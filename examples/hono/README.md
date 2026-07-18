# InReply + Hono

The smallest possible inbound email handler. Hono's `c.req.raw` is a standard
web `Request`, so it passes straight into `resumeConversation`.

```bash
cp .env.example .env   # fill in your Resend credentials
pnpm install
pnpm dev
```

Point a [Resend webhook](https://resend.com/docs/dashboard/webhooks/introduction)
for the `email.received` event at `https://<your-tunnel>/webhooks/resend`
(use `ngrok http 3000` or similar for local development).
