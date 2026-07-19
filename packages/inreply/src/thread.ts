import type { InboundEmail } from './provider.js';
import type { ReplyContext } from './types.js';

/** Strip whitespace and one pair of surrounding angle brackets from a Message-ID. */
export function normalizeMessageId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** RFC 5322 wire format: `<id>`. */
export function toWireId(id: string): string {
  const normalized = normalizeMessageId(id);
  return `<${normalized}>`;
}

/** Parse a raw References header (possibly folded) into normalized ids, oldest first. */
export function parseReferences(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(/\s+/)
    .filter((token) => token.startsWith('<') && token.endsWith('>'))
    .map(normalizeMessageId);
}

const REPLY_PREFIX = /^\s*((re|fw|fwd|aw|sv|vs)(\[\d+\])?\s*:\s*)+/i;

/** Strip Re:/Fwd:/AW:/Re[2]: style prefixes - "Re: Re: Hello" → "Hello". */
export function normalizeSubject(subject: string): string {
  return subject.replace(REPLY_PREFIX, '').trim();
}

/**
 * Resolve the stable thread identifier: the root of the References chain,
 * falling back to In-Reply-To (clients that omit References), then to the
 * message's own id (a brand-new thread).
 */
export function resolveThreadId(
  email: Pick<InboundEmail, 'references' | 'inReplyTo' | 'messageId'>,
): string {
  if (email.references.length > 0) return email.references[0]!;
  if (email.inReplyTo) return email.inReplyTo;
  return email.messageId;
}

/** Build everything a developer needs to send a correctly-threaded reply. */
export function buildReplyContext(email: InboundEmail): ReplyContext {
  // RFC 5322 §3.6.4: a reply's References is the parent's References
  // (or its In-Reply-To when References is absent) plus the parent's id.
  const chain =
    email.references.length > 0 ? email.references : email.inReplyTo ? [email.inReplyTo] : [];
  const references = [...chain, email.messageId].map(toWireId).join(' ');
  const inReplyTo = toWireId(email.messageId);

  return {
    to: email.replyTo[0]?.email ?? email.from.email,
    from: email.to[0]?.email ?? '',
    subject: `Re: ${normalizeSubject(email.subject)}`,
    inReplyTo,
    references,
    headers: { 'In-Reply-To': inReplyTo, References: references },
  };
}
