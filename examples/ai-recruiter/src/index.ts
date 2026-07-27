/**
 * AI Recruiter - the canonical InReply example.
 *
 * The flow:
 *
 *   POST /invite                      you kick off an interview invite
 *        |
 *        v
 *   candidate gets a real email ... and hits "Reply"
 *        |
 *        v
 *   POST /webhooks/resend            Resend delivers the reply
 *        |
 *        v
 *   resumeConversation(request)      InReply verifies, cleans, rebuilds the thread
 *        |
 *        v
 *   AI answers with full context     and the reply lands in the same email thread
 *
 * The candidate never sees a form, a portal, or a login. They just answer
 * email, and the conversation resumes every time.
 */
import { serve } from '@hono/node-server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { Hono } from 'hono';
import { createInReply, InMemoryThreadStore, isInReplyError } from 'inreply';
import type { Message } from 'inreply';
import { resend as resendProvider } from '@inreply/resend';
import { Resend } from 'resend';

const FROM = process.env.RECRUITER_FROM ?? 'Ava from Acme <ava@yourdomain.dev>';

// One store instance shared by InReply (inbound) and us (outbound),
// so every follow-up email sees the whole conversation.
const threadStore = new InMemoryThreadStore();

const { resumeConversation } = createInReply({
  provider: resendProvider(),
  threadStore,
});

const resend = new Resend(process.env.RESEND_API_KEY);
const app = new Hono();

// What we know about each candidate, keyed by email address.
const candidates = new Map<string, { name: string; role: string }>();

/** Step 1: invite a candidate. curl -X POST localhost:3000/invite -d '{...}' */
app.post('/invite', async (c) => {
  const { to, name, role } = await c.req.json<{ to: string; name: string; role: string }>();
  candidates.set(to.toLowerCase(), { name, role });

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Interview invitation: ${role} at Acme`,
    text: [
      `Hi ${name},`,
      '',
      `Thanks for applying for the ${role} role at Acme! We'd love to talk.`,
      'Just reply to this email with a few times that work for you next week.',
      '',
      'Ava',
    ].join('\n'),
  });

  return c.json({ invited: to });
});

/** Step 2: every reply, forever. This one handler is the whole inbound side. */
app.post('/webhooks/resend', async (c) => {
  try {
    const conversation = await resumeConversation(c.req.raw);
    if (!conversation) return c.text('ok'); // delivery receipts etc.

    const candidate = candidates.get(conversation.message.from.email.toLowerCase());
    if (!candidate) return c.text('ok'); // not someone we invited

    // The thread is chat-shaped: hand it to the model as-is.
    const { text } = await generateText({
      model: openai('gpt-5.1'),
      system: [
        `You are Ava, a friendly recruiter at Acme, scheduling an interview with`,
        `${candidate.name} for the ${candidate.role} role. Confirm a concrete time,`,
        `answer questions briefly, and keep replies to a few sentences of plain text.`,
      ].join(' '),
      messages: conversation.messages.map((m) => ({ role: m.role, content: m.text })),
    });

    // Reply lands in the same thread: to/subject/headers are pre-built.
    await resend.emails.send({
      from: conversation.reply.from || FROM,
      to: conversation.reply.to,
      subject: conversation.reply.subject,
      text,
      headers: conversation.reply.headers,
    });

    // Remember our own turn so the next reply sees it as history.
    const assistantTurn: Message = {
      id: `ava-${conversation.message.id}`,
      role: 'assistant',
      from: { email: FROM },
      to: [{ email: conversation.reply.to }],
      text,
      original: { text },
      subject: conversation.reply.subject,
      date: new Date().toISOString(),
      attachments: [],
    };
    await threadStore.append(conversation.threadId, assistantTurn);

    console.log(`[${conversation.threadId}] ${candidate.name}: ${conversation.message.text}`);
    console.log(`[${conversation.threadId}] Ava: ${text}`);
    return c.text('ok');
  } catch (error) {
    if (isInReplyError(error)) {
      return c.text(error.message, error.status as 401);
    }
    throw error;
  }
});

serve({ fetch: app.fetch, port: 3000 });
console.log('AI recruiter running on http://localhost:3000');
console.log(
  'Invite someone:  curl -X POST localhost:3000/invite -H "content-type: application/json" -d \'{"to":"candidate@example.com","name":"Sam","role":"Platform Engineer"}\'',
);
