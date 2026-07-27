# AI Recruiter

The canonical InReply example: an AI recruiter that schedules interviews
entirely over email.

```
POST /invite ──> invite email ──> candidate hits Reply
                                        │
                                        v
             Resend webhook ──> resumeConversation(request)
                                        │
                     clean text + full thread history
                                        │
                                        v
                  AI writes the next message ──> lands in the same thread
```

The candidate never sees a form or a portal. They answer email like a human,
and the conversation resumes on every reply: InReply verifies the webhook,
strips the quoted history and signatures, reconstructs the thread, and hands
the model a chat-shaped transcript.

## Run it

```bash
cp .env.example .env    # Resend + OpenAI credentials
pnpm install
pnpm dev
```

1. Point a Resend `email.received` webhook at `https://<your-tunnel>/webhooks/resend`
   (`ngrok http 3000` works for local development).
2. Invite yourself:

```bash
curl -X POST localhost:3000/invite \
  -H "content-type: application/json" \
  -d '{"to":"you@example.com","name":"Sam","role":"Platform Engineer"}'
```

3. Reply to the email you receive. Then reply to the reply. The AI keeps the
   whole conversation in context every time.
