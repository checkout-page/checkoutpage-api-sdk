use anyhow::Result;
use serde_json::{Value, json};

use crate::api::{ApiError, ListPage, Query, unwrap_data};
use crate::app::{App, CliError, ModeParam};
use crate::cli::ListArgs;
use crate::money::{format_decimal, format_money};
use crate::output::{Format, err, out, render_csv, render_detail, render_table, to_pretty_json};

pub type Getter = fn(&Value) -> String;

pub struct Column {
    pub header: &'static str,
    pub get: Getter,
}

const fn col(header: &'static str, get: Getter) -> Column {
    Column { header, get }
}

pub struct Resource {
    pub command: &'static str,
    pub singular: &'static str,
    pub path: &'static str,
    pub list_mode: ModeParam,
    pub get_mode: ModeParam,
    pub has_get: bool,
    pub table: &'static [Column],
    pub fields: &'static [Column],
}

pub fn at<'a>(v: &'a Value, path: &str) -> Option<&'a Value> {
    path.split('.').try_fold(v, |acc, key| acc.get(key))
}

pub fn text(v: &Value, path: &str) -> String {
    match at(v, path) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Array(a)) => a
            .iter()
            .map(|x| match x {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            })
            .collect::<Vec<_>>()
            .join(", "),
        Some(Value::Object(_)) => at(v, path).map(Value::to_string).unwrap_or_default(),
        Some(Value::Null) | None => String::new(),
    }
}

fn first_text(v: &Value, paths: &[&str]) -> String {
    paths
        .iter()
        .map(|p| text(v, p))
        .find(|s| !s.is_empty())
        .unwrap_or_default()
}

pub fn int(v: &Value, path: &str) -> Option<i64> {
    let n = at(v, path)?;
    n.as_i64().or_else(|| n.as_f64().map(|f| f.round() as i64))
}

fn money_at(v: &Value, amount: &str, currency: &str) -> String {
    match (int(v, amount), at(v, currency).and_then(Value::as_str)) {
        (Some(a), Some(c)) if !c.is_empty() => format_money(a, c),
        (Some(a), _) => a.to_string(),
        _ => String::new(),
    }
}

fn decimal_at(v: &Value, amount: &str, currency: &str) -> String {
    match (int(v, amount), at(v, currency).and_then(Value::as_str)) {
        (Some(a), Some(c)) if !c.is_empty() => format_decimal(a, c),
        (Some(a), _) => a.to_string(),
        _ => String::new(),
    }
}

fn date(v: &Value, path: &str) -> String {
    let raw = text(v, path);
    chrono::DateTime::parse_from_rfc3339(&raw)
        .map(|d| d.with_timezone(&chrono::Utc).format("%Y-%m-%d").to_string())
        .unwrap_or(raw)
}

fn datetime(v: &Value, path: &str) -> String {
    let raw = text(v, path);
    chrono::DateTime::parse_from_rfc3339(&raw)
        .map(|d| {
            d.with_timezone(&chrono::Utc)
                .format("%Y-%m-%d %H:%M UTC")
                .to_string()
        })
        .unwrap_or(raw)
}

fn yes_no(v: &Value, path: &str) -> String {
    match at(v, path).and_then(Value::as_bool) {
        Some(true) => "yes".into(),
        Some(false) => "no".into(),
        None => String::new(),
    }
}

fn page_price(v: &Value) -> Option<&Value> {
    let prices = at(v, "product.prices").and_then(Value::as_array);
    if let Some(prices) = prices {
        let enabled = |p: &&Value| p.get("enabled").and_then(Value::as_bool) != Some(false);
        if let Some(p) = prices
            .iter()
            .filter(enabled)
            .find(|p| p.get("isDefault").and_then(Value::as_bool) == Some(true))
            .or_else(|| prices.iter().find(enabled))
        {
            return Some(p);
        }
    }
    at(v, "product.price").filter(|p| p.is_object())
}

fn page_price_money(v: &Value) -> String {
    page_price(v)
        .map(|p| money_at(p, "amount", "currency"))
        .unwrap_or_default()
}

