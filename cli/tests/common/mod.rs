#![allow(dead_code)]

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, ExitStatus, Stdio};
use std::sync::mpsc::{Receiver, channel};
use std::thread;
use std::time::{Duration, Instant};

use assert_cmd::Command;
use tempfile::TempDir;

pub const BIN: &str = env!("CARGO_BIN_EXE_checkoutpage");

pub struct Env {
    pub dir: TempDir,
}

impl Env {
    pub fn new() -> Self {
        Env {
            dir: tempfile::tempdir().unwrap(),
        }
    }

    fn apply(&self, c: &mut std::process::Command) {
        c.env("CHECKOUTPAGE_CONFIG_DIR", self.dir.path())
            .env_remove("CHECKOUTPAGE_API_KEY")
            .env_remove("CHECKOUTPAGE_BASE_URL")
            .env_remove("CHECKOUTPAGE_PROFILE")
            .env("NO_COLOR", "1");
    }

    pub fn cmd(&self) -> Command {
        let mut std_cmd = std::process::Command::new(BIN);
        self.apply(&mut std_cmd);
        Command::from_std(std_cmd)
    }

    pub fn api(&self, base_url: &str) -> Command {
        let mut c = self.cmd();
        c.args(["--base-url", base_url, "--api-key", "sk_test_key"]);
        c
    }

    pub fn std_cmd(&self) -> std::process::Command {
        let mut c = std::process::Command::new(BIN);
        self.apply(&mut c);
        c
    }

    pub fn config_path(&self) -> PathBuf {
        self.dir.path().join("config.toml")
    }

    pub fn write_config(&self, text: &str) {
        std::fs::write(self.config_path(), text).unwrap();
    }

    pub fn read_config(&self) -> String {
        std::fs::read_to_string(self.config_path()).unwrap_or_default()
    }
}

pub fn stdout_of(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

pub fn stderr_of(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

pub struct Proc {
    child: Child,
    rx: Receiver<String>,
    pub lines: Vec<String>,
}

impl Proc {
    pub fn spawn(mut cmd: std::process::Command) -> Self {
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        let mut child = cmd.spawn().expect("spawn checkoutpage");
        let (tx, rx) = channel();
        for (tag, stream) in [
            (
                "out",
                Box::new(child.stdout.take().unwrap()) as Box<dyn Read + Send>,
            ),
            (
                "err",
                Box::new(child.stderr.take().unwrap()) as Box<dyn Read + Send>,
            ),
        ] {
            let tx = tx.clone();
            thread::spawn(move || {
                for line in BufReader::new(stream).lines() {
                    let Ok(line) = line else { break };
                    if tx.send(format!("{tag}: {line}")).is_err() {
                        break;
                    }
                }
            });
        }
        Proc {
            child,
            rx,
            lines: Vec::new(),
        }
    }

    pub fn wait_for(&mut self, needle: &str, timeout: Duration) -> String {
        self.wait_until(|l| l.contains(needle), timeout)
            .unwrap_or_else(|| {
                panic!(
                    "timed out waiting for {needle:?}. Output so far:\n{}",
                    self.lines.join("\n")
                )
            })
    }

    pub fn wait_until(&mut self, pred: impl Fn(&str) -> bool, timeout: Duration) -> Option<String> {
        if let Some(l) = self.lines.iter().find(|l| pred(l)) {
            return Some(l.clone());
        }
        let deadline = Instant::now() + timeout;
        loop {
            let left = deadline.checked_duration_since(Instant::now())?;
            match self.rx.recv_timeout(left) {
                Ok(line) => {
                    let hit = pred(&line);
                    self.lines.push(line.clone());
                    if hit {
                        return Some(line);
                    }
                }
                Err(_) => return None,
            }
        }
    }

    pub fn drain(&mut self) -> String {
        while let Ok(l) = self.rx.try_recv() {
            self.lines.push(l);
        }
        self.lines.join("\n")
    }

    pub fn wait_exit(&mut self, timeout: Duration) -> ExitStatus {
        let deadline = Instant::now() + timeout;
        loop {
            if let Some(status) = self.child.try_wait().unwrap() {
                // Let the reader threads flush the tail of the output.
                thread::sleep(Duration::from_millis(50));
                self.drain();
                return status;
            }
            if Instant::now() > deadline {
                panic!("process did not exit. Output:\n{}", self.drain());
            }
            thread::sleep(Duration::from_millis(20));
        }
    }
}

impl Drop for Proc {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn closed_port() -> u16 {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    l.local_addr().unwrap().port()
}

pub fn http_get(url: &str) -> String {
    let parsed = url::Url::parse(url).unwrap();
    let mut s = TcpStream::connect((parsed.host_str().unwrap(), parsed.port().unwrap())).unwrap();
    let target = match parsed.query() {
        Some(q) => format!("{}?{q}", parsed.path()),
        None => parsed.path().to_string(),
    };
    write!(
        s,
        "GET {target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    let mut out = String::new();
    s.read_to_string(&mut out).unwrap();
    out
}
