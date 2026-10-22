# CLAUDE.md - cli/

`checkoutpage`, the merchant CLI for the Checkout Page seller API. A standalone Rust crate
(`checkoutpage-cli`, binary `checkoutpage`), edition 2024, toolchain pinned by
`rust-toolchain.toml`. User docs are in [README.md](README.md).

## Commands

```bash
cargo build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test                     # unit + integration, a few seconds
cargo test --test listen       # one integration file
```

### Live listen tests

`tests/live_listen.rs` runs the real binary against a real API: `webhooks listen` with a local
`--forward-to` receiver, `webhooks trigger`, and checkout pages created through the API. Every
test skips with a printed reason unless both env vars are set, so plain `cargo test` and CI stay
offline.

```bash
CHECKOUTPAGE_LIVE_API_KEY=sk_... \
CHECKOUTPAGE_LIVE_BASE_URL=http://localhost:810N \
  cargo test --locked --test live_listen -- --nocapture
```

- Target a local API serving the relay (`/v1/webhook-listeners/*`): a mono instance stack
  (`scripts/stack up N --worker`, no `--isolate`) or canonical once the relay is on main.
  Never production: the tests create checkout pages (archived on the way out; the product
  each page creates stays) and fill the seller's 5-listener cap.
- The key is the e2e seller's dev key, `CHECKOUTPAGE_API_KEY` in the mono's
  `api-sdk/js/.env.test` (see the mono's `running-sdk-integration-tests` skill).
- `CHECKOUTPAGE_LIVE_SECOND_API_KEY`, a key for a different seller, turns on the seller
  isolation test; without it that test skips.
- The tests run one at a time (they share the cap), and each starts by waiting until the seller
  has no open listener. A `webhooks listen` you have running on the same seller holds them up
  for 60s, then fails them. About 25s in all.

CI: `.github/workflows/test-cli.yml` runs all three on ubuntu and macos for changes under `cli/`.

## Layout

- `src/api/` - the HTTP client, with no CLI concerns, so it can become a standalone Rust SDK
  crate. `Client` (bearer auth, query building, cursor pagination, SSE stream opening),
  `ApiError` (mirrors the JS SDK's error classes), `oauth` (register, authorize URL, token,
  refresh, issue-api-key, revoke), `pkce`, `sse` (incremental event-stream parser) and
  `signature` (`sha256=` HMAC, same as `apps/api/src/webhooks/lib/webhookSignature.ts`).
- `src/cli.rs` - clap definitions. `src/app.rs` - credential and base URL precedence, OAuth key
  refresh, `--test`/`--live` mapping, exit codes.
- `src/commands/` - one module per command group. `resources.rs` holds a column spec per
  resource; table, CSV and `get` views all come from it.
- `src/config.rs` (profiles in `config.toml`, 0600), `src/callback.rs` (loopback login
  redirect), `src/money.rs` (minor units, zero-decimal currencies), `src/backoff.rs`.
- `tests/` - integration tests running the real binary with `CHECKOUTPAGE_CONFIG_DIR` in a
  tempdir: `resources.rs`, `auth.rs` (the test plays the browser), `listen.rs` (scripted SSE
  server in `tests/common/`), and `live_listen.rs` (opt-in, against a real API).

## Conventions

- The OpenAPI spec (`../spec/openapi.json`) is the source of truth for paths, query params and
  shapes. List paths keep the spec's trailing slash (`/v1/coupons/`), like the JS SDK.
- Single-object responses come wrapped in `{ "data": ... }`; use `api::unwrap_data`, which also
  accepts a bare object.
- `webhooks listen` and `webhooks trigger` use `/v1/webhook-listeners/*`, which is not in the
  spec yet; the contract is the relay design in the mono repo's API.
- `CHECKOUTPAGE_BACKOFF_UNIT_MS` and `CHECKOUTPAGE_IDLE_TIMEOUT_MS` shrink the listener's
  reconnect and heartbeat timings for tests. They are not user-facing.
- Print through `output::out` / `output::err`, not `println!`, so a closed pipe exits quietly.
- Never print a full API key; use `util::mask_key`.
- No em dashes in user-facing strings (help text, messages, README).