fn interval_suffix(v: &Value) -> String {
    let interval = text(v, "interval");
    if interval.is_empty() {
        return String::new();
    }
    match int(v, "intervalCount") {
        Some(n) if n > 1 => format!(" / {n} {interval}s"),
        _ => format!(" / {interval}"),
    }
}

fn coupon_discount(v: &Value) -> String {
    if let Some(p) = at(v, "percentOff").and_then(Value::as_f64) {
        let p = if p.fract() == 0.0 {
            format!("{p:.0}")
        } else {
            p.to_string()
        };
        return format!("{p}% off");
    }
    let amount = money_at(v, "amountOff", "currency");
    if amount.is_empty() {
        amount
    } else {
        format!("{amount} off")
    }
}

fn coupon_duration(v: &Value) -> String {
    match text(v, "duration").as_str() {
        "repeating" => match int(v, "durationInMonths") {
            Some(1) => "1 month".into(),
            Some(n) => format!("{n} months"),
            None => "repeating".into(),
        },
        other => other.to_string(),
    }
}

fn coupon_redeemed(v: &Value) -> String {
    let used = int(v, "timesRedeemed").unwrap_or(0);
    match int(v, "maxRedemptions") {
        Some(max) if max > 0 => format!("{used}/{max}"),
        _ => used.to_string(),
    }
}

fn coupon_status(v: &Value) -> String {
    if at(v, "deleted").and_then(Value::as_bool) == Some(true) {
        "deleted".into()
    } else {
        "active".into()
    }
}

fn customer_label(v: &Value) -> String {
    first_text(v, &["customerEmail", "customerName"])
}

pub static EVENTS: Resource = Resource {
    command: "events",
    singular: "event",
    path: "/v1/events/",
    list_mode: ModeParam::Testmode,
    get_mode: ModeParam::None,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("TITLE", |v| first_text(v, &["title", "name"])),
        col("STATUS", |v| text(v, "status")),
        col("STARTS", |v| datetime(v, "eventDetails.startDate")),
        col("TEST", |v| yes_no(v, "testmode")),
        col("URL", |v| text(v, "url")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("name", |v| text(v, "name")),
        col("title", |v| text(v, "title")),
        col("status", |v| text(v, "status")),
        col("testmode", |v| text(v, "testmode")),
        col("start_date", |v| text(v, "eventDetails.startDate")),
        col("end_date", |v| text(v, "eventDetails.endDate")),
        col("timezone", |v| text(v, "eventDetails.timezone")),
        col("location", |v| text(v, "eventDetails.location")),
        col("capacity", |v| text(v, "eventDetails.capacity")),
        col("currency", |v| text(v, "eventDetails.currency")),
        col("slug", |v| text(v, "slug")),
        col("url", |v| text(v, "url")),
        col("visit_count", |v| text(v, "visitCount")),
        col("created_at", |v| text(v, "createdAt")),
        col("updated_at", |v| text(v, "updatedAt")),
    ],
};

pub static CHECKOUT_PAGES: Resource = Resource {
    command: "checkout-pages",
    singular: "checkout page",
    path: "/v1/checkout-pages/",
    list_mode: ModeParam::Testmode,
    get_mode: ModeParam::None,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("NAME", |v| first_text(v, &["name", "product.title"])),
        col("STATUS", |v| text(v, "status")),
        col("PRICE", page_price_money),
        col("TEST", |v| yes_no(v, "testmode")),
        col("URL", |v| text(v, "url")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("name", |v| text(v, "name")),
        col("status", |v| text(v, "status")),
        col("testmode", |v| text(v, "testmode")),
        col("product_id", |v| text(v, "product.id")),
        col("product_title", |v| text(v, "product.title")),
        col("price", |v| {
            page_price(v)
                .map(|p| decimal_at(p, "amount", "currency"))
                .unwrap_or_default()
        }),
        col("currency", |v| {
            page_price(v)
                .map(|p| text(p, "currency"))
                .unwrap_or_default()
        }),
        col("slug", |v| text(v, "slug")),
        col("url", |v| text(v, "url")),
        col("visit_count", |v| text(v, "visitCount")),
        col("created_at", |v| text(v, "createdAt")),
        col("updated_at", |v| text(v, "updatedAt")),
    ],
};

