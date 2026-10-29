# make/CLAUDE.md

The Checkout Page custom app for Make.com. Its audience is sellers who are not developers
(churches, clubs, studios, coaches), the same as the n8n nodes, so it favours what they
automate: new bookings and payments, adding an attendee, coupons, customer lookups. The app is
in private beta, shared by invite link from Make; the public listing comes after Make's review.

## Layout

- `app/` - the app in the local file format of the Make Apps Editor VS Code extension. Make
  reads these files as they are, so their names and shapes follow Make, not this repo.
  - `makecomapp.json` - the manifest: every component (connection, webhooks, modules, RPCs,
    functions) with its label, description and code files, plus the general files. Only the
    Production origin is committed, never a key (see [Deploying](#deploying)).
  - Code files are named `<type>s/<kebab-id>/<kebab-id>.<code>.iml.json`, for example
    `modules/search-payments/search-payments.mappable-params.iml.json`. `common` files end in
    `.json`, function `code` and `test` files in `.js`. `test/structure.test.ts` enforces it.
  - `general/base.iml.json` - base URL, auth header and error mapping shared by every module.
  - `connections/checkout-page/` - the `checkoutPage` connection: API key and an advanced base
    URL, checked with `GET /v1/account/`.
  - `webhooks/` - one dedicated webhook per trigger. `attach` creates a Checkout Page webhook
    with an `x-make-token` custom header, `detach` deletes it, and the communication drops
    `webhook.test` and deliveries with the wrong token.
  - `modules/` - instant triggers, searches, gets, writes and the universal module.
    `modules/groups.json` puts every module in exactly one group.
  - `rpcs/` - the dropdown lists (events, checkout pages, forms, customers, products, coupons,
    an event's ticket types and fields).
  - `functions/` - IML functions. The write bodies (`bookingBody`, `couponBody`,
    `customerBody`) and the query helpers (`toQueryBoolean`, `toQueryDate`) live here.
  - `README.md` - the in-app README Make shows to sellers. Customer-facing.
- `scripts/` - the interface generator. `interfaces.config.ts` lists one `Target` per module
  that returns data; `gen-interfaces.ts` writes each module's `interface` and `samples` from
  `spec/openapi.json`. `spec-schema.ts` holds the spec-to-Make conversion.
- `test/` - vitest. `spec.ts` loads the spec into ajv; `conformance.ts` checks a
  communication's method, path, query and body keys against it.

## Commands

A standalone npm project with its own `package-lock.json`, outside the root pnpm workspace.

```bash
cd make
npm ci
npm test               # vitest
npm run lint           # tsc --noEmit
npm run format:check   # prettier, also over the Markdown and app/ JSON
npm run generate       # rewrite module interfaces and samples from the spec
```

Generated interfaces and samples are committed. `npm run generate` must be idempotent:
`test-make.yml` runs it and fails if `app/` changes. Run it after every spec change and commit
the result.

## Adding a module

1. Register it in `app/makecomapp.json` under `components.module` with a sentence-case label,
   a one-sentence description, `moduleType`, `connection: "checkoutPage"` and its code files
   (the naming rule above). Write the communication and params by hand.
2. If it returns data, add a `Target` to `scripts/interfaces.config.ts`. Use `exclude` for
   fields sellers never map, `labels` to name a bare `pageId` as a checkout page, event or form,
   and `wrap` for triggers (the webhook envelope around the record).
3. Run `npm run generate`.
4. Add the module to one group in `app/modules/groups.json`.
5. Add or extend the tests for its type (`searches.test.ts`, `gets.test.ts`, `writes.test.ts`,
   `webhooks.test.ts`, `rpcs.test.ts`), and update the module lists in `README.md` and
   `app/README.md`.

## Spec rules

- Every path, query parameter and body key comes from `spec/openapi.json`. Search filters must
  be query parameters the operation declares; the conformance check fails otherwise. A spec
  sync that breaks it means the app is out of line: fix the app, never loosen the test.
- Never send or show a field the spec marks `deprecated: true`. The generator drops deprecated
  fields, the conformance check rejects deprecated query parameters and `writes.test.ts`
  rejects deprecated body keys.
- Write bodies are built by functions (`{{bookingBody(parameters)}}`), never inline IML, so
  they can be unit tested. `writes.test.ts` validates their output against the operation's
  request schema with ajv and rejects unknown keys.
- Labels never say a bare "Page": name the checkout page, event or form. `interfaces.test.ts`
  checks every generated label, and `structure.test.ts` checks the in-app README.

## Never break published scenarios

- **Never rename or delete a published component** (module, connection, webhook, RPC or
  function id) or a parameter name. Scenarios store them, and Make never lets a public app
  delete a module or connection. Change the label instead.
- **Never commit `.secrets/` or a key file.** `.secrets/` is gitignored. No real API keys or
  Make tokens in tests, fixtures or docs: use placeholders like `YOUR_API_KEY`.
- **Commit the Production origin, not the Testing ones.** After the first Production deploy,
  commit its origin (`label`, `baseUrl`, `appId`, `appVersion`, `idMapping` and
  `apikeyFile: "../.secrets/production"`) so the component mapping is shared and the next
  deploy does not create duplicates. Never commit the key file itself; Testing origins stay
  local.

## Deploying

Deploying only works from VS Code with the Make Apps Editor extension. There is no CLI.

Hard dependency: Make does not enable custom IML functions for an app by default. Ask Make
support to turn them on for each app (testing and Production) before the first deploy, or the
five functions (`toQueryBoolean`, `toQueryDate`, `bookingBody`, `couponBody`, `customerBody`)
fail to deploy and every search and write that calls them breaks.

1. Create a Make API token with the scopes `sdk-apps:read` and `sdk-apps:write`. Save it in a
   file under `make/.secrets/`, for example `make/.secrets/testing`.
2. Add an origin to `app/makecomapp.json` locally, pointing `apikeyFile` at that file:

   ```json
   "origins": [
     {
       "label": "Testing",
       "baseUrl": "https://eu1.make.com/api",
       "appId": "YOUR_TEST_APP_ID",
       "appVersion": 1,
       "apikeyFile": "../.secrets/testing"
     }
   ]
   ```

   The path is relative to `makecomapp.json`. The extension keeps each origin's local-to-remote
   component mapping (`idMapping`) inside the origin. Keep Testing origins local. After the
   first Production deploy, commit the Production origin (`label`, `baseUrl`, `appId`,
   `appVersion`, `idMapping`, `apikeyFile: "../.secrets/production"`) so the mapping is shared;
   never commit the key file itself. `structure.test.ts` fails when an origin's `apikeyFile`
   is outside `.secrets/` or a key is inline.

3. Right-click `app/makecomapp.json` and select **Deploy to Make**. Try the change in a scenario
   with a test mode API key before deploying to the Production origin.

Each developer deploys to their own testing app; only a release deploys to Production.

## Releasing

`package.json` holds the last released version. The first release is 0.1.0, so it stays at
`0.0.0` until then; the workflow writes the new version.

1. Add a `## <version>` section to `CHANGELOG.md`.
2. Deploy `app/` to the Production origin from VS Code.
3. Run `publish-make.yml` from main with the new version. It checks the version is greater than
   `package.json`'s, that tag `make-v<version>` is new and that the changelog has the section,
   runs the tests, commits the bump and pushes it with the tag, then creates the GitHub
   release from the changelog section. It does not deploy.
