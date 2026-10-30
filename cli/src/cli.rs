// Argument structs are parsed once per run; boxing them would only add noise.
#![allow(clippy::large_enum_variant)]

use clap::{Args, Parser, Subcommand};

use crate::util::parse_key_value;

#[derive(Parser, Debug)]
#[command(
    name = "checkoutpage",
    version,
    about = "Work with your Checkout Page account from the terminal",
    long_about = "Work with your Checkout Page account from the terminal: list and look up \
                  events, checkout pages, forms, bookings, payments, customers, subscriptions, \
                  coupons and webhook endpoints.",
    propagate_version = true
)]
pub struct Cli {
    #[command(flatten)]
    pub global: GlobalArgs,
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Args, Debug, Clone, Default)]
pub struct GlobalArgs {
    /// API key to use for this command. Beats CHECKOUTPAGE_API_KEY and stored credentials.
    /// With `login`, the key to store, or `-` to read it from stdin.
    #[arg(long, global = true, value_name = "KEY")]
    pub api_key: Option<String>,

    /// API origin [env: CHECKOUTPAGE_BASE_URL] [default: https://api.checkoutpage.com]
    #[arg(long, global = true, value_name = "URL")]
    pub base_url: Option<String>,

    /// Credentials profile to use
    #[arg(
        long,
        global = true,
        env = "CHECKOUTPAGE_PROFILE",
        default_value = "default",
        value_name = "NAME"
    )]
    pub profile: String,

    /// Print the raw API JSON
    #[arg(long, global = true, conflicts_with = "csv")]
    pub json: bool,

    /// Print list results as CSV
    #[arg(long, global = true)]
    pub csv: bool,

    /// Only test-mode records (where the endpoint supports it)
    #[arg(long, global = true, conflicts_with = "live")]
    pub test: bool,

    /// Only live records (where the endpoint supports it)
    #[arg(long, global = true)]
    pub live: bool,

    /// Disable colored output (NO_COLOR is also respected)
    #[arg(long, global = true)]
    pub no_color: bool,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Log in through your browser, or store an API key with --api-key
    Login(LoginArgs),
    /// Revoke the stored login and delete the profile's credentials
    Logout,
    /// Show the account and credentials in use
    Whoami,
    /// Events
    Events {
        #[command(subcommand)]
        command: PageCommand,
    },
    /// Checkout pages
    CheckoutPages {
        #[command(subcommand)]
        command: PageCommand,
    },
    /// Forms
    Forms {
        #[command(subcommand)]
        command: PageCommand,
    },
    /// Event bookings
    Bookings {
        #[command(subcommand)]
        command: BookingsCommand,
    },
    /// Payments
    Payments {
        #[command(subcommand)]
        command: PaymentsCommand,
    },
    /// Customers
    Customers {
        #[command(subcommand)]
        command: CustomersCommand,
    },
    /// Subscriptions
    Subscriptions {
        #[command(subcommand)]
        command: SubscriptionsCommand,
    },
    /// Coupons
    Coupons {
        #[command(subcommand)]
        command: CouponsCommand,
    },
    /// Webhook endpoints
    Webhooks {
        #[command(subcommand)]
        command: WebhooksCommand,
    },
    /// Make a raw API request and print the JSON response
    Api(ApiArgs),
}

#[derive(Args, Debug)]
pub struct LoginArgs {
    /// Print the login URL instead of opening a browser
    #[arg(long)]
    pub no_browser: bool,
}

#[derive(Args, Debug, Clone, Default)]
pub struct ListArgs {
    /// Records per page, 1-100 [default: 20, or 100 with --all]
    #[arg(long, value_parser = clap::value_parser!(u32).range(1..=100))]
    pub limit: Option<u32>,
    /// Fetch every page
    #[arg(long)]
    pub all: bool,
    /// Return records after this ID (the last ID of the previous page)
    #[arg(long, value_name = "ID", conflicts_with_all = ["all", "ending_before"])]
    pub starting_after: Option<String>,
    /// Return records before this ID
    #[arg(long, value_name = "ID", conflicts_with = "all")]
    pub ending_before: Option<String>,
}

