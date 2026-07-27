# Contributing to InReply

Thanks for helping make inbound email conversations boring (in the best way).

## Setup

```bash
pnpm install
pnpm build        # build all packages
pnpm test         # run all tests
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
```

Node ≥ 20 and pnpm 9 required. The repo is a Turborepo monorepo:

```
packages/inreply    # core - provider-agnostic primitive
packages/resend     # @inreply/resend provider
examples/*          # runnable examples (ai-recruiter is the flagship)
apps/docs           # documentation site (Next.js + Nextra)
```

## The most valuable contribution: reply fixtures

Reply extraction is fixture-driven. If InReply strips (or fails to strip) a
reply from some email client incorrectly:

1. Add the offending email body to `packages/inreply/test/fixtures/replies/`
   (redact anything personal).
2. Add a test case in `packages/inreply/test/clean.test.ts` asserting the
   expected clean text.
3. If it fails, fix `src/clean.ts` - or open the PR with the failing fixture
   and we'll take it from there.

## Writing a provider

A provider connects InReply to an email platform. It implements one method:

```ts
import type { InboundProvider, InboundEmail, NormalizedRequest } from 'inreply';

export function myProvider(options = {}): InboundProvider {
  // Validate config eagerly - throw InReplyError('missing_config', ...) here.
  return {
    name: 'my-provider',
    async receive(request: NormalizedRequest): Promise<InboundEmail | null> {
      // 1. Verify the webhook signature against request.body (raw string).
      //    Throw InReplyError('invalid_signature', ...) on failure.
      // 2. Return null for verified events that are not inbound email.
      // 3. Fetch the full email if your platform's webhook is metadata-only.
      // 4. Map to the normalized InboundEmail shape. Core utilities help:
      //    normalizeMessageId(), parseReferences().
    },
  };
}
```

Ground rules:

- **Never make the core depend on your platform's SDK** - providers are
  separate packages that depend on `inreply` (the core stays dependency-free of any platform SDK).
- Ids are normalized (angle brackets stripped); `references` is oldest-first.
- Header maps are lowercased.
- Preserve the platform's full original object on `raw`.
- Test signature verification with _real_ computed signatures, not mocks - see `packages/resend/test/helpers/sign.ts`.

## Pull requests

- One logical change per PR.
- Add or update tests for anything behavioral.
- `pnpm turbo lint typecheck test build` must be green.
- Include a changeset for user-facing changes: `pnpm changeset`.

## Releases

Releases are automated with [Changesets](https://github.com/changesets/changesets):
merged changesets accumulate into a "Version Packages" PR; merging that PR
publishes to npm.
