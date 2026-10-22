use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{message}")]
    Authentication {
        status: u16,
        message: String,
        body: Value,
    },
    #[error("{message}")]
    NotFound { message: String, body: Value },
    #[error("{message}")]
    Conflict { message: String, body: Value },
    #[error("{}", format_validation(.message, .details))]
    Validation {
        status: u16,
        message: String,
        details: Vec<String>,
        body: Value,
    },
    #[error("{message}")]
    RateLimit {
        message: String,
        retry_after: Option<u64>,
        body: Value,
    },
    #[error("{message} (HTTP {status})")]
    Api {
        status: u16,
        message: String,
        body: Value,
    },
    #[error("could not reach the API: {}", describe_reqwest(.0))]
    Network(#[source] reqwest::Error),
    #[error("unexpected response from the API: {0}")]
    InvalidResponse(String),
}

fn format_validation(message: &str, details: &[String]) -> String {
    if details.is_empty() {
        message.to_string()
    } else {
        format!("{message}: {}", details.join("; "))
    }
}

/// reqwest's Display stops at "error sending request"; the useful part is in the source chain.
pub fn describe_reqwest(err: &reqwest::Error) -> String {
    let mut out = err.to_string();
    let mut source = std::error::Error::source(err);
    while let Some(s) = source {
        let text = s.to_string();
        if !out.contains(&text) {
            out.push_str(": ");
            out.push_str(&text);
        }
        source = s.source();
    }
    out
}

impl ApiError {
    pub fn from_response(status: u16, body: Value, retry_after: Option<u64>) -> Self {
        let message = extract_message(&body);
        match status {
            401 | 403 => ApiError::Authentication {
                status,
                message: message
                    .unwrap_or_else(|| "Authentication failed. Please check your API key.".into()),
                body,
            },
            404 => ApiError::NotFound {
                message: message.unwrap_or_else(|| "The requested resource was not found.".into()),
                body,
            },
            409 => ApiError::Conflict {
                message: message
                    .unwrap_or_else(|| "Conflict - the created resource already exists.".into()),
                body,
            },
            400 | 422 => ApiError::Validation {
                status,
                message: message.unwrap_or_else(|| "Validation failed.".into()),
                details: extract_details(&body),
                body,
            },
            429 => ApiError::RateLimit {
                message: message
                    .unwrap_or_else(|| "Rate limit exceeded. Please try again later.".into()),
                retry_after,
                body,
            },
            _ => ApiError::Api {
                status,
                message: message.unwrap_or_else(|| "An unexpected error occurred".into()),
                body,
            },
        }
    }

    pub fn status(&self) -> Option<u16> {
        match self {
            ApiError::Authentication { status, .. }
            | ApiError::Validation { status, .. }
            | ApiError::Api { status, .. } => Some(*status),
            ApiError::NotFound { .. } => Some(404),
            ApiError::Conflict { .. } => Some(409),
            ApiError::RateLimit { .. } => Some(429),
            ApiError::Network(_) | ApiError::InvalidResponse(_) => None,
        }
    }

    pub fn body(&self) -> Option<&Value> {
        match self {
            ApiError::Authentication { body, .. }
            | ApiError::NotFound { body, .. }
            | ApiError::Conflict { body, .. }
            | ApiError::Validation { body, .. }
            | ApiError::RateLimit { body, .. }
            | ApiError::Api { body, .. } => Some(body),
            ApiError::Network(_) | ApiError::InvalidResponse(_) => None,
        }
    }

    pub fn is_transient(&self) -> bool {
        match self {
            ApiError::Network(_) => true,
            ApiError::Api { status, .. } => *status >= 500,
            _ => false,
        }
    }
}

fn extract_message(body: &Value) -> Option<String> {
    let obj = body.as_object()?;
    for key in ["message", "error_description", "error"] {
        match obj.get(key) {
            Some(Value::String(s)) if !s.is_empty() => return Some(s.clone()),
            Some(Value::Object(inner)) => {
                if let Some(Value::String(s)) = inner.get("message") {
                    return Some(s.clone());
                }
            }
            _ => {}
        }
    }
    None
}

fn extract_details(body: &Value) -> Vec<String> {
    let Some(errors) = body.get("errors").and_then(Value::as_array) else {
        return Vec::new();
    };
    errors
        .iter()
        .filter_map(|e| match e {
            Value::String(s) => Some(s.clone()),
            Value::Object(o) => {
                let message = o.get("message").and_then(Value::as_str)?;
                let param = o
                    .get("param")
                    .or_else(|| o.get("path"))
                    .or_else(|| o.get("field"))
                    .and_then(Value::as_str)
                    .filter(|p| !p.is_empty());
                Some(match param {
                    Some(p) => format!("{p}: {message}"),
                    None => message.to_string(),
                })
            }
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn maps_status_codes_to_error_kinds() {
        let e = ApiError::from_response(401, json!({"message": "Invalid API key"}), None);
        assert!(matches!(e, ApiError::Authentication { status: 401, .. }));
        assert_eq!(e.to_string(), "Invalid API key");

        assert!(matches!(
            ApiError::from_response(403, json!({}), None),
            ApiError::Authentication { status: 403, .. }
        ));
        assert!(matches!(
            ApiError::from_response(404, json!({}), None),
            ApiError::NotFound { .. }
        ));
        assert!(matches!(
            ApiError::from_response(409, json!({}), None),
            ApiError::Conflict { .. }
        ));
        assert!(matches!(
            ApiError::from_response(400, json!({}), None),
            ApiError::Validation { status: 400, .. }
        ));
        assert!(matches!(
            ApiError::from_response(422, json!({}), None),
            ApiError::Validation { status: 422, .. }
        ));
        assert!(matches!(
            ApiError::from_response(429, json!({}), Some(3)),
            ApiError::RateLimit {
                retry_after: Some(3),
                ..
            }
        ));
        let e = ApiError::from_response(502, Value::Null, None);
        assert_eq!(e.to_string(), "An unexpected error occurred (HTTP 502)");
        assert!(e.is_transient());
        assert_eq!(e.status(), Some(502));
    }

    #[test]
    fn falls_back_to_js_sdk_default_messages() {
        assert_eq!(
            ApiError::from_response(404, Value::String("<html>".into()), None).to_string(),
            "The requested resource was not found."
        );
        assert_eq!(
            ApiError::from_response(429, json!({}), None).to_string(),
            "Rate limit exceeded. Please try again later."
        );
        assert_eq!(
            ApiError::from_response(401, json!({"message": ""}), None).to_string(),
            "Authentication failed. Please check your API key."
        );
    }

    #[test]
    fn message_lookup_order() {
        let body = json!({"error": "invalid_grant", "error_description": "Code expired"});
        assert_eq!(extract_message(&body).as_deref(), Some("Code expired"));
        let body = json!({"error": {"message": "nested"}});
        assert_eq!(extract_message(&body).as_deref(), Some("nested"));
        let body = json!({"message": "first", "error": "second"});
        assert_eq!(extract_message(&body).as_deref(), Some("first"));
    }

    #[test]
    fn validation_details_are_listed() {
        let body = json!({
            "status": "error",
            "type": "ValidationError",
            "message": "Validation failed",
            "errors": [
                {"param": "code", "message": "Required"},
                {"param": "", "message": "Bad body"},
                "plain"
            ]
        });
        let e = ApiError::from_response(400, body, None);
        assert_eq!(
            e.to_string(),
            "Validation failed: code: Required; Bad body; plain"
        );
        assert!(!e.is_transient());
    }
}
