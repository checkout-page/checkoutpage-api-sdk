mod common;

use common::{Env, stderr_of, stdout_of};
use predicates::prelude::*;
use serde_json::{Value, json};
use wiremock::matchers::{body_json, header, method, path, query_param, query_param_is_missing};
use wiremock::{Mock, MockServer, ResponseTemplate};

struct Case {
    command: &'static str,
    path: &'static str,
    record: fn() -> Value,
    table: &'static [&'static str],
    csv_header: &'static str,
    csv: &'static [&'static str],
}

fn event() -> Value {
    json!({
        "id": "65f000000000000000000e01",
        "name": "Summer Gala internal",
        "title": "Summer Gala",
        "status": "published",
        "testmode": false,
        "url": "https://acme.checkoutpage.co/c/acme/summer-gala",
        "eventDetails": {"startDate": "2026-07-01T18:30:00.000Z", "endDate": "2026-07-01T22:00:00.000Z", "timezone": "Europe/London", "capacity": 200, "currency": "gbp"},
        "createdAt": "2026-05-01T10:00:00.000Z"
    })
}

fn checkout_page() -> Value {
    json!({
        "id": "65f000000000000000000c01",
        "name": "Annual membership",
        "status": "published",
        "testmode": true,
        "url": "https://acme.checkoutpage.co/c/acme/membership",
        "product": {"id": "prod1", "title": "Membership", "prices": [
            {"id": "pr1", "amount": 1500, "currency": "jpy", "enabled": true, "isDefault": true}
        ]},
        "createdAt": "2026-04-01T10:00:00.000Z"
    })
}

fn form() -> Value {
    json!({
        "id": "65f000000000000000000f01",
        "name": "Volunteer signup",
        "title": "Volunteer with us",
        "status": "draft",
        "testmode": false,
        "submissionCount": 42,
        "url": "https://acme.checkoutpage.co/c/acme/volunteer",
        "createdAt": "2026-03-01T10:00:00.000Z"
    })
}

fn booking() -> Value {
    json!({
        "id": "65f000000000000000000b01",
        "orderId": "1042",
        "customerEmail": "ana@example.com",
        "customerName": "Ana Lopez",
        "eventTitle": "Summer Gala",
        "pageId": "65f000000000000000000e01",
        "amount": 4550,
        "amountPaid": 4550,
        "amountDue": 0,
        "amountRefunded": 0,
        "currency": "gbp",
        "status": "paid",
        "orderStatus": "active",
        "livemode": true,
        "tickets": [{"id": "t1"}, {"id": "t2"}],
        "createdAt": "2026-06-10T12:00:00.000Z"
    })
}

fn payment() -> Value {
    json!({
        "id": "65f000000000000000000a01",
        "orderId": "2001",
        "customerEmail": "kenji@example.com",
        "productTitle": "Workshop",
        "productId": "prod2",
        "quantity": 1,
        "amount": 12000,
        "amountPaid": 12000,
        "amountRefunded": 0,
        "currency": "jpy",
        "status": "paid",
        "livemode": false,
        "coupon": {"code": "EARLY"},
        "createdAt": "2026-06-11T12:00:00.000Z"
    })
}

fn customer() -> Value {
    json!({
        "id": "65f000000000000000000d01",
        "name": "Grace Hopper",
        "email": "grace@example.com",
        "companyName": "Navy Labs",
        "phone": "+1 555 0100",
        "createdAt": "2026-01-15T08:00:00.000Z"
    })
}

fn subscription() -> Value {
    json!({
        "id": "65f000000000000000000501",
        "customerEmail": "sam@example.com",
        "productTitle": "Studio pass",
        "amount": 2500,
        "currency": "usd",
        "interval": "month",
        "intervalCount": 1,
        "status": "active",
        "currentPeriodEnd": "2026-11-01T00:00:00.000Z",
        "livemode": true,
        "createdAt": "2026-02-01T00:00:00.000Z"
    })
}

