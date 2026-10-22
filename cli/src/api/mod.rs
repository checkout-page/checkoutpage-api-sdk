//! Nothing in here knows about the CLI, so it can move into a standalone Rust SDK crate.

mod error;
pub mod oauth;
pub mod pkce;

pub use error::{ApiError, describe_reqwest};

use reqwest::{Method, header};
use serde_json::Value;
use url::Url;

pub const DEFAULT_BASE_URL: &str = "https://api.checkoutpage.com";

pub type Query = Vec<(String, String)>;

#[derive(Clone)]
pub struct Client {
    http: reqwest::Client,
    base_url: Url,
    api_key: String,
    user_agent: String,
}

impl std::fmt::Debug for Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Client")
            .field("base_url", &self.base_url.as_str())
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Clone)]
pub struct ListPage {
    pub data: Vec<Value>,
    pub has_more: bool,
    pub total: Option<u64>,
    pub raw: Value,
}

impl ListPage {
    pub fn from_value(raw: Value) -> Result<Self, ApiError> {
        let data = raw
            .get("data")
            .and_then(Value::as_array)
            .cloned()
            .ok_or_else(|| ApiError::InvalidResponse("list response has no `data` array".into()))?;
        let has_more = raw
            .get("has_more")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let total = raw.get("total").and_then(Value::as_u64);
        Ok(ListPage {
            data,
            has_more,
            total,
            raw,
        })
    }

    pub fn next_cursor(&self) -> Option<String> {
        if !self.has_more {
            return None;
        }
        self.data
            .last()
            .and_then(|r| r.get("id"))
            .and_then(Value::as_str)
            .map(str::to_string)
    }
}

pub fn parse_base_url(base_url: &str) -> Result<Url, ApiError> {
    let url = Url::parse(base_url)
        .map_err(|e| ApiError::InvalidResponse(format!("invalid base URL {base_url:?}: {e}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(ApiError::InvalidResponse(format!(
            "invalid base URL {base_url:?}: must be http or https"
        )));
    }
    Ok(url)
}

impl Client {
    pub fn new(base_url: &str, api_key: impl Into<String>) -> Result<Self, ApiError> {
        Self::with_user_agent(
            base_url,
            api_key,
            format!("checkoutpage-rust/{}", env!("CARGO_PKG_VERSION")),
        )
    }

    pub fn with_user_agent(
        base_url: &str,
        api_key: impl Into<String>,
        user_agent: impl Into<String>,
    ) -> Result<Self, ApiError> {
        let http = reqwest::Client::builder()
            .build()
            .map_err(ApiError::Network)?;
        Ok(Client {
            http,
            base_url: parse_base_url(base_url)?,
            api_key: api_key.into(),
            user_agent: user_agent.into(),
        })
    }

    pub fn base_url(&self) -> &Url {
        &self.base_url
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    pub fn url(&self, path: &str, query: &[(String, String)]) -> Result<Url, ApiError> {
        let mut url = self
            .base_url
            .join(path)
            .map_err(|e| ApiError::InvalidResponse(format!("invalid path {path:?}: {e}")))?;
        if !query.is_empty() {
            let mut pairs = url.query_pairs_mut();
            for (k, v) in query {
                pairs.append_pair(k, v);
            }
        }
        Ok(url)
    }

    fn builder(&self, method: Method, url: Url) -> reqwest::RequestBuilder {
        self.http
            .request(method, url)
            .bearer_auth(&self.api_key)
            .header(header::USER_AGENT, &self.user_agent)
    }

    pub async fn request(
        &self,
        method: Method,
        path: &str,
        query: &[(String, String)],
        body: Option<&Value>,
    ) -> Result<Value, ApiError> {
        let url = self.url(path, query)?;
        let mut req = self
            .builder(method, url)
            .header(header::ACCEPT, "application/json");
        if let Some(body) = body {
            req = req.json(body);
        }
        let resp = req.send().await.map_err(ApiError::Network)?;
        read_json_response(resp).await
    }

    pub async fn get(&self, path: &str, query: &[(String, String)]) -> Result<Value, ApiError> {
        self.request(Method::GET, path, query, None).await
    }

    pub async fn post(&self, path: &str, body: &Value) -> Result<Value, ApiError> {
        self.request(Method::POST, path, &[], Some(body)).await
    }

    pub async fn list_page(
        &self,
        path: &str,
        query: &[(String, String)],
        starting_after: Option<&str>,
    ) -> Result<ListPage, ApiError> {
        let mut q = query.to_vec();
        if let Some(cursor) = starting_after {
            q.retain(|(k, _)| k != "starting_after");
            q.push(("starting_after".into(), cursor.into()));
        }
        ListPage::from_value(self.get(path, &q).await?)
    }

    pub async fn list_all(
        &self,
        path: &str,
        query: &[(String, String)],
        mut on_page: impl FnMut(&ListPage),
    ) -> Result<Vec<Value>, ApiError> {
        let mut out = Vec::new();
        let mut cursor: Option<String> = None;
        loop {
            let page = self.list_page(path, query, cursor.as_deref()).await?;
            on_page(&page);
            let next = page.next_cursor();
            out.extend(page.data);
            match next {
                Some(c) if Some(&c) != cursor.as_ref() => cursor = Some(c),
                _ => break,
            }
        }
        Ok(out)
    }
}

pub fn unwrap_data(value: &Value) -> &Value {
    match value.get("data") {
        Some(inner) if inner.is_object() => inner,
        _ => value,
    }
}

pub(crate) async fn read_json_response(resp: reqwest::Response) -> Result<Value, ApiError> {
    let status = resp.status().as_u16();
    let retry_after = resp
        .headers()
        .get(header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<u64>().ok());
    let bytes = resp.bytes().await.map_err(ApiError::Network)?;
    let body = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };
    if (200..300).contains(&status) {
        Ok(body)
    } else {
        Err(ApiError::from_response(status, body, retry_after))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn builds_urls_with_query() {
        let c = Client::new("https://api.checkoutpage.com", "sk_test_x").unwrap();
        let url = c
            .url(
                "/v1/coupons/",
                &[
                    ("limit".into(), "5".into()),
                    ("search".into(), "a b&c".into()),
                ],
            )
            .unwrap();
        assert_eq!(
            url.as_str(),
            "https://api.checkoutpage.com/v1/coupons/?limit=5&search=a+b%26c"
        );
    }

    #[test]
    fn rejects_bad_base_urls() {
        assert!(Client::new("not a url", "k").is_err());
        assert!(Client::new("ftp://example.com", "k").is_err());
        assert!(Client::new("http://localhost:8080", "k").is_ok());
    }

    #[test]
    fn list_page_cursor() {
        let page = ListPage::from_value(json!({
            "data": [{"id": "a"}, {"id": "b"}],
            "has_more": true,
            "total": 5
        }))
        .unwrap();
        assert_eq!(page.next_cursor().as_deref(), Some("b"));
        assert_eq!(page.total, Some(5));

        let last = ListPage::from_value(json!({"data": [{"id": "c"}], "has_more": false})).unwrap();
        assert_eq!(last.next_cursor(), None);

        assert!(ListPage::from_value(json!({"items": []})).is_err());
    }

    #[test]
    fn unwraps_data_envelope() {
        let wrapped = json!({"data": {"id": "x"}});
        assert_eq!(unwrap_data(&wrapped), &json!({"id": "x"}));
        let bare = json!({"id": "y"});
        assert_eq!(unwrap_data(&bare), &bare);
        let list = json!({"data": [1, 2]});
        assert_eq!(unwrap_data(&list), &list);
    }
}
