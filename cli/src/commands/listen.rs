use std::time::{Duration, Instant};

use anyhow::Result;
use chrono::{DateTime, Local, Utc};
use futures_util::StreamExt;
use reqwest::header;
use serde::Deserialize;
use serde_json::Value;
use url::Url;

use crate::api::signature::{SIGNATURE_HEADER, TIMESTAMP_HEADER, sign};
use crate::api::sse::{SseEvent, SseItem, SseParser};
use crate::api::{ApiError, Client, Query};
use crate::app::{App, ModeParam};
use crate::backoff::Backoff;
use crate::cli::ListenArgs;
use crate::output::{err, out};
use crate::util::Style;

pub const STREAM_PATH: &str = "/v1/webhook-listeners/stream";
const FORWARD_TIMEOUT: Duration = Duration::from_secs(30);
/// The server pings every 15s; three missed pings means the connection is dead.
const IDLE_TIMEOUT: Duration = Duration::from_secs(45);
/// After a deploy, the old process's listeners count against the limit for up to 45s.
const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(60);

/// Test hooks: shrink reconnect and idle timings so integration tests run in milliseconds.
const BACKOFF_UNIT_ENV: &str = "CHECKOUTPAGE_BACKOFF_UNIT_MS";
const IDLE_TIMEOUT_ENV: &str = "CHECKOUTPAGE_IDLE_TIMEOUT_MS";
const RATE_LIMIT_WINDOW_ENV: &str = "CHECKOUTPAGE_RATE_LIMIT_WINDOW_MS";