pub static FORMS: Resource = Resource {
    command: "forms",
    singular: "form",
    path: "/v1/forms/",
    list_mode: ModeParam::Testmode,
    get_mode: ModeParam::None,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("TITLE", |v| first_text(v, &["title", "name"])),
        col("STATUS", |v| text(v, "status")),
        col("SUBMISSIONS", |v| text(v, "submissionCount")),
        col("TEST", |v| yes_no(v, "testmode")),
        col("URL", |v| text(v, "url")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("name", |v| text(v, "name")),
        col("title", |v| text(v, "title")),
        col("status", |v| text(v, "status")),
        col("testmode", |v| text(v, "testmode")),
        col("submission_count", |v| text(v, "submissionCount")),
        col("slug", |v| text(v, "slug")),
        col("url", |v| text(v, "url")),
        col("visit_count", |v| text(v, "visitCount")),
        col("created_at", |v| text(v, "createdAt")),
        col("updated_at", |v| text(v, "updatedAt")),
    ],
};

pub static BOOKINGS: Resource = Resource {
    command: "bookings",
    singular: "booking",
    path: "/v1/bookings/",
    list_mode: ModeParam::Livemode,
    get_mode: ModeParam::Livemode,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("ORDER", |v| text(v, "orderId")),
        col("CUSTOMER", customer_label),
        col("EVENT", |v| text(v, "eventTitle")),
        col("AMOUNT", |v| money_at(v, "amount", "currency")),
        col("STATUS", |v| text(v, "status")),
        col("CREATED", |v| date(v, "createdAt")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("order_id", |v| text(v, "orderId")),
        col("status", |v| text(v, "status")),
        col("order_status", |v| text(v, "orderStatus")),
        col("customer_id", |v| text(v, "customerId")),
        col("customer_name", |v| text(v, "customerName")),
        col("customer_email", |v| text(v, "customerEmail")),
        col("event_id", |v| text(v, "pageId")),
        col("event_title", |v| text(v, "eventTitle")),
        col("tickets", |v| {
            at(v, "tickets")
                .and_then(Value::as_array)
                .map(|t| t.len().to_string())
                .unwrap_or_default()
        }),
        col("amount", |v| decimal_at(v, "amount", "currency")),
        col("amount_paid", |v| decimal_at(v, "amountPaid", "currency")),
        col("amount_due", |v| decimal_at(v, "amountDue", "currency")),
        col("amount_refunded", |v| {
            decimal_at(v, "amountRefunded", "currency")
        }),
        col("currency", |v| text(v, "currency")),
        col("coupon_code", |v| text(v, "coupon.code")),
        col("complimentary", |v| text(v, "isComplimentary")),
        col("livemode", |v| text(v, "livemode")),
        col("created_at", |v| text(v, "createdAt")),
    ],
};

