mod common;

use std::time::Duration;

use common::{Conn, Env, Proc, SseServer, Step, closed_port, ready_frame, webhook_frame};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

const SECRET_A: &str = "aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000";
const SECRET_B: &str = "bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111";
const WAIT: Duration = Duration::from_secs(20);

fn node_style_signature(secret: &str, body: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(body);
    format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
}

fn payload(event: &str, id: &str, extra: &str) -> String {
    format!(
        r#"{{"event":"{event}","data":{{"id":"p1","amount":1999,"currency":"usd","note":"café ☕"}},"seller_id":"s1","sellerId":"s1","timestamp":"2026-10-22T10:00:00.000Z","event_id":"{id}","eventId":"{id}","api_version":"v1"{extra}}}"#
    )
}

fn listen(env: &Env, sse: &SseServer, extra: &[&str]) -> Proc {
    let mut cmd = env.std_cmd();
    cmd.env("CHECKOUTPAGE_BACKOFF_UNIT_MS", "10")
        .args([
            "webhooks",
            "listen",
            "--base-url",
            &sse.base_url,
            "--api-key",
            "sk_test_key",
        ])
        .args(extra);
    Proc::spawn(cmd)
}

async fn receiver() -> MockServer {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/hook"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&server)
        .await;
    server
}

