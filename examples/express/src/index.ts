import express from 'express';
import { createInReply, isInReplyError } from 'inreply';
import { resend } from '@inreply/resend';

const { resumeConversation } = createInReply({ provider: resend() });

const app = express();

// IMPORTANT: webhook signatures are computed over the raw bytes.
// Use express.raw() on the webhook route — not express.json().
app.post(
  '/webhooks/resend',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const conversation = await resumeConversation({
        headers: req.headers,
        body: req.body,
      });
      if (!conversation) return res.sendStatus(200);

      console.log(`[${conversation.threadId}] ${conversation.message.from.email}:`);
      console.log(conversation.message.text);

      return res.sendStatus(200);
    } catch (error) {
      if (isInReplyError(error)) {
        return res.status(error.status).send(error.message);
      }
      throw error;
    }
  },
);

app.listen(3000, () => {
  console.log('Listening on http://localhost:3000/webhooks/resend');
});
