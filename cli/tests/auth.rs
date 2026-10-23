mod common;

use std::collections::HashMap;
use std::time::Duration;

use base64::Engine;
use common::{Env, Proc, http_get, stderr_of, stdout_of};
use predicates::prelude::*;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use wiremock::matchers::{body_json, body_partial_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

const ISSUED_KEY: &str = "sk_live_fake-0123-a1b2";

async fn mount_oauth(server: &MockServer) {
    Mock::given(method("POST"))
        .and(path("/oauth/register"))
        .and(body_partial_json(json!({
            "client_name": "Checkout Page CLI",
            "redirect_uris": ["http://127.0.0.1/callback"],
            "token_endpoint_auth_method": "none"
        })))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({
            "client_id": "cli_client_1",
            "client_name": "Checkout Page CLI",
            "redirect_uris": ["http://127.0.0.1/callback"]
        })))
        .mount(server)
        .await;
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .and(body_partial_json(json!({
            "grant_type": "authorization_code",
            "client_id": "cli_client_1",
            "code": "the-code"
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "access_token": "at_1",
            "token_type": "Bearer",
            "expires_in": 604800,
            "refresh_token": "rt_1",
            "scope": "admin:read admin:write"
        })))
        .mount(server)
        .await;
    Mock::given(method("POST"))
        .and(path("/oauth/issue-api-key"))
        .and(header("authorization", "Bearer at_1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": {"token": ISSUED_KEY, "expiresAt": "2099-01-01T00:00:00.000Z"}
        })))
        .mount(server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/account/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": {"id": "s1", "name": "acme", "displayName": "Acme Studio", "logo": null}
        })))
        .mount(server)
        .await;
}

fn start_login(env: &Env, server: &MockServer) -> (Proc, url::Url) {
    let mut cmd = env.std_cmd();
    cmd.args(["login", "--no-browser", "--base-url", &server.uri()]);
    let mut proc = Proc::spawn(cmd);
    let line = proc.wait_for("/oauth/authorize?", Duration::from_secs(20));
    let url = url::Url::parse(line.trim_start_matches("out:").trim()).unwrap();
    (proc, url)
}

fn query(url: &url::Url) -> HashMap<String, String> {
    url.query_pairs().into_owned().collect()
}