#[tokio::test(flavor = "multi_thread")]
async fn forwards_signed_exact_bytes_and_prints_one_line_per_delivery() {
    let first = payload("payment.paid", "evt_1", "");
    let second = payload("booking.paid", "evt_2", r#","test":true"#);
    let sse = SseServer::start(vec![Conn::Stream(vec![
        Step::Send(": connected\n\n".into()),
        Step::Send(ready_frame(SECRET_A, &["payment.paid", "booking.paid"])),
        Step::Send(": ping\n\n".into()),
        Step::Send(webhook_frame("evt_1", &first).replace('\n', "\r\n")),
        Step::Send(": ping\n\n".into()),
        Step::Send(webhook_frame("evt_2", &second)),
        Step::Hold,
    ])]);
    let target = receiver().await;
    let env = Env::new();
    let mut proc = listen(
        &env,
        &sse,
        &[
            "--events",
            "payment.paid,booking.paid",
            "--forward-to",
            &format!("{}/hook", target.uri()),
        ],
    );

    proc.wait_for("Ready! Listening for payment.paid, booking.paid.", WAIT);
    proc.wait_for(&format!("Webhook signing secret: {SECRET_A}"), WAIT);
    proc.wait_for(&format!("Forwarding to {}/hook", target.uri()), WAIT);
    let line1 = proc.wait_for("evt_1", WAIT);
    let line2 = proc.wait_for("evt_2", WAIT);
    assert!(line1.starts_with("out: "), "{line1}");
    let re_ok = |l: &str, event: &str, id: &str| {
        let rest = l.trim_start_matches("out: ");
        let (time, tail) = rest.split_at(8);
        assert!(time.chars().all(|c| c.is_ascii_digit() || c == ':'), "{l}");
        assert!(
            tail.starts_with(&format!("  {event}  {id}  -> 200 (")),
            "{l}"
        );
        assert!(tail.ends_with("ms)"), "{l}");
    };
    re_ok(&line1, "payment.paid", "evt_1");
    re_ok(&line2, "booking.paid", "evt_2");
    assert_eq!(proc.count("ping"), 0, "heartbeats are silent");

    let requests = sse.requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(
        requests[0].target,
        "/v1/webhook-listeners/stream?events=payment.paid%2Cbooking.paid"
    );
    assert_eq!(
        requests[0].header("authorization"),
        Some("Bearer sk_test_key")
    );
    assert_eq!(requests[0].header("accept"), Some("text/event-stream"));

    let delivered = target.received_requests().await.unwrap();
    assert_eq!(delivered.len(), 2);
    for (req, body, is_test) in [
        (&delivered[0], &first, false),
        (&delivered[1], &second, true),
    ] {
        assert_eq!(req.body, body.as_bytes(), "body is forwarded byte for byte");
        let h = |name: &str| {
            req.headers
                .get(name)
                .map(|v| v.to_str().unwrap().to_string())
        };
        assert_eq!(
            h("x-webhook-signature"),
            Some(node_style_signature(SECRET_A, body.as_bytes()))
        );
        assert_eq!(h("content-type").as_deref(), Some("application/json"));
        assert_eq!(
            h("user-agent"),
            Some(format!("Checkout-Page-CLI/{}", env!("CARGO_PKG_VERSION")))
        );
        assert_eq!(h("x-webhook-delivery-attempt").as_deref(), Some("1"));
        let ts: i64 = h("x-webhook-timestamp").unwrap().parse().unwrap();
        assert!((ts - chrono::Utc::now().timestamp_millis()).abs() < 60_000);
        assert_eq!(h("x-webhook-test").as_deref(), is_test.then_some("true"));
    }

    // Windows has no way to send Ctrl-C to just one child process, so this check is Unix-only.
    #[cfg(unix)]
    {
        proc.interrupt();
        let status = proc.wait_exit(WAIT);
        assert!(status.success(), "Ctrl-C exits cleanly: {}", proc.drain());
        assert!(proc.drain().contains("Stopped listening."));
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn without_forwarding_prints_event_lines_and_print_json_prints_payloads() {
    let body = payload("payment.paid", "evt_7", "");
    let script = vec![Conn::Stream(vec![
        Step::Send(ready_frame(SECRET_A, &["payment.paid", "booking.paid"])),
        Step::Send(webhook_frame("evt_7", &body)),
        Step::Hold,
    ])];
    let env = Env::new();

    let sse = SseServer::start(script.clone());
    let mut proc = listen(&env, &sse, &[]);
    proc.wait_for("Listening for all events.", WAIT);
    proc.wait_for("Not forwarding.", WAIT);
    let line = proc.wait_for("evt_7", WAIT);
    assert!(
        line.starts_with("out: ") && line.ends_with("  payment.paid  evt_7"),
        "{line}"
    );
    assert_eq!(sse.requests()[0].target, "/v1/webhook-listeners/stream");

    let sse = SseServer::start(script);
    let mut proc = listen(&env, &sse, &["--print-json"]);
    let printed = proc.wait_for("\"event_id\":\"evt_7\"", WAIT);
    assert_eq!(
        printed,
        format!("out: {body}"),
        "stdout gets the exact payload"
    );
    let status = proc.wait_for("  payment.paid  evt_7", WAIT);
    assert!(
        status.starts_with("err: "),
        "status line moves to stderr: {status}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn expired_listener_reconnects_and_warns_about_the_new_secret() {
    let sse = SseServer::start(vec![
        Conn::Stream(vec![
            Step::Send(ready_frame(SECRET_A, &["payment.paid"])),
            Step::Send("event: expired\ndata: {}\n\n".into()),
            Step::Hold,
        ]),
        Conn::Stream(vec![
            Step::Send(ready_frame(SECRET_B, &["payment.paid"])),
            Step::Send(webhook_frame(
                "evt_after",
                &payload("payment.paid", "evt_after", ""),
            )),
            Step::Hold,
        ]),
    ]);
    let target = receiver().await;
    let env = Env::new();
    let mut proc = listen(
        &env,
        &sse,
        &["--forward-to", &format!("{}/hook", target.uri())],
    );

    proc.wait_for(&format!("Webhook signing secret: {SECRET_A}"), WAIT);
    proc.wait_for("reached its 60 minute limit. Reconnecting", WAIT);
    proc.wait_for("the signing secret changed", WAIT);
    proc.wait_for(&format!("Webhook signing secret: {SECRET_B}"), WAIT);
    proc.wait_for("Update the secret your endpoint verifies with.", WAIT);
    proc.wait_for("evt_after  -> 200", WAIT);
    assert_eq!(sse.requests().len(), 2);

    let delivered = target.received_requests().await.unwrap();
    let sig = delivered[0]
        .headers
        .get("x-webhook-signature")
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(
        sig,
        node_style_signature(SECRET_B, &delivered[0].body),
        "signed with the new secret"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn a_dropped_stream_reconnects_with_backoff() {
    let sse = SseServer::start(vec![
        Conn::Stream(vec![Step::Send(ready_frame(SECRET_A, &[])), Step::Close]),
        Conn::Status(503, r#"{"message":"Service unavailable"}"#.into()),
        Conn::Stream(vec![Step::Close]),
        Conn::Stream(vec![Step::Send(ready_frame(SECRET_A, &[])), Step::Hold]),
    ]);
    let env = Env::new();
    let mut proc = listen(&env, &sse, &[]);

    proc.wait_for("Ready!", WAIT);
    proc.wait_for(
        "The server closed the connection. Reconnecting in 10ms",
        WAIT,
    );
    proc.wait_for("Service unavailable (HTTP 503). Reconnecting in 20ms", WAIT);
    proc.wait_for(
        "The server closed the connection. Reconnecting in 40ms",
        WAIT,
    );
    proc.wait_for("Reconnected.", WAIT);
    assert_eq!(
        proc.count("Webhook signing secret"),
        1,
        "same secret is not re-announced"
    );
    assert_eq!(sse.requests().len(), 4);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_silent_stream_is_treated_as_dead() {
    let sse = SseServer::start(vec![
        Conn::Stream(vec![Step::Send(ready_frame(SECRET_A, &[])), Step::Hold]),
        Conn::Stream(vec![Step::Send(ready_frame(SECRET_A, &[])), Step::Hold]),
    ]);
    let env = Env::new();
    let mut cmd = env.std_cmd();
    cmd.env("CHECKOUTPAGE_BACKOFF_UNIT_MS", "10")
        .env("CHECKOUTPAGE_IDLE_TIMEOUT_MS", "300")
        .args([
            "webhooks",
            "listen",
            "--base-url",
            &sse.base_url,
            "--api-key",
            "sk_test_key",
        ]);
    let mut proc = Proc::spawn(cmd);
    proc.wait_for("Ready!", WAIT);
    proc.wait_for(
        "No heartbeat from the server for 300ms. Reconnecting in 10ms",
        WAIT,
    );
    proc.wait_for("Reconnected.", WAIT);
}

#[test]
fn a_stream_request_with_no_response_is_retried() {
    let sse = SseServer::start(vec![
        Conn::NoResponse,
        Conn::Stream(vec![Step::Send(ready_frame(SECRET_A, &[])), Step::Hold]),
    ]);
    let env = Env::new();
    let mut cmd = env.std_cmd();
    cmd.env("CHECKOUTPAGE_BACKOFF_UNIT_MS", "10")
        .env("CHECKOUTPAGE_IDLE_TIMEOUT_MS", "300")
        .args([
            "webhooks",
            "listen",
            "--base-url",
            &sse.base_url,
            "--api-key",
            "sk_test_key",
        ]);
    let mut proc = Proc::spawn(cmd);
    proc.wait_for(
        "No response from the server for 300ms. Reconnecting in 10ms",
        WAIT,
    );
    proc.wait_for("Ready!", WAIT);
    assert_eq!(sse.requests().len(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_down_forward_target_prints_an_error_and_keeps_listening() {
    let sse = SseServer::start(vec![Conn::Stream(vec![
        Step::Send(ready_frame(SECRET_A, &[])),
        Step::Send(webhook_frame(
            "evt_a",
            &payload("payment.paid", "evt_a", ""),
        )),
        Step::Sleep(Duration::from_millis(200)),
        Step::Send(webhook_frame(
            "evt_b",
            &payload("payment.paid", "evt_b", ""),
        )),
        Step::Hold,
    ])]);
    let env = Env::new();
    let port = closed_port();
    let mut proc = listen(
        &env,
        &sse,
        &["--forward-to", &format!("http://127.0.0.1:{port}/hook")],
    );
    let a = proc.wait_for("evt_a", WAIT);
    assert!(a.contains("  -> error: "), "{a}");
    let b = proc.wait_for("evt_b", WAIT);
    assert!(b.contains("  -> error: "), "{b}");
    assert_eq!(
        sse.requests().len(),
        1,
        "a failed delivery doesn't drop the stream"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn forward_target_errors_are_reported_with_their_status() {
    let sse = SseServer::start(vec![Conn::Stream(vec![
        Step::Send(ready_frame(SECRET_A, &[])),
        Step::Send(webhook_frame(
            "evt_500",
            &payload("payment.paid", "evt_500", ""),
        )),
        Step::Hold,
    ])]);
    let target = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&target)
        .await;
    let env = Env::new();
    let mut proc = listen(&env, &sse, &["--forward-to", &target.uri()]);
    let line = proc.wait_for("evt_500", WAIT);
    assert!(line.contains("  -> 500 ("), "{line}");
}

#[test]
fn auth_and_validation_errors_stop_instead_of_retrying() {
    for (status, body, code, message) in [
        (
            401,
            r#"{"message":"Invalid API key"}"#,
            3,
            "Invalid API key",
        ),
        (
            400,
            r#"{"message":"Unknown event nope.event"}"#,
            5,
            "Unknown event nope.event",
        ),
        (
            429,
            r#"{"error":"Too many listeners for this account"}"#,
            7,
            "Too many listeners",
        ),
    ] {
        let sse = SseServer::start(vec![Conn::Status(status, body.into())]);
        let env = Env::new();
        let mut proc = listen(&env, &sse, &["--events", "nope.event"]);
        let exit = proc.wait_exit(WAIT);
        assert_eq!(exit.code(), Some(code), "{}", proc.drain());
        assert!(proc.drain().contains(message));
        assert_eq!(sse.requests().len(), 1, "no reconnect after HTTP {status}");
    }
}
