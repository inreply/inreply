# InReply AI email agent

A complete AI agent that converses over email: inbound replies become
`conversation.messages`, the Vercel AI SDK generates a response, and the reply
goes out with correct threading headers - the whole loop in ~40 lines.

Uses `InMemoryThreadStore` so follow-up emails include the full conversation
history. Swap it for your own `ThreadStore` implementation in production.

```bash
cp .env.example .env   # Resend + OpenAI credentials
pnpm install
pnpm dev
```

Point a Resend `email.received` webhook at `https://<your-tunnel>/webhooks/resend`,
send an email to your Resend inbound address, and reply to the response - the agent remembers the thread.