fn coupon() -> Value {
    json!({
        "id": "65f000000000000000000901",
        "code": "SPRING25",
        "label": "Spring sale",
        "percentOff": 25,
        "amountOff": null,
        "duration": "repeating",
        "durationInMonths": 3,
        "timesRedeemed": 4,
        "maxRedemptions": 100,
        "deleted": false,
        "createdAt": "2026-03-01T00:00:00.000Z"
    })
}

fn webhook() -> Value {
    json!({
        "id": "65f000000000000000000701",
        "name": "Zapier",
        "url": "https://hooks.example.com/cp",
        "status": "active",
        "events": ["payment.paid", "booking.paid"],
        "apiVersion": "v1",
        "deliveryCount": 10,
        "successCount": 9,
        "failureCount": 1,
        "lastTriggeredAt": null,
        "createdAt": "2026-03-01T00:00:00.000Z"
    })
}

const CASES: &[Case] = &[
    Case {
        command: "events",
        path: "/v1/events/",
        record: event,
        table: &[
            "ID",
            "TITLE",
            "STARTS",
            "Summer Gala",
            "published",
            "2026-07-01 18:30 UTC",
            "no",
        ],
        csv_header: "id,name,title,status,testmode,start_date,end_date,timezone,location,capacity,currency,slug,url,visit_count,created_at,updated_at",
        csv: &[
            "Summer Gala internal",
            "2026-07-01T18:30:00.000Z",
            "Europe/London",
            "200",
        ],
    },
    Case {
        command: "checkout-pages",
        path: "/v1/checkout-pages/",
        record: checkout_page,
        table: &["NAME", "PRICE", "Annual membership", "¥1,500", "yes"],
        csv_header: "id,name,status,testmode,product_id,product_title,price,currency,slug,url,visit_count,created_at,updated_at",
        csv: &[",1500,jpy,"],
    },
    Case {
        command: "forms",
        path: "/v1/forms/",
        record: form,
        table: &["SUBMISSIONS", "Volunteer with us", "draft", "42"],
        csv_header: "id,name,title,status,testmode,submission_count,slug,url,visit_count,created_at,updated_at",
        csv: &["Volunteer signup", ",42,"],
    },
    Case {
        command: "bookings",
        path: "/v1/bookings/",
        record: booking,
        table: &[
            "ORDER",
            "EVENT",
            "1042",
            "ana@example.com",
            "Summer Gala",
            "£45.50",
            "paid",
            "2026-06-10",
        ],
        csv_header: "id,order_id,status,order_status,customer_id,customer_name,customer_email,event_id,event_title,tickets,amount,amount_paid,amount_due,amount_refunded,currency,coupon_code,complimentary,livemode,created_at",
        csv: &["Ana Lopez", ",2,45.50,45.50,0.00,0.00,gbp,"],
    },
    Case {
        command: "payments",
        path: "/v1/payments/",
        record: payment,
        table: &[
            "PRODUCT",
            "AMOUNT",
            "kenji@example.com",
            "Workshop",
            "¥12,000",
        ],
        csv_header: "id,order_id,status,order_status,customer_id,customer_name,customer_email,product_id,product_title,page_id,quantity,amount,amount_paid,amount_refunded,tax_amount,currency,coupon_code,payment_method,livemode,created_at",
        csv: &[",12000,12000,0,,jpy,EARLY,"],
    },
    Case {
        command: "customers",
        path: "/v1/customers/",
        record: customer,
        table: &[
            "EMAIL",
            "Grace Hopper",
            "grace@example.com",
            "Navy Labs",
            "2026-01-15",
        ],
        csv_header: "id,name,email,billing_email,phone,company_name,tax_id,country,stripe_customer_id,created_at,updated_at",
        csv: &["+1 555 0100"],
    },
    Case {
        command: "subscriptions",
        path: "/v1/subscriptions/",
        record: subscription,
        table: &[
            "RENEWS",
            "sam@example.com",
            "Studio pass",
            "$25.00 / month",
            "active",
            "2026-11-01",
        ],
        csv_header: "id,status,customer_id,customer_name,customer_email,product_id,product_title,page_id,order_id,amount,currency,interval,interval_count,quantity,current_period_start,current_period_end,cancel_at_period_end,canceled_at,trial_end,stripe_subscription_id,livemode,created_at",
        csv: &[",25.00,usd,month,1,"],
    },
    Case {
        command: "coupons",
        path: "/v1/coupons/",
        record: coupon,
        table: &[
            "DISCOUNT",
            "SPRING25",
            "Spring sale",
            "25% off",
            "3 months",
            "4/100",
            "active",
        ],
        csv_header: "id,code,label,percent_off,amount_off,currency,duration,duration_in_months,times_redeemed,max_redemptions,redeem_by,page_ids,deleted,created_at",
        csv: &["SPRING25,Spring sale,25,,,repeating,3,4,100,"],
    },
    Case {
        command: "webhooks",
        path: "/v1/webhooks/",
        record: webhook,
        table: &[
            "LAST DELIVERY",
            "Zapier",
            "https://hooks.example.com/cp",
            "payment.paid, booking.paid",
            "never",
        ],
        csv_header: "id,name,url,status,events,api_version,delivery_count,success_count,failure_count,last_triggered_at,last_success_at,last_failure_at,created_at",
        csv: &["\"payment.paid, booking.paid\",v1,10,9,1"],
    },
];

