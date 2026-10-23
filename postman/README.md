# Checkout Page Postman collection

A [Postman](https://www.postman.com) collection for the Checkout Page seller API. It has a
request for every endpoint, grouped into folders by resource, with descriptions and example
bodies.

The collection is generated from the shared [OpenAPI spec](../spec/openapi.json), so it always
matches the SDKs and the [API reference](https://checkoutpage.com/docs).

## Files

- `checkoutpage-api.postman_collection.json` - the collection.
- `checkoutpage.postman_environment.json` - an environment with the `baseUrl` and `apiKey`
  variables.

## Get started

You can fork the collection or import the files.

### Fork it from Postman

Search for "Checkout Page" on the [Postman API Network](https://www.postman.com/explore) and
fork the collection into your own workspace. A fork can pull in later changes to the API.

### Import the files

1. Download `checkoutpage-api.postman_collection.json` and
   `checkoutpage.postman_environment.json` from this directory.
2. In Postman, select **Import** and drop in both files.
3. Pick the "Checkout Page" environment in the top right of Postman.

## Set your API key

1. In the [Checkout Page dashboard](https://checkoutpage.com/dashboard), go to **Settings** >
   **API keys** and generate a key. Copy it straight away: it is only shown once.
2. In Postman, open the "Checkout Page" environment and paste the key into the `apiKey`
   variable. The variable is a secret, so Postman masks it.

Every request inherits its auth from the collection, which sends `apiKey` in the
`Authorization` header. You only set the key once.

Use a test API key while you try things out. It only reads test data, and the records it
creates are test records. A live key leaves test records out by default. Add
`livemode=false` to a list or get request to read them with a live key.

Keep your key in the environment, not in the collection. Never share a collection or
workspace that holds a real key.

## Variables

| Variable  | Default                        | Use                   |
| --------- | ------------------------------ | --------------------- |
| `baseUrl` | `https://api.checkoutpage.com` | The API host.         |
| `apiKey`  | empty                          | Your API key, secret. |

## Regenerate the collection

Do not edit the JSON files by hand. After the spec changes, run this from the repo root:

```bash
pnpm generate:types
```

That also runs `pnpm generate:postman`, which rewrites both files here. You can run
`pnpm generate:postman` on its own too. Commit the result with the spec change. The output is
deterministic: with no spec change, regenerating gives no diff.

The generator is `src/generate.ts`. It converts the spec with
[openapi-to-postmanv2](https://github.com/postmanlabs/openapi-to-postman), then tidies the
result:

- folders follow the spec's tags, and each request is named after its operation summary;
- ids come from each operation's `operationId`, so they never change between runs;
- example bodies come from the spec's examples and schemas;
- only the production server is used.

Run the tests with:

```bash
pnpm --filter @checkoutpage/postman test
```

They check that every spec operation appears once, that auth and `baseUrl` are variables, that
the files hold no keys or internal hosts, and that the committed files match a fresh
generation.

## Publishing

The **Publish Postman collection** workflow pushes the committed collection to Postman with
the [Postman API](https://learning.postman.com/docs/developer/postman-api/intro-api/). Run it
by hand from the Actions tab after a change is merged.

### One-time setup

1. In the Checkout Page team on Postman, create a public workspace for the API.
2. Import `checkoutpage-api.postman_collection.json` into that workspace. This creates the
   collection once.
3. Note the collection's UID. Open the collection, then its info panel. The UID looks like
   `12345678-0b1e2f3a-aaaa-bbbb-cccc-1234567890ab`.
4. Create a Postman API key with access to the workspace (**Settings** > **API keys** in
   Postman).
5. In this GitHub repo, go to **Settings** > **Environments** and create an environment named
   `postman`:
   - under **Deployment branches and tags**, pick **Protected branches only** (or a rule for
     `main` only), so no other branch can publish;
   - under **Required reviewers**, add the people who approve each publish.
6. Add two secrets to the `postman` environment, not to the repo's Actions secrets:
   - `POSTMAN_API_KEY` - the Postman API key.
   - `POSTMAN_COLLECTION_UID` - the collection UID from step 3.
7. Submit the public workspace to the Postman API Network. This is a manual step in Postman.

The workflow fails with a clear message if it runs from a branch other than main, or if either
secret is missing. Each run waits for a required reviewer to approve it before it can read the
secrets.