#[tokio::test(flavor = "multi_thread")]
async fn browser_login_runs_the_pkce_flow_and_stores_the_issued_key() {
    let server = MockServer::start().await;
    mount_oauth(&server).await;
    let env = Env::new();
    let (mut proc, authorize) = start_login(&env, &server);

    assert_eq!(authorize.path(), "/oauth/authorize");
    let q = query(&authorize);
    assert_eq!(q["response_type"], "code");
    assert_eq!(q["client_id"], "cli_client_1");
    assert_eq!(q["code_challenge_method"], "S256");
    assert_eq!(q["scope"], "admin:read admin:write");
    let redirect = url::Url::parse(&q["redirect_uri"]).unwrap();
    assert_eq!(redirect.host_str(), Some("127.0.0.1"));
    assert_eq!(redirect.path(), "/callback");
    assert!(redirect.port().is_some());
    assert!(q["state"].len() >= 22);

    let response = http_get(&format!(
        "{}?code=the-code&state={}",
        q["redirect_uri"], q["state"]
    ));
    assert!(response.starts_with("HTTP/1.1 200"), "{response}");
    assert!(response.contains("You're logged in"));

    let status = proc.wait_exit(Duration::from_secs(20));
    let output = proc.drain();
    assert!(status.success(), "{output}");
    assert!(
        output.contains("Logged in to Acme Studio (profile \"default\")."),
        "{output}"
    );
    assert!(
        !output.contains(ISSUED_KEY),
        "the full key is never printed"
    );

    let requests = server.received_requests().await.unwrap();
    let token_req = requests
        .iter()
        .find(|r| r.url.path() == "/oauth/token")
        .unwrap();
    let body: Value = serde_json::from_slice(&token_req.body).unwrap();
    assert_eq!(
        body["redirect_uri"],
        q["redirect_uri"].as_str(),
        "same redirect_uri, port included"
    );
    let verifier = body["code_verifier"].as_str().unwrap();
    let challenge =
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier));
    assert_eq!(
        challenge, q["code_challenge"],
        "verifier matches the S256 challenge"
    );

    let config = env.read_config();
    assert!(config.contains("[profiles.default.oauth]"), "{config}");
    assert!(config.contains("client_id = \"cli_client_1\""));
    assert!(config.contains("refresh_token = \"rt_1\""));
    assert!(config.contains(ISSUED_KEY));
    assert!(config.contains(&format!("base_url = \"{}\"", server.uri())));
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(env.config_path())
            .unwrap()
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(mode, 0o600);
    }

    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(header(
            "authorization",
            format!("Bearer {ISSUED_KEY}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(
            json!({"data": [{"id": "c1", "name": "Via OAuth"}], "has_more": false, "total": 1}),
        ))
        .mount(&server)
        .await;
    env.cmd()
        .args(["customers", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Via OAuth"));
}

#[tokio::test(flavor = "multi_thread")]
async fn login_rejects_a_callback_with_the_wrong_state() {
    let server = MockServer::start().await;
    mount_oauth(&server).await;
    let env = Env::new();
    let (mut proc, authorize) = start_login(&env, &server);
    let q = query(&authorize);

    let response = http_get(&format!("{}?code=the-code&state=forged", q["redirect_uri"]));
    assert!(response.starts_with("HTTP/1.1 400"), "{response}");

    let status = proc.wait_exit(Duration::from_secs(20));
    assert_eq!(status.code(), Some(1));
    assert!(proc.drain().contains("state value that doesn't match"));
    assert!(!env.config_path().exists(), "nothing is stored");
    let requests = server.received_requests().await.unwrap();
    assert!(
        requests.iter().all(|r| r.url.path() != "/oauth/token"),
        "the code is never exchanged"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn login_ignores_stray_requests_and_reports_denied_consent() {
    let server = MockServer::start().await;
    mount_oauth(&server).await;
    let env = Env::new();
    let (mut proc, authorize) = start_login(&env, &server);
    let q = query(&authorize);
    let redirect = url::Url::parse(&q["redirect_uri"]).unwrap();

    let stray = http_get(&format!(
        "http://127.0.0.1:{}/favicon.ico",
        redirect.port().unwrap()
    ));
    assert!(stray.starts_with("HTTP/1.1 404"));
    let denied = http_get(&format!(
        "{}?error=access_denied&error_description=The+user+declined&state={}",
        q["redirect_uri"], q["state"]
    ));
    assert!(denied.starts_with("HTTP/1.1 400"));
    let status = proc.wait_exit(Duration::from_secs(20));
    assert_eq!(status.code(), Some(1));
    assert!(proc.drain().contains("The user declined (access_denied)"));
}

#[tokio::test(flavor = "multi_thread")]
async fn login_surfaces_a_failed_token_exchange() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/oauth/register"))
        .respond_with(
            ResponseTemplate::new(201).set_body_json(json!({"client_id": "cli_client_1"})),
        )
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "error": "invalid_grant", "error_description": "Authorization code expired"
        })))
        .mount(&server)
        .await;
    let env = Env::new();
    let (mut proc, authorize) = start_login(&env, &server);
    let q = query(&authorize);
    http_get(&format!(
        "{}?code=old&state={}",
        q["redirect_uri"], q["state"]
    ));
    let status = proc.wait_exit(Duration::from_secs(20));
    assert_eq!(status.code(), Some(5));
    assert!(proc.drain().contains("Authorization code expired"));
}