pub static PAYMENTS: Resource = Resource {
    command: "payments",
    singular: "payment",
    path: "/v1/payments/",
    list_mode: ModeParam::Livemode,
    get_mode: ModeParam::Livemode,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("ORDER", |v| text(v, "orderId")),
        col("CUSTOMER", customer_label),
        col("PRODUCT", |v| text(v, "productTitle")),
        col("AMOUNT", |v| money_at(v, "amount", "currency")),
        col("STATUS", |v| text(v, "status")),
        col("CREATED", |v| date(v, "createdAt")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("order_id", |v| text(v, "orderId")),
        col("status", |v| text(v, "status")),
        col("order_status", |v| text(v, "orderStatus")),
        col("customer_id", |v| text(v, "customerId")),
        col("customer_name", |v| text(v, "customerName")),
        col("customer_email", |v| text(v, "customerEmail")),
        col("product_id", |v| text(v, "productId")),
        col("product_title", |v| text(v, "productTitle")),
        col("page_id", |v| text(v, "pageId")),
        col("quantity", |v| text(v, "quantity")),
        col("amount", |v| decimal_at(v, "amount", "currency")),
        col("amount_paid", |v| decimal_at(v, "amountPaid", "currency")),
        col("amount_refunded", |v| {
            decimal_at(v, "amountRefunded", "currency")
        }),
        col("tax_amount", |v| decimal_at(v, "taxAmount", "currency")),
        col("currency", |v| text(v, "currency")),
        col("coupon_code", |v| text(v, "coupon.code")),
        col("payment_method", |v| {
            first_text(v, &["paymentMethod.brand", "paymentMethod.method"])
        }),
        col("livemode", |v| text(v, "livemode")),
        col("created_at", |v| text(v, "createdAt")),
    ],
};

pub static CUSTOMERS: Resource = Resource {
    command: "customers",
    singular: "customer",
    path: "/v1/customers/",
    list_mode: ModeParam::None,
    get_mode: ModeParam::None,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("NAME", |v| text(v, "name")),
        col("EMAIL", |v| text(v, "email")),
        col("COMPANY", |v| text(v, "companyName")),
        col("CREATED", |v| date(v, "createdAt")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("name", |v| text(v, "name")),
        col("email", |v| text(v, "email")),
        col("billing_email", |v| text(v, "billingEmail")),
        col("phone", |v| text(v, "phone")),
        col("company_name", |v| text(v, "companyName")),
        col("tax_id", |v| text(v, "taxId")),
        col("country", |v| text(v, "address.country")),
        col("stripe_customer_id", |v| text(v, "stripeCustomerId")),
        col("created_at", |v| text(v, "createdAt")),
        col("updated_at", |v| text(v, "updatedAt")),
    ],
};

pub static SUBSCRIPTIONS: Resource = Resource {
    command: "subscriptions",
    singular: "subscription",
    path: "/v1/subscriptions/",
    list_mode: ModeParam::Livemode,
    get_mode: ModeParam::Livemode,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("CUSTOMER", customer_label),
        col("PRODUCT", |v| text(v, "productTitle")),
        col("AMOUNT", |v| {
            let m = money_at(v, "amount", "currency");
            if m.is_empty() {
                m
            } else {
                format!("{m}{}", interval_suffix(v))
            }
        }),
        col("STATUS", |v| text(v, "status")),
        col("RENEWS", |v| date(v, "currentPeriodEnd")),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("status", |v| text(v, "status")),
        col("customer_id", |v| text(v, "customerId")),
        col("customer_name", |v| text(v, "customerName")),
        col("customer_email", |v| text(v, "customerEmail")),
        col("product_id", |v| text(v, "productId")),
        col("product_title", |v| text(v, "productTitle")),
        col("page_id", |v| text(v, "pageId")),
        col("order_id", |v| text(v, "orderId")),
        col("amount", |v| decimal_at(v, "amount", "currency")),
        col("currency", |v| text(v, "currency")),
        col("interval", |v| text(v, "interval")),
        col("interval_count", |v| text(v, "intervalCount")),
        col("quantity", |v| text(v, "quantity")),
        col("current_period_start", |v| text(v, "currentPeriodStart")),
        col("current_period_end", |v| text(v, "currentPeriodEnd")),
        col("cancel_at_period_end", |v| text(v, "cancelAtPeriodEnd")),
        col("canceled_at", |v| text(v, "canceledAt")),
        col("trial_end", |v| text(v, "trialEnd")),
        col("stripe_subscription_id", |v| {
            text(v, "stripeSubscriptionId")
        }),
        col("livemode", |v| text(v, "livemode")),
        col("created_at", |v| text(v, "createdAt")),
    ],
};