fn env_ms(name: &str) -> Option<Duration> {
    std::env::var(name)
        .ok()?
        .parse()
        .ok()
        .map(Duration::from_millis)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ready {
    pub id: String,
    pub secret: String,
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

#[derive(Debug)]
enum SessionEnd {
    Expired,
    Dropped(String),
}

pub struct Settings {
    pub events: Vec<String>,
    pub forward_to: Option<Url>,
    pub skip_verify: bool,
    pub print_json: bool,
    pub backoff_unit: Duration,
    pub idle_timeout: Duration,
    pub rate_limit_window: Duration,
}

pub async fn run(app: &App, args: &ListenArgs) -> Result<()> {
    app.reject_csv("webhooks listen")?;
    app.mode_query(ModeParam::None, "webhooks listen")?;
    let client = app.client().await?;
    let settings = Settings {
        events: args
            .events
            .iter()
            .map(|e| e.trim().to_string())
            .filter(|e| !e.is_empty())
            .collect(),
        forward_to: args.forward_to.clone(),
        skip_verify: args.skip_verify,
        print_json: args.print_json,
        backoff_unit: env_ms(BACKOFF_UNIT_ENV).unwrap_or(Duration::from_secs(1)),
        idle_timeout: env_ms(IDLE_TIMEOUT_ENV).unwrap_or(IDLE_TIMEOUT),
        rate_limit_window: env_ms(RATE_LIMIT_WINDOW_ENV).unwrap_or(RATE_LIMIT_WINDOW),
    };
    let mut listener = Listener::new(client, settings, app.out_style, app.err_style)?;
    tokio::select! {
        result = listener.run() => result,
        _ = tokio::signal::ctrl_c() => {
            err("\nStopped listening.");
            Ok(())
        }
    }
}

pub struct Listener {
    client: Client,
    settings: Settings,
    forwarder: Option<Forwarder>,
    secret: Option<String>,
    rate_limited_since: Option<Instant>,
    out_style: Style,
    err_style: Style,
}

impl Listener {
    pub fn new(
        client: Client,
        settings: Settings,
        out_style: Style,
        err_style: Style,
    ) -> Result<Self> {
        let forwarder = match &settings.forward_to {
            Some(url) => Some(Forwarder::new(url.clone(), settings.skip_verify)?),
            None => None,
        };
        Ok(Listener {
            client,
            settings,
            forwarder,
            secret: None,
            rate_limited_since: None,
            out_style,
            err_style,
        })
    }

    pub async fn run(&mut self) -> Result<()> {
        let mut query = Query::new();
        if !self.settings.events.is_empty() {
            query.push(("events".into(), self.settings.events.join(",")));
        }
        let mut backoff = Backoff::new(self.settings.backoff_unit);
        loop {
            let (reason, wait_at_least) = match self.session(&query, &mut backoff).await {
                Ok(SessionEnd::Expired) => {
                    err(self
                        .err_style
                        .yellow("The listener reached its 60 minute limit. Reconnecting..."));
                    continue;
                }
                Ok(SessionEnd::Dropped(reason)) => (reason, Duration::ZERO),
                Err(e @ ApiError::RateLimit { retry_after, .. }) if self.secret.is_some() => {
                    let since = *self.rate_limited_since.get_or_insert_with(Instant::now);
                    if since.elapsed() >= self.settings.rate_limit_window {
                        return Err(e.into());
                    }
                    (e.to_string(), Duration::from_secs(retry_after.unwrap_or(0)))
                }
                Err(e) if e.is_transient() => (e.to_string(), Duration::ZERO),
                Err(e) => return Err(e.into()),
            };
            let delay = backoff.next_delay().max(wait_at_least);
            err(self.err_style.yellow(&format!(
                "{reason}. Reconnecting in {}...",
                human_delay(delay)
            )));
            tokio::time::sleep(delay).await;
        }
    }

    async fn session(
        &mut self,
        query: &Query,
        backoff: &mut Backoff,
    ) -> Result<SessionEnd, ApiError> {
        let opened = tokio::time::timeout(
            self.settings.idle_timeout,
            self.client.open_event_stream(STREAM_PATH, query),
        )
        .await;
        let Ok(resp) = opened else {
            return Ok(SessionEnd::Dropped(format!(
                "No response from the server for {}",
                human_delay(self.settings.idle_timeout)
            )));
        };
        let resp = resp?;
        let mut stream = resp.bytes_stream();
        let mut parser = SseParser::new();
        loop {
            let chunk = match tokio::time::timeout(self.settings.idle_timeout, stream.next()).await
            {
                Err(_) => {
                    return Ok(SessionEnd::Dropped(format!(
                        "No heartbeat from the server for {}",
                        human_delay(self.settings.idle_timeout)
                    )));
                }
                Ok(None) => {
                    return Ok(SessionEnd::Dropped(
                        "The server closed the connection".into(),
                    ));
                }
                Ok(Some(Err(e))) => {
                    return Ok(SessionEnd::Dropped(format!(
                        "Lost the connection ({})",
                        crate::api::describe_reqwest(&e)
                    )));
                }
                Ok(Some(Ok(bytes))) => bytes,
            };
            for item in parser.feed(&chunk) {
                let event = match item {
                    SseItem::Event(event) => event,
                    SseItem::TooLarge => {
                        return Ok(SessionEnd::Dropped(
                            "The server sent a message larger than 1 MiB".into(),
                        ));
                    }
                    _ => continue,
                };
                match event.event.as_str() {
                    "ready" => {
                        self.on_ready(&event);
                        backoff.reset();
                    }
                    "webhook" => self.on_webhook(&event).await,
                    "expired" => return Ok(SessionEnd::Expired),
                    _ => {}
                }
            }
        }
    }

    fn on_ready(&mut self, event: &SseEvent) {
        let ready: Ready = match serde_json::from_str(&event.data) {
            Ok(r) => r,
            Err(e) => {
                err(self
                    .err_style
                    .red(&format!("Couldn't read the ready message: {e}")));
                return;
            }
        };
        let e = &self.err_style;
        match self.secret.as_deref() {
            None => {
                let what = if self.settings.events.is_empty() {
                    "all events".to_string()
                } else {
                    ready.events.join(", ")
                };
                err(format!("{} Listening for {what}.", e.green("Ready!")));
                match &self.settings.forward_to {
                    Some(url) => err(format!("Forwarding to {url}")),
                    None => err(
                        e.dim("Not forwarding. Add --forward-to <url> to send events to your app.")
                    ),
                }
                err(format!("Webhook signing secret: {}", e.bold(&ready.secret)));
                err(e.dim("Press Ctrl-C to stop."));
            }
            Some(old) if old != ready.secret => {
                err(e.yellow("Reconnected with a new listener, and the signing secret changed."));
                err(format!("Webhook signing secret: {}", e.bold(&ready.secret)));
                err(e.yellow("Update the secret your endpoint verifies with."));
            }
            Some(_) => err(e.green("Reconnected.")),
        }
        self.secret = Some(ready.secret);
        self.rate_limited_since = None;
    }

    async fn on_webhook(&self, event: &SseEvent) {
        let payload: Option<Value> = serde_json::from_str(&event.data).ok();
        let name = payload
            .as_ref()
            .and_then(|p| p.get("event"))
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        let id = payload
            .as_ref()
            .and_then(|p| p.get("event_id").or_else(|| p.get("eventId")))
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| event.id.clone())
            .unwrap_or_else(|| "-".into());
        let is_test = payload
            .as_ref()
            .and_then(|p| p.get("test"))
            .and_then(Value::as_bool)
            .unwrap_or(false);

        if self.settings.print_json {
            out(&event.data);
        }
        let line = match &self.forwarder {
            None => format_line(Local::now(), &name, &id, None, &self.out_style),
            Some(f) => {
                let delivery = match self.secret.as_deref() {
                    Some(secret) => f.forward(event.data.as_bytes(), secret, is_test).await,
                    None => Delivery::failed("no signing secret yet", Duration::ZERO),
                };
                format_line(Local::now(), &name, &id, Some(&delivery), &self.out_style)
            }
        };
        if self.settings.print_json {
            err(line);
        } else {
            out(line);
        }
    }
}

fn human_delay(d: Duration) -> String {
    if d.as_millis() < 1000 {
        format!("{}ms", d.as_millis())
    } else {
        format!("{}s", d.as_secs())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Delivery {
    pub status: Option<u16>,
    pub error: Option<String>,
    pub elapsed: Duration,
}

impl Delivery {
    fn failed(message: &str, elapsed: Duration) -> Self {
        Delivery {
            status: None,
            error: Some(message.to_string()),
            elapsed,
        }
    }
}

pub fn format_line(
    at: DateTime<Local>,
    event: &str,
    id: &str,
    delivery: Option<&Delivery>,
    style: &Style,
) -> String {
    let time = at.format("%H:%M:%S");
    let prefix = format!("{time}  {event}  {id}");
    match delivery {
        None => prefix,
        Some(Delivery {
            status: Some(s),
            elapsed,
            ..
        }) => {
            let status = if (200..300).contains(s) {
                style.green(&s.to_string())
            } else {
                style.red(&s.to_string())
            };
            format!("{prefix}  -> {status} ({}ms)", elapsed.as_millis())
        }
        Some(d) => format!(
            "{prefix}  -> {}",
            style.red(&format!(
                "error: {}",
                d.error.as_deref().unwrap_or("unknown error")
            ))
        ),
    }
}

pub struct Forwarder {
    http: reqwest::Client,
    url: Url,
}

impl Forwarder {
    pub fn new(url: Url, skip_verify: bool) -> Result<Self> {
        let http = reqwest::Client::builder()
            .danger_accept_invalid_certs(skip_verify)
            .redirect(reqwest::redirect::Policy::none())
            .timeout(FORWARD_TIMEOUT)
            .build()?;
        Ok(Forwarder { http, url })
    }

    /// POSTs `body` byte for byte; the signature covers exactly these bytes.
    pub async fn forward(&self, body: &[u8], secret: &str, is_test: bool) -> Delivery {
        let mut req = self
            .http
            .post(self.url.clone())
            .header(header::CONTENT_TYPE, "application/json")
            .header(
                header::USER_AGENT,
                format!("Checkout-Page-CLI/{}", env!("CARGO_PKG_VERSION")),
            )
            .header(SIGNATURE_HEADER, sign(secret, body))
            .header(TIMESTAMP_HEADER, Utc::now().timestamp_millis().to_string())
            .header("X-Webhook-Delivery-Attempt", "1")
            .body(body.to_vec());
        if is_test {
            req = req.header("X-Webhook-Test", "true");
        }
        let started = Instant::now();
        match req.send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let _ = resp.bytes().await;
                Delivery {
                    status: Some(status),
                    error: None,
                    elapsed: started.elapsed(),
                }
            }
            Err(e) => Delivery::failed(&short_error(&e), started.elapsed()),
        }
    }
}

/// The innermost cause ("Connection refused (os error 61)") is the part worth showing.
fn short_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        return format!("timed out after {}s", FORWARD_TIMEOUT.as_secs());
    }
    let mut msg = e.to_string();
    let mut source = std::error::Error::source(e);
    while let Some(s) = source {
        msg = s.to_string();
        source = s.source();
    }
    msg
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at() -> DateTime<Local> {
        Local.with_ymd_and_hms(2026, 10, 22, 9, 5, 7).unwrap()
    }

    #[test]
    fn status_lines() {
        let plain = Style { enabled: false };
        assert_eq!(
            format_line(at(), "payment.paid", "evt_1", None, &plain),
            "09:05:07  payment.paid  evt_1"
        );
        let ok = Delivery {
            status: Some(200),
            error: None,
            elapsed: Duration::from_millis(42),
        };
        assert_eq!(
            format_line(at(), "payment.paid", "evt_1", Some(&ok), &plain),
            "09:05:07  payment.paid  evt_1  -> 200 (42ms)"
        );
        let bad = Delivery::failed("Connection refused (os error 61)", Duration::from_millis(1));
        assert_eq!(
            format_line(at(), "booking.paid", "evt_2", Some(&bad), &plain),
            "09:05:07  booking.paid  evt_2  -> error: Connection refused (os error 61)"
        );
        let colored = Style { enabled: true };
        let line = format_line(at(), "x", "y", Some(&ok), &colored);
        assert!(line.contains("\x1b[32m200\x1b[0m"));
        let five = Delivery {
            status: Some(500),
            ..ok
        };
        assert!(format_line(at(), "x", "y", Some(&five), &colored).contains("\x1b[31m500"));
    }

    #[test]
    fn ready_payload() {
        let r: Ready = serde_json::from_str(
            r#"{"id":"wl_0123456789abcdef01234567","secret":"ab","events":["payment.paid"],"expiresAt":"2026-10-22T10:00:00.000Z"}"#,
        )
        .unwrap();
        assert_eq!(r.secret, "ab");
        assert_eq!(r.events, ["payment.paid"]);
        assert!(serde_json::from_str::<Ready>(r#"{"id":"x"}"#).is_err());
    }

    #[test]
    fn delays_read_naturally() {
        assert_eq!(human_delay(Duration::from_millis(20)), "20ms");
        assert_eq!(human_delay(Duration::from_secs(4)), "4s");
    }
}
