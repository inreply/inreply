import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createInReply, isInReplyError } from 'inreply';
import { resend } from '@inreply/resend';

const { resumeConversation } = createInReply({ provider: resend() });

const app = new Hono();

app.post('/webhooks/resend', async (c) => {
  try {
    const conversation = await resumeConversation(c.req.raw);
    if (!conversation) return c.text('ok'); // some other Resend event

    console.log(`[${conversation.threadId}] ${conversation.message.from.email}:`);
    console.log(conversation.message.text);
    console.log('reply with headers:', conversation.reply.headers);

    return c.text('ok');
  } catch (error) {
    if (isInReplyError(error)) {
      return c.text(error.message, error.status as 401);
    }
    throw error;
  }
});

serve({ fetch: app.fetch, port: 3000 });
console.log('Listening on http://localhost:3000/webhooks/resend');
