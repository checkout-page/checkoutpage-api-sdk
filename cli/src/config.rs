use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const CONFIG_DIR_ENV: &str = "CHECKOUTPAGE_CONFIG_DIR";

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub profiles: BTreeMap<String, Profile>,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Profile {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub oauth: Option<OAuthCredentials>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OAuthCredentials {
    pub client_id: String,
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token_expires_at: Option<DateTime<Utc>>,
    /// The `sk_...` key issued for the access token; what `/v1` calls actually use. Empty after
    /// a refresh whose key issue failed, since the refresh deletes the old key on the server.
    #[serde(default)]
    pub api_key: String,
    pub api_key_expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Renewal {
    None,
    ReissueKey,
    Refresh,
}

impl OAuthCredentials {
    /// Renews a minute early so a key or token doesn't expire mid-request.
    pub fn renewal(&self, now: DateTime<Utc>) -> Renewal {
        let early = now + chrono::Duration::seconds(60);
        if !self.api_key.is_empty() && self.api_key_expires_at > early {
            Renewal::None
        } else if self.access_token_expires_at.is_some_and(|exp| exp > early) {
            Renewal::ReissueKey
        } else {
            Renewal::Refresh
        }
    }
}

pub fn config_dir() -> Result<PathBuf> {
    if let Some(dir) = std::env::var_os(CONFIG_DIR_ENV).filter(|v| !v.is_empty()) {
        return Ok(PathBuf::from(dir));
    }
    dirs::config_dir()
        .map(|d| d.join("checkoutpage"))
        .ok_or_else(|| anyhow!("could not find a config directory; set {CONFIG_DIR_ENV}"))
}

pub fn config_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("config.toml"))
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        match fs::read_to_string(path) {
            Ok(text) => {
                toml::from_str(&text).with_context(|| format!("could not parse {}", path.display()))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Config::default()),
            Err(e) => Err(e).with_context(|| format!("could not read {}", path.display())),
        }
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        let dir = path
            .parent()
            .ok_or_else(|| anyhow!("config path has no parent directory"))?;
        create_private_dir(dir)?;
        let text = toml::to_string_pretty(self)?;
        let tmp = dir.join(format!(".config.toml.{}.tmp", std::process::id()));
        {
            let mut file =
                open_private(&tmp).with_context(|| format!("could not write {}", tmp.display()))?;
            file.write_all(text.as_bytes())?;
            file.sync_all()?;
        }
        fs::rename(&tmp, path).with_context(|| format!("could not write {}", path.display()))?;
        set_private(path)?;
        Ok(())
    }
}

#[cfg(unix)]
fn create_private_dir(dir: &Path) -> Result<()> {
    use std::os::unix::fs::DirBuilderExt;
    if dir.exists() {
        return Ok(());
    }
    fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(dir)
        .with_context(|| format!("could not create {}", dir.display()))
}

#[cfg(not(unix))]
fn create_private_dir(dir: &Path) -> Result<()> {
    fs::create_dir_all(dir).with_context(|| format!("could not create {}", dir.display()))
}

#[cfg(unix)]
fn open_private(path: &Path) -> std::io::Result<fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
}

#[cfg(not(unix))]
fn open_private(path: &Path) -> std::io::Result<fs::File> {
    fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)
}

#[cfg(unix)]
fn set_private(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    Ok(())
}

// On Windows the file sits in the user's own AppData folder, whose ACL already keeps other users out.
#[cfg(not(unix))]
fn set_private(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn sample() -> Config {
        let mut c = Config::default();
        c.profiles.insert(
            "default".into(),
            Profile {
                base_url: Some("http://localhost:8080".into()),
                api_key: Some("sk_test_abc".into()),
                oauth: None,
            },
        );
        c.profiles.insert(
            "work".into(),
            Profile {
                base_url: None,
                api_key: None,
                oauth: Some(OAuthCredentials {
                    client_id: "cid".into(),
                    access_token: "at".into(),
                    refresh_token: Some("rt".into()),
                    access_token_expires_at: None,
                    api_key: "sk_live_issued".into(),
                    api_key_expires_at: Utc.with_ymd_and_hms(2030, 1, 2, 3, 4, 5).unwrap(),
                }),
            },
        );
        c
    }

    #[test]
    fn round_trips_profiles() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("config.toml");
        let c = sample();
        c.save(&path).unwrap();
        assert_eq!(Config::load(&path).unwrap(), c);
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.contains("[profiles.work.oauth]"), "{text}");
        assert!(
            text.contains("api_key_expires_at = \"2030-01-02T03:04:05Z\""),
            "{text}"
        );
    }

    #[test]
    fn missing_file_is_empty_config() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            Config::load(&dir.path().join("config.toml")).unwrap(),
            Config::default()
        );
    }

    #[test]
    fn invalid_file_is_an_error_naming_the_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "profiles = 3").unwrap();
        let err = Config::load(&path).unwrap_err().to_string();
        assert!(err.contains("config.toml"), "{err}");
    }

    #[cfg(unix)]
    #[test]
    fn file_is_0600_and_dir_0700() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let cfg_dir = dir.path().join("cp");
        let path = cfg_dir.join("config.toml");
        sample().save(&path).unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let dmode = fs::metadata(&cfg_dir).unwrap().permissions().mode() & 0o777;
        assert_eq!(dmode, 0o700);

        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        sample().save(&path).unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "an existing loose file is tightened on save");
        assert_eq!(
            fs::read_dir(&cfg_dir).unwrap().count(),
            1,
            "no temp file left"
        );
    }

    #[test]
    fn refresh_window() {
        let mut creds = sample().profiles["work"].oauth.clone().unwrap();
        let exp = creds.api_key_expires_at;
        assert_eq!(
            creds.renewal(exp - chrono::Duration::minutes(5)),
            Renewal::None
        );
        assert_eq!(
            creds.renewal(exp - chrono::Duration::seconds(30)),
            Renewal::Refresh
        );
        assert_eq!(
            creds.renewal(exp + chrono::Duration::seconds(1)),
            Renewal::Refresh
        );

        creds.access_token_expires_at = Some(exp + chrono::Duration::hours(1));
        assert_eq!(
            creds.renewal(exp - chrono::Duration::minutes(5)),
            Renewal::None
        );
        assert_eq!(
            creds.renewal(exp + chrono::Duration::seconds(1)),
            Renewal::ReissueKey
        );
        creds.api_key.clear();
        assert_eq!(
            creds.renewal(exp - chrono::Duration::minutes(5)),
            Renewal::ReissueKey
        );
        assert_eq!(
            creds.renewal(exp + chrono::Duration::hours(2)),
            Renewal::Refresh
        );
    }
}
