# Checkout Page for Zapier

The source of the Checkout Page integration for Zapier (Zapier integration id `140636`). It lets Zapier users start a Zap when something happens in
their Checkout Page account.

It has 10 polling triggers and API key authentication:

| Trigger key                  | Label                      | API endpoint                         |
| ---------------------------- | -------------------------- | ------------------------------------ |
| `new_payment`                | New Payment                | `/zapier/v2/charges`                 |
| `new_submission`             | New Submission             | `/zapier/v2/submissions`             |
| `new_subscription`           | New Subscription           | `/zapier/v2/subscriptions`           |
| `active_subscription`        | Active Subscription        | `/zapier/v2/active-subscriptions`    |
| `canceled_subscription`      | Canceled Subscription      | `/zapier/v2/canceled-subscriptions`  |
| `completed_subscription`     | Completed Subscription     | `/zapier/v2/completed-subscriptions` |
| `new_subscription_payment`   | New Subscription Payment   | `/zapier/v2/subscription-payments`   |
| `new_abandoned_payment`      | New Abandoned Payment      | `/zapier/v2/abandoned-payments`      |
| `new_abandoned_booking`      | New Abandoned Booking      | `/zapier/v2/abandoned-bookings`      |
| `new_abandoned_subscription` | New Abandoned Subscription | `/zapier/v2/abandoned-subscriptions` |

Every request goes to `${API_URL}/zapier/v2/...` with `Authorization: Bearer <api_key>`.
`API_URL` is not in the code: it is an environment variable set on each Zapier version (the
API origin plus `/api/v1`). The connection test calls `${API_URL}/zapier/v2/health`.

