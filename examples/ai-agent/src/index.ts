import { serve } from '@hono/node-server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { Hono } from 'hono';
import { createInReply, InMemoryThreadStore, isInReplyError } from 'inreply';
import { resend as resendProvider } from '@inreply/resend';
import { Resend } from 'resend';

// One store instance shared between InReply (inbound) and your code (outbound),
// so the whole thread is available on the next reply.
const threadStore = new InMemoryThreadStore();

const { resumeConversation } = createInReply({
  provider: resendProvider(),
  threadStore,
});

const resend = new Resend(process.env.RESEND_API_KEY);
const app = new Hono();

app.post('/webhooks/resend', async (c) => {
  try {
    const conversation = await resumeConversation(c.req.raw);
    if (!conversation) return c.text('ok');

    // conversation.messages maps 1:1 to chat messages — any AI framework works.
    const { text } = await generateText({
      model: openai('gpt-5.1'),
      system: 'You are a helpful email assistant. Reply concisely in plain text, no markdown.',
      messages: conversation.messages.map((m) => ({ role: m.role, content: m.text })),
    });

    // Send the reply with correct threading — In-Reply-To and References handled for you.
    await resend.emails.send({
      from: conversation.reply.from,
      to: conversation.reply.to,
      subject: conversation.reply.subject,
      text,
      headers: conversation.reply.headers,
    });

    // Remember our own turn so the next inbound email sees the full thread.
    await threadStore.append(conversation.threadId, {
      id: `assistant-${Date.now()}@inreply.example`,
      role: 'assistant',
      from: { email: conversation.reply.from },
      to: [{ email: conversation.reply.to }],
      text,
      original: { text },
      subject: conversation.reply.subject,
      date: new Date().toISOString(),
      attachments: [],
    });

    return c.text('ok');
  } catch (error) {
    if (isInReplyError(error)) {
      return c.text(error.message, error.status as 401);
    }
    throw error;
  }
});

serve({ fetch: app.fetch, port: 3000 });
console.log('AI email agent listening on http://localhost:3000/webhooks/resend');