#[test]
fn login_with_api_key_stores_it_masked() {
    let env = Env::new();
    env.cmd()
        .args(["login", "--api-key", "sk_test_fake-aaaa-9z8y"])
        .assert()
        .success()
        .stdout("Saved API key sk_test_...9z8y to profile \"default\".\n");
    let config = env.read_config();
    assert!(
        config.contains("api_key = \"sk_test_fake-aaaa-9z8y\""),
        "{config}"
    );
    assert!(
        !config.contains("base_url"),
        "default base URL isn't stored"
    );

    env.cmd()
        .args([
            "login",
            "--api-key",
            "sk_live_fake-bbbb-1234",
            "--profile",
            "live",
            "--base-url",
            "http://localhost:8080",
        ])
        .assert()
        .success();
    let config = env.read_config();
    assert!(config.contains("[profiles.live]"));
    assert!(config.contains("base_url = \"http://localhost:8080\""));
    assert!(
        config.contains("sk_test_fake-aaaa-9z8y"),
        "other profiles are kept"
    );

    env.cmd()
        .args(["login", "--api-key", "not-a-key-at-all"])
        .assert()
        .success()
        .stderr(predicate::str::contains(
            "doesn't look like a Checkout Page API key",
        ));
}

fn expired_oauth_config(base_url: &str) -> String {
    format!(
        r#"[profiles.default]
base_url = "{base_url}"

[profiles.default.oauth]
client_id = "cli_client_1"
access_token = "at_old"
refresh_token = "rt_old"
api_key = "sk_live_fake-old0-old1"
api_key_expires_at = "2020-01-01T00:00:00Z"
"#
    )
}

#[tokio::test(flavor = "multi_thread")]
async fn an_expired_issued_key_is_refreshed_and_saved() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .and(body_json(json!({
            "grant_type": "refresh_token",
            "client_id": "cli_client_1",
            "refresh_token": "rt_old"
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "access_token": "at_new", "token_type": "Bearer", "expires_in": 3600, "refresh_token": "rt_new"
        })))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/oauth/issue-api-key"))
        .and(header("authorization", "Bearer at_new"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": {"token": "sk_live_fake-new0-new2", "expiresAt": "2099-01-01T00:00:00.000Z"}
        })))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(header("authorization", "Bearer sk_live_fake-new0-new2"))
        .respond_with(ResponseTemplate::new(200).set_body_json(
            json!({"data": [{"id": "c1", "name": "Fresh"}], "has_more": false, "total": 1}),
        ))
        .expect(2)
        .mount(&server)
        .await;
    let env = Env::new();
    env.write_config(&expired_oauth_config(&server.uri()));

    env.cmd()
        .args(["customers", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Fresh"))
        .stderr(predicate::str::contains("Renewed your login."));
    let config = env.read_config();
    assert!(config.contains("refresh_token = \"rt_new\""), "{config}");
    assert!(config.contains("access_token = \"at_new\""));
    assert!(config.contains("sk_live_fake-new0-new2"));
    assert!(config.contains("api_key_expires_at = \"2099-01-01T00:00:00Z\""));

    // Second run uses the saved key without refreshing again (the token mock expects 1 call).
    env.cmd()
        .args(["customers", "list"])
        .assert()
        .success()
        .stderr(predicate::str::contains("Renewed").not());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_failed_key_issue_after_a_refresh_keeps_the_rotated_tokens() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "access_token": "at_new", "token_type": "Bearer", "expires_in": 3600, "refresh_token": "rt_new"
        })))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/oauth/issue-api-key"))
        .respond_with(ResponseTemplate::new(500).set_body_json(json!({"message": "boom"})))
        .up_to_n_times(1)
        .expect(1)
        .mount(&server)
        .await;
    let env = Env::new();
    env.write_config(&expired_oauth_config(&server.uri()));

    env.cmd().args(["customers", "list"]).assert().failure();
    let config = env.read_config();
    assert!(config.contains("refresh_token = \"rt_new\""), "{config}");
    assert!(config.contains("access_token = \"at_new\""), "{config}");
    assert!(!config.contains("sk_live_fake-old0-old1"), "{config}");

    Mock::given(method("POST"))
        .and(path("/oauth/issue-api-key"))
        .and(header("authorization", "Bearer at_new"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": {"token": "sk_live_fake-new0-new2", "expiresAt": "2099-01-01T00:00:00.000Z"}
        })))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(header("authorization", "Bearer sk_live_fake-new0-new2"))
        .respond_with(ResponseTemplate::new(200).set_body_json(
            json!({"data": [{"id": "c1", "name": "Fresh"}], "has_more": false, "total": 1}),
        ))
        .expect(1)
        .mount(&server)
        .await;

    // The token mock expects one call, so this run must re-issue with at_new, not refresh again.
    env.cmd()
        .args(["customers", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Fresh"));
    assert!(env.read_config().contains("sk_live_fake-new0-new2"));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_dead_refresh_token_asks_for_a_new_login() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(400).set_body_json(
            json!({"error": "invalid_grant", "error_description": "Refresh token revoked"}),
        ))
        .mount(&server)
        .await;
    let env = Env::new();
    env.write_config(&expired_oauth_config(&server.uri()));
    env.cmd()
        .args(["customers", "list"])
        .assert()
        .code(3)
        .stderr(predicate::str::contains(
            "has expired. Run `checkoutpage login` again.",
        ));
}

