# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Checkout Page's public developer tools: client libraries and tools for the Checkout Page seller
API, one top-level directory per language or tool. They all build from one OpenAPI spec.

This repo is public. README, CONTRIBUTING, `spec/README.md`, package READMEs and examples are
customer-facing: plain short sentences, sentence-case headings, no em dash character.

## Repo map

- **`js/`** - JavaScript/TypeScript SDK, npm `@checkoutpage/sdk`. Conventions in [js/CLAUDE.md](js/CLAUDE.md).
- **`cli/`** - `checkoutpage` CLI, a standalone Rust crate outside the pnpm workspace. Conventions in [cli/CLAUDE.md](cli/CLAUDE.md).
- **`spec/openapi.json`** - the seller API's OpenAPI spec, shared by every language. See [spec/README.md](spec/README.md).
- **`examples/<lang>/`** - runnable usage examples per language (`examples/js/` today).
- **`scripts/`** - shared tooling (`generate-types.ts`).
- **`.github/workflows/`** - one `test-<lang>.yml` and one `publish-<lang>.yml` per language.

Planned later: `php/`, `ruby/`, `python/`, `go/`. Directories never move once published:
package metadata (npm `repository.directory`, for example), CI path filters and release tags
depend on them.

The root `package.json` (`@checkoutpage/dev-tools`, private) holds the shared Node tooling and
the pnpm workspace scripts. Only JS packages belong in `pnpm-workspace.yaml`; other languages
use their own toolchain inside their directory.

## The spec is the source of truth

`spec/openapi.json` comes from the Checkout Page API in the `checkoutpage-mono` repo. Never edit
it by hand to invent fields; every change must match what the API serves or is about to serve.

How it is refreshed (see `git log --oneline -- spec`):

- **Full refresh from production** - replace the file with the production swagger,
  `https://api.checkoutpage.com/docs/seller-api/v1/swagger.json`. Used to clear drift once the
  API changes are live.
- **Slice for an API change not yet in production** - take only the paths and schemas that
  one mono PR changes, copied by JSON pointer from that branch's spec (dumped from a local API
  running the branch). Unrelated drift stays out. Name the mono PR in the commit, for example
  `chore(spec): ..., from checkoutpage-mono#1740`, and refresh from production once it deploys.
- Then run `pnpm generate:types` from the root. `scripts/generate-types.ts` rewrites the spec
  in a stable form (keys sorted, 2-space pretty print) so it diffs line by line, and generates
  the JS types into `js/src/generated/schema.ts` (gitignored). Commit the normalized spec.

Every language generates from this one file. A spec change lands in one PR with the regenerated
code and tests for each language it affects. When a new language gets a generator, add it to
the same `pnpm generate:types` flow (or document its own command in `<lang>/CLAUDE.md`) and
keep it reading `spec/openapi.json`.

## Per-language conventions

Each language keeps its own conventions in `<lang>/CLAUDE.md`: layout, commands, testing,
build and publishing. Read it before working in that directory. This file only holds what
applies everywhere.

## Adding a new language or tool

1. A top-level directory named for the language or tool (`php/`, `ruby/`, `cli/`).
2. Its own `README.md` (install, quick start, link back to the root README) and `CLAUDE.md`
   (conventions, commands, how it uses the spec).
3. Path-filtered workflows: `.github/workflows/test-<lang>.yml` triggered on `<lang>/**`,
   `spec/**` and the workflow file itself, and `.github/workflows/publish-<lang>.yml` that
   tags releases `<lang>-v<version>`. Copy `test-js.yml` / `publish-js.yml` for the shape.
4. Examples in `examples/<lang>/`, with a README.
5. A row in the tools table in the root `README.md`, and an entry in the repo map above.
6. Build-output entries for the toolchain in the root `.gitignore`, under its language heading.

## Cross-cutting rules

- **Error classes mirror across languages.** Every client maps HTTP status codes to the same
  set of errors, named idiomatically per language: authentication (401, 403), not found (404),
  conflict (409), validation (400, 422), rate limit (429), and a generic API error carrying the
  status code and response body. The JS names (`AuthenticationError`, `NotFoundError`,
  `ConflictError`, `ValidationError`, `RateLimitError`, `APIError`) are the reference.
- **Resource and method names follow the API**, the same across languages (customers, coupons,
  payments, ...; list, get, create, update, delete).
- **No secrets in examples, tests or docs.** Read API keys from the environment
  (`CHECKOUTPAGE_API_KEY`); use placeholders like `YOUR_API_KEY`. Local env files (`.env*`)
  stay gitignored, with a committed `.env*.example` template.
- **Integration tests are optional** and skip when no API key is configured. Unit tests with a
  mocked HTTP layer are the standard.
