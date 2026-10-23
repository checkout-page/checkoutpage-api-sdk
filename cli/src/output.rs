use std::fmt::Display;
use std::io::Write;

use comfy_table::{ContentArrangement, Table, presets};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Table,
    Json,
    Csv,
}

/// Writes a line to stdout. A closed pipe (`checkoutpage payments list | head`) ends the
/// process quietly instead of panicking like `println!` does.
pub fn out(line: impl Display) {
    let mut stdout = std::io::stdout().lock();
    if let Err(e) = writeln!(stdout, "{line}").and_then(|_| stdout.flush()) {
        if e.kind() == std::io::ErrorKind::BrokenPipe {
            std::process::exit(0);
        }
    }
}

pub fn err(line: impl Display) {
    let _ = writeln!(std::io::stderr().lock(), "{line}");
}

pub fn to_pretty_json(v: &Value) -> String {
    serde_json::to_string_pretty(v).unwrap_or_else(|_| v.to_string())
}

const MAX_CELL: usize = 48;

/// Cells hold customer-entered text, so escape sequences must not reach the terminal.
fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect()
}

fn truncate(s: &str, max: usize) -> String {
    let single_line = sanitize(s);
    if single_line.chars().count() <= max {
        single_line
    } else {
        let mut t: String = single_line.chars().take(max - 1).collect();
        t.push('…');
        t
    }
}

fn trim_lines(s: String) -> String {
    s.lines()
        .map(|l| l.trim().to_string())
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn render_table(headers: &[&str], rows: &[Vec<String>]) -> String {
    let mut table = Table::new();
    table
        .load_preset(presets::NOTHING)
        .set_content_arrangement(ContentArrangement::Disabled)
        .set_header(headers.iter().map(|h| h.to_string()));
    for row in rows {
        table.add_row(row.iter().map(|c| truncate(c, MAX_CELL)));
    }
    trim_lines(table.to_string())
}

pub fn render_detail(pairs: &[(&str, String)]) -> String {
    let mut table = Table::new();
    table
        .load_preset(presets::NOTHING)
        .set_content_arrangement(ContentArrangement::Disabled);
    for (k, v) in pairs {
        table.add_row(vec![k.to_string(), sanitize(v)]);
    }
    trim_lines(table.to_string())
}

/// Spreadsheets run a cell starting with one of these as a formula (OWASP CSV injection).
fn escape_formula(cell: &str) -> std::borrow::Cow<'_, str> {
    let risky = cell.starts_with(['=', '+', '-', '@', '\t', '\r']);
    if risky && cell.parse::<f64>().is_err() {
        format!("'{cell}").into()
    } else {
        cell.into()
    }
}

pub fn render_csv(headers: &[&str], rows: &[Vec<String>]) -> anyhow::Result<String> {
    let mut w = csv::Writer::from_writer(Vec::new());
    w.write_record(headers)?;
    for row in rows {
        w.write_record(row.iter().map(|c| escape_formula(c).into_owned()))?;
    }
    let bytes = w.into_inner().map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(String::from_utf8(bytes)?.trim_end().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_is_compact_and_aligned() {
        let t = render_table(
            &["ID", "NAME"],
            &[
                vec!["a1".into(), "First".into()],
                vec!["b22".into(), "Second".into()],
            ],
        );
        let lines: Vec<_> = t.lines().collect();
        assert_eq!(lines.len(), 3);
        assert!(lines[0].starts_with("ID"));
        let col = lines[0].find("NAME").unwrap();
        assert_eq!(lines[1].find("First"), Some(col));
        assert_eq!(lines[2].find("Second"), Some(col));
    }

    #[test]
    fn long_and_multiline_cells_are_flattened_and_truncated() {
        let long = "x".repeat(100);
        let t = render_table(&["A"], &[vec![long], vec!["two\nlines".into()]]);
        assert!(t.contains('…'));
        assert!(t.contains("two lines"));
        assert!(t.lines().all(|l| l.chars().count() <= MAX_CELL));
    }

    #[test]
    fn csv_quotes_when_needed() {
        let c = render_csv(&["id", "name"], &[vec!["1".into(), "Smith, \"Jo\"".into()]]).unwrap();
        assert_eq!(c, "id,name\n1,\"Smith, \"\"Jo\"\"\"");
    }

    #[test]
    fn csv_neutralises_formulas_but_keeps_numbers() {
        let c = render_csv(
            &["a", "b", "c", "d", "e", "f", "g"],
            &[vec![
                "=HYPERLINK(\"x\")".into(),
                "+cmd".into(),
                "-2+3".into(),
                "@SUM(A1)".into(),
                "\tx".into(),
                "-12.50".into(),
                "+5".into(),
            ]],
        )
        .unwrap();
        let row = c.lines().nth(1).unwrap();
        assert_eq!(
            row,
            "\"'=HYPERLINK(\"\"x\"\")\",'+cmd,'-2+3,'@SUM(A1),'\tx,-12.50,+5"
        );
    }

    #[test]
    fn control_characters_never_reach_the_terminal() {
        let evil = "a\u{1b}]52;c;aGk=\u{7}b\u{9b}31mc\td";
        let t = render_table(&["A"], &[vec![evil.into()]]);
        let d = render_detail(&[("name", evil.into())]);
        for out in [t, d] {
            assert!(!out.chars().any(|c| c.is_control() && c != '\n'), "{out:?}");
            assert!(out.contains("a ]52;c;aGk= b 31mc d"), "{out:?}");
        }
    }

    #[test]
    fn detail_view_has_one_row_per_field() {
        let d = render_detail(&[("id", "x".into()), ("email", "a@b.c".into())]);
        assert_eq!(d.lines().count(), 2);
        assert!(d.lines().nth(1).unwrap().ends_with("a@b.c"));
    }
}
