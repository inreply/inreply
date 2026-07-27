# InReply docs

The documentation site, built with Next.js + Nextra.

```bash
pnpm install
pnpm dev      # http://localhost:3333
pnpm build
```

## Deploy to Vercel

1. Import the `inreply/inreply` repository on [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** to `apps/docs`
3. Framework preset: Next.js. Everything else is auto-detected (Vercel reads
   the pnpm workspace from the repo root).
