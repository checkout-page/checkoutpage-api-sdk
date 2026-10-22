use std::time::Duration;

use anyhow::{Result, anyhow, bail};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub const CALLBACK_PATH: &str = "/callback";

#[derive(Debug, PartialEq, Eq)]
pub enum Callback {
    Code(String),
    Denied(String),
    StateMismatch,
    Ignored,
}

pub fn classify(target: &str, expected_state: &str) -> Callback {
    let Ok(url) = url::Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::Ignored;
    };
    if url.path() != CALLBACK_PATH {
        return Callback::Ignored;
    }
    let mut code = None;
    let mut state = None;
    let mut error = None;
    let mut description = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "code" => code = Some(v.into_owned()),
            "state" => state = Some(v.into_owned()),
            "error" => error = Some(v.into_owned()),
            "error_description" => description = Some(v.into_owned()),
            _ => {}
        }
    }
    // State is checked before anything else, including errors, so a forged redirect can't end
    // the login with a misleading message.
    if state.as_deref() != Some(expected_state) {
        return Callback::StateMismatch;
    }
    if let Some(error) = error {
        return Callback::Denied(match description {
            Some(d) => format!("{d} ({error})"),
            None => error,
        });
    }
    match code {
        Some(c) if !c.is_empty() => Callback::Code(c),
        _ => Callback::Denied("the redirect carried no authorization code".into()),
    }
}

fn page(title: &str, body: &str) -> String {
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title></head>\
         <body style=\"font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;\
         padding:0 1rem;color:#111\"><h1 style=\"font-size:1.25rem\">{title}</h1><p>{body}</p>\
         </body></html>"
    )
}

async fn respond(stream: &mut TcpStream, status: &str, html: &str) {
    let resp = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Connection: close\r\nCache-Control: no-store\r\n\r\n{html}",
        html.len()
    );
    let _ = stream.write_all(resp.as_bytes()).await;
    let _ = stream.shutdown().await;
}

async fn read_request_target(stream: &mut TcpStream) -> Option<String> {
    let mut buf = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    while !buf.windows(4).any(|w| w == b"\r\n\r\n") {
        if buf.len() > 16 * 1024 {
            return None;
        }
        let n = tokio::time::timeout(Duration::from_secs(10), stream.read(&mut chunk))
            .await
            .ok()?
            .ok()?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    let text = String::from_utf8_lossy(&buf);
    let mut parts = text.lines().next()?.split_whitespace();
    match (parts.next(), parts.next()) {
        (Some("GET"), Some(target)) => Some(target.to_string()),
        _ => None,
    }
}

pub async fn wait_for_code(
    listener: TcpListener,
    expected_state: &str,
    timeout: Duration,
) -> Result<String> {
    let work = async {
        loop {
            let (mut stream, _) = listener.accept().await?;
            let Some(target) = read_request_target(&mut stream).await else {
                respond(&mut stream, "400 Bad Request", &page("Bad request", "")).await;
                continue;
            };
            match classify(&target, expected_state) {
                Callback::Code(code) => {
                    respond(
                        &mut stream,
                        "200 OK",
                        &page(
                            "You're logged in",
                            "Checkout Page CLI is now connected. You can close this tab and go back to your terminal.",
                        ),
                    )
                    .await;
                    return Ok(code);
                }
                Callback::Denied(reason) => {
                    respond(
                        &mut stream,
                        "400 Bad Request",
                        &page("Login failed", "Go back to your terminal for details."),
                    )
                    .await;
                    bail!("Login was not completed: {reason}");
                }
                Callback::StateMismatch => {
                    respond(
                        &mut stream,
                        "400 Bad Request",
                        &page(
                            "Login failed",
                            "This login link doesn't match the one your terminal started. Run checkoutpage login again.",
                        ),
                    )
                    .await;
                    bail!(
                        "Login failed: the browser returned a state value that doesn't match this login. Run `checkoutpage login` again."
                    );
                }
                Callback::Ignored => {
                    respond(&mut stream, "404 Not Found", &page("Not found", "")).await;
                }
            }
        }
    };
    tokio::time::timeout(timeout, work)
        .await
        .map_err(|_| anyhow!("Timed out waiting for the browser login to finish."))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_matching_state() {
        assert_eq!(
            classify("/callback?code=abc&state=s1", "s1"),
            Callback::Code("abc".into())
        );
        assert_eq!(
            classify("/callback?state=s%201&code=a%2Bb", "s 1"),
            Callback::Code("a+b".into())
        );
    }

    #[test]
    fn rejects_wrong_or_missing_state() {
        assert_eq!(
            classify("/callback?code=abc&state=evil", "s1"),
            Callback::StateMismatch
        );
        assert_eq!(
            classify("/callback?code=abc", "s1"),
            Callback::StateMismatch
        );
        assert_eq!(
            classify("/callback?error=access_denied&state=evil", "s1"),
            Callback::StateMismatch
        );
    }

    #[test]
    fn reports_authorization_errors() {
        assert_eq!(
            classify(
                "/callback?error=access_denied&error_description=User+said+no&state=s1",
                "s1"
            ),
            Callback::Denied("User said no (access_denied)".into())
        );
        assert!(matches!(
            classify("/callback?state=s1", "s1"),
            Callback::Denied(_)
        ));
    }

    #[test]
    fn ignores_other_paths() {
        assert_eq!(classify("/favicon.ico", "s1"), Callback::Ignored);
        assert_eq!(
            classify("/callback/extra?code=a&state=s1", "s1"),
            Callback::Ignored
        );
        assert_eq!(classify("/", "s1"), Callback::Ignored);
    }

    async fn get(port: u16, target: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        s.write_all(format!("GET {target} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").as_bytes())
            .await
            .unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).await.unwrap();
        out
    }

    #[tokio::test]
    async fn serves_until_the_callback_arrives() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(wait_for_code(listener, "st", Duration::from_secs(5)));
        assert!(get(port, "/favicon.ico").await.starts_with("HTTP/1.1 404"));
        assert!(
            get(port, "/callback?code=c0de&state=st")
                .await
                .starts_with("HTTP/1.1 200")
        );
        assert_eq!(server.await.unwrap().unwrap(), "c0de");
    }

    #[tokio::test]
    async fn bad_state_fails_the_login() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(wait_for_code(listener, "st", Duration::from_secs(5)));
        assert!(
            get(port, "/callback?code=c0de&state=forged")
                .await
                .starts_with("HTTP/1.1 400")
        );
        let err = server.await.unwrap().unwrap_err().to_string();
        assert!(err.contains("state"), "{err}");
    }

    #[tokio::test]
    async fn times_out() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let err = wait_for_code(listener, "st", Duration::from_millis(50))
            .await
            .unwrap_err();
        assert!(err.to_string().contains("Timed out"));
    }
}
