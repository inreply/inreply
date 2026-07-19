# InReply + Express

Express doesn't use web `Request` objects, so pass `{ headers, body }` instead - InReply accepts both.

**The one gotcha:** use `express.raw({ type: 'application/json' })` on the
webhook route. Signatures are computed over the raw request bytes;
`express.json()` re-serializes the body and verification will fail.

```bash
cp .env.example .env
pnpm install
pnpm dev
```
