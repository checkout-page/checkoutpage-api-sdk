use std::time::Duration;

use anyhow::Result;
use chrono::Utc;
use serde_json::Value;
use tokio::net::TcpListener;

use crate::api::oauth::{AuthorizeRequest, DEFAULT_SCOPE, OAuthClient};
use crate::api::pkce::{Pkce, random_urlsafe};
use crate::api::{Client, unwrap_data};
use crate::app::{API_KEY_ENV, App, KeySource, parse_expiry, user_agent};
use crate::callback::{CALLBACK_PATH, wait_for_code};
use crate::cli::LoginArgs;
use crate::config::{OAuthCredentials, Profile};
use crate::output::{Format, err, out, render_detail, to_pretty_json};
use crate::util::{key_mode, mask_key};

const CLIENT_NAME: &str = "Checkout Page CLI";
/// Registered without a port; the API accepts any loopback port for it (RFC 8252 section 7.3).
const REGISTERED_REDIRECT_URI: &str = "http://127.0.0.1/callback";
const LOGIN_TIMEOUT: Duration = Duration::from_secs(5 * 60);

pub async fn login(app: &App, args: &LoginArgs) -> Result<()> {
    app.reject_csv("login")?;
    let existing = app.profile()?;
    let base_url = app.base_url(existing.as_ref());
    let stored_base_url = (base_url != crate::api::DEFAULT_BASE_URL).then(|| base_url.clone());

    if let Some(key) = app.global.api_key.clone().filter(|k| !k.is_empty()) {
        if key_mode(&key).is_none() {
            err(app.err_style.yellow(
                "Warning: that doesn't look like a Checkout Page API key (sk_live_... or sk_test_...). Saving it anyway.",
            ));
        }
        app.set_profile(Some(Profile {
            base_url: stored_base_url,
            api_key: Some(key.clone()),
            oauth: None,
        }))?;
        out(format!(
            "Saved API key {} to profile \"{}\".",
            mask_key(&key),
            app.global.profile
        ));
        return Ok(());
    }

    let oauth = OAuthClient::new(&base_url, user_agent())?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}{CALLBACK_PATH}");

    let client_id = oauth
        .register(CLIENT_NAME, &[REGISTERED_REDIRECT_URI])
        .await?;
    let pkce = Pkce::generate();
    let state = random_urlsafe(24);
    let url = oauth.authorize_url(&AuthorizeRequest {
        client_id: &client_id,
        redirect_uri: &redirect_uri,
        code_challenge: &pkce.challenge,
        state: &state,
        scope: DEFAULT_SCOPE,
    })?;

    if args.no_browser {
        out("Open this URL in your browser to log in:");
    } else if open::that_detached(url.as_str()).is_ok() {
        out("Opening your browser to log in. If it doesn't open, visit:");
    } else {
        out("Couldn't open a browser. Open this URL to log in:");
    }
    out(format!("\n  {url}\n"));
    err(app
        .err_style
        .dim("Waiting for you to finish in the browser..."));

    let code = wait_for_code(listener, &state, LOGIN_TIMEOUT).await?;
    let tokens = oauth
        .exchange_code(&client_id, &code, &redirect_uri, &pkce.verifier)
        .await?;
    let issued = oauth.issue_api_key(&tokens.access_token).await?;
    let creds = OAuthCredentials {
        client_id,
        access_token_expires_at: tokens
            .expires_in
            .map(|s| Utc::now() + chrono::Duration::seconds(s)),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        api_key_expires_at: parse_expiry(&issued.expires_at)?,
        api_key: issued.token,
    };

    app.set_profile(Some(Profile {
        base_url: stored_base_url,
        api_key: None,
        oauth: Some(creds.clone()),
    }))?;

    let account = match Client::with_user_agent(&base_url, &creds.api_key, user_agent()) {
        Ok(c) => c.get("/v1/account/", &[]).await.ok(),
        Err(_) => None,
    };
    let name = account
        .as_ref()
        .map(unwrap_data)
        .and_then(|a| a.get("displayName").or_else(|| a.get("name")))
        .and_then(Value::as_str)
        .map(|n| format!(" to {n}"))
        .unwrap_or_default();
    out(app.out_style.green(&format!(
        "Logged in{name} (profile \"{}\").",
        app.global.profile
    )));
    if std::env::var_os(API_KEY_ENV).is_some() {
        err(app.err_style.yellow(&format!(
            "Note: {API_KEY_ENV} is set, and it takes priority over this login."
        )));
    }
    Ok(())
}

pub async fn logout(app: &App) -> Result<()> {
    app.reject_csv("logout")?;
    let Some(profile) = app.profile()? else {
        out(format!(
            "Profile \"{}\" has no stored credentials.",
            app.global.profile
        ));
        return Ok(());
    };
    if let Some(oauth) = &profile.oauth {
        let base_url = app.base_url(Some(&profile));
        let token = oauth
            .refresh_token
            .as_deref()
            .unwrap_or(&oauth.access_token);
        let revoked = match OAuthClient::new(&base_url, user_agent()) {
            Ok(c) => c.revoke(token).await,
            Err(e) => Err(e),
        };
        if let Err(e) = revoked {
            err(app.err_style.yellow(&format!(
                "Warning: couldn't revoke the login on the server ({e}). The local credentials are deleted anyway."
            )));
        }
    }
    app.set_profile(None)?;
    out(format!("Logged out of profile \"{}\".", app.global.profile));
    if std::env::var_os(API_KEY_ENV).is_some() {
        err(app.err_style.yellow(&format!(
            "Note: {API_KEY_ENV} is still set in your environment."
        )));
    }
    Ok(())
}

pub async fn whoami(app: &App) -> Result<()> {
    app.reject_csv("whoami")?;
    let (creds, base_url) = app.credentials().await?;
    let client = Client::with_user_agent(&base_url, &creds.api_key, user_agent())?;
    let raw = client.get("/v1/account/", &[]).await?;
    if app.format() == Format::Json {
        out(to_pretty_json(&raw));
        return Ok(());
    }
    let account = unwrap_data(&raw);
    let s = |k: &str| {
        account
            .get(k)
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    };
    let mut auth = creds.source.describe().to_string();
    if creds.source == KeySource::OAuth {
        if let Some(exp) = creds.expires_at {
            auth.push_str(&format!(
                ", key renews after {}",
                exp.format("%Y-%m-%d %H:%M UTC")
            ));
        }
    }
    let pairs = vec![
        ("Account", s("displayName")),
        ("Store", s("name")),
        ("Account ID", s("id")),
        (
            "Mode",
            key_mode(&creds.api_key).unwrap_or("unknown").to_string(),
        ),
        ("API key", mask_key(&creds.api_key)),
        ("Signed in with", auth),
        ("Profile", app.global.profile.clone()),
        ("API", base_url),
    ];
    out(render_detail(&pairs));
    Ok(())
}
