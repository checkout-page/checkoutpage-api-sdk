# Checkout Page CLI

`checkoutpage` works with your Checkout Page account from the terminal. Look up events,
checkout pages, forms, bookings, payments, customers, subscriptions, coupons and webhook
endpoints, and book tickets and create coupons.

## Install

Prebuilt binaries are available from the first CLI release, for macOS (Apple silicon and
Intel), Linux (x64 and arm64) and Windows (x64). Until then, build from source.

### Homebrew (macOS and Linux)

```bash
brew install checkout-page/tap/checkoutpage
```

### Shell script (macOS and Linux)

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/checkout-page/checkoutpage-api-sdk/releases/download/checkoutpage-cli-v0.1.0/checkoutpage-cli-installer.sh | sh
```

### PowerShell (Windows)

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/checkout-page/checkoutpage-api-sdk/releases/download/checkoutpage-cli-v0.1.0/checkoutpage-cli-installer.ps1 | iex"
```

Both scripts install the version in the URL. For a newer one, replace `0.1.0` with the version
from the [CLI releases](https://github.com/checkout-page/checkoutpage-api-sdk/releases); each
release lists its own install commands. The binary goes in `~/.cargo/bin` (`%USERPROFILE%\.cargo\bin`
on Windows), which the script adds to your `PATH`.

### npm

```bash
npm install -g @checkoutpage/cli
```

The package downloads the binary for your platform when it installs.

### From source

With Rust (stable, 1.85 or newer):

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

To store an API key from your dashboard instead, pass `-` and paste the key when asked, or pipe
it in:

```bash
checkoutpage login --api-key -
pbpaste | checkoutpage login --api-key -
```

Reading it from stdin keeps the key out of your shell history and the process list. Scripts can
still pass the key itself with `--api-key <key>`.

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
Linux, `%APPDATA%\checkoutpage` on Windows). The file is readable only by you. The CLI never prints a full key: it shows
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

`cargo test` runs offline against mock servers.

See [CLAUDE.md](CLAUDE.md) for the layout and the testing approach.