Versions up to 2.2.9 were built in Zapier's visual builder. This directory started as the
output of `zapier-platform convert 140636 --version=2.2.9`, and new versions are pushed from
here. See [Editing in Zapier's visual builder](#editing-in-zapiers-visual-builder).

This is a standalone npm project (Zapier builds integrations with npm). It is not part of the
repo's pnpm workspace.

## Layout

```
zapier/
├─ index.js              # The app definition: registers the triggers and the auth
├─ authentication.js     # API key auth and its connection test
├─ triggers/             # One file per trigger
├─ test/                 # Unit tests (nock, no network)
│  ├─ __snapshots__/     # The user-facing contract snapshot
│  └─ live/              # Optional tests against a real API
├─ CHANGELOG.md          # Release notes, read by `zapier-platform promote`
├─ .zapierapprc          # Links this directory to integration 140636
└─ .env.example          # API_URL and live test settings
```

## Develop and test locally

Use Node 22 or later.

```bash
cd zapier
npm ci
npm test                 # unit tests
npm run format:check     # or: npm run format
npm run validate         # zapier-platform validate --without-style
```

The Zapier CLI is a pinned dev dependency (`zapier-platform-cli`), so you do not need a global
install. Run it as `npx zapier-platform <command>` from this directory. The CLI command is
`zapier-platform` (older docs call it `zapier`).

`npm run validate` checks the app definition against Zapier's schema on your machine.
`--without-style` skips the extra checks that need Zapier's servers, and
`DISABLE_ZAPIER_ANALYTICS=1` stops the CLI from sending usage analytics, so it needs no login
and no network.

The unit tests use `zapier.createAppTester` with `nock`, so they make no real requests. They
cover, for each trigger, the URL, method, headers, paging, the livemode filter for each input
choice, results and error statuses, and the connection test. `test/contract.test.js` snapshots
the user-facing contract: trigger keys, labels, nouns, input fields and choices, output fields,
samples and the auth field. If it fails, read [CLAUDE.md](CLAUDE.md) before you update the
snapshot.

## Live tests

`test/live/` calls the auth test and every trigger against a real API and checks the response
shape (an array of objects with an `id`). They are skipped unless both variables are set:

```bash
ZAPIER_LIVE_API_URL=http://localhost:8106/api/v1 \
ZAPIER_LIVE_API_KEY=<seller API key> \
npm run test:live
```

Against a local Checkout Page API (Checkout Page developers):

1. Start an instance stack from a `checkoutpage-mono` worktree, for example
   `scripts/stack up 6`. Instance `N` serves the API on port `8100 + N`. The canonical stack
   serves it on `8080` and at `https://api.checkoutpage.dev`.
2. Use the same seller API key as the SDK integration tests: `CHECKOUTPAGE_API_KEY` in
   `api-sdk/js/.env.test` in the mono.
3. Run the command above with `ZAPIER_LIVE_API_URL=http://localhost:810N/api/v1`. For the
   canonical HTTPS URL, add `NODE_OPTIONS=--use-system-ca` so Node trusts the local
   certificate.

The triggers ask for test data in the live tests (`include_test_*: true`), since a local
database has little live-mode data.

## Releasing

Releases run from GitHub Actions. A release pushes a new **private** version to Zapier. It
does not change anything for existing users until you promote and migrate by hand.

### 1. Prepare

Open a PR that adds a `## <version>` section to [CHANGELOG.md](CHANGELOG.md), for example:

```markdown
## 2.2.11

- Update trigger/new_payment: describe the change for Zapier users.
```

The version must be greater than `version` in `package.json`. Merge the PR to main.

### 2. Push the version

Run the **Publish Zapier app** workflow (`.github/workflows/publish-zapier.yml`) on main, with
the version as input. It:

1. checks the version is `X.Y.Z`, greater than `package.json`'s, has no `zapier-v<version>`
   tag yet and has a CHANGELOG section;
2. sets `version` in `package.json` and `package-lock.json`;
3. runs the format check, the unit tests and `zapier-platform validate --without-style`;
4. runs `zapier-platform push` with the `ZAPIER_DEPLOY_KEY` secret. Push also runs Zapier's
   server-side checks, and fails on any error they report;
5. runs `zapier-platform env:set <version> API_URL=<ZAPIER_API_URL>`;
6. commits the version bump to main, tags it `zapier-v<version>` and creates a GitHub release.

If a step after the push fails, fix the cause and run the workflow again with the same
version: the tag does not exist yet, and the push overwrites the unpromoted version.

### 3. Check the new version

The commands below run from `zapier/` with a deploy key: either
`export ZAPIER_DEPLOY_KEY=<key>` or `npx zapier-platform login` once.

```bash
npx zapier-platform versions          # the new version is listed, with 0 users
npx zapier-platform env:get 2.2.11    # API_URL is set
```

Then try it in Zapier: in the Zap editor, pick the new version of Checkout Page (private
versions are visible to the integration's team), connect an account and test each changed
trigger.

### 4. Promote (manual)

```bash
npx zapier-platform promote 2.2.11
```

Promoting makes the version the one new users get. Existing Zaps stay on their version. The
command shows the CHANGELOG section and asks you to confirm.

### 5. Migrate existing users (manual, gradual)

Move a small share of users first, then watch for errors before moving everyone:

```bash
npx zapier-platform migrate 2.2.9 2.2.11 10     # 10% of users on 2.2.9
npx zapier-platform jobs                        # wait for the migration to finish
npx zapier-platform logs --version=2.2.11 --status=error --type=http
npx zapier-platform migrate 2.2.9 2.2.11 100    # everyone else
```

The percent is a plain number from 1 to 100 (no `%` sign). Repeat for any other version that
still has users (see `npx zapier-platform versions`). Only migrate between versions with no
breaking change: migrated Zaps keep running on their saved trigger keys and field values.

### Roll back

Migrate users back and re-promote the previous version:

```bash
npx zapier-platform migrate 2.2.11 2.2.9 100
npx zapier-platform promote 2.2.9
```

Then fix forward with a new version. Never delete a version that still has users.

### One-time setup

A repo admin sets these once in the GitHub repo settings:

- **`ZAPIER_DEPLOY_KEY`** (Actions secret): a deploy key from the Zapier developer platform,
  under Settings, Deploy keys (`https://developer.zapier.com/partner-settings/deploy-keys/`).
  Create a new key for CI rather than reusing a personal one, from an account that is an admin
  of integration 140636. The CLI reads it from the `ZAPIER_DEPLOY_KEY` environment variable.
- **`ZAPIER_API_URL`** (Actions variable, not a secret): the production API origin plus
  `/api/v1`. Copy it from the live version: `npx zapier-platform env:get 2.2.9`. The workflow
  refuses to run unless it is an `https` URL ending in `/api/v1`.
- **`RELEASE_TOKEN`** (Actions secret, only if main is protected): a fine-grained token, or a
  GitHub App token, with Contents read and write on this repo, allowed to push to main past the
  branch protection rules. Without it the workflow uses `GITHUB_TOKEN`, which cannot push to
  a protected main.

## Editing in Zapier's visual builder

Do not edit this integration in Zapier's visual builder (Platform UI) any more. Make every
change here, in code, and release it with the workflow.

From Zapier's docs on exporting to the CLI: once a version is pushed from the CLI, that
version cannot be edited from the Build section of the Platform UI (its settings show a lock).
The versions built in the visual builder (up to 2.2.9) can still be edited there, but a change
made there never reaches this code and is lost from the next version pushed from here. The
Platform UI is still the place for everything outside Build: versions, sharing, embeds and the
partner dashboard.

## Known issues

These are kept as they are on purpose: changing them changes behaviour for existing Zaps. The
unit tests pin today's behaviour.

- **"Include test ..." = False may still include test data.** The `include_test_*` fields are
  `boolean` fields with string choices `'false'` and `'true'`, and the triggers check
  `bundle.inputData.include_test_* ? {} : { livemode: true }`. `zapier-platform-core` does not
  convert input values, so if Zapier passes the chosen value as the string `'false'`, it is
  truthy and the `livemode` filter is dropped. Zapier's docs say a boolean field "passes along
  true or false"; which one a Zap actually receives needs checking in Zapier's logs for a Zap
  set to False.