pub static COUPONS: Resource = Resource {
    command: "coupons",
    singular: "coupon",
    path: "/v1/coupons/",
    list_mode: ModeParam::None,
    get_mode: ModeParam::None,
    has_get: false,
    table: &[
        col("ID", |v| text(v, "id")),
        col("CODE", |v| text(v, "code")),
        col("LABEL", |v| text(v, "label")),
        col("DISCOUNT", coupon_discount),
        col("DURATION", coupon_duration),
        col("REDEEMED", coupon_redeemed),
        col("STATUS", coupon_status),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("code", |v| text(v, "code")),
        col("label", |v| text(v, "label")),
        col("percent_off", |v| text(v, "percentOff")),
        col("amount_off", |v| decimal_at(v, "amountOff", "currency")),
        col("currency", |v| text(v, "currency")),
        col("duration", |v| text(v, "duration")),
        col("duration_in_months", |v| text(v, "durationInMonths")),
        col("times_redeemed", |v| text(v, "timesRedeemed")),
        col("max_redemptions", |v| text(v, "maxRedemptions")),
        col("redeem_by", |v| text(v, "redeemBy")),
        col("page_ids", |v| text(v, "pageIds")),
        col("deleted", |v| text(v, "deleted")),
        col("created_at", |v| text(v, "createdAt")),
    ],
};

pub static WEBHOOKS: Resource = Resource {
    command: "webhooks",
    singular: "webhook",
    path: "/v1/webhooks/",
    list_mode: ModeParam::None,
    get_mode: ModeParam::None,
    has_get: true,
    table: &[
        col("ID", |v| text(v, "id")),
        col("NAME", |v| text(v, "name")),
        col("URL", |v| text(v, "url")),
        col("STATUS", |v| text(v, "status")),
        col("EVENTS", |v| text(v, "events")),
        col("LAST DELIVERY", |v| {
            let d = datetime(v, "lastTriggeredAt");
            if d.is_empty() { "never".into() } else { d }
        }),
    ],
    fields: &[
        col("id", |v| text(v, "id")),
        col("name", |v| text(v, "name")),
        col("url", |v| text(v, "url")),
        col("status", |v| text(v, "status")),
        col("events", |v| text(v, "events")),
        col("api_version", |v| text(v, "apiVersion")),
        col("delivery_count", |v| text(v, "deliveryCount")),
        col("success_count", |v| text(v, "successCount")),
        col("failure_count", |v| text(v, "failureCount")),
        col("last_triggered_at", |v| text(v, "lastTriggeredAt")),
        col("last_success_at", |v| text(v, "lastSuccessAt")),
        col("last_failure_at", |v| text(v, "lastFailureAt")),
        col("created_at", |v| text(v, "createdAt")),
    ],
};

pub fn push(q: &mut Query, key: &str, value: &Option<String>) {
    if let Some(v) = value.as_ref().filter(|v| !v.is_empty()) {
        q.push((key.to_string(), v.clone()));
    }
}

fn rows(records: &[Value], columns: &[Column]) -> Vec<Vec<String>> {
    records
        .iter()
        .map(|r| columns.iter().map(|c| (c.get)(r)).collect())
        .collect()
}

fn headers(columns: &[Column]) -> Vec<&'static str> {
    columns.iter().map(|c| c.header).collect()
}

/// IDs go into the URL path, so anything that could change the path is refused up front.
fn check_id(res: &Resource, id: &str) -> Result<()> {
    if id.is_empty()
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(CliError::Usage(format!("{id:?} is not a valid {} ID", res.singular)).into());
    }
    Ok(())
}

