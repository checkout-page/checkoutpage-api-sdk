use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::RngCore;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

impl Pkce {
    pub fn generate() -> Self {
        Self::from_verifier(random_urlsafe(32))
    }

    pub fn from_verifier(verifier: String) -> Self {
        let challenge = challenge_for(&verifier);
        Pkce {
            verifier,
            challenge,
        }
    }
}

pub fn challenge_for(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

pub fn random_urlsafe(n: usize) -> String {
    let mut bytes = vec![0u8; n];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc7636_appendix_b_vector() {
        let p = Pkce::from_verifier("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk".into());
        assert_eq!(p.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn generated_verifier_meets_rfc_length_and_charset() {
        let p = Pkce::generate();
        assert!((43..=128).contains(&p.verifier.len()));
        assert!(
            p.verifier
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-._~".contains(c))
        );
        assert_eq!(p.challenge, challenge_for(&p.verifier));
        assert_ne!(Pkce::generate().verifier, p.verifier);
    }
}
