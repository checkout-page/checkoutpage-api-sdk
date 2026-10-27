use anyhow::Result;
use serde_json::{Map, Value, json};

use super::read_data;
use super::resources::{BOOKINGS, COUPONS, print_record};
use crate::app::{App, CliError};
use crate::cli::{BookingCreateArgs, CouponCreateArgs};
use crate::money::parse_major;

fn base_body(data: &Option<String>) -> Result<Map<String, Value>> {
    match data {
        None => Ok(Map::new()),
        Some(d) => match read_data(d)? {
            Value::Object(m) => Ok(m),
            _ => Err(CliError::Usage("--data must be a JSON object".into()).into()),
        },
    }
}

fn merge_map(
    body: &mut Map<String, Value>,
    key: &str,
    entries: impl Iterator<Item = (String, Value)>,
) {
    let mut entries = entries.peekable();
    if entries.peek().is_none() {
        return;
    }
    let target = body
        .entry(key.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !target.is_object() {
        *target = Value::Object(Map::new());
    }
    let obj = target.as_object_mut().expect("just made it an object");
    for (k, v) in entries {
        obj.insert(k, v);
    }
}

pub fn booking_body(args: &BookingCreateArgs) -> Result<Value> {
    let mut body = base_body(&args.data)?;
    if let Some(event) = &args.event {
        body.insert("eventId".into(), json!(event));
    }
    merge_map(
        &mut body,
        "tickets",
        args.tickets.iter().map(|(k, n)| (k.clone(), json!(n))),
    );
    merge_map(
        &mut body,
        "ticketPwywAmounts",
        args.pwyw.iter().map(|(k, n)| (k.clone(), json!(n))),
    );
    merge_map(
        &mut body,
        "queryParameters",
        args.query_params.iter().map(|(k, v)| (k.clone(), json!(v))),
    );
    if !args.fields.is_empty() {
        let fields = body
            .entry("fields")
            .or_insert_with(|| Value::Array(Vec::new()));
        if !fields.is_array() {
            *fields = Value::Array(Vec::new());
        }
        let list = fields.as_array_mut().expect("just made it an array");
        for (id, value) in &args.fields {
            list.retain(|f| f.get("fieldId").and_then(Value::as_str) != Some(id));
            list.push(json!({ "fieldId": id, "value": value }));
        }
    }
    if args.complimentary {
        body.insert("complimentary".into(), json!(true));
    }
    if let Some(p) = &args.payment {
        body.insert("paymentOption".into(), json!({ "manualType": p }));
    }
    if let Some(c) = &args.coupon {
        body.insert("couponId".into(), json!(c));
    }
    if !body.contains_key("eventId") {
        return Err(CliError::Usage("--event is required".into()).into());
    }
    if !body.contains_key("tickets") {
        return Err(CliError::Usage("add at least one --ticket TICKET_TYPE_ID=QTY".into()).into());
    }
    Ok(Value::Object(body))
}

pub fn coupon_body(args: &CouponCreateArgs) -> Result<Value> {
    let mut body = base_body(&args.data)?;
    let usage = |m: &str| -> anyhow::Error { CliError::Usage(m.to_string()).into() };
    if let Some(code) = &args.code {
        body.insert("code".into(), json!(code));
    }
    if let Some(label) = &args.label {
        body.insert("label".into(), json!(label));
    } else if !body.contains_key("label") {
        if let Some(code) = body.get("code").cloned() {
            body.insert("label".into(), code);
        }
    }
    if let Some(p) = args.percent_off {
        if !(p > 0.0 && p <= 100.0) {
            return Err(usage("--percent-off must be more than 0 and at most 100"));
        }
        body.remove("amountOff");
        body.remove("currency");
        let n = if p.fract() == 0.0 {
            json!(p as i64)
        } else {
            json!(p)
        };
        body.insert("percentOff".into(), n);
    }
    if let (Some(amount), Some(currency)) = (&args.amount_off, &args.currency) {
        let minor =
            parse_major(amount, currency).map_err(|e| usage(&format!("--amount-off: {e}")))?;
        if minor <= 0 {
            return Err(usage("--amount-off must be more than 0"));
        }
        body.remove("percentOff");
        body.insert("amountOff".into(), json!(minor));
        body.insert("currency".into(), json!(currency.to_ascii_lowercase()));
    } else if let Some(currency) = &args.currency {
        body.insert("currency".into(), json!(currency.to_ascii_lowercase()));
    }
    if let Some(d) = &args.duration {
        body.insert("duration".into(), json!(d));
    } else {
        body.entry("duration").or_insert_with(|| json!("once"));
    }
    if let Some(m) = args.duration_in_months {
        body.insert("durationInMonths".into(), json!(m));
    }
    if let Some(m) = args.max_redemptions {
        body.insert("maxRedemptions".into(), json!(m));
    }
    if let Some(r) = &args.redeem_by {
        body.insert("redeemBy".into(), json!(r));
    }
    if !args.pages.is_empty() {
        body.insert("pageIds".into(), json!(args.pages));
    }
    if !args.ticket_types.is_empty() {
        body.insert("ticketTypeIds".into(), json!(args.ticket_types));
    }
    if args.applies_to_setup_fee {
        body.insert("appliesToSetupFee".into(), json!(true));
    }
    if args.applies_to_ticket_fees {
        body.insert("appliesToTicketFees".into(), json!(true));
    }

    if !body.contains_key("code") {
        return Err(usage("--code is required"));
    }
    if !body.contains_key("percentOff") && !body.contains_key("amountOff") {
        return Err(usage(
            "give the discount with --percent-off or --amount-off",
        ));
    }
    if body.get("duration") == Some(&json!("repeating")) && !body.contains_key("durationInMonths") {
        return Err(usage("--duration repeating needs --duration-in-months"));
    }
    Ok(Value::Object(body))
}

pub async fn booking(app: &App, args: &BookingCreateArgs) -> Result<()> {
    app.reject_csv("bookings create")?;
    app.mode_query(crate::app::ModeParam::None, "bookings create")?;
    let body = booking_body(args)?;
    let client = app.client().await?;
    let raw = client.post(BOOKINGS.path, &body).await?;
    print_record(app, &BOOKINGS, &raw)
}

pub async fn coupon(app: &App, args: &CouponCreateArgs) -> Result<()> {
    app.reject_csv("coupons create")?;
    app.mode_query(crate::app::ModeParam::None, "coupons create")?;
    let body = coupon_body(args)?;
    let client = app.client().await?;
    let raw = client.post(COUPONS.path, &body).await?;
    print_record(app, &COUPONS, &raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::{BookingsCommand, Cli, Command, CouponsCommand};
    use clap::Parser;

    fn coupon_args(args: &[&str]) -> CouponCreateArgs {
        let cli =
            Cli::try_parse_from(["checkoutpage", "coupons", "create"].iter().chain(args)).unwrap();
        match cli.command {
            Command::Coupons {
                command: CouponsCommand::Create(a),
            } => a,
            _ => unreachable!(),
        }
    }

    fn booking_args(args: &[&str]) -> BookingCreateArgs {
        let cli =
            Cli::try_parse_from(["checkoutpage", "bookings", "create"].iter().chain(args)).unwrap();
        match cli.command {
            Command::Bookings {
                command: BookingsCommand::Create(a),
            } => a,
            _ => unreachable!(),
        }
    }

    #[test]
    fn percent_coupon() {
        let b = coupon_body(&coupon_args(&["--code", "SAVE10", "--percent-off", "10"])).unwrap();
        assert_eq!(
            b,
            json!({"code": "SAVE10", "label": "SAVE10", "percentOff": 10, "duration": "once"})
        );
    }

    #[test]
    fn amount_coupon_converts_major_units_per_currency() {
        let b = coupon_body(&coupon_args(&[
            "--code",
            "FIVE",
            "--label",
            "Five off",
            "--amount-off",
            "5.50",
            "--currency",
            "USD",
            "--duration",
            "repeating",
            "--duration-in-months",
            "3",
            "--page",
            "p1",
            "--page",
            "p2",
            "--max-redemptions",
            "10",
        ]))
        .unwrap();
        assert_eq!(b["amountOff"], 550);
        assert_eq!(b["currency"], "usd");
        assert_eq!(b["durationInMonths"], 3);
        assert_eq!(b["pageIds"], json!(["p1", "p2"]));
        assert_eq!(b["maxRedemptions"], 10);
        assert_eq!(b["label"], "Five off");

        let b = coupon_body(&coupon_args(&[
            "--code",
            "YEN",
            "--amount-off",
            "500",
            "--currency",
            "jpy",
        ]))
        .unwrap();
        assert_eq!(b["amountOff"], 500);
        assert!(
            coupon_body(&coupon_args(&[
                "--code",
                "YEN",
                "--amount-off",
                "5.5",
                "--currency",
                "jpy"
            ]))
            .is_err()
        );
    }

    #[test]
    fn coupon_validation() {
        assert!(coupon_body(&coupon_args(&["--percent-off", "10"])).is_err());
        assert!(coupon_body(&coupon_args(&["--code", "X"])).is_err());
        assert!(coupon_body(&coupon_args(&["--code", "X", "--percent-off", "101"])).is_err());
        assert!(
            coupon_body(&coupon_args(&[
                "--code",
                "X",
                "--percent-off",
                "5",
                "--duration",
                "repeating"
            ]))
            .is_err()
        );
    }

    #[test]
    fn coupon_flags_override_data() {
        let b = coupon_body(&coupon_args(&[
            "--data", r#"{"code":"OLD","label":"Keep","amountOff":100,"currency":"usd","duration":"forever"}"#,
            "--code", "NEW", "--percent-off", "12.5",
        ]))
        .unwrap();
        assert_eq!(b["code"], "NEW");
        assert_eq!(b["label"], "Keep");
        assert_eq!(b["percentOff"], 12.5);
        assert!(b.get("amountOff").is_none());
        assert_eq!(b["duration"], "forever");
    }

    #[test]
    fn booking_body_from_flags() {
        let b = booking_body(&booking_args(&[
            "--event",
            "ev1",
            "--ticket",
            "tt1=2",
            "--field",
            "email=a@b.co",
            "--payment",
            "invoice",
            "--pwyw",
            "tt1=500",
            "--query-param",
            "utm_source=box-office",
        ]))
        .unwrap();
        assert_eq!(
            b,
            json!({
                "eventId": "ev1",
                "tickets": {"tt1": 2},
                "ticketPwywAmounts": {"tt1": 500},
                "queryParameters": {"utm_source": "box-office"},
                "fields": [{"fieldId": "email", "value": "a@b.co"}],
                "paymentOption": {"manualType": "invoice"}
            })
        );
    }

    #[test]
    fn booking_flags_merge_into_data() {
        let b = booking_body(&booking_args(&[
            "--data", r#"{"eventId":"ev1","tickets":{"a":1},"fields":[{"fieldId":"email","value":"old@x.co"},{"fieldId":"addr","value":{"billing":{"country":"GB"}}}]}"#,
            "--ticket", "b=3", "--field", "email=new@x.co", "--complimentary",
        ]))
        .unwrap();
        assert_eq!(b["tickets"], json!({"a": 1, "b": 3}));
        let fields = b["fields"].as_array().unwrap();
        assert_eq!(fields.len(), 2);
        assert_eq!(fields[1], json!({"fieldId": "email", "value": "new@x.co"}));
        assert_eq!(b["complimentary"], true);
    }

    #[test]
    fn booking_requires_event_and_tickets() {
        assert!(booking_body(&booking_args(&["--ticket", "a=1"])).is_err());
        assert!(booking_body(&booking_args(&["--event", "e"])).is_err());
        assert!(booking_body(&booking_args(&["--data", "[1]"])).is_err());
    }
}
