use std::io::IsTerminal;

const KEY_PREFIXES: &[&str] = &["sk_live_", "sk_test_"];

pub fn mask_key(key: &str) -> String {
    let prefix = KEY_PREFIXES
        .iter()
        .find(|p| key.starts_with(*p))
        .copied()
        .unwrap_or("");
    let rest = &key[prefix.len()..];
    let chars: Vec<char> = rest.chars().collect();
    if chars.len() < 8 {
        return format!("{prefix}****");
    }
    let last4: String = chars[chars.len() - 4..].iter().collect();
    format!("{prefix}...{last4}")
}

pub fn key_mode(key: &str) -> Option<&'static str> {
    if key.starts_with("sk_live_") {
        Some("live")
    } else if key.starts_with("sk_test_") {
        Some("test")
    } else {
        None
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Style {
    pub enabled: bool,
}

impl Style {
    pub fn detect(no_color_flag: bool, stream_is_tty: bool) -> Self {
        let no_color_env = std::env::var_os("NO_COLOR").is_some_and(|v| !v.is_empty());
        Style {
            enabled: !no_color_flag && !no_color_env && stream_is_tty,
        }
    }

    pub fn for_stderr(no_color_flag: bool) -> Self {
        Self::detect(no_color_flag, std::io::stderr().is_terminal())
    }

    pub fn for_stdout(no_color_flag: bool) -> Self {
        Self::detect(no_color_flag, std::io::stdout().is_terminal())
    }

    fn paint(&self, code: &str, s: &str) -> String {
        if self.enabled {
            format!("\x1b[{code}m{s}\x1b[0m")
        } else {
            s.to_string()
        }
    }

    pub fn bold(&self, s: &str) -> String {
        self.paint("1", s)
    }
    pub fn green(&self, s: &str) -> String {
        self.paint("32", s)
    }
    pub fn red(&self, s: &str) -> String {
        self.paint("31", s)
    }
    pub fn yellow(&self, s: &str) -> String {
        self.paint("33", s)
    }
    pub fn dim(&self, s: &str) -> String {
        self.paint("2", s)
    }
}

pub fn parse_key_value(s: &str) -> Result<(String, String), String> {
    match s.split_once('=') {
        Some((k, v)) if !k.is_empty() => Ok((k.to_string(), v.to_string())),
        _ => Err(format!("expected KEY=VALUE, got {s:?}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_keys_like_the_dashboard() {
        assert_eq!(mask_key("sk_live_fake-0123-4567"), "sk_live_...4567");
        assert_eq!(mask_key("sk_test_fake-aaaa-bbbb"), "sk_test_...bbbb");
        assert_eq!(mask_key("customkeyvalue9876"), "...9876");
        assert_eq!(mask_key("sk_live_short"), "sk_live_****");
        assert_eq!(mask_key(""), "****");
    }

    #[test]
    fn masked_key_never_contains_the_secret_body() {
        let key = "sk_live_fake-supe-1234";
        let masked = mask_key(key);
        assert!(!masked.contains("supersecret"));
        assert!(masked.len() < key.len());
    }

    #[test]
    fn detects_key_mode() {
        assert_eq!(key_mode("sk_live_x"), Some("live"));
        assert_eq!(key_mode("sk_test_x"), Some("test"));
        assert_eq!(key_mode("pk_x"), None);
    }

    #[test]
    fn style_disabled_paints_nothing() {
        let s = Style { enabled: false };
        assert_eq!(s.red("x"), "x");
        let s = Style { enabled: true };
        assert_eq!(s.green("ok"), "\x1b[32mok\x1b[0m");
        assert!(!Style::detect(true, true).enabled);
        assert!(!Style::detect(false, false).enabled);
    }

    #[test]
    fn key_value_parsing() {
        assert_eq!(
            parse_key_value("a=b=c"),
            Ok(("a".to_string(), "b=c".to_string()))
        );
        assert_eq!(parse_key_value("a="), Ok(("a".to_string(), String::new())));
        assert!(parse_key_value("=b").is_err());
        assert!(parse_key_value("ab").is_err());
    }
}
