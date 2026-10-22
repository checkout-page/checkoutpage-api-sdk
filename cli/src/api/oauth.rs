use reqwest::header;
use serde::Deserialize;
use serde_json::{Value, json};
use url::Url;

use super::{ApiError, parse_base_url, read_json_response, unwrap_data};

pub const DEFAULT_SCOPE: &str = "admin:read admin:write";

#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedApiKey {
    pub token: String,
    pub expires_at: String,
}

#[derive(Debug, Clone)]
pub struct AuthorizeRequest<'a> {
    pub client_id: &'a str,
    pub redirect_uri: &'a str,
    pub code_challenge: &'a str,
    pub state: &'a str,
    pub scope: &'a str,
}

#[derive(Clone)]
pub struct OAuthClient {
    http: reqwest::Client,
    base_url: Url,
    user_agent: String,
}

impl OAuthClient {
    pub fn new(base_url: &str, user_agent: impl Into<String>) -> Result<Self, ApiError> {
        Ok(OAuthClient {
            http: reqwest::Client::builder()
                .build()
                .map_err(ApiError::Network)?,
            base_url: parse_base_url(base_url)?,
            user_agent: user_agent.into(),
        })
    }

    fn endpoint(&self, path: &str) -> Result<Url, ApiError> {
        self.base_url
            .join(path)
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))
    }

    async fn post_json(
        &self,
        path: &str,
        body: &Value,
        bearer: Option<&str>,
    ) -> Result<Value, ApiError> {
        let mut req = self
            .http
            .post(self.endpoint(path)?)
            .header(header::USER_AGENT, &self.user_agent)
            .header(header::ACCEPT, "application/json")
            .json(body);
        if let Some(token) = bearer {
            req = req.bearer_auth(token);
        }
        read_json_response(req.send().await.map_err(ApiError::Network)?).await
    }

    /// The API returns the same `client_id` for the same name and redirect URIs, so registering
    /// on every login is safe.
    pub async fn register(
        &self,
        client_name: &str,
        redirect_uris: &[&str],
    ) -> Result<String, ApiError> {
        let body = json!({
            "client_name": client_name,
            "redirect_uris": redirect_uris,
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        });
        let resp = self.post_json("/oauth/register", &body, None).await?;
        unwrap_data(&resp)
            .get("client_id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| ApiError::InvalidResponse("registration returned no client_id".into()))
    }

    pub fn authorize_url(&self, req: &AuthorizeRequest<'_>) -> Result<Url, ApiError> {
        let mut url = self.endpoint("/oauth/authorize")?;
        url.query_pairs_mut()
            .append_pair("response_type", "code")
            .append_pair("client_id", req.client_id)
            .append_pair("redirect_uri", req.redirect_uri)
            .append_pair("code_challenge", req.code_challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", req.state)
            .append_pair("scope", req.scope);
        Ok(url)
    }

    pub async fn exchange_code(
        &self,
        client_id: &str,
        code: &str,
        redirect_uri: &str,
        code_verifier: &str,
    ) -> Result<TokenResponse, ApiError> {
        let body = json!({
            "grant_type": "authorization_code",
            "client_id": client_id,
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        });
        parse_token(self.post_json("/oauth/token", &body, None).await?)
    }

    pub async fn refresh(
        &self,
        client_id: &str,
        refresh_token: &str,
    ) -> Result<TokenResponse, ApiError> {
        let body = json!({
            "grant_type": "refresh_token",
            "client_id": client_id,
            "refresh_token": refresh_token,
        });
        parse_token(self.post_json("/oauth/token", &body, None).await?)
    }

    pub async fn issue_api_key(&self, access_token: &str) -> Result<IssuedApiKey, ApiError> {
        let resp = self
            .post_json("/oauth/issue-api-key", &json!({}), Some(access_token))
            .await?;
        serde_json::from_value(unwrap_data(&resp).clone())
            .map_err(|e| ApiError::InvalidResponse(format!("issue-api-key: {e}")))
    }

    /// Revoking any token of a grant revokes the whole grant, including its API key.
    pub async fn revoke(&self, token: &str) -> Result<(), ApiError> {
        self.post_json("/oauth/revoke", &json!({ "token": token }), None)
            .await
            .map(|_| ())
    }
}

fn parse_token(resp: Value) -> Result<TokenResponse, ApiError> {
    serde_json::from_value(unwrap_data(&resp).clone())
        .map_err(|e| ApiError::InvalidResponse(format!("token response: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_url_carries_pkce_and_state() {
        let c = OAuthClient::new("https://api.checkoutpage.com", "test").unwrap();
        let url = c
            .authorize_url(&AuthorizeRequest {
                client_id: "cid",
                redirect_uri: "http://127.0.0.1:5555/callback",
                code_challenge: "chal",
                state: "st",
                scope: DEFAULT_SCOPE,
            })
            .unwrap();
        assert_eq!(url.path(), "/oauth/authorize");
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(q["response_type"], "code");
        assert_eq!(q["client_id"], "cid");
        assert_eq!(q["redirect_uri"], "http://127.0.0.1:5555/callback");
        assert_eq!(q["code_challenge"], "chal");
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["state"], "st");
        assert_eq!(q["scope"], "admin:read admin:write");
    }

    #[test]
    fn token_response_accepts_bare_or_wrapped() {
        let bare = parse_token(json!({"access_token": "a", "refresh_token": "r", "expires_in": 60, "token_type": "Bearer"})).unwrap();
        assert_eq!(bare.refresh_token.as_deref(), Some("r"));
        let wrapped = parse_token(json!({"data": {"access_token": "b"}})).unwrap();
        assert_eq!(wrapped.access_token, "b");
        assert!(parse_token(json!({"nope": 1})).is_err());
    }
}