#[tokio::test(flavor = "multi_thread")]
async fn logout_revokes_the_oauth_grant_and_deletes_the_profile() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/oauth/revoke"))
        .and(body_json(json!({"token": "rt_old"})))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {}})))
        .expect(1)
        .mount(&server)
        .await;
    let env = Env::new();
    let mut config = expired_oauth_config(&server.uri());
    config.push_str("\n[profiles.other]\napi_key = \"sk_test_fake-keep-epme\"\n");
    env.write_config(&config);

    env.cmd()
        .args(["logout"])
        .assert()
        .success()
        .stdout("Logged out of profile \"default\".\n");
    let config = env.read_config();
    assert!(!config.contains("profiles.default"), "{config}");
    assert!(config.contains("[profiles.other]"));

    env.cmd()
        .args(["logout"])
        .assert()
        .success()
        .stdout(predicate::str::contains("has no stored credentials"));
}

#[tokio::test(flavor = "multi_thread")]
async fn logout_of_an_api_key_profile_makes_no_request_and_survives_revoke_failure() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/oauth/revoke"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;
    let env = Env::new();
    env.write_config("[profiles.default]\napi_key = \"sk_test_fake-aaaa-aaaa\"\n");
    env.cmd().args(["logout"]).assert().success();
    assert!(server.received_requests().await.unwrap().is_empty());

    env.write_config(&expired_oauth_config(&server.uri()));
    env.cmd()
        .args(["logout"])
        .assert()
        .success()
        .stderr(predicate::str::contains(
            "couldn't revoke the login on the server",
        ));
    assert!(!env.read_config().contains("profiles.default"));
}

#[tokio::test(flavor = "multi_thread")]
async fn whoami_shows_the_account_and_a_masked_key() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/account/"))
        .and(header("authorization", "Bearer sk_test_fake-abcd-yz12"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": {"id": "s1", "name": "acme", "displayName": "Acme Studio", "logo": null}
        })))
        .mount(&server)
        .await;
    let env = Env::new();
    let out = env
        .cmd()
        .env("CHECKOUTPAGE_API_KEY", "sk_test_fake-abcd-yz12")
        .args(["whoami", "--base-url", &server.uri()])
        .output()
        .unwrap();
    assert!(out.status.success(), "{}", stderr_of(&out));
    let text = stdout_of(&out);
    for needle in [
        "Acme Studio",
        "acme",
        "s1",
        "test",
        "sk_test_...yz12",
        "CHECKOUTPAGE_API_KEY",
        &server.uri(),
    ] {
        assert!(text.contains(needle), "lacks {needle:?}:\n{text}");
    }
    assert!(!text.contains("abcdefghijklmnop"));

    let out = env
        .cmd()
        .env("CHECKOUTPAGE_API_KEY", "sk_test_fake-abcd-yz12")
        .args(["whoami", "--json", "--base-url", &server.uri()])
        .output()
        .unwrap();
    let v: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(v["data"]["displayName"], "Acme Studio");
}