#[derive(Args, Debug)]
pub struct GetArgs {
    /// The record's ID
    pub id: String,
}

#[derive(Subcommand, Debug)]
pub enum PageCommand {
    /// List them
    List(PageListArgs),
    /// Show one by ID
    Get(GetArgs),
}

#[derive(Args, Debug)]
pub struct PageListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    /// Filter by publication status
    #[arg(long, value_parser = ["published", "draft", "archived"])]
    pub status: Option<String>,
    /// Case-insensitive search on name and title
    #[arg(long)]
    pub search: Option<String>,
}

const CHARGE_STATUSES: [&str; 11] = [
    "created",
    "pending",
    "unpaid",
    "partially_paid",
    "paid",
    "canceled",
    "failed",
    "partial_refund",
    "refunded",
    "draft",
    "draft_expired",
];

#[derive(Args, Debug)]
pub struct DateFilters {
    /// Created at or after this date or time (2026-01-31 or RFC 3339)
    #[arg(long, value_name = "DATE", value_parser = parse_date_filter)]
    pub created_after: Option<String>,
    /// Created before this date or time (2026-01-31 or RFC 3339)
    #[arg(long, value_name = "DATE", value_parser = parse_date_filter)]
    pub created_before: Option<String>,
}

#[derive(Subcommand, Debug)]
pub enum BookingsCommand {
    /// List bookings
    List(BookingListArgs),
    /// Show one booking
    Get(GetArgs),
    /// Book tickets without collecting card payment (invoice, cash on delivery or complimentary)
    Create(BookingCreateArgs),
}

#[derive(Args, Debug)]
pub struct BookingListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    /// Search customer email, name, event title
    #[arg(long)]
    pub search: Option<String>,
    #[arg(long, value_parser = CHARGE_STATUSES)]
    pub status: Option<String>,
    #[arg(long, value_parser = ["active", "canceled"])]
    pub order_status: Option<String>,
    /// Only bookings for this event ID
    #[arg(long, value_name = "EVENT_ID")]
    pub event: Option<String>,
    #[arg(long, value_name = "CUSTOMER_ID")]
    pub customer: Option<String>,
    /// Order number
    #[arg(long, value_name = "ORDER_ID")]
    pub order: Option<String>,
    /// Coupon code used
    #[arg(long, value_name = "CODE")]
    pub coupon_code: Option<String>,
    #[arg(long, value_parser = ["abandoned", "recovered"])]
    pub abandonment_status: Option<String>,
    /// Only complimentary bookings (true) or none of them (false)
    #[arg(long, value_parser = ["true", "false"])]
    pub complimentary: Option<String>,
    #[command(flatten)]
    pub dates: DateFilters,
}

#[derive(Args, Debug)]
pub struct BookingCreateArgs {
    /// The event to book onto
    #[arg(long, value_name = "EVENT_ID")]
    pub event: Option<String>,
    /// Tickets to book, repeatable
    #[arg(long = "ticket", value_name = "TICKET_TYPE_ID=QTY", value_parser = parse_ticket)]
    pub tickets: Vec<(String, u64)>,
    /// A field value, repeatable. Must include the event's email field.
    #[arg(long = "field", value_name = "FIELD_ID=VALUE", value_parser = parse_key_value)]
    pub fields: Vec<(String, String)>,
    /// Issue the tickets at no charge
    #[arg(long, conflicts_with_all = ["payment", "coupon"])]
    pub complimentary: bool,
    /// Record the booking as unpaid, to settle outside checkout
    #[arg(long, value_parser = ["invoice", "cash_on_delivery"])]
    pub payment: Option<String>,
    /// Coupon ID to apply
    #[arg(long, value_name = "COUPON_ID")]
    pub coupon: Option<String>,
    /// Amount for a pay-what-you-want ticket type, in the smallest currency unit (cents), repeatable
    #[arg(long = "pwyw", value_name = "TICKET_TYPE_ID=AMOUNT", value_parser = parse_ticket)]
    pub pwyw: Vec<(String, u64)>,
    /// Attribution parameter to record, repeatable
    #[arg(long = "query-param", value_name = "KEY=VALUE", value_parser = parse_key_value)]
    pub query_params: Vec<(String, String)>,
    /// Full request body as JSON, or @file. Flags are applied on top.
    #[arg(long, value_name = "JSON|@FILE")]
    pub data: Option<String>,
}