fn list_body(records: Vec<Value>, has_more: bool, total: u64) -> Value {
    json!({"data": records, "has_more": has_more, "total": total})
}

async fn mount_list(server: &MockServer, p: &str, body: Value) {
    Mock::given(method("GET"))
        .and(path(p))
        .and(header("authorization", "Bearer sk_test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(body))
        .mount(server)
        .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn every_resource_lists_as_table_json_and_csv() {
    for case in CASES {
        let server = MockServer::start().await;
        let body = list_body(vec![(case.record)()], false, 1);
        mount_list(&server, case.path, body.clone()).await;
        let env = Env::new();

        let out = env
            .api(&server.uri())
            .args([case.command, "list"])
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}: {}",
            case.command,
            stderr_of(&out)
        );
        let table = stdout_of(&out);
        assert!(table.starts_with("ID"), "{}:\n{table}", case.command);
        for needle in case.table {
            assert!(
                table.contains(needle),
                "{} table lacks {needle:?}:\n{table}",
                case.command
            );
        }
        assert_eq!(
            table.lines().count(),
            2,
            "{}: header + one row:\n{table}",
            case.command
        );

        let out = env
            .api(&server.uri())
            .args([case.command, "list", "--json"])
            .output()
            .unwrap();
        assert!(out.status.success());
        let parsed: Value = serde_json::from_slice(&out.stdout).unwrap();
        assert_eq!(parsed, body, "{} --json is the raw API body", case.command);

        let out = env
            .api(&server.uri())
            .args([case.command, "list", "--csv"])
            .output()
            .unwrap();
        assert!(out.status.success());
        let csv = stdout_of(&out);
        let mut lines = csv.lines();
        assert_eq!(lines.next(), Some(case.csv_header), "{}", case.command);
        let row = lines.next().unwrap();
        assert!(row.starts_with(&format!("{},", (case.record)()["id"].as_str().unwrap())));
        for needle in case.csv {
            assert!(
                row.contains(needle),
                "{} csv lacks {needle:?}:\n{row}",
                case.command
            );
        }
        assert_eq!(lines.next(), None);
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn every_resource_gets_by_id() {
    for case in CASES {
        let server = MockServer::start().await;
        let record = (case.record)();
        let id = record["id"].as_str().unwrap().to_string();
        let env = Env::new();
        if case.command == "coupons" {
            // No GET /v1/coupons/:id in the API: the CLI finds it in the list.
            mount_list(
                &server,
                case.path,
                list_body(vec![record.clone()], false, 1),
            )
            .await;
        } else {
            Mock::given(method("GET"))
                .and(path(format!("{}{id}", case.path)))
                .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": record})))
                .mount(&server)
                .await;
        }

        let out = env
            .api(&server.uri())
            .args([case.command, "get", &id])
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}: {}",
            case.command,
            stderr_of(&out)
        );
        let detail = stdout_of(&out);
        assert!(detail.lines().next().unwrap().starts_with("id"), "{detail}");
        assert!(detail.contains(&id));
        for needle in case.csv {
            let first_value = needle
                .trim_matches(|c| c == ',' || c == '"')
                .split(',')
                .next()
                .unwrap();
            if !first_value.is_empty() {
                assert!(
                    detail.contains(first_value),
                    "{} get lacks {first_value:?}:\n{detail}",
                    case.command
                );
            }
        }

        let out = env
            .api(&server.uri())
            .args([case.command, "get", &id, "--json"])
            .output()
            .unwrap();
        let parsed: Value = serde_json::from_slice(&out.stdout).unwrap();
        assert_eq!(parsed, json!({"data": record}), "{}", case.command);

        let out = env
            .api(&server.uri())
            .args([case.command, "get", &id, "--csv"])
            .output()
            .unwrap();
        assert!(
            stdout_of(&out).starts_with(case.csv_header),
            "{}",
            case.command
        );
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn all_follows_cursors_with_the_max_page_size() {
    let server = MockServer::start().await;
    let mk = |id: &str| json!({"id": id, "name": format!("Customer {id}"), "email": format!("{id}@x.co")});
    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(query_param("limit", "100"))
        .and(query_param_is_missing("starting_after"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(
            vec![mk("c1"), mk("c2")],
            true,
            5,
        )))
        .expect(3)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(query_param("starting_after", "c2"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(
            vec![mk("c3"), mk("c4")],
            true,
            5,
        )))
        .expect(3)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(query_param("starting_after", "c4"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(vec![mk("c5")], false, 5)))
        .expect(3)
        .mount(&server)
        .await;
    let env = Env::new();

    let out = env
        .api(&server.uri())
        .args(["customers", "list", "--all"])
        .output()
        .unwrap();
    assert!(out.status.success(), "{}", stderr_of(&out));
    let table = stdout_of(&out);
    assert_eq!(table.lines().count(), 6, "{table}");
    for id in ["c1", "c2", "c3", "c4", "c5"] {
        assert!(table.contains(&format!("{id}@x.co")));
    }
    assert!(!stderr_of(&out).contains("Next page"));

    let out = env
        .api(&server.uri())
        .args(["customers", "list", "--all", "--json"])
        .output()
        .unwrap();
    let parsed: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(parsed["data"].as_array().unwrap().len(), 5);
    assert_eq!(parsed["has_more"], false);
    assert_eq!(parsed["total"], 5);

    let out = env
        .api(&server.uri())
        .args(["customers", "list", "--all", "--csv"])
        .output()
        .unwrap();
    assert_eq!(stdout_of(&out).lines().count(), 6);
}

#[tokio::test(flavor = "multi_thread")]
async fn single_page_hints_at_the_next_cursor() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/customers/"))
        .and(query_param("limit", "1"))
        .and(query_param("starting_after", "c0"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(
            vec![json!({"id": "c1"})],
            true,
            9,
        )))
        .mount(&server)
        .await;
    let env = Env::new();
    env.api(&server.uri())
        .args([
            "customers",
            "list",
            "--limit",
            "1",
            "--starting-after",
            "c0",
        ])
        .assert()
        .success()
        .stderr(predicate::str::contains(
            "Showing 1 of 9. Next page: --starting-after c1",
        ));
}

#[tokio::test(flavor = "multi_thread")]
async fn empty_list_says_so() {
    let server = MockServer::start().await;
    mount_list(&server, "/v1/checkout-pages/", list_body(vec![], false, 0)).await;
    Env::new()
        .api(&server.uri())
        .args(["checkout-pages", "list"])
        .assert()
        .success()
        .stdout("")
        .stderr(predicate::str::contains("No checkout pages found."));
}

#[tokio::test(flavor = "multi_thread")]
async fn filters_and_test_mode_become_spec_query_params() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/bookings/"))
        .and(query_param("pageId", "ev1"))
        .and(query_param("status", "paid"))
        .and(query_param("customerId", "cu1"))
        .and(query_param("isComplimentary", "false"))
        .and(query_param("createdAfter", "2026-01-01T00:00:00Z"))
        .and(query_param("livemode", "false"))
        .and(query_param("limit", "5"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(
            vec![booking()],
            false,
            1,
        )))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/events/"))
        .and(query_param("testmode", "false"))
        .and(query_param("status", "published"))
        .and(query_param("search", "gala night"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(vec![event()], false, 1)))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/payments/65f000000000000000000a01"))
        .and(query_param("livemode", "true"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": payment()})))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/webhooks/"))
        .and(query_param("event", "payment.paid"))
        .and(query_param("status", "failed"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(vec![], false, 0)))
        .expect(1)
        .mount(&server)
        .await;
    let env = Env::new();

    env.api(&server.uri())
        .args([
            "bookings",
            "list",
            "--event",
            "ev1",
            "--status",
            "paid",
            "--customer",
            "cu1",
            "--complimentary",
            "false",
            "--created-after",
            "2026-01-01",
            "--limit",
            "5",
            "--test",
        ])
        .assert()
        .success();
    env.api(&server.uri())
        .args([
            "events",
            "list",
            "--live",
            "--status",
            "published",
            "--search",
            "gala night",
        ])
        .assert()
        .success();
    env.api(&server.uri())
        .args(["payments", "get", "65f000000000000000000a01", "--live"])
        .assert()
        .success();
    env.api(&server.uri())
        .args([
            "webhooks",
            "list",
            "--event",
            "payment.paid",
            "--status",
            "failed",
        ])
        .assert()
        .success();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_flag_is_refused_where_the_api_has_no_mode_filter() {
    let server = MockServer::start().await;
    for args in [
        &["customers", "list", "--test"][..],
        &["coupons", "list", "--live"],
        &["events", "get", "abc", "--test"],
    ] {
        Env::new()
            .api(&server.uri())
            .args(args)
            .assert()
            .code(2)
            .stderr(predicate::str::contains("--test and --live can't be used"));
    }
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn coupon_get_pages_through_the_list() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/coupons/"))
        .and(query_param_is_missing("starting_after"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(
            vec![json!({"id": "k1", "code": "A"})],
            true,
            2,
        )))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/coupons/"))
        .and(query_param("starting_after", "k1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(list_body(vec![coupon()], false, 2)))
        .mount(&server)
        .await;
    let env = Env::new();
    env.api(&server.uri())
        .args(["coupons", "get", "65f000000000000000000901"])
        .assert()
        .success()
        .stdout(predicate::str::contains("SPRING25"));
    env.api(&server.uri())
        .args(["coupons", "get", "65f0000000000000000009ff"])
        .assert()
        .code(4)
        .stderr(predicate::str::contains(
            "No coupon with ID 65f0000000000000000009ff.",
        ));
}

#[tokio::test(flavor = "multi_thread")]
async fn invalid_ids_never_reach_the_api() {
    let server = MockServer::start().await;
    Env::new()
        .api(&server.uri())
        .args(["payments", "get", "../account"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains("is not a valid payment ID"));
    assert!(server.received_requests().await.unwrap().is_empty());
}

async fn error_case(status: u16, body: Value) -> std::process::Output {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/payments/"))
        .respond_with(ResponseTemplate::new(status).set_body_json(body))
        .mount(&server)
        .await;
    Env::new()
        .api(&server.uri())
        .args(["payments", "list"])
        .output()
        .unwrap()
}

#[tokio::test(flavor = "multi_thread")]
async fn api_errors_map_to_messages_and_exit_codes() {
    let cases: Vec<(u16, Value, i32, &str)> = vec![
        (
            401,
            json!({"status": "error", "message": "Invalid API key"}),
            3,
            "Error: Invalid API key",
        ),
        (
            403,
            json!({}),
            3,
            "Error: Authentication failed. Please check your API key.",
        ),
        (
            404,
            json!({"message": "Payment not found"}),
            4,
            "Error: Payment not found",
        ),
        (
            409,
            json!({"message": "Already exists"}),
            6,
            "Error: Already exists",
        ),
        (
            422,
            json!({"type": "ValidationError", "message": "Validation failed", "errors": [{"param": "limit", "message": "Too big"}]}),
            5,
            "Error: Validation failed: limit: Too big",
        ),
        (
            400,
            json!({"message": "Bad cursor"}),
            5,
            "Error: Bad cursor",
        ),
        (
            429,
            json!({"error": "Too many requests"}),
            7,
            "Error: Too many requests",
        ),
        (500, json!({"message": "Boom"}), 1, "Error: Boom (HTTP 500)"),
        (
            503,
            Value::Null,
            1,
            "Error: An unexpected error occurred (HTTP 503)",
        ),
    ];
    for (status, body, code, message) in cases {
        let out = error_case(status, body).await;
        assert_eq!(
            out.status.code(),
            Some(code),
            "HTTP {status}: {}",
            stderr_of(&out)
        );
        assert!(
            stderr_of(&out).contains(message),
            "HTTP {status}: {}",
            stderr_of(&out)
        );
        assert!(out.stdout.is_empty());
    }
}

#[test]
fn unreachable_api_is_a_network_error() {
    let port = common::closed_port();
    Env::new()
        .api(&format!("http://127.0.0.1:{port}"))
        .args(["customers", "list"])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("could not reach the API"));
}

#[test]
fn not_logged_in() {
    Env::new()
        .cmd()
        .args(["customers", "list"])
        .assert()
        .code(3)
        .stderr(predicate::str::contains("You're not logged in"));
}

#[test]
fn usage_errors_exit_2() {
    Env::new()
        .cmd()
        .args(["payments", "list", "--json", "--csv"])
        .assert()
        .code(2);
    Env::new().cmd().args(["nope"]).assert().code(2);
    Env::new()
        .cmd()
        .args(["whoami", "--csv", "--api-key", "sk_test_x"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains(
            "--csv only works with list and get",
        ));
}

async fn whose_key(server: &MockServer) {
    for (key, name) in [
        ("sk_test_flag", "from-flag"),
        ("sk_test_env", "from-env"),
        ("sk_test_stored", "from-stored"),
        ("sk_test_work", "from-work-profile"),
    ] {
        Mock::given(method("GET"))
            .and(path("/v1/customers/"))
            .and(header("authorization", format!("Bearer {key}").as_str()))
            .respond_with(ResponseTemplate::new(200).set_body_json(list_body(
                vec![json!({"id": "c1", "name": name})],
                false,
                1,
            )))
            .mount(server)
            .await;
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn flag_beats_env_beats_stored_credentials() {
    let server = MockServer::start().await;
    whose_key(&server).await;
    let env = Env::new();
    env.write_config(&format!(
        "[profiles.default]\nbase_url = \"{0}\"\napi_key = \"sk_test_stored\"\n\n[profiles.work]\nbase_url = \"{0}\"\napi_key = \"sk_test_work\"\n",
        server.uri()
    ));

    env.cmd()
        .args(["customers", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("from-stored"));
    env.cmd()
        .args(["customers", "list", "--profile", "work"])
        .assert()
        .success()
        .stdout(predicate::str::contains("from-work-profile"));
    env.cmd()
        .env("CHECKOUTPAGE_PROFILE", "work")
        .args(["customers", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("from-work-profile"));
    env.cmd()
        .env("CHECKOUTPAGE_API_KEY", "sk_test_env")
        .args(["customers", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("from-env"));
    env.cmd()
        .env("CHECKOUTPAGE_API_KEY", "sk_test_env")
        .args(["customers", "list", "--api-key", "sk_test_flag"])
        .assert()
        .success()
        .stdout(predicate::str::contains("from-flag"));
}

#[tokio::test(flavor = "multi_thread")]
async fn base_url_flag_beats_env_beats_profile() {
    let right = MockServer::start().await;
    whose_key(&right).await;
    let wrong = format!("http://127.0.0.1:{}", common::closed_port());
    let env = Env::new();
    env.write_config(&format!(
        "[profiles.default]\nbase_url = \"{wrong}\"\napi_key = \"sk_test_stored\"\n"
    ));
    env.cmd()
        .env("CHECKOUTPAGE_BASE_URL", right.uri())
        .args(["customers", "list"])
        .assert()
        .success();
    env.cmd()
        .env("CHECKOUTPAGE_BASE_URL", &wrong)
        .args(["customers", "list", "--base-url", &right.uri()])
        .assert()
        .success();
    env.cmd().args(["customers", "list"]).assert().code(1);
}

#[tokio::test(flavor = "multi_thread")]
async fn bookings_create_posts_the_spec_body() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/bookings/"))
        .and(body_json(json!({
            "eventId": "ev1",
            "tickets": {"tt1": 2},
            "fields": [{"fieldId": "f_email", "value": "ana@example.com"}],
            "complimentary": true
        })))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({"data": booking()})))
        .expect(1)
        .mount(&server)
        .await;
    Env::new()
        .api(&server.uri())
        .args([
            "bookings",
            "create",
            "--event",
            "ev1",
            "--ticket",
            "tt1=2",
            "--field",
            "f_email=ana@example.com",
            "--complimentary",
        ])
        .assert()
        .success()
        .stdout(predicate::str::contains("65f000000000000000000b01"))
        .stdout(predicate::str::contains("ana@example.com"));
}

#[tokio::test(flavor = "multi_thread")]
async fn coupons_create_converts_amounts_and_maps_validation_errors() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/coupons/"))
        .and(body_json(json!({
            "code": "YEN500",
            "label": "YEN500",
            "amountOff": 500,
            "currency": "jpy",
            "duration": "once"
        })))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({"data": {
            "id": "k9", "code": "YEN500", "label": "YEN500", "amountOff": 500, "currency": "jpy", "duration": "once"
        }})))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/v1/coupons/"))
        .and(body_json(
            json!({"code": "DUP", "label": "DUP", "percentOff": 10, "duration": "once"}),
        ))
        .respond_with(
            ResponseTemplate::new(409)
                .set_body_json(json!({"message": "An item with that code already exists"})),
        )
        .mount(&server)
        .await;
    let env = Env::new();
    env.api(&server.uri())
        .args([
            "coupons",
            "create",
            "--code",
            "YEN500",
            "--amount-off",
            "500",
            "--currency",
            "jpy",
            "--json",
        ])
        .assert()
        .success()
        .stdout(predicate::str::contains("\"amountOff\": 500"));
    env.api(&server.uri())
        .args(["coupons", "create", "--code", "DUP", "--percent-off", "10"])
        .assert()
        .code(6)
        .stderr(predicate::str::contains("already exists"));
}

#[tokio::test(flavor = "multi_thread")]
async fn api_command_sends_method_path_query_and_body() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/tickets/"))
        .and(query_param("limit", "2"))
        .and(query_param("pageId", "p1"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({"data": [], "has_more": false, "total": 0})),
        )
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("PATCH"))
        .and(path("/v1/customers/c1"))
        .and(body_json(json!({"name": "New name"})))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({"data": {"id": "c1", "name": "New name"}})),
        )
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("DELETE"))
        .and(path("/v1/webhooks/w1"))
        .respond_with(
            ResponseTemplate::new(404).set_body_json(json!({"message": "Webhook not found"})),
        )
        .mount(&server)
        .await;
    let env = Env::new();
    let out = env
        .api(&server.uri())
        .args(["api", "GET", "/v1/tickets/?limit=2", "-q", "pageId=p1"])
        .output()
        .unwrap();
    assert!(out.status.success(), "{}", stderr_of(&out));
    let v: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(v["total"], 0);

    let body_file = env.dir.path().join("body.json");
    std::fs::write(&body_file, r#"{"name": "New name"}"#).unwrap();
    env.api(&server.uri())
        .args([
            "api",
            "patch",
            "v1/customers/c1",
            "--data",
            &format!("@{}", body_file.display()),
        ])
        .assert()
        .success()
        .stdout(predicate::str::contains("\"name\": \"New name\""));

    env.api(&server.uri())
        .args(["api", "DELETE", "/v1/webhooks/w1"])
        .assert()
        .code(4)
        .stdout(predicate::str::contains(
            "\"message\": \"Webhook not found\"",
        ))
        .stderr(predicate::str::contains("Error: Webhook not found"));

    env.api(&server.uri())
        .args(["api", "POST", "/v1/coupons/", "--data", "{oops"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains("not valid JSON"));
}
