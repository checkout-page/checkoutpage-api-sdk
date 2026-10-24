//! Opt-in: skipped unless `CHECKOUTPAGE_LIVE_API_KEY` and `CHECKOUTPAGE_LIVE_BASE_URL` are set.
//! The tests share one seller and its 5-listener cap, so they run one at a time.

mod common;

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::sync::mpsc::{Receiver as MpscReceiver, channel};
use std::sync::{Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use common::{Env, Proc};
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

const WAIT: Duration = Duration::from_secs(30);
/// How long to keep watching for a delivery that must not arrive.
const QUIET: Duration = Duration::from_secs(5);

static SERIAL: Mutex<()> = Mutex::new(());

struct Live {
    key: String,
    base_url: String,
    _serial: MutexGuard<'static, ()>,
}

fn live(test: &str) -> Option<Live> {
    let key = std::env::var("CHECKOUTPAGE_LIVE_API_KEY").unwrap_or_default();
    let base_url = std::env::var("CHECKOUTPAGE_LIVE_BASE_URL").unwrap_or_default();
    if key.is_empty() || base_url.is_empty() {
        eprintln!(
            "skipping {test}: set CHECKOUTPAGE_LIVE_API_KEY and CHECKOUTPAGE_LIVE_BASE_URL to run the live listen tests"
        );
        return None;
    }
    let serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let live = Live {
        key,
        base_url,
        _serial: serial,
    };
    live.wait_for_no_listeners();
    Some(live)
}

fn marker() -> String {
    format!("cli-live-listen-{:08x}", rand::random::<u32>())
}

fn sign(secret: &str, body: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(body);
    format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
}

impl Live {
    fn cmd_as(&self, key: &str, env: &Env) -> std::process::Command {
        let mut c = env.std_cmd();
        c.env("CHECKOUTPAGE_API_KEY", key)
            .env("CHECKOUTPAGE_BASE_URL", &self.base_url);
        c
    }

    fn cmd(&self, env: &Env) -> std::process::Command {
        self.cmd_as(&self.key, env)
    }

    fn listen(&self, extra: &[&str]) -> Listener {
        self.listen_as(&self.key, extra)
    }

    fn listen_as(&self, key: &str, extra: &[&str]) -> Listener {
        let env = Env::new();
        let mut cmd = self.cmd_as(key, &env);
        cmd.args(["webhooks", "listen"]).args(extra);
        let mut proc = Proc::spawn(cmd);
        let line = proc.wait_for("Webhook signing secret: ", WAIT);
        let secret = line
            .rsplit("Webhook signing secret: ")
            .next()
            .unwrap()
            .trim()
            .to_string();
        assert_eq!(secret.len(), 64, "secret is 64 hex chars: {line}");
        assert!(secret.chars().all(|c| c.is_ascii_hexdigit()), "{line}");
        Listener {
            proc,
            secret,
            _env: env,
        }
    }

    fn run_as(&self, key: &str, args: &[&str]) -> (Option<i32>, String, String) {
        let env = Env::new();
        let out = self
            .cmd_as(key, &env)
            .args(args)
            .output()
            .expect("run checkoutpage");
        (
            out.status.code(),
            String::from_utf8_lossy(&out.stdout).into_owned(),
            String::from_utf8_lossy(&out.stderr).into_owned(),
        )
    }

    fn trigger_as(&self, key: &str, event: &str) -> (u64, String) {
        let (code, stdout, stderr) = self.run_as(key, &["--json", "webhooks", "trigger", event]);
        assert_eq!(code, Some(0), "trigger failed: {stdout}\n{stderr}");
        let v: Value = serde_json::from_str(&stdout).expect("trigger --json prints JSON");
        let v = v.get("data").filter(|d| d.is_object()).unwrap_or(&v);
        (
            v["delivered"].as_u64().expect("delivered"),
            v["eventId"].as_str().expect("eventId").to_string(),
        )
    }

    fn trigger(&self, event: &str) -> (u64, String) {
        self.trigger_as(&self.key, event)
    }

    fn api(&self, method: &str, path: &str, data: Option<&Value>) -> Value {
        let mut args = vec!["api".to_string(), method.into(), path.into()];
        if let Some(d) = data {
            args.push("--data".into());
            args.push(d.to_string());
        }
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let (code, stdout, stderr) = self.run_as(&self.key, &args);
        assert_eq!(code, Some(0), "{method} {path} failed: {stdout}\n{stderr}");
        let v: Value = serde_json::from_str(&stdout).expect("api prints JSON");
        v.get("data").cloned().unwrap_or(v)
    }

    /// Listeners closed by an earlier test (or a crashed run) can linger until the server
    /// notices the socket closed, or for the 45s Redis TTL at worst.
    fn wait_for_no_listeners(&self) {
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            let (delivered, _) = self.trigger("customer.created");
            if delivered == 0 {
                return;
            }
            assert!(
                Instant::now() < deadline,
                "{delivered} listener(s) still open on this seller after 60s; is another `webhooks listen` running?"
            );
            thread::sleep(Duration::from_millis(500));
        }
    }
}

