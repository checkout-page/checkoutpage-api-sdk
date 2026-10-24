# zapier/

The Checkout Page Zapier integration (id 140636), pushed with `zapier-platform-cli`. What it
is, commands, live tests and the release flow are in [README.md](README.md). Read it first.

Standalone npm project: `npm ci`, `npm test`, `npm run format:check`, `npm run validate`, from
this directory. Not in the pnpm workspace; never add it to `pnpm-workspace.yaml`. Run the CLI
as `npx zapier-platform ...` (the pinned dev dependency), with `DISABLE_ZAPIER_ANALYTICS=1`.

## Never break existing Zaps

Live Zaps store trigger keys, input field keys and values, and auth fields. When users are
migrated to a new version, their Zaps run on the new code with that saved data. So, without
an explicit decision from a maintainer:

- Never rename or remove a trigger key, an input field key or a choice value, and never
  rename the auth field `api_key`.
- Never change a request a trigger sends: URL, method, headers, `limit`/`skip` paging, the
  `livemode` filter or `sort`.
- Never change the shape of `sample` or `outputFields`: Zaps map later steps to these keys.
- Don't make an optional input field required, or add a new required one.
- Results are returned as the API sends them. Don't reshape them in `perform`.
- A known bug that changes behaviour when fixed (README, Known issues) is fixed only as a
  decided, announced change, never as a side effect.

`test/contract.test.js` snapshots the user-facing contract. When it fails, treat it as a
breaking change: undo it. Update the snapshot (`npx jest -u test/contract.test.js`) only for a
purely additive change such as a new trigger or a new optional field, and say so in the PR.

Formatting and comment-only edits are fine. A breaking change ships as a new trigger (or a new
major version with `zapier-platform deprecate`), never by editing an existing one in place.

## Adding a trigger

1. Check the API endpoint in `checkoutpage-mono`, `apps/api/src/zapier/routes.ts`. New
   endpoints live under `/api/v1/zapier/v2/`, use `zapierAuth` and return an array of objects
   with an `id`.
2. Add `triggers/<key>.js`, copying an existing trigger: `key`, `noun`, `display`
   (Title Case labels like "New Payment": Zapier's convention for action names), `operation.perform` calling
   `${process.env.API_URL}/zapier/v2/<resource>` with `Accept: application/json` and the
   bearer key, `limit: 25` / `skip: 25 * bundle.meta.page`, `canPaginate: true`, then
   `response.throwForStatus()`. Include `sample` and `outputFields` from a real response.
3. Register it in `index.js` under `[trigger.key]`.
4. Add it to the `TRIGGERS` table in `test/triggers.test.js`, and the `index.js` count test.
5. Update the contract snapshot (`npx jest -u test/contract.test.js`) and check the diff only
   adds the new trigger.
6. Add the trigger to the table in README.md and a `## <version>` CHANGELOG entry
   (`- New trigger/<key>: ...`), then `npm test` and `npm run validate`.
7. Release with the Publish Zapier app workflow (README.md, Releasing).

## Don'ts

- Never commit `.env` (gitignored) or a real API key or deploy key. Tests use fake values like
  `test-api-key-123`.
- Never run `zapier-platform promote`, `migrate` or `deprecate` from CI or without the
  maintainer asking. The release workflow only pushes and sets the environment.
- Never edit the integration in Zapier's visual builder (README.md explains why).
- Unit tests make no network calls: mock every request with `nock`.
