//! Incremental `text/event-stream` parser following the WHATWG HTML "event stream
//! interpretation" rules. Feed it raw chunks in any split; it yields complete events.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseEvent {
    pub event: String,
    pub data: String,
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SseItem {
    Event(SseEvent),
    Comment(String),
    /// A `retry:` field, in milliseconds.
    Retry(u64),
}

#[derive(Debug, Default)]
pub struct SseParser {
    line: Vec<u8>,
    after_cr: bool,
    started: bool,
    event_type: Option<String>,
    data: String,
    has_data: bool,
    id: Option<String>,
    last_event_id: Option<String>,
}

impl SseParser {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn last_event_id(&self) -> Option<&str> {
        self.last_event_id.as_deref()
    }

    pub fn feed(&mut self, chunk: &[u8]) -> Vec<SseItem> {
        let mut out = Vec::new();
        for &b in chunk {
            if self.after_cr {
                self.after_cr = false;
                if b == b'\n' {
                    continue;
                }
            }
            match b {
                b'\r' => {
                    self.after_cr = true;
                    self.end_line(&mut out);
                }
                b'\n' => self.end_line(&mut out),
                _ => self.line.push(b),
            }
        }
        out
    }

    fn end_line(&mut self, out: &mut Vec<SseItem>) {
        let raw = std::mem::take(&mut self.line);
        let mut line = String::from_utf8_lossy(&raw).into_owned();
        if !self.started {
            self.started = true;
            if let Some(stripped) = line.strip_prefix('\u{feff}') {
                line = stripped.to_string();
            }
        }

        if line.is_empty() {
            self.dispatch(out);
            return;
        }
        if let Some(comment) = line.strip_prefix(':') {
            out.push(SseItem::Comment(
                comment.strip_prefix(' ').unwrap_or(comment).to_string(),
            ));
            return;
        }
        let (field, value) = match line.split_once(':') {
            Some((f, v)) => (f, v.strip_prefix(' ').unwrap_or(v)),
            None => (line.as_str(), ""),
        };
        match field {
            "event" => self.event_type = Some(value.to_string()),
            "data" => {
                if self.has_data {
                    self.data.push('\n');
                }
                self.data.push_str(value);
                self.has_data = true;
            }
            "id" if !value.contains('\0') => {
                self.id = Some(value.to_string());
                self.last_event_id = Some(value.to_string());
            }
            "retry" if !value.is_empty() && value.bytes().all(|c| c.is_ascii_digit()) => {
                if let Ok(ms) = value.parse() {
                    out.push(SseItem::Retry(ms));
                }
            }
            _ => {}
        }
    }