struct Listener {
    proc: Proc,
    secret: String,
    _env: Env,
}

struct PageCleanup<'a> {
    live: &'a Live,
    id: String,
}

impl Drop for PageCleanup<'_> {
    fn drop(&mut self) {
        let path = format!("/v1/checkout-pages/{}", self.id);
        let (code, stdout, stderr) = self.live.run_as(&self.live.key, &["api", "DELETE", &path]);
        if code != Some(0) {
            eprintln!(
                "could not archive test page {}: {stdout}\n{stderr}",
                self.id
            );
        }
    }
}

#[derive(Debug, Clone)]
struct Received {
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl Received {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }

    fn json(&self) -> Value {
        serde_json::from_slice(&self.body).expect("delivery body is JSON")
    }

    fn event_id(&self) -> String {
        self.json()["event_id"].as_str().unwrap_or("").to_string()
    }
}

struct Receiver {
    url: String,
    rx: MpscReceiver<Received>,
    seen: Vec<Received>,
}

impl Receiver {
    fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/hook", listener.local_addr().unwrap());
        let (tx, rx) = channel();
        thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let tx = tx.clone();
                thread::spawn(move || {
                    let Some(req) = read_request(&mut stream) else {
                        return;
                    };
                    let _ = stream.write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
                    );
                    let _ = stream.flush();
                    let _ = tx.send(req);
                });
            }
        });
        Receiver {
            url,
            rx,
            seen: Vec::new(),
        }
    }

    fn drain(&mut self) {
        while let Ok(r) = self.rx.try_recv() {
            self.seen.push(r);
        }
    }

    fn wait_for(&mut self, what: &str, pred: impl Fn(&Received) -> bool) -> Received {
        self.wait_until(&pred, WAIT).unwrap_or_else(|| {
            panic!(
                "timed out after {WAIT:?} waiting for a delivery of {what}. Received:\n{}",
                self.describe()
            )
        })
    }

    fn wait_until(
        &mut self,
        pred: impl Fn(&Received) -> bool,
        timeout: Duration,
    ) -> Option<Received> {
        self.drain();
        if let Some(r) = self.seen.iter().find(|r| pred(r)) {
            return Some(r.clone());
        }
        let deadline = Instant::now() + timeout;
        loop {
            let left = deadline.checked_duration_since(Instant::now())?;
            let r = self.rx.recv_timeout(left).ok()?;
            self.seen.push(r.clone());
            if pred(&r) {
                return Some(r);
            }
        }
    }

    fn assert_never(&mut self, what: &str, pred: impl Fn(&Received) -> bool) {
        if let Some(r) = self.wait_until(&pred, QUIET) {
            panic!(
                "unexpected delivery of {what}: {}",
                String::from_utf8_lossy(&r.body)
            );
        }
    }

    fn describe(&mut self) -> String {
        self.drain();
        self.seen
            .iter()
            .map(|r| {
                String::from_utf8_lossy(&r.body)
                    .chars()
                    .take(300)
                    .collect::<String>()
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

fn read_request(stream: &mut std::net::TcpStream) -> Option<Received> {
    let mut reader = BufReader::new(stream.try_clone().ok()?);
    let mut first = String::new();
    reader.read_line(&mut first).ok()?;
    let mut parts = first.split_whitespace();
    let method = parts.next()?.to_string();
    let path = parts.next()?.to_string();
    let mut headers = Vec::new();
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).ok()?;
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            headers.push((k.trim().to_string(), v.trim().to_string()));
        }
    }
    let len: usize = headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, v)| v.parse().ok())
        .unwrap_or(0);
    let mut body = vec![0; len];
    reader.read_exact(&mut body).ok()?;
    assert_eq!(method, "POST", "the CLI forwards with POST");
    Some(Received {
        path,
        headers,
        body,
    })
}