#[derive(Subcommand, Debug)]
pub enum PaymentsCommand {
    /// List payments
    List(PaymentListArgs),
    /// Show one payment
    Get(GetArgs),
}

#[derive(Args, Debug)]
pub struct PaymentListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    /// Search customer email, name, product title
    #[arg(long)]
    pub search: Option<String>,
    #[arg(long, value_parser = CHARGE_STATUSES)]
    pub status: Option<String>,
    #[arg(long, value_parser = ["active", "canceled"])]
    pub order_status: Option<String>,
    #[arg(long, value_name = "PRODUCT_ID")]
    pub product: Option<String>,
    /// Only payments made on this checkout page, event or form
    #[arg(long, value_name = "PAGE_ID")]
    pub page: Option<String>,
    #[arg(long, value_name = "CUSTOMER_ID")]
    pub customer: Option<String>,
    /// Order number
    #[arg(long, value_name = "ORDER_ID")]
    pub order: Option<String>,
    /// Coupon code used
    #[arg(long, value_name = "CODE")]
    pub coupon_code: Option<String>,
    #[arg(long, value_parser = ["abandoned", "recovered"])]
    pub abandonment_status: Option<String>,
    #[command(flatten)]
    pub dates: DateFilters,
}

#[derive(Subcommand, Debug)]
pub enum CustomersCommand {
    /// List customers
    List(CustomerListArgs),
    /// Show one customer
    Get(GetArgs),
}

#[derive(Args, Debug)]
pub struct CustomerListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    /// Search name and email
    #[arg(long)]
    pub search: Option<String>,
    #[command(flatten)]
    pub dates: DateFilters,
}

#[derive(Subcommand, Debug)]
pub enum SubscriptionsCommand {
    /// List subscriptions
    List(SubscriptionListArgs),
    /// Show one subscription
    Get(GetArgs),
}

#[derive(Args, Debug)]
pub struct SubscriptionListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    /// Search customer email, name, product title, order and subscription ID
    #[arg(long)]
    pub search: Option<String>,
    #[arg(long, value_parser = [
        "draft", "draft_expired", "incomplete", "incomplete_expired", "trialing", "paused",
        "scheduled", "active", "past_due", "canceled", "unpaid", "failed", "completed",
    ])]
    pub status: Option<String>,
    /// Only subscriptions started on this checkout page
    #[arg(long, value_name = "PAGE_ID")]
    pub page: Option<String>,
    #[arg(long, value_name = "CUSTOMER_ID")]
    pub customer: Option<String>,
    /// Order number
    #[arg(long, value_name = "ORDER_ID")]
    pub order: Option<String>,
    #[arg(long, value_parser = ["abandoned", "recovered"])]
    pub abandonment_status: Option<String>,
    #[command(flatten)]
    pub dates: DateFilters,
}

#[derive(Subcommand, Debug)]
pub enum CouponsCommand {
    /// List coupons
    List(CouponListArgs),
    /// Show one coupon
    Get(GetArgs),
    /// Create a coupon
    Create(CouponCreateArgs),
}

#[derive(Args, Debug)]
pub struct CouponListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    /// Search label and code
    #[arg(long)]
    pub search: Option<String>,
}

