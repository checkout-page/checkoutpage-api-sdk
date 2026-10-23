use anyhow::Result;
use reqwest::Method;
use serde_json::Value;

use super::read_data;
use crate::api::{ApiError, Query};
use crate::app::{App, CliError};
use crate::cli::ApiArgs;
use crate::output::{out, to_pretty_json};

pub fn split_path(raw: &str) -> Result<(String, Query)> {
    if raw.contains("://") {
        return Err(CliError::Usage(format!(
            "give a path like /v1/coupons, not a full URL (use --base-url to change the host): {raw}"
        ))
        .into());
    }
    let (path, query) = raw.split_once('?').unwrap_or((raw, ""));
    let path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };
    let pairs = url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect();
    Ok((path, pairs))
}

pub async fn run(app: &App, args: &ApiArgs) -> Result<()> {
    app.reject_csv("api")?;
    let (path, mut query) = split_path(&args.path)?;
    query.extend(args.query.iter().cloned());
    let body = args.data.as_deref().map(read_data).transpose()?;
    let method =
        Method::from_bytes(args.method.as_bytes()).map_err(|e| CliError::Usage(e.to_string()))?;
    let client = app.client().await?;
    match client.request(method, &path, &query, body.as_ref()).await {
        Ok(Value::Null) => Ok(()),
        Ok(v) => {
            out(to_pretty_json(&v));
            Ok(())
        }
        Err(e) => {
            if let Some(body) = ApiError::body(&e).filter(|b| b.is_object() || b.is_array()) {
                out(to_pretty_json(body));
            }
            Err(e.into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_path_and_query() {
        let (p, q) = split_path("/v1/coupons?limit=2&search=a%20b").unwrap();
        assert_eq!(p, "/v1/coupons");
        assert_eq!(
            q,
            vec![
                ("limit".to_string(), "2".to_string()),
                ("search".to_string(), "a b".to_string())
            ]
        );
        assert_eq!(split_path("v1/account").unwrap().0, "/v1/account");
        assert!(split_path("https://evil.example/v1").is_err());
    }
}