fn assert_signed_delivery(r: &Received, secret: &str, is_test: bool) {
    assert_eq!(r.path, "/hook");
    assert_eq!(r.header("content-type"), Some("application/json"));
    assert_eq!(
        r.header("user-agent"),
        Some(format!("Checkout-Page-CLI/{}", env!("CARGO_PKG_VERSION")).as_str())
    );
    assert_eq!(
        r.header("x-webhook-signature"),
        Some(sign(secret, &r.body).as_str()),
        "the signature verifies with the secret the CLI printed"
    );
    let ts: i64 = r
        .header("x-webhook-timestamp")
        .expect("X-Webhook-Timestamp")
        .parse()
        .expect("timestamp is ms since epoch");
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    assert!(
        (now - ts).abs() < 120_000,
        "timestamp {ts} is close to now {now}"
    );
    assert_eq!(r.header("x-webhook-delivery-attempt"), Some("1"));
    assert_eq!(
        r.header("x-webhook-test"),
        is_test.then_some("true"),
        "X-Webhook-Test only on test events"
    );
    let p = r.json();
    for key in [
        "event",
        "data",
        "seller_id",
        "sellerId",
        "timestamp",
        "event_id",
        "eventId",
        "api_version",
    ] {
        assert!(p.get(key).is_some(), "payload has {key}: {p}");
    }
    assert_eq!(p["event_id"], p["eventId"]);
    assert_eq!(p["seller_id"], p["sellerId"]);
}

fn status_line_for(l: &mut Listener, event_id: &str) -> String {
    l.proc.wait_for(event_id, WAIT)
}

