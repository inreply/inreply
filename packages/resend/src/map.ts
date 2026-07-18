import { normalizeMessageId, parseReferences } from 'inreply';
import type { Attachment, EmailAddress, InboundEmail } from 'inreply';
import type { ReceivedEmail } from './schemas.js';

/** Parse `"Ava Smith" <ava@acme.dev>` / `Ava <ava@acme.dev>` / `ava@acme.dev`. */
export function parseAddress(raw: string): EmailAddress {
  const match = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (match?.[2]) {
    const name = match[1]?.trim();
    return name ? { email: match[2], name } : { email: match[2] };
  }
  return { email: raw.trim() };
}

const parseAddressList = (list: string[] | null | undefined): EmailAddress[] =>
  (list ?? []).map(parseAddress);

function toAttachment(attachment: ReceivedEmail['attachments'][number]): Attachment {
  const result: Attachment = {
    id: attachment.id,
    filename: attachment.filename ?? 'attachment',
    contentType: attachment.content_type ?? 'application/octet-stream',
  };
  if (attachment.content_disposition != null) result.contentDisposition = attachment.content_disposition;
  if (attachment.content_id != null) result.contentId = attachment.content_id;
  if (attachment.size != null) result.size = attachment.size;
  return result;
}

/** Map a Resend received email to the provider-agnostic InboundEmail. */
export function toInboundEmail(email: ReceivedEmail): InboundEmail {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(email.headers ?? {})) {
    headers[key.toLowerCase()] = value;
  }

  const inReplyToHeader = headers['in-reply-to'];
  const inReplyTo = inReplyToHeader ? parseReferences(inReplyToHeader)[0] : undefined;

  const result: InboundEmail = {
    messageId: normalizeMessageId(email.message_id),
    references: parseReferences(headers['references']),
    from: parseAddress(email.from),
    to: parseAddressList(email.to),
    cc: parseAddressList(email.cc),
    replyTo: parseAddressList(email.reply_to),
    subject: email.subject,
    date: email.created_at,
    attachments: email.attachments.map(toAttachment),
    headers,
    raw: email,
  };
  if (inReplyTo !== undefined) result.inReplyTo = inReplyTo;
  if (email.text != null) result.text = email.text;
  if (email.html != null) result.html = email.html;
  return result;
}
