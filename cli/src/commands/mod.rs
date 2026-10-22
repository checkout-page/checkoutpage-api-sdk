pub mod api_cmd;
pub mod auth;
pub mod create;
pub mod listen;
pub mod resources;
pub mod webhooks;

use anyhow::{Context, Result};
use serde_json::Value;

use crate::api::Query;
use crate::app::{App, CliError};
use crate::cli::*;
use resources::{
    BOOKINGS, CHECKOUT_PAGES, COUPONS, CUSTOMERS, EVENTS, FORMS, PAYMENTS, Resource, SUBSCRIPTIONS,
    WEBHOOKS, push,
};

pub async fn dispatch(app: &App, command: Command) -> Result<()> {
    match command {
        Command::Login(args) => auth::login(app, &args).await,
        Command::Logout => auth::logout(app).await,
        Command::Whoami => auth::whoami(app).await,
        Command::Events { command } => pages(app, &EVENTS, command).await,
        Command::CheckoutPages { command } => pages(app, &CHECKOUT_PAGES, command).await,
        Command::Forms { command } => pages(app, &FORMS, command).await,
        Command::Bookings { command } => match command {
            BookingsCommand::List(a) => {
                let mut q = Query::new();
                push(&mut q, "search", &a.search);
                push(&mut q, "status", &a.status);
                push(&mut q, "orderStatus", &a.order_status);
                push(&mut q, "pageId", &a.event);
                push(&mut q, "customerId", &a.customer);
                push(&mut q, "orderId", &a.order);
                push(&mut q, "couponCode", &a.coupon_code);
                push(&mut q, "abandonmentStatus", &a.abandonment_status);
                push(&mut q, "isComplimentary", &a.complimentary);
                dates(&mut q, &a.dates);
                resources::list(app, &BOOKINGS, &a.list, q).await
            }
            BookingsCommand::Get(a) => resources::get(app, &BOOKINGS, &a.id).await,
            BookingsCommand::Create(a) => create::booking(app, &a).await,
        },
        Command::Payments { command } => match command {
            PaymentsCommand::List(a) => {
                let mut q = Query::new();
                push(&mut q, "search", &a.search);
                push(&mut q, "status", &a.status);
                push(&mut q, "orderStatus", &a.order_status);
                push(&mut q, "productId", &a.product);
                push(&mut q, "pageId", &a.page);
                push(&mut q, "customerId", &a.customer);
                push(&mut q, "orderId", &a.order);
                push(&mut q, "couponCode", &a.coupon_code);
                push(&mut q, "abandonmentStatus", &a.abandonment_status);
                dates(&mut q, &a.dates);
                resources::list(app, &PAYMENTS, &a.list, q).await
            }
            PaymentsCommand::Get(a) => resources::get(app, &PAYMENTS, &a.id).await,
        },
        Command::Customers { command } => match command {
            CustomersCommand::List(a) => {
                let mut q = Query::new();
                push(&mut q, "search", &a.search);
                dates(&mut q, &a.dates);
                resources::list(app, &CUSTOMERS, &a.list, q).await
            }
            CustomersCommand::Get(a) => resources::get(app, &CUSTOMERS, &a.id).await,
        },
        Command::Subscriptions { command } => match command {
            SubscriptionsCommand::List(a) => {
                let mut q = Query::new();
                push(&mut q, "search", &a.search);
                push(&mut q, "status", &a.status);
                push(&mut q, "pageId", &a.page);
                push(&mut q, "customerId", &a.customer);
                push(&mut q, "orderId", &a.order);
                push(&mut q, "abandonmentStatus", &a.abandonment_status);
                dates(&mut q, &a.dates);
                resources::list(app, &SUBSCRIPTIONS, &a.list, q).await
            }
            SubscriptionsCommand::Get(a) => resources::get(app, &SUBSCRIPTIONS, &a.id).await,
        },
        Command::Coupons { command } => match command {
            CouponsCommand::List(a) => {
                let mut q = Query::new();
                push(&mut q, "search", &a.search);
                resources::list(app, &COUPONS, &a.list, q).await
            }
            CouponsCommand::Get(a) => resources::get(app, &COUPONS, &a.id).await,
            CouponsCommand::Create(a) => create::coupon(app, &a).await,
        },
        Command::Webhooks { command } => match command {
            WebhooksCommand::List(a) => {
                let mut q = Query::new();
                push(&mut q, "status", &a.status);
                push(&mut q, "event", &a.event);
                resources::list(app, &WEBHOOKS, &a.list, q).await
            }
            WebhooksCommand::Get(a) => resources::get(app, &WEBHOOKS, &a.id).await,
            WebhooksCommand::Listen(a) => listen::run(app, &a).await,
            WebhooksCommand::Trigger(a) => webhooks::trigger(app, &a).await,
        },
        Command::Api(a) => api_cmd::run(app, &a).await,
    }
}

async fn pages(app: &App, res: &Resource, command: PageCommand) -> Result<()> {
    match command {
        PageCommand::List(a) => {
            let mut q = Query::new();
            push(&mut q, "status", &a.status);
            push(&mut q, "search", &a.search);
            resources::list(app, res, &a.list, q).await
        }
        PageCommand::Get(a) => resources::get(app, res, &a.id).await,
    }
}

fn dates(q: &mut Query, d: &DateFilters) {
    push(q, "createdAfter", &d.created_after);
    push(q, "createdBefore", &d.created_before);
}

pub fn read_data(arg: &str) -> Result<Value> {
    let text = match arg.strip_prefix('@') {
        Some("-") => std::io::read_to_string(std::io::stdin()).context("could not read stdin")?,
        Some(path) => {
            std::fs::read_to_string(path).with_context(|| format!("could not read {path}"))?
        }
        None => arg.to_string(),
    };
    serde_json::from_str(&text)
        .map_err(|e| CliError::Usage(format!("--data is not valid JSON: {e}")).into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_data_inline_and_file() {
        assert_eq!(read_data(r#"{"a":1}"#).unwrap()["a"], 1);
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("b.json");
        std::fs::write(&p, r#"{"b":[1,2]}"#).unwrap();
        assert_eq!(read_data(&format!("@{}", p.display())).unwrap()["b"][1], 2);
        let e = read_data("{nope").unwrap_err();
        assert!(e.to_string().contains("not valid JSON"));
        assert!(read_data("@/definitely/missing.json").is_err());
    }
}