pub async fn list(app: &App, res: &Resource, args: &ListArgs, mut query: Query) -> Result<()> {
    let command = format!("{} list", res.command);
    if let Some(mode) = app.mode_query(res.list_mode, &command)? {
        query.push(mode);
    }
    let limit = args.limit.or(if args.all { Some(100) } else { None });
    if let Some(limit) = limit {
        query.push(("limit".into(), limit.to_string()));
    }
    push(&mut query, "starting_after", &args.starting_after);
    push(&mut query, "ending_before", &args.ending_before);

    let client = app.client().await?;
    let (records, raw, has_more, total) = if args.all {
        let mut total = None;
        let records = client
            .list_all(res.path, &query, |page| {
                if total.is_none() {
                    total = page.total;
                }
            })
            .await?;
        let total_json = total.map(Value::from).unwrap_or(Value::from(records.len()));
        let raw = json!({ "data": records, "has_more": false, "total": total_json });
        (records, raw, false, total)
    } else {
        let ListPage {
            data,
            has_more,
            total,
            raw,
        } = client.list_page(res.path, &query, None).await?;
        (data, raw, has_more, total)
    };

    match app.format() {
        Format::Json => out(to_pretty_json(&raw)),
        Format::Csv => {
            let csv = render_csv(&headers(res.fields), &rows(&records, res.fields))?;
            out(csv);
        }
        Format::Table => {
            if records.is_empty() {
                err(format!("No {} found.", res.command.replace('-', " ")));
                return Ok(());
            }
            out(render_table(
                &headers(res.table),
                &rows(&records, res.table),
            ));
            if has_more {
                let last = records.last().map(|r| text(r, "id")).unwrap_or_default();
                let of_total = total.map(|t| format!(" of {t}")).unwrap_or_default();
                err(app.err_style.dim(&format!(
                    "Showing {}{of_total}. Next page: --starting-after {last}, or --all for everything.",
                    records.len()
                )));
            }
        }
    }
    Ok(())
}

pub async fn get(app: &App, res: &Resource, id: &str) -> Result<()> {
    check_id(res, id)?;
    let command = format!("{} get", res.command);
    let mut query = Query::new();
    if let Some(mode) = app.mode_query(res.get_mode, &command)? {
        query.push(mode);
    }
    let client = app.client().await?;
    let raw = if res.has_get {
        client.get(&format!("{}{id}", res.path), &query).await?
    } else {
        find_in_list(&client, res, id).await?
    };
    print_record(app, res, &raw)
}

async fn find_in_list(client: &crate::api::Client, res: &Resource, id: &str) -> Result<Value> {
    let query: Query = vec![("limit".into(), "100".into())];
    let mut cursor: Option<String> = None;
    loop {
        let page = client
            .list_page(res.path, &query, cursor.as_deref())
            .await?;
        if let Some(found) = page
            .data
            .iter()
            .find(|r| r.get("id").and_then(Value::as_str) == Some(id))
        {
            return Ok(json!({ "data": found }));
        }
        match page.next_cursor() {
            Some(next) if Some(&next) != cursor.as_ref() => cursor = Some(next),
            _ => break,
        }
    }
    Err(ApiError::NotFound {
        message: format!("No {} with ID {id}.", res.singular),
        body: Value::Null,
    }
    .into())
}

