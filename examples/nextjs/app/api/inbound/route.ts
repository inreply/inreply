import { createInReply, isInReplyError } from 'inreply';
import { resend } from '@inreply/resend';

const { resumeConversation } = createInReply({ provider: resend() });

export async function POST(request: Request) {
  try {
    const conversation = await resumeConversation(request);
    if (!conversation) return new Response('ok'); // some other Resend event

    console.log(`[${conversation.threadId}] ${conversation.message.from.email}:`);
    console.log(conversation.message.text);

    return new Response('ok');
  } catch (error) {
    if (isInReplyError(error)) {
      return new Response(error.message, { status: error.status });
    }
    throw error;
  }
}
