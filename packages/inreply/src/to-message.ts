import type { InboundEmail } from './provider.js';
import type { Message } from './types.js';

/** Map a normalized inbound email to a conversation message. */
export function inboundEmailToMessage(email: InboundEmail, cleanedText: string): Message {
  const original: Message['original'] = {};
  if (email.text !== undefined) original.text = email.text;
  if (email.html !== undefined) original.html = email.html;

  return {
    id: email.messageId,
    role: 'user',
    from: email.from,
    to: email.to,
    text: cleanedText,
    original,
    subject: email.subject,
    date: email.date,
    attachments: email.attachments,
  };
}
