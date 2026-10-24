//! The secret is used as-is (its UTF-8 bytes), never hex-decoded.

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub const SIGNATURE_HEADER: &str = "X-Webhook-Signature";
pub const TIMESTAMP_HEADER: &str = "X-Webhook-Timestamp";

pub fn sign(secret: &str, body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC takes any key length");
    mac.update(body);
    format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
}

/// Constant-time check of a `sha256=<hex>` header value.
pub fn verify(secret: &str, body: &[u8], header: &str) -> bool {
    let Some(hex_sig) = header.trim().strip_prefix("sha256=") else {
        return false;
    };
    let Ok(expected) = hex::decode(hex_sig) else {
        return false;
    };
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC takes any key length");
    mac.update(body);
    mac.verify_slice(&expected).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Both computed with Node: crypto.createHmac('sha256', secret).update(payload).digest('hex')
    #[test]
    fn matches_node_create_hmac() {
        let body = br#"{"event":"payment.paid","data":{"id":"p_1","amount":1999}}"#;
        assert_eq!(
            sign("whsec_test_secret", body),
            "sha256=4f6782d3546d5c3b98f87f4a8163184c1d6bd84d7da51e345eb89ad17e996171"
        );
    }

    #[test]
    fn matches_node_for_multibyte_utf8_and_hex_secret() {
        let secret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let body = "{\"emoji\":\"caf\u{e9} \u{2615}\"}".as_bytes();
        assert_eq!(
            sign(secret, body),
            "sha256=857f63102bc7d673f499a1c8872a57bd21e25fa11f6942e296d0b300c044a691"
        );
    }

    #[test]
    fn verify_round_trip_and_rejections() {
        let sig = sign("s3cret", b"payload");
        assert!(verify("s3cret", b"payload", &sig));
        assert!(!verify("s3cret", b"payload ", &sig));
        assert!(!verify("other", b"payload", &sig));
        assert!(!verify(
            "s3cret",
            b"payload",
            sig.trim_start_matches("sha256=")
        ));
        assert!(!verify("s3cret", b"payload", "sha256=zz"));
        assert!(!verify("s3cret", b"payload", "sha256="));
    }
}
