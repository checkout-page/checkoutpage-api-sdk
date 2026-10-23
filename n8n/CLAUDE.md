# n8n/CLAUDE.md

The Checkout Page n8n community node package, npm `n8n-nodes-checkoutpage`. Its audience is
sellers who are not developers (churches, clubs, studios, coaches), so the node favours the
things they automate: new bookings and payments, adding an attendee, coupons, customer lookups.

## Layout

- `credentials/CheckoutPageApi.credentials.ts` - API key (password field) and base URL. Sends
  `Authorization: Bearer <key>`; the credential test is `GET /v1/account/`.
- `nodes/CheckoutPage/` - the action node. `CheckoutPage.node.ts` holds the description, load
  options (events, ticket types, event fields) and `execute`. `operations.ts` turns parameters
  into `{ method, path, qs, body }`. `transport.ts` is the only place that makes HTTP calls and
  maps errors. `descriptions/` holds the UI parameters per resource.
- `nodes/CheckoutPageTrigger/` - the webhook trigger. `signature.ts` verifies
  `X-Webhook-Signature`.
- `icons/` - `checkoutpage.svg` (light) and `checkoutpage.dark.svg` (dark), the brand mark from
  the mono repo's `apps/site/public/brand/`.
- `test/` - vitest unit tests with a mocked `httpRequestWithAuthentication`. Not shipped.

## Rules n8n verification imposes

Check https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/
before changing any of these.

- **No runtime dependencies.** `dependencies` stays empty; `n8n-workflow` is a peer dependency.
  Only `n8n-workflow` and Node's built-in `crypto` may be imported from shipped code. Never
  import `@checkoutpage/sdk`: verified nodes can't carry it. Every request goes through
  `this.helpers.httpRequestWithAuthentication` in `transport.ts`.
- **No environment or file system access** in shipped code, and no `process`, timers, `eval` or
  `child_process`. The linter enforces this.
- **`eslint.config.mjs` must stay byte-for-byte the scaffold's.** `"strict": true` in the `n8n`
  section of `package.json` makes `n8n-node lint` fail if it changes.
- **Publish only from GitHub Actions with npm provenance** (required since May 1, 2026). Use
  `.github/workflows/publish-n8n.yml`; `prepublishOnly` blocks a plain `npm publish`.
- Package name starts with `n8n-nodes-`, keywords include `n8n-community-node-package`, license
  MIT, and `repository` points at this public repo with `directory: "n8n"`.
- Errors thrown from shipped code are `NodeApiError` (API failures, built by `toNodeApiError`
  with the API's `message`) or `NodeOperationError` (bad input). Never rethrow a raw error.

## Conventions

- Resource and operation names follow the API: `get`, `getAll` (shown as "Get Many"),
  `create`, `update`. Paths, query parameters and body fields come from `spec/openapi.json`;
  a test fails if a list filter is not a query parameter in the spec, or if the trigger's
  events differ from the spec's webhook event enum. Update both when the spec changes.
- Lists use the API's cursor: `limit` up to 100, then `starting_after` set to the last id
  while `has_more` is true (`apiRequestList`).
- The action node is programmatic (`execute`), not declarative. Declarative routing can't be
  unit tested without n8n's runtime, and booking create builds a keyed `tickets` object from
  rows, which routing can't express.
- n8n's linter wants title case for parameter names and option labels in the node UI
  ("Get Many", "Live Mode"). That overrides the repo's sentence-case rule inside the node; the
  README and other docs stay in sentence case.
- Customer-facing text (README, parameter descriptions) follows the root rules: plain short
  sentences, no em dash character, "organizations" where a church or club would not call
  itself a business.

## The trigger

- `create` sends a random 64-character hex `secret` in `POST /v1/webhooks/` and stores the
  webhook `id` and secret in the node's static data (the response's `secret` wins if present).
  On a 409 for the same URL, or the 400 for the 10-webhook cap (the API checks the cap first),
  it deletes the leftover webhook with this exact URL and retries once, because a secret can't
  be read back.
- `checkExists` returns true only when the stored webhook still exists with the same URL and
  events and a secret is stored; otherwise it deletes the remote webhook and clears static data.
- `delete` removes the webhook (a 404 counts as deleted) and clears static data.
- `webhook` verifies `sha256=<hex HMAC-SHA256 of the raw body>` against the stored secret with
  `timingSafeEqual`, and answers 401 without starting the workflow when it doesn't match.
- Checkout Page rejects `http` webhook URLs, so `create` refuses them with a clear message.

## Commands

This is a standalone npm project with its own `package-lock.json`, not part of the root pnpm
workspace: n8n's tooling (`@n8n/node-cli`, its `n8n-node release` flow and CI template)
assumes npm, and its dev dependency tree (about 750 MB) is unrelated to the SDK lockfile.

```bash
cd n8n
npm install
npm run lint        # n8n-node lint (n8n's eslint rules)
npm run type-check  # tsc over source and tests
npm test            # vitest
npm run build       # n8n-node build -> dist/
npm run dev         # local n8n with the node loaded (needs Docker or Podman)
npm pack --dry-run  # should list only dist/, README.md and package.json
```
