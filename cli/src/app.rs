use std::path::PathBuf;

use anyhow::Result;
use chrono::{DateTime, Utc};

use crate::api::oauth::OAuthClient;
use crate::api::{ApiError, Client, DEFAULT_BASE_URL};
use crate::cli::GlobalArgs;
use crate::config::{self, Config, OAuthCredentials, Profile};
use crate::output::{Format, err};
use crate::util::Style;

pub const API_KEY_ENV: &str = "CHECKOUTPAGE_API_KEY";
pub const BASE_URL_ENV: &str = "CHECKOUTPAGE_BASE_URL";

pub fn user_agent() -> String {
    format!("checkoutpage-cli/{}", env!("CARGO_PKG_VERSION"))
}

#[derive(Debug, thiserror::Error)]
pub enum CliError {
    #[error("{0}")]
    Usage(String),
    #[error(
        "You're not logged in. Run `checkoutpage login`, pass --api-key, or set {API_KEY_ENV}."
    )]
    NotLoggedIn,
    #[error("{0}")]
    Auth(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeySource {
    Flag,
    Env,
    StoredKey,
    OAuth,
}

impl KeySource {
    pub fn describe(&self) -> &'static str {
        match self {
            KeySource::Flag => "--api-key flag",
            KeySource::Env => "CHECKOUTPAGE_API_KEY",
            KeySource::StoredKey => "stored API key",
            KeySource::OAuth => "browser login",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Credentials {
    pub api_key: String,
    pub source: KeySource,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Records (payments, bookings, subscriptions) take `livemode`; pages (events, checkout pages,
/// forms) take `testmode`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModeParam {
    None,
    Livemode,
    Testmode,
}

pub struct App {
    pub global: GlobalArgs,
    pub config_path: PathBuf,
    pub out_style: Style,
    pub err_style: Style,
}

fn non_empty_env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.trim().is_empty())
}

impl App {
    pub fn new(global: GlobalArgs) -> Result<Self> {
        let out_style = Style::for_stdout(global.no_color);
        let err_style = Style::for_stderr(global.no_color);
        Ok(App {
            config_path: config::config_path()?,
            global,
            out_style,
            err_style,
        })
    }

    pub fn format(&self) -> Format {
        if self.global.json {
            Format::Json
        } else if self.global.csv {
            Format::Csv
        } else {
            Format::Table
        }
    }

    pub fn load_config(&self) -> Result<Config> {
        Config::load(&self.config_path)
    }

    pub fn profile(&self) -> Result<Option<Profile>> {
        Ok(self
            .load_config()?
            .profiles
            .get(&self.global.profile)
            .cloned())
    }

    pub fn base_url(&self, profile: Option<&Profile>) -> String {
        self.global
            .base_url
            .clone()
            .or_else(|| non_empty_env(BASE_URL_ENV))
            .or_else(|| profile.and_then(|p| p.base_url.clone()))
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string()
    }

    pub fn reject_csv(&self, command: &str) -> Result<()> {
        if self.global.csv {
            return Err(CliError::Usage(format!(
                "--csv only works with list and get commands, not `{command}`"
            ))
            .into());
        }
        Ok(())
    }

    pub fn mode_query(&self, param: ModeParam, command: &str) -> Result<Option<(String, String)>> {
        let wanted = match (self.global.test, self.global.live) {
            (true, _) => "test",
            (_, true) => "live",
            _ => return Ok(None),
        };
        match param {
            ModeParam::None => Err(CliError::Usage(format!(
                "`{command}` has no test mode filter, so --test and --live can't be used with it"
            ))
            .into()),
            ModeParam::Livemode => Ok(Some(("livemode".into(), (wanted == "live").to_string()))),
            ModeParam::Testmode => Ok(Some(("testmode".into(), (wanted == "test").to_string()))),
        }
    }

    pub async fn credentials(&self) -> Result<(Credentials, String)> {
        let profile = self.profile()?;
        let base_url = self.base_url(profile.as_ref());
        if let Some(key) = self.global.api_key.clone().filter(|k| !k.is_empty()) {
            return Ok((
                Credentials {
                    api_key: key,
                    source: KeySource::Flag,
                    expires_at: None,
                },
                base_url,
            ));
        }
        if let Some(key) = non_empty_env(API_KEY_ENV) {
            return Ok((
                Credentials {
                    api_key: key,
                    source: KeySource::Env,
                    expires_at: None,
                },
                base_url,
            ));
        }
        let Some(profile) = profile else {
            return Err(CliError::NotLoggedIn.into());
        };
        if let Some(oauth) = &profile.oauth {
            let oauth = if oauth.needs_refresh(Utc::now()) {
                self.refresh(oauth, &base_url).await?
            } else {
                oauth.clone()
            };
            return Ok((
                Credentials {
                    api_key: oauth.api_key.clone(),
                    source: KeySource::OAuth,
                    expires_at: Some(oauth.api_key_expires_at),
                },
                base_url,
            ));
        }
        if let Some(key) = profile.api_key.clone().filter(|k| !k.is_empty()) {
            return Ok((
                Credentials {
                    api_key: key,
                    source: KeySource::StoredKey,
                    expires_at: None,
                },
                base_url,
            ));
        }
        Err(CliError::NotLoggedIn.into())
    }

    async fn refresh(&self, old: &OAuthCredentials, base_url: &str) -> Result<OAuthCredentials> {
        let expired = || {
            CliError::Auth(format!(
                "Your login for profile \"{}\" has expired. Run `checkoutpage login` again.",
                self.global.profile
            ))
        };
        let Some(refresh_token) = old.refresh_token.as_deref() else {
            return Err(expired().into());
        };
        let oauth = OAuthClient::new(base_url, user_agent())?;
        let tokens = match oauth.refresh(&old.client_id, refresh_token).await {
            Ok(t) => t,
            Err(ApiError::Validation { .. } | ApiError::Authentication { .. }) => {
                return Err(expired().into());
            }
            Err(e) => return Err(e.into()),
        };
        let issued = oauth.issue_api_key(&tokens.access_token).await?;
        let creds = OAuthCredentials {
            client_id: old.client_id.clone(),
            access_token_expires_at: tokens
                .expires_in
                .map(|s| Utc::now() + chrono::Duration::seconds(s)),
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token.or_else(|| old.refresh_token.clone()),
            api_key_expires_at: parse_expiry(&issued.expires_at)?,
            api_key: issued.token,
        };
        let mut config = self.load_config()?;
        if let Some(p) = config.profiles.get_mut(&self.global.profile) {
            p.oauth = Some(creds.clone());
            config.save(&self.config_path)?;
        }
        err(self.err_style.dim("Renewed your login."));
        Ok(creds)
    }

    pub async fn client(&self) -> Result<Client> {
        let (creds, base_url) = self.credentials().await?;
        Ok(Client::with_user_agent(
            &base_url,
            creds.api_key,
            user_agent(),
        )?)
    }
}

pub fn parse_expiry(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| anyhow::anyhow!("the API returned an invalid expiry {s:?}: {e}"))
}

pub fn exit_code(error: &anyhow::Error) -> i32 {
    if let Some(e) = error.downcast_ref::<ApiError>() {
        return match e {
            ApiError::Authentication { .. } => 3,
            ApiError::NotFound { .. } => 4,
            ApiError::Validation { .. } => 5,
            ApiError::Conflict { .. } => 6,
            ApiError::RateLimit { .. } => 7,
            ApiError::InvalidRequest(_) => 2,
            ApiError::Api { .. } | ApiError::Network(_) | ApiError::InvalidResponse(_) => 1,
        };
    }
    if let Some(e) = error.downcast_ref::<CliError>() {
        return match e {
            CliError::Usage(_) => 2,
            CliError::NotLoggedIn | CliError::Auth(_) => 3,
        };
    }
    1
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn app(test: bool, live: bool) -> App {
        App {
            global: GlobalArgs {
                profile: "default".into(),
                test,
                live,
                ..Default::default()
            },
            config_path: PathBuf::from("/nonexistent/config.toml"),
            out_style: Style { enabled: false },
            err_style: Style { enabled: false },
        }
    }

    #[test]
    fn mode_flags_map_to_each_endpoints_parameter() {
        let a = app(true, false);
        assert_eq!(
            a.mode_query(ModeParam::Livemode, "x").unwrap(),
            Some(("livemode".into(), "false".into()))
        );
        assert_eq!(
            a.mode_query(ModeParam::Testmode, "x").unwrap(),
            Some(("testmode".into(), "true".into()))
        );
        let a = app(false, true);
        assert_eq!(
            a.mode_query(ModeParam::Livemode, "x").unwrap(),
            Some(("livemode".into(), "true".into()))
        );
        assert_eq!(
            a.mode_query(ModeParam::Testmode, "x").unwrap(),
            Some(("testmode".into(), "false".into()))
        );
        assert!(a.mode_query(ModeParam::None, "customers list").is_err());
        assert_eq!(
            app(false, false).mode_query(ModeParam::None, "x").unwrap(),
            None
        );
    }

    #[test]
    fn exit_codes() {
        let code = |e: ApiError| exit_code(&anyhow::Error::from(e));
        assert_eq!(code(ApiError::from_response(401, json!({}), None)), 3);
        assert_eq!(code(ApiError::from_response(404, json!({}), None)), 4);
        assert_eq!(code(ApiError::from_response(422, json!({}), None)), 5);
        assert_eq!(code(ApiError::from_response(409, json!({}), None)), 6);
        assert_eq!(code(ApiError::from_response(429, json!({}), None)), 7);
        assert_eq!(code(ApiError::from_response(500, json!({}), None)), 1);
        assert_eq!(exit_code(&CliError::Usage("x".into()).into()), 2);
        assert_eq!(exit_code(&CliError::NotLoggedIn.into()), 3);
        assert_eq!(exit_code(&anyhow::anyhow!("other")), 1);
        let wrapped = anyhow::Error::from(ApiError::from_response(404, json!({}), None))
            .context("while doing a thing");
        assert_eq!(exit_code(&wrapped), 4);
    }

    #[test]
    fn parses_api_expiry() {
        assert_eq!(
            parse_expiry("2026-10-29T12:00:00.000Z")
                .unwrap()
                .to_rfc3339(),
            "2026-10-29T12:00:00+00:00"
        );
        assert!(parse_expiry("tomorrow").is_err());
    }
}
