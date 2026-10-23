# CLAUDE.md - Postman collection

Conventions for `postman/`, the Postman collection for the seller API (private workspace
package `@checkoutpage/postman`, never published to npm). Repo-wide rules are in the root
[CLAUDE.md](../CLAUDE.md).

## Layout

- `src/generate.ts` - the generator. Converts `../spec/openapi.json` with
  `openapi-to-postmanv2`, then post-processes the result.
- `test/collection.test.ts` - vitest suite, including the drift check.
- `checkoutpage-api.postman_collection.json`, `checkoutpage.postman_environment.json` -
  generated output, committed. Never edit by hand.

## Commands

```bash
pnpm generate:postman                       # from the root; also run by pnpm generate:types
pnpm --filter @checkoutpage/postman test    # includes the drift check
pnpm --filter @checkoutpage/postman lint
pnpm --filter @checkoutpage/postman type-check
```

## How the generator works

- The converter only sees the production server, so staging and local hosts never reach the
  output.
- The converter fakes values with `Math.random`. The generator rebuilds every faked value
  (request bodies, response bodies, query values and form fields) from the spec with
  `exampleFromSchema`, so the output is deterministic and a spec change only changes the
  requests it touches. If a faked value ever survives, the drift check catches it.
- Ids are `stableId(...)` hashes of the operationId (requests), operationId + status (example
  responses) and tag name (folders). Keys are sorted on write. Regenerating with no spec change
  must give a zero diff; the test suite and `test-postman.yml` enforce it.
- Requests carry no `auth`: they inherit collection-level bearer auth with `{{apiKey}}`.
- Path variables have empty values and the spec's description. Multipart requests have no
  literal `Content-Type` header, so Postman adds the boundary.
- Folders follow the spec's tags. Within a folder, requests sort by path, then GET, POST, PUT,
  PATCH, DELETE.

Pin `openapi-to-postmanv2` to an exact version. A converter upgrade can change the output, so
regenerate and review the diff in the same PR.

## Publishing

`.github/workflows/publish-postman.yml` (manual) runs the tests, then replaces the public
collection with `PUT https://api.postman.com/collections/{uid}`, using the `POSTMAN_API_KEY` and
`POSTMAN_COLLECTION_UID` secrets. Setup steps are in [README.md](README.md#publishing).
