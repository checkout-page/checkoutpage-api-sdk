# Checkout Page CLI

`checkoutpage` works with your Checkout Page account from the terminal. Look up events,
checkout pages, forms, bookings, payments, customers, subscriptions and coupons, book tickets
and create coupons, and receive your account's webhooks on your own machine while you build an
integration.

## Install

There are no prebuilt binaries yet. Build from source with Rust (stable, 1.85 or newer):

```bash
git clone https://github.com/checkout-page/checkoutpage-api-sdk.git
cd checkoutpage-api-sdk/cli
cargo install --path .
checkoutpage --version
```

`cargo install` puts the binary in `~/.cargo/bin`. To build without installing, run
`cargo build --release` and use `target/release/checkoutpage`.

## Log in

```bash
checkoutpage login
```

This opens your browser. Approve access for your account, and the CLI stores a key for it.
The key renews itself while you keep using the CLI. After 30 days without use, run
`checkoutpage login` again.

On a machine without a browser, print the link and open it somewhere else on the same machine:

```bash
checkoutpage login --no-browser
```

The browser has to reach `http://127.0.0.1` on the machine running the CLI, because that is
where the login finishes.

To store an API key from your dashboard instead:

```bash
checkoutpage login --api-key sk_live_...
```

### Which credentials are used

1. `--api-key <key>` on the command
2. the `CHECKOUTPAGE_API_KEY` environment variable
3. the credentials stored for the profile (`--profile`, `CHECKOUTPAGE_PROFILE`, default `default`)

The API origin follows the same order: `--base-url`, then `CHECKOUTPAGE_BASE_URL`, then the URL
stored with the profile, then `https://api.checkoutpage.com`.

Profiles let you keep several accounts or environments side by side:

```bash
checkoutpage login --profile staging --base-url https://staging-api.example.com
checkoutpage payments list --profile staging
```

Credentials live in `config.toml` inside `$CHECKOUTPAGE_CONFIG_DIR`, or the platform config
directory (`~/Library/Application Support/checkoutpage` on macOS, `~/.config/checkoutpage` on
Linux). The file is readable only by you. The CLI never prints a full key: it shows
`sk_live_...a1b2`, like the dashboard.

```bash
checkoutpage whoami    # account, key in use and where it came from
checkoutpage logout    # revokes a browser login and deletes the profile's credentials
```

## Output

Lists print a compact table. Amounts show in their currency, with zero-decimal currencies
like JPY shown in whole units (`¥1,500`).

| Flag | Output |
| --- | --- |
| (none) | Table, or a field list for `get` |
| `--json` | The API's JSON response, unchanged |
| `--csv` | CSV with a wider set of fields, amounts as plain decimals plus a currency column |
| `--no-color` | No color (also `NO_COLOR=1`) |

### Lists and pagination

Every `list` takes `--limit` (1 to 100, default 20), `--starting-after <id>` and
`--ending-before <id>` for cursors, and `--all` to fetch every page:

```bash
checkoutpage customers list --limit 50
checkoutpage customers list --starting-after 65f0c2...
checkoutpage payments list --all --csv > payments.csv
```

### Test mode

`--test` and `--live` filter by mode where the API supports it:

- payments, bookings and subscriptions: test-mode or live records (`livemode`)
- events, checkout pages and forms: pages that are in test mode or not (`testmode`)

Customers, coupons and webhooks have no mode filter, so `--test` and `--live` are refused for
them. A test key (`sk_test_...`) only ever sees test data.

## Commands

### Events, checkout pages and forms

```bash
checkoutpage events list --status published
checkoutpage events get 65f0c2a1e4a9f3d2b1c0a9e8
checkoutpage checkout-pages list --search membership --test
checkoutpage forms list --status draft
```

### Bookings

```bash
checkoutpage bookings list --event 65f0c2... --status paid
checkoutpage bookings list --customer 65f0d1... --created-after 2026-01-01
checkoutpage bookings get 65f0e3...
```

Book tickets without taking a card payment: pay by invoice, cash on delivery, or free of charge.

```bash
checkoutpage bookings create \
  --event 65f0c2... \
  --ticket 65f4a1...=2 \
  --field 65f4b2...=ana@example.com \
  --payment invoice
```

`--complimentary` issues the tickets at no charge. `--coupon <id>`, `--pwyw TICKET_TYPE_ID=AMOUNT`
(in the smallest currency unit) and `--query-param KEY=VALUE` are also available. For values the
flags can't express, such as an address field, pass the body with `--data '{...}'` or
`--data @booking.json`; flags are applied on top of it.

