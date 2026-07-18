import { z } from 'zod';

/**
 * We validate only what we consume and let everything else pass through —
 * Resend may add fields at any time and that must never break inbound mail.
 */
export const webhookEventSchema = z
  .object({
    type: z.string(),
    data: z.unknown().optional(),
  })
  .passthrough();

export const emailReceivedEventSchema = z
  .object({
    type: z.literal('email.received'),
    data: z
      .object({
        email_id: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

const attachmentSchema = z
  .object({
    id: z.string(),
    filename: z.string().nullable().optional(),
    content_type: z.string().nullable().optional(),
    content_disposition: z.string().nullable().optional(),
    content_id: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
  })
  .passthrough();

/** The Received Emails API response (`emails.receiving.get`). */
export const receivedEmailSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.array(z.string()).default([]),
    cc: z.array(z.string()).nullable().optional(),
    bcc: z.array(z.string()).nullable().optional(),
    reply_to: z.array(z.string()).nullable().optional(),
    subject: z.string().default(''),
    text: z.string().nullable().optional(),
    html: z.string().nullable().optional(),
    headers: z.record(z.string()).nullable().optional(),
    message_id: z.string(),
    created_at: z.string(),
    attachments: z.array(attachmentSchema).default([]),
  })
  .passthrough();

export type ReceivedEmail = z.infer<typeof receivedEmailSchema>;
