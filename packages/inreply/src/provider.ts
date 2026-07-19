import type { Attachment, EmailAddress } from './types.js';

/** A webhook request normalized to lowercase header names and a raw string body. */
export interface NormalizedRequest {
  headers: Record<string, string>;
  body: string;
}

/**
 * A provider-agnostic inbound email - the only thing the InReply core
 * consumes. Providers verify the webhook, fetch whatever their platform
 * requires, and hand back this shape.
 */
export interface InboundEmail {
  /** Message-ID with angle brackets stripped. */
  messageId: string;
  /** In-Reply-To id (brackets stripped), when present. */
  inReplyTo?: string;
  /** Parsed References chain (brackets stripped), oldest first. */
  references: string[];
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  replyTo: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  /** ISO 8601 timestamp. */
  date: string;
  attachments: Attachment[];
  /** All headers, lowercased. */
  headers: Record<string, string>;
  /** The provider's full original object. */
  raw: unknown;
}

/**
 * An inbound email provider. Implement this to connect InReply to any
 * email platform (Resend, SendGrid, Postmark, SES, ...).
 */
export interface InboundProvider {
  /** e.g. 'resend' */
  name: string;
  /**
   * Verify the webhook and produce the inbound email, fetching the body when
   * the platform's webhook is metadata-only.
   *
   * Returns `null` for verified events that are not inbound email (delivery
   * receipts, opens, ...). Throws `InReplyError` on verification, payload,
   * or fetch failures.
   */
  receive(request: NormalizedRequest): Promise<InboundEmail | null>;
}