    fn dispatch(&mut self, out: &mut Vec<SseItem>) {
        let event_type = self.event_type.take();
        let id = self.id.take();
        if !self.has_data {
            self.data.clear();
            return;
        }
        self.has_data = false;
        out.push(SseItem::Event(SseEvent {
            event: event_type
                .filter(|t| !t.is_empty())
                .unwrap_or_else(|| "message".into()),
            data: std::mem::take(&mut self.data),
            id,
        }));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn events(items: Vec<SseItem>) -> Vec<SseEvent> {
        items
            .into_iter()
            .filter_map(|i| match i {
                SseItem::Event(e) => Some(e),
                _ => None,
            })
            .collect()
    }

    fn ev(event: &str, data: &str, id: Option<&str>) -> SseEvent {
        SseEvent {
            event: event.into(),
            data: data.into(),
            id: id.map(Into::into),
        }
    }

    #[test]
    fn parses_named_event_with_id() {
        let mut p = SseParser::new();
        let out = events(p.feed(b"event: webhook\nid: evt_1\ndata: {\"a\":1}\n\n"));
        assert_eq!(out, vec![ev("webhook", "{\"a\":1}", Some("evt_1"))]);
        assert_eq!(p.last_event_id(), Some("evt_1"));
    }

    #[test]
    fn joins_multi_line_data() {
        let mut p = SseParser::new();
        let out = events(p.feed(b"data: line one\ndata:line two\ndata\ndata: \n\n"));
        assert_eq!(out, vec![ev("message", "line one\nline two\n\n", None)]);
    }

    #[test]
    fn crlf_and_cr_line_endings() {
        let mut p = SseParser::new();
        let out = events(p.feed(b"event: a\r\ndata: 1\r\n\r\nevent: b\rdata: 2\r\r"));
        assert_eq!(out, vec![ev("a", "1", None), ev("b", "2", None)]);
    }

    #[test]
    fn crlf_split_across_chunks_is_one_line_ending() {
        let mut p = SseParser::new();
        let mut out = p.feed(b"data: x\r");
        out.extend(p.feed(b"\n\r"));
        out.extend(p.feed(b"\n"));
        assert_eq!(events(out), vec![ev("message", "x", None)]);
    }

    #[test]
    fn handles_arbitrary_chunk_boundaries_including_mid_utf8() {
        let stream = "event: webhook\nid: e\u{e9}\ndata: {\"name\":\"caf\u{e9} \u{2615}\"}\n\n";
        let bytes = stream.as_bytes();
        for split in 1..bytes.len() {
            let mut p = SseParser::new();
            let mut out = p.feed(&bytes[..split]);
            out.extend(p.feed(&bytes[split..]));
            assert_eq!(
                events(out),
                vec![ev(
                    "webhook",
                    "{\"name\":\"caf\u{e9} \u{2615}\"}",
                    Some("e\u{e9}")
                )],
                "split at {split}"
            );
        }
        let mut p = SseParser::new();
        let mut out = Vec::new();
        for b in bytes {
            out.extend(p.feed(std::slice::from_ref(b)));
        }
        assert_eq!(events(out).len(), 1);
    }

    #[test]
    fn comments_are_reported_and_do_not_dispatch() {
        let mut p = SseParser::new();
        let out = p.feed(b": ping\n\n:raw\ndata: d\n\n");
        assert_eq!(
            out,
            vec![
                SseItem::Comment("ping".into()),
                SseItem::Comment("raw".into()),
                SseItem::Event(ev("message", "d", None)),
            ]
        );
    }

    #[test]
    fn event_without_data_is_dropped_and_type_reset() {
        let mut p = SseParser::new();
        let out = events(p.feed(b"event: lonely\n\ndata: next\n\n"));
        assert_eq!(out, vec![ev("message", "next", None)]);
    }

    #[test]
    fn incomplete_event_is_not_dispatched() {
        let mut p = SseParser::new();
        assert!(events(p.feed(b"event: webhook\ndata: {}\n")).is_empty());
        assert_eq!(events(p.feed(b"\n")), vec![ev("webhook", "{}", None)]);
    }

    #[test]
    fn strips_only_one_leading_space_and_keeps_colons_in_value() {
        let mut p = SseParser::new();
        let out = events(p.feed(b"data:  two spaces: and:colons\n\n"));
        assert_eq!(out, vec![ev("message", " two spaces: and:colons", None)]);
    }

    #[test]
    fn strips_leading_bom_once() {
        let mut p = SseParser::new();
        let out = events(p.feed("\u{feff}data: a\n\n\u{feff}data: b\n\n".as_bytes()));
        assert_eq!(out[0].data, "a");
        assert_eq!(
            out.len(),
            1,
            "a BOM after the first line makes an unknown field"
        );
    }

    #[test]
    fn retry_and_unknown_fields() {
        let mut p = SseParser::new();
        let out = p.feed(b"retry: 3000\nretry: soon\nfoo: bar\nid: has\0nul\ndata: x\n\n");
        assert_eq!(
            out,
            vec![
                SseItem::Retry(3000),
                SseItem::Event(ev("message", "x", None))
            ]
        );
    }

    #[test]
    fn id_is_per_event_but_last_event_id_persists() {
        let mut p = SseParser::new();
        let out = events(p.feed(b"id: 1\ndata: a\n\ndata: b\n\n"));
        assert_eq!(out[0].id.as_deref(), Some("1"));
        assert_eq!(out[1].id, None);
        assert_eq!(p.last_event_id(), Some("1"));
    }

    #[test]
    fn contract_frames() {
        let mut p = SseParser::new();
        let stream = concat!(
            "event: ready\n",
            "data: {\"id\":\"wl_1\",\"secret\":\"abc\",\"events\":[\"payment.paid\"],\"expiresAt\":\"2026-01-01T00:00:00.000Z\"}\n\n",
            ": ping\n\n",
            "event: webhook\nid: evt_9\ndata: {\"event\":\"payment.paid\"}\n\n",
            "event: expired\ndata: {}\n\n",
        );
        let out = events(p.feed(stream.as_bytes()));
        let names: Vec<_> = out.iter().map(|e| e.event.as_str()).collect();
        assert_eq!(names, ["ready", "webhook", "expired"]);
        assert_eq!(out[2].data, "{}");
    }
}