#[test]
fn live_trigger_is_forwarded_signed_with_the_printed_secret() {
    let Some(live) = live("live_trigger_is_forwarded_signed_with_the_printed_secret") else {
        return;
    };
    let started = Instant::now();
    let mut rx = Receiver::start();
    let mut l = live.listen(&["--forward-to", &rx.url]);
    l.proc.wait_for("Ready! Listening for all events.", WAIT);
    l.proc.wait_for(&format!("Forwarding to {}", rx.url), WAIT);

    let (delivered, event_id) = live.trigger("checkout_page.created");
    assert_eq!(delivered, 1);
    assert!(
        event_id.starts_with("checkout_page.created_test_"),
        "{event_id}"
    );

    let r = rx.wait_for(&event_id, |r| r.event_id() == event_id);
    assert_signed_delivery(&r, &l.secret, true);
    let p = r.json();
    assert_eq!(p["event"], "checkout_page.created");
    assert_eq!(p["test"], true);
    assert_eq!(p["data"]["test"], true);
    assert!(p["data"]["message"].is_string(), "{p}");
    assert_eq!(p["api_version"], "v1");

    let line = status_line_for(&mut l, &event_id);
    assert!(line.starts_with("out: "), "{line}");
    assert!(
        line.contains(&format!("  checkout_page.created  {event_id}  -> 200 (")),
        "{line}"
    );
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_real_checkout_page_events_reach_the_listener() {
    let Some(live) = live("live_real_checkout_page_events_reach_the_listener") else {
        return;
    };
    let started = Instant::now();
    let mut rx = Receiver::start();
    let mut l = live.listen(&[
        "--events",
        "checkout_page.created,checkout_page.updated",
        "--forward-to",
        &rx.url,
    ]);

    let name = marker();
    let page = live.api(
        "POST",
        "/v1/checkout-pages/",
        Some(&json!({ "name": name })),
    );
    let id = page["id"].as_str().expect("created page id").to_string();
    let seller_id = page["sellerId"].as_str().expect("sellerId").to_string();
    let _cleanup = PageCleanup {
        live: &live,
        id: id.clone(),
    };

    let created = rx.wait_for("checkout_page.created for the new page", |r| {
        let p = r.json();
        p["event"] == "checkout_page.created" && p["data"]["checkoutPage"]["id"] == id.as_str()
    });
    assert_signed_delivery(&created, &l.secret, false);
    let p = created.json();
    assert_eq!(p["event_id"], format!("checkout_page_created_{id}"));
    assert_eq!(p["data"]["checkoutPage"]["name"], name.as_str());
    assert_eq!(p["seller_id"], seller_id.as_str());
    assert!(p.get("test").is_none(), "a real event is not marked test");
    let line = status_line_for(&mut l, &format!("checkout_page_created_{id}"));
    assert!(line.contains("  -> 200 ("), "{line}");

    let renamed = format!("{name}-renamed");
    live.api(
        "PATCH",
        &format!("/v1/checkout-pages/{id}"),
        Some(&json!({ "name": renamed })),
    );
    let updated = rx.wait_for("checkout_page.updated for the rename", |r| {
        let p = r.json();
        p["event"] == "checkout_page.updated"
            && p["data"]["checkoutPage"]["id"] == id.as_str()
            && p["data"]["checkoutPage"]["name"] == renamed.as_str()
    });
    assert_signed_delivery(&updated, &l.secret, false);
    assert!(
        updated
            .event_id()
            .starts_with(&format!("checkout_page_updated_{id}_")),
        "{}",
        updated.event_id()
    );

    rx.assert_never("product.created to a checkout_page.* listener", |r| {
        r.json()["event"] == "product.created"
    });
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_event_filter_only_delivers_matching_events() {
    let Some(live) = live("live_event_filter_only_delivers_matching_events") else {
        return;
    };
    let started = Instant::now();
    let mut filtered_rx = Receiver::start();
    let mut all_rx = Receiver::start();
    let mut filtered = live.listen(&["--events", "payment.paid", "--forward-to", &filtered_rx.url]);
    filtered
        .proc
        .wait_for("Ready! Listening for payment.paid.", WAIT);
    let all = live.listen(&["--forward-to", &all_rx.url]);

    let (delivered, page_event) = live.trigger("checkout_page.created");
    assert_eq!(delivered, 1, "only the unfiltered listener matches");
    let r = all_rx.wait_for(&page_event, |r| r.event_id() == page_event);
    assert_signed_delivery(&r, &all.secret, true);

    let (delivered, paid_event) = live.trigger("payment.paid");
    assert_eq!(delivered, 2, "payment.paid matches both listeners");
    let r = filtered_rx.wait_for(&paid_event, |r| r.event_id() == paid_event);
    assert_signed_delivery(&r, &filtered.secret, true);
    all_rx.wait_for(&paid_event, |r| r.event_id() == paid_event);

    filtered_rx.assert_never("checkout_page.created to a payment.paid listener", |r| {
        r.event_id() == page_event
    });
    assert_eq!(filtered.proc.count(&page_event), 0);

    let name = marker();
    let page = live.api(
        "POST",
        "/v1/checkout-pages/",
        Some(&json!({ "name": name })),
    );
    let id = page["id"].as_str().expect("created page id").to_string();
    let _cleanup = PageCleanup {
        live: &live,
        id: id.clone(),
    };
    let real_id = format!("checkout_page_created_{id}");
    all_rx.wait_for(&real_id, |r| r.event_id() == real_id);
    filtered_rx.assert_never(
        "a real checkout_page.created to a payment.paid listener",
        |r| r.event_id() == real_id,
    );
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_fan_out_delivers_one_event_to_every_listener() {
    let Some(live) = live("live_fan_out_delivers_one_event_to_every_listener") else {
        return;
    };
    let started = Instant::now();
    let mut rx_a = Receiver::start();
    let mut rx_b = Receiver::start();
    let a = live.listen(&["--forward-to", &rx_a.url]);
    let b = live.listen(&["--forward-to", &rx_b.url]);
    assert_ne!(a.secret, b.secret, "each listener gets its own secret");

    let (delivered, event_id) = live.trigger("booking.paid");
    assert_eq!(delivered, 2);
    let ra = rx_a.wait_for(&event_id, |r| r.event_id() == event_id);
    let rb = rx_b.wait_for(&event_id, |r| r.event_id() == event_id);
    assert_eq!(ra.body, rb.body, "both get the same payload bytes");
    assert_signed_delivery(&ra, &a.secret, true);
    assert_signed_delivery(&rb, &b.secret, true);
    assert_ne!(
        ra.header("x-webhook-signature"),
        rb.header("x-webhook-signature")
    );
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_sixth_listener_is_refused_until_one_closes() {
    let Some(live) = live("live_sixth_listener_is_refused_until_one_closes") else {
        return;
    };
    let started = Instant::now();
    let mut open: Vec<Listener> = (0..5).map(|_| live.listen(&[])).collect();
    let (delivered, _) = live.trigger("customer.updated");
    assert_eq!(delivered, 5);

    let env = Env::new();
    let mut cmd = live.cmd(&env);
    cmd.args(["webhooks", "listen"]);
    let mut sixth = Proc::spawn(cmd);
    let status = sixth.wait_exit(WAIT);
    let output = sixth.drain();
    assert_eq!(status.code(), Some(7), "429 exits 7: {output}");
    assert!(
        output.contains("Too many webhook listeners: at most 5 can be open at once"),
        "{output}"
    );
    assert!(
        !output.contains("Reconnecting"),
        "a 429 is not retried: {output}"
    );

    drop(open.pop());
    let freed = Instant::now();
    let deadline = freed + WAIT;
    let replacement = loop {
        let env = Env::new();
        let mut cmd = live.cmd(&env);
        cmd.args(["webhooks", "listen"]);
        let mut p = Proc::spawn(cmd);
        let hit = p.wait_until(
            |l| l.contains("Webhook signing secret: ") || l.contains("Too many webhook listeners"),
            WAIT,
        );
        match hit {
            Some(l) if l.contains("Webhook signing secret: ") => break p,
            _ => {
                assert!(
                    Instant::now() < deadline,
                    "no slot freed within {WAIT:?} of closing a listener: {}",
                    p.drain()
                );
                thread::sleep(Duration::from_millis(250));
            }
        }
    };
    eprintln!("slot freed after {:?}", freed.elapsed());
    let (delivered, _) = live.trigger("customer.updated");
    assert_eq!(delivered, 5);
    drop(replacement);
    drop(open);
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_print_json_writes_the_payload_to_stdout() {
    let Some(live) = live("live_print_json_writes_the_payload_to_stdout") else {
        return;
    };
    let started = Instant::now();
    let mut l = live.listen(&["--print-json"]);
    l.proc.wait_for("Not forwarding.", WAIT);

    let (delivered, event_id) = live.trigger("submission.created");
    assert_eq!(delivered, 1);
    let line = l
        .proc
        .wait_until(|l| l.starts_with("out: {") && l.contains(&event_id), WAIT)
        .unwrap_or_else(|| panic!("no JSON on stdout:\n{}", l.proc.drain()));
    let p: Value = serde_json::from_str(line.trim_start_matches("out: ")).expect("one JSON line");
    assert_eq!(p["event"], "submission.created");
    assert_eq!(p["event_id"], event_id.as_str());
    assert_eq!(p["test"], true);

    let status = l.proc.wait_until(
        |l| l.starts_with("err: ") && l.contains(&format!("  submission.created  {event_id}")),
        WAIT,
    );
    assert!(
        status.is_some(),
        "status line goes to stderr: {}",
        l.proc.drain()
    );
    l.proc.drain();
    let stdout: Vec<_> = l
        .proc
        .lines
        .iter()
        .filter(|l| l.starts_with("out: "))
        .collect();
    assert_eq!(
        stdout.len(),
        1,
        "stdout carries only the payload: {stdout:?}"
    );
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_unknown_event_filter_is_refused() {
    let Some(live) = live("live_unknown_event_filter_is_refused") else {
        return;
    };
    let started = Instant::now();
    let env = Env::new();
    let mut cmd = live.cmd(&env);
    cmd.args([
        "webhooks",
        "listen",
        "--events",
        "payment.paid,not.an.event",
    ]);
    let mut p = Proc::spawn(cmd);
    let status = p.wait_exit(WAIT);
    let output = p.drain();
    assert_eq!(status.code(), Some(5), "400 exits 5: {output}");
    assert!(output.contains("Unknown event: not.an.event"), "{output}");
    assert!(!output.contains("Ready!"), "{output}");
    let (delivered, _) = live.trigger("payment.paid");
    assert_eq!(delivered, 0, "no listener was registered");
    eprintln!("took {:?}", started.elapsed());
}

#[test]
fn live_other_sellers_listener_gets_nothing() {
    let Some(live) = live("live_other_sellers_listener_gets_nothing") else {
        return;
    };
    let second = std::env::var("CHECKOUTPAGE_LIVE_SECOND_API_KEY").unwrap_or_default();
    if second.is_empty() {
        eprintln!(
            "skipping live_other_sellers_listener_gets_nothing: set CHECKOUTPAGE_LIVE_SECOND_API_KEY to a key for a different seller"
        );
        return;
    }
    let started = Instant::now();
    let mut mine_rx = Receiver::start();
    let mut other_rx = Receiver::start();
    let mine = live.listen(&["--forward-to", &mine_rx.url]);
    let other = live.listen_as(&second, &["--forward-to", &other_rx.url]);

    let (delivered, event_id) = live.trigger("payment.paid");
    assert_eq!(delivered, 1, "the other seller's listener is not counted");
    let r = mine_rx.wait_for(&event_id, |r| r.event_id() == event_id);
    assert_signed_delivery(&r, &mine.secret, true);

    let name = marker();
    let page = live.api(
        "POST",
        "/v1/checkout-pages/",
        Some(&json!({ "name": name })),
    );
    let id = page["id"].as_str().expect("created page id").to_string();
    let _cleanup = PageCleanup {
        live: &live,
        id: id.clone(),
    };
    let real_id = format!("checkout_page_created_{id}");
    mine_rx.wait_for(&real_id, |r| r.event_id() == real_id);
    other_rx.assert_never("this seller's events to another seller", |r| {
        r.event_id() == event_id || r.event_id() == real_id
    });

    let (delivered, theirs) = live.trigger_as(&second, "payment.paid");
    assert_eq!(delivered, 1);
    let r = other_rx.wait_for(&theirs, |r| r.event_id() == theirs);
    assert_signed_delivery(&r, &other.secret, true);
    mine_rx.assert_never("another seller's event", |r| r.event_id() == theirs);
    eprintln!("took {:?}", started.elapsed());
}
