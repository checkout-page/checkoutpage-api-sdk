//! Amounts in the API are integers in the currency's smallest unit (Stripe's convention).

const ZERO_DECIMAL: &[&str] = &[
    "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv",
    "xaf", "xof", "xpf",
];
const THREE_DECIMAL: &[&str] = &["bhd", "jod", "kwd", "omr", "tnd"];

pub fn exponent(currency: &str) -> u32 {
    let c = currency.to_ascii_lowercase();
    if ZERO_DECIMAL.contains(&c.as_str()) {
        0
    } else if THREE_DECIMAL.contains(&c.as_str()) {
        3
    } else {
        2
    }
}

fn symbol(currency: &str) -> Option<&'static str> {
    Some(match currency.to_ascii_lowercase().as_str() {
        "usd" => "$",
        "gbp" => "£",
        "eur" => "€",
        "jpy" => "¥",
        "cad" => "CA$",
        "aud" => "A$",
        "nzd" => "NZ$",
        "inr" => "₹",
        _ => return None,
    })
}

fn split(amount: i64, currency: &str) -> (bool, String, String) {
    let exp = exponent(currency);
    let negative = amount < 0;
    let abs = amount.unsigned_abs();
    let divisor = 10u64.pow(exp);
    let whole = (abs / divisor).to_string();
    let frac = if exp == 0 {
        String::new()
    } else {
        format!("{:0width$}", abs % divisor, width = exp as usize)
    };
    (negative, whole, frac)
}

fn group_thousands(digits: &str) -> String {
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

pub fn format_decimal(amount: i64, currency: &str) -> String {
    let (negative, whole, frac) = split(amount, currency);
    let sign = if negative { "-" } else { "" };
    if frac.is_empty() {
        format!("{sign}{whole}")
    } else {
        format!("{sign}{whole}.{frac}")
    }
}

pub fn format_money(amount: i64, currency: &str) -> String {
    let (negative, whole, frac) = split(amount, currency);
    let sign = if negative { "-" } else { "" };
    let mut number = group_thousands(&whole);
    if !frac.is_empty() {
        number.push('.');
        number.push_str(&frac);
    }
    match symbol(currency) {
        Some(sym) => format!("{sign}{sym}{number}"),
        None => format!("{sign}{number} {}", currency.to_ascii_uppercase()),
    }
}

pub fn parse_major(input: &str, currency: &str) -> Result<i64, String> {
    let exp = exponent(currency) as usize;
    let s = input.trim();
    let (whole, frac) = s.split_once('.').unwrap_or((s, ""));
    let digits_only = |p: &str| p.bytes().all(|b| b.is_ascii_digit());
    if whole.is_empty()
        || !digits_only(whole)
        || !digits_only(frac)
        || (s.contains('.') && frac.is_empty())
    {
        return Err(format!(
            "{input:?} is not a positive amount like 10 or 10.50"
        ));
    }
    if frac.len() > exp {
        return Err(if exp == 0 {
            format!(
                "{} has no minor unit, so {input:?} can't have decimals",
                currency.to_ascii_uppercase()
            )
        } else {
            format!(
                "{input:?} has more than {exp} decimal places for {}",
                currency.to_ascii_uppercase()
            )
        });
    }
    let combined = format!("{whole}{frac:0<exp$}");
    combined
        .parse::<i64>()
        .map_err(|_| format!("{input:?} is too large"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_two_decimal_currencies() {
        assert_eq!(format_money(123456, "usd"), "$1,234.56");
        assert_eq!(format_money(5, "USD"), "$0.05");
        assert_eq!(format_money(0, "gbp"), "£0.00");
        assert_eq!(format_money(100000000, "eur"), "€1,000,000.00");
        assert_eq!(format_money(-500, "usd"), "-$5.00");
        assert_eq!(format_money(1999, "chf"), "19.99 CHF");
    }

    #[test]
    fn formats_zero_decimal_currencies() {
        assert_eq!(format_money(1500, "jpy"), "¥1,500");
        assert_eq!(format_money(1500, "JPY"), "¥1,500");
        assert_eq!(format_money(990, "krw"), "990 KRW");
        assert_eq!(format_decimal(1500, "jpy"), "1500");
        assert_eq!(format_decimal(25000, "clp"), "25000");
    }

    #[test]
    fn formats_three_decimal_currencies() {
        assert_eq!(format_money(1234, "kwd"), "1.234 KWD");
        assert_eq!(format_decimal(5, "bhd"), "0.005");
    }

    #[test]
    fn plain_decimal_for_csv() {
        assert_eq!(format_decimal(123456, "usd"), "1234.56");
        assert_eq!(format_decimal(-1, "usd"), "-0.01");
        assert_eq!(format_decimal(i64::MIN, "usd"), "-92233720368547758.08");
    }

    #[test]
    fn groups_thousands() {
        assert_eq!(group_thousands("1"), "1");
        assert_eq!(group_thousands("123"), "123");
        assert_eq!(group_thousands("1234"), "1,234");
        assert_eq!(group_thousands("1234567"), "1,234,567");
    }

    #[test]
    fn parses_major_units() {
        assert_eq!(parse_major("10", "usd"), Ok(1000));
        assert_eq!(parse_major("10.5", "usd"), Ok(1050));
        assert_eq!(parse_major("10.50", "gbp"), Ok(1050));
        assert_eq!(parse_major("0.01", "usd"), Ok(1));
        assert_eq!(parse_major("500", "jpy"), Ok(500));
        assert_eq!(parse_major("1.5", "kwd"), Ok(1500));
        assert!(parse_major("500.5", "jpy").is_err());
        assert!(parse_major("10.505", "usd").is_err());
        assert!(parse_major("-1", "usd").is_err());
        assert!(parse_major("1e3", "usd").is_err());
        assert!(parse_major("", "usd").is_err());
        assert!(parse_major(".5", "usd").is_err());
        assert!(parse_major("5.", "usd").is_err());
        assert!(parse_major("99999999999999999999", "usd").is_err());
    }
}
