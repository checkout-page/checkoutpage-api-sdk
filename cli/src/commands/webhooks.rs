use anyhow::Result;
use serde_json::{Value, json};

use crate::api::unwrap_data;
use crate::app::{App, ModeParam};
use crate::cli::TriggerArgs;
use crate::output::{Format, err, out, to_pretty_json};

pub const TEST_EVENTS_PATH: &str = "/v1/webhook-listeners/test-events";

pub async fn trigger(app: &App, args: &TriggerArgs) -> Result<()> {
    app.reject_csv("webhooks trigger")?;
    app.mode_query(ModeParam::None, "webhooks trigger")?;
    let client = app.client().await?;
    let raw = client
        .post(TEST_EVENTS_PATH, &json!({ "event": args.event }))
        .await?;
    if app.format() == Format::Json {
        out(to_pretty_json(&raw));
        return Ok(());
    }
    let data = unwrap_data(&raw);
    let delivered = data.get("delivered").and_then(Value::as_u64).unwrap_or(0);
    let event_id = data.get("eventId").and_then(Value::as_str).unwrap_or("-");
    let listeners = if delivered == 1 {
        "listener"
    } else {
        "listeners"
    };
    out(format!(
        "Sent a test {} event ({event_id}) to {delivered} {listeners}.",
        args.event
    ));
    if delivered == 0 {
        err(app.err_style.yellow(
            "No `checkoutpage webhooks listen` session is running for this account, so nothing received it.",
        ));
    }
    Ok(())
}