#[derive(Args, Debug)]
pub struct CouponCreateArgs {
    /// The code customers enter (letters, digits, - and _)
    #[arg(long)]
    pub code: Option<String>,
    /// Internal name [default: the code]
    #[arg(long)]
    pub label: Option<String>,
    /// Percentage off, 1-100
    #[arg(long, value_name = "PERCENT", conflicts_with = "amount_off")]
    pub percent_off: Option<f64>,
    /// Fixed amount off in the currency's main unit (10.50 = $10.50, 500 = ¥500). Needs --currency.
    #[arg(long, value_name = "AMOUNT", requires = "currency")]
    pub amount_off: Option<String>,
    /// Three-letter currency code for --amount-off
    #[arg(long, value_name = "CODE")]
    pub currency: Option<String>,
    /// How long the discount applies to a subscription
    #[arg(long, value_parser = ["once", "repeating", "forever"])]
    pub duration: Option<String>,
    /// Months the discount applies with --duration repeating
    #[arg(long, value_name = "MONTHS")]
    pub duration_in_months: Option<u32>,
    /// Total redemptions allowed
    #[arg(long, value_name = "N")]
    pub max_redemptions: Option<u64>,
    /// Last moment the coupon can be used (2026-12-31 or RFC 3339)
    #[arg(long, value_name = "DATE", value_parser = parse_date_filter)]
    pub redeem_by: Option<String>,
    /// Limit to a checkout page, event or form ID, repeatable
    #[arg(long = "page", value_name = "PAGE_ID")]
    pub pages: Vec<String>,
    /// Limit to a ticket type ID, repeatable
    #[arg(long = "ticket-type", value_name = "TICKET_TYPE_ID")]
    pub ticket_types: Vec<String>,
    /// Also discount the setup fee
    #[arg(long)]
    pub applies_to_setup_fee: bool,
    /// Also discount ticket fees
    #[arg(long)]
    pub applies_to_ticket_fees: bool,
    /// Full request body as JSON, or @file. Flags are applied on top.
    #[arg(long, value_name = "JSON|@FILE")]
    pub data: Option<String>,
}

#[derive(Subcommand, Debug)]
pub enum WebhooksCommand {
    /// List webhook endpoints
    List(WebhookListArgs),
    /// Show one webhook endpoint
    Get(GetArgs),
}

#[derive(Args, Debug)]
pub struct WebhookListArgs {
    #[command(flatten)]
    pub list: ListArgs,
    #[arg(long, value_parser = ["active", "inactive", "failed"])]
    pub status: Option<String>,
    /// Only endpoints subscribed to this event, e.g. payment.paid
    #[arg(long)]
    pub event: Option<String>,
}

#[derive(Args, Debug)]
pub struct ApiArgs {
    /// HTTP method
    #[arg(value_parser = parse_method)]
    pub method: String,
    /// Path, e.g. /v1/coupons
    pub path: String,
    /// Request body as JSON, or @file (@- for stdin)
    #[arg(long, short = 'd', value_name = "JSON|@FILE")]
    pub data: Option<String>,
    /// Query parameter, repeatable
    #[arg(long, short = 'q', value_name = "KEY=VALUE", value_parser = parse_key_value)]
    pub query: Vec<(String, String)>,
}

fn parse_method(s: &str) -> Result<String, String> {
    let m = s.to_ascii_uppercase();
    match m.as_str() {
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" => Ok(m),
        _ => Err(format!("{s:?} is not one of GET, POST, PUT, PATCH, DELETE")),
    }
}

fn parse_ticket(s: &str) -> Result<(String, u64), String> {
    let (k, v) = parse_key_value(s)?;
    let n = v
        .parse::<u64>()
        .map_err(|_| format!("{v:?} in {s:?} is not a whole number"))?;
    Ok((k, n))
}