pub fn print_record(app: &App, res: &Resource, raw: &Value) -> Result<()> {
    let record = unwrap_data(raw);
    match app.format() {
        Format::Json => out(to_pretty_json(raw)),
        Format::Csv => out(render_csv(
            &headers(res.fields),
            &rows(std::slice::from_ref(record), res.fields),
        )?),
        Format::Table => {
            let pairs: Vec<(&str, String)> = res
                .fields
                .iter()
                .map(|c| (c.header, (c.get)(record)))
                .collect();
            out(render_detail(&pairs));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_lookup_and_text() {
        let v = json!({"a": {"b": "x", "n": 5, "t": true, "arr": ["p", "q"]}, "nul": null});
        assert_eq!(text(&v, "a.b"), "x");
        assert_eq!(text(&v, "a.n"), "5");
        assert_eq!(text(&v, "a.t"), "true");
        assert_eq!(text(&v, "a.arr"), "p, q");
        assert_eq!(text(&v, "nul"), "");
        assert_eq!(text(&v, "missing.deep"), "");
    }

    #[test]
    fn money_columns_handle_zero_decimal_and_missing_currency() {
        let v = json!({"amount": 1500, "currency": "jpy"});
        assert_eq!(money_at(&v, "amount", "currency"), "¥1,500");
        assert_eq!(decimal_at(&v, "amount", "currency"), "1500");
        let v = json!({"amount": 1999.0, "currency": "usd"});
        assert_eq!(money_at(&v, "amount", "currency"), "$19.99");
        let v = json!({"amount": 1999});
        assert_eq!(money_at(&v, "amount", "currency"), "1999");
        assert_eq!(money_at(&json!({}), "amount", "currency"), "");
    }

    #[test]
    fn dates_render_in_utc() {
        let v = json!({"d": "2026-03-01T23:30:00-02:00"});
        assert_eq!(date(&v, "d"), "2026-03-02");
        assert_eq!(datetime(&v, "d"), "2026-03-02 01:30 UTC");
        assert_eq!(date(&json!({"d": "soon"}), "d"), "soon");
    }

    #[test]
    fn checkout_page_price_prefers_the_default_enabled_price() {
        let v = json!({"product": {"prices": [
            {"amount": 100, "currency": "usd", "enabled": true},
            {"amount": 200, "currency": "usd", "enabled": false, "isDefault": true},
            {"amount": 300, "currency": "gbp", "enabled": true, "isDefault": true}
        ]}});
        assert_eq!(page_price_money(&v), "£3.00");
        let v = json!({"product": {"prices": [{"amount": 100, "currency": "usd"}]}});
        assert_eq!(page_price_money(&v), "$1.00");
        let v = json!({"product": {"price": {"amount": 5000, "currency": "jpy"}}});
        assert_eq!(page_price_money(&v), "¥5,000");
        assert_eq!(page_price_money(&json!({})), "");
    }

    #[test]
    fn subscription_interval() {
        let v = json!({"amount": 1000, "currency": "usd", "interval": "month", "intervalCount": 3});
        assert_eq!((SUBSCRIPTIONS.table[3].get)(&v), "$10.00 / 3 months");
        let v = json!({"amount": 1000, "currency": "usd", "interval": "year"});
        assert_eq!((SUBSCRIPTIONS.table[3].get)(&v), "$10.00 / year");
    }

    #[test]
    fn coupon_columns() {
        let pct = json!({"percentOff": 25, "duration": "repeating", "durationInMonths": 3, "timesRedeemed": 2, "maxRedemptions": 10});
        assert_eq!(coupon_discount(&pct), "25% off");
        assert_eq!(coupon_duration(&pct), "3 months");
        assert_eq!(coupon_redeemed(&pct), "2/10");
        assert_eq!(coupon_status(&pct), "active");
        let amt = json!({"amountOff": 500, "currency": "jpy", "percentOff": null, "duration": "once", "deleted": true});
        assert_eq!(coupon_discount(&amt), "¥500 off");
        assert_eq!(coupon_duration(&amt), "once");
        assert_eq!(coupon_redeemed(&amt), "0");
        assert_eq!(coupon_status(&amt), "deleted");
        assert_eq!(coupon_discount(&json!({"percentOff": 12.5})), "12.5% off");
    }

    #[test]
    fn ids_cannot_escape_the_path() {
        assert!(check_id(&PAYMENTS, "507f1f77bcf86cd799439011").is_ok());
        assert!(check_id(&PAYMENTS, "../account").is_err());
        assert!(check_id(&PAYMENTS, "a?b=c").is_err());
        assert!(check_id(&PAYMENTS, "").is_err());
    }

    #[test]
    fn every_resource_has_an_id_column_first() {
        for r in [
            &EVENTS,
            &CHECKOUT_PAGES,
            &FORMS,
            &BOOKINGS,
            &PAYMENTS,
            &CUSTOMERS,
            &SUBSCRIPTIONS,
            &COUPONS,
            &WEBHOOKS,
        ] {
            assert_eq!(r.table[0].header, "ID", "{}", r.command);
            assert_eq!(r.fields[0].header, "id", "{}", r.command);
            assert!(r.path.starts_with("/v1/") && r.path.ends_with('/'));
        }
    }
}
