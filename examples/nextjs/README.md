# InReply + Next.js

Route handlers receive a standard web `Request`, so it passes straight into
`resumeConversation` — InReply reads the raw body itself, which is exactly what
signature verification needs.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Point a Resend `email.received` webhook at
`https://<your-domain>/api/inbound`.