pub fn parse_date_filter(s: &str) -> Result<String, String> {
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Ok(format!("{d}T00:00:00Z"));
    }
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|_| s.to_string())
        .map_err(|_| format!("{s:?} is not a date like 2026-01-31 or 2026-01-31T09:00:00Z"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    fn parse(args: &[&str]) -> Result<Cli, clap::Error> {
        Cli::try_parse_from(std::iter::once("checkoutpage").chain(args.iter().copied()))
    }

    #[test]
    fn clap_definition_is_valid() {
        Cli::command().debug_assert();
    }

    #[test]
    fn global_flags_work_after_the_subcommand() {
        let cli = parse(&[
            "payments",
            "list",
            "--json",
            "--test",
            "--api-key",
            "sk_test_x",
        ])
        .unwrap();
        assert!(cli.global.json);
        assert!(cli.global.test);
        assert_eq!(cli.global.api_key.as_deref(), Some("sk_test_x"));
        assert_eq!(cli.global.profile, "default");
    }

    #[test]
    fn json_and_csv_conflict_and_test_and_live_conflict() {
        assert!(parse(&["payments", "list", "--json", "--csv"]).is_err());
        assert!(parse(&["payments", "list", "--test", "--live"]).is_err());
    }

    #[test]
    fn limit_is_range_checked() {
        assert!(parse(&["customers", "list", "--limit", "0"]).is_err());
        assert!(parse(&["customers", "list", "--limit", "101"]).is_err());
        let cli = parse(&["customers", "list", "--limit", "100"]).unwrap();
        let Command::Customers {
            command: CustomersCommand::List(a),
        } = cli.command
        else {
            panic!()
        };
        assert_eq!(a.list.limit, Some(100));
    }

    #[test]
    fn all_conflicts_with_cursors() {
        assert!(parse(&["customers", "list", "--all", "--starting-after", "x"]).is_err());
    }

    #[test]
    fn status_values_are_validated() {
        assert!(parse(&["events", "list", "--status", "live"]).is_err());
        assert!(parse(&["events", "list", "--status", "draft"]).is_ok());
        assert!(parse(&["payments", "list", "--status", "partially_paid"]).is_ok());
    }

    #[test]
    fn booking_create_flags() {
        let cli = parse(&[
            "bookings",
            "create",
            "--event",
            "e1",
            "--ticket",
            "t1=2",
            "--ticket",
            "t2=1",
            "--field",
            "f1=a@b.c",
            "--payment",
            "invoice",
        ])
        .unwrap();
        let Command::Bookings {
            command: BookingsCommand::Create(a),
        } = cli.command
        else {
            panic!()
        };
        assert_eq!(a.tickets, vec![("t1".into(), 2), ("t2".into(), 1)]);
        assert_eq!(a.fields, vec![("f1".into(), "a@b.c".into())]);
        assert!(parse(&["bookings", "create", "--ticket", "t1=two"]).is_err());
        assert!(
            parse(&[
                "bookings",
                "create",
                "--complimentary",
                "--payment",
                "invoice"
            ])
            .is_err()
        );
    }

    #[test]
    fn coupon_amount_needs_currency() {
        assert!(parse(&["coupons", "create", "--code", "X", "--amount-off", "5"]).is_err());
        assert!(
            parse(&[
                "coupons",
                "create",
                "--code",
                "X",
                "--amount-off",
                "5",
                "--currency",
                "usd"
            ])
            .is_ok()
        );
        assert!(
            parse(&[
                "coupons",
                "create",
                "--code",
                "X",
                "--amount-off",
                "5",
                "--currency",
                "usd",
                "--percent-off",
                "5"
            ])
            .is_err()
        );
    }

    #[test]
    fn api_method_and_query() {
        let cli = parse(&[
            "api",
            "get",
            "/v1/coupons",
            "-q",
            "limit=2",
            "--query",
            "search=x",
        ])
        .unwrap();
        let Command::Api(a) = cli.command else {
            panic!()
        };
        assert_eq!(a.method, "GET");
        assert_eq!(a.query.len(), 2);
        assert!(parse(&["api", "FETCH", "/v1/x"]).is_err());
    }

    #[test]
    fn date_filters() {
        assert_eq!(
            parse_date_filter("2026-01-31").unwrap(),
            "2026-01-31T00:00:00Z"
        );
        assert_eq!(
            parse_date_filter("2026-01-31T09:00:00+01:00").unwrap(),
            "2026-01-31T09:00:00+01:00"
        );
        assert!(parse_date_filter("31/01/2026").is_err());
    }
}