### Payments, customers and subscriptions

```bash
checkoutpage payments list --status paid --product 65f0... --created-after 2026-06-01
checkoutpage payments get 65f0...
checkoutpage customers list --search grace
checkoutpage customers get 65f0...
checkoutpage subscriptions list --status past_due
checkoutpage subscriptions get 65f0...
```

### Coupons

```bash
checkoutpage coupons list --search spring
checkoutpage coupons get 65f0...
checkoutpage coupons create --code SPRING25 --label "Spring sale" --percent-off 25
checkoutpage coupons create --code TENOFF --amount-off 10 --currency usd \
  --duration repeating --duration-in-months 3 --max-redemptions 100
```

`--amount-off` is in the currency's main unit: `10.50` with `usd` is $10.50, `500` with `jpy`
is ¥500.

### Webhook endpoints

```bash
checkoutpage webhooks list --status failed
checkoutpage webhooks get 65f0...
```

### Raw API requests

`api` calls any endpoint and prints the JSON response. The path is relative to the API origin.

```bash
checkoutpage api GET /v1/tickets/ -q pageId=65f0... -q limit=5
checkoutpage api PATCH /v1/customers/65f0... --data '{"name": "Grace Hopper"}'
checkoutpage api POST /v1/products/ --data @product.json
```

## Receive webhooks locally

`webhooks listen` receives your account's webhook events as they happen, with no endpoint to
set up. It needs no public URL.

```bash
checkoutpage webhooks listen --forward-to http://localhost:3000/webhooks
```

```
Ready! Listening for all events.
Forwarding to http://localhost:3000/webhooks
Webhook signing secret: 3f9a...c41e
Press Ctrl-C to stop.
10:42:07  payment.paid  evt_6718...  -> 200 (14ms)
10:42:31  booking.paid  evt_6718...  -> 500 (31ms)
```

- `--events payment.paid,booking.paid` receives only those events.
- `--forward-to <url>` POSTs each event to your app, signed like a real delivery. Without it,
  the CLI prints one line per event.
- `--print-json` prints each event's payload to stdout (the status lines move to stderr), for
  piping into `jq`.
- `--skip-verify` accepts a self-signed certificate on an `https` forward URL.

Each forwarded request carries the same headers as a real delivery:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | `sha256=<hex HMAC-SHA256 of the body, keyed with the signing secret>` |
| `X-Webhook-Timestamp` | Milliseconds since the epoch |
| `X-Webhook-Delivery-Attempt` | `1` |
| `X-Webhook-Test` | `true` for events sent with `webhooks trigger` |
| `User-Agent` | `Checkout-Page-CLI/<version>` |

The signing secret belongs to this listening session only. Put it where your app reads its
webhook secret while you test. A session lasts at most 60 minutes, then the CLI reconnects
automatically and prints the new secret. It also reconnects after network drops, waiting 1s,
2s, 4s and so on up to 30s between tries.

Your existing verification code works unchanged with the listener's secret. In Node:

```js
import crypto from 'node:crypto';

// Use the raw request body, before any JSON parsing.
function verify(rawBody, signatureHeader, secret) {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader ?? '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verify(req.body, req.get('X-Webhook-Signature'), process.env.CHECKOUTPAGE_WEBHOOK_SECRET)) {
    return res.sendStatus(401);
  }
  const event = JSON.parse(req.body);
  console.log(event.event, event.event_id);
  res.sendStatus(200);
});
```

In Python:

```python
import hashlib, hmac

def verify(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")
```

### Send a test event

With `webhooks listen` running, send a sample event to it from another terminal:

```bash
checkoutpage webhooks trigger payment.paid
```

The sample payload has `"test": true`, and the forwarded request has `X-Webhook-Test: true`.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | API or network error |
| 2 | Invalid command or arguments |
| 3 | Not logged in, or the key was rejected (401, 403) |
| 4 | Not found (404) |
| 5 | Validation error (400, 422) |
| 6 | Conflict (409) |
| 7 | Rate limited (429) |

## Development

```bash
cd cli
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

`cargo test` runs offline against mock servers. `tests/live_listen.rs` also checks
`webhooks listen` end to end against a real API, and runs only when
`CHECKOUTPAGE_LIVE_API_KEY` and `CHECKOUTPAGE_LIVE_BASE_URL` are set. Point it at a local dev
stack, never production: it creates and archives checkout pages.

See [CLAUDE.md](CLAUDE.md) for the layout and the testing approach.
