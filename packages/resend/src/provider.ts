import { InReplyError } from 'inreply';
import type { InboundProvider } from 'inreply';
import { Resend } from 'resend';
import { fetchReceivedEmail } from './fetch-email.js';
import { toInboundEmail } from './map.js';
import { emailReceivedEventSchema, webhookEventSchema } from './schemas.js';
import { verifyWebhook } from './verify.js';

export interface ResendProviderOptions {
  /** Defaults to `process.env.RESEND_API_KEY`. */
  apiKey?: string;
  /** The endpoint's signing secret (`whsec_...`). Defaults to `process.env.RESEND_WEBHOOK_SECRET`. */
  webhookSecret?: string;
}

/**
 * The Resend inbound provider.
 *
 * Verifies the webhook signature, fetches the full email (Resend webhooks
 * carry metadata only), and returns a normalized inbound email. Events other
 * than `email.received` resolve to `null`.
 */
export function resend(options: ResendProviderOptions = {}): InboundProvider {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const webhookSecret = options.webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET;

  if (!apiKey) {
    throw new InReplyError(
      'missing_config',
      'Missing Resend API key. Pass resend({ apiKey }) or set RESEND_API_KEY.',
    );
  }
  if (!webhookSecret) {
    throw new InReplyError(
      'missing_config',
      'Missing webhook signing secret. Pass resend({ webhookSecret }) or set RESEND_WEBHOOK_SECRET (find it on the webhook endpoint in the Resend dashboard).',
    );
  }

  const client = new Resend(apiKey);

  return {
    name: 'resend',
    async receive(request) {
      const verified = verifyWebhook(client, request, webhookSecret);

      const event = webhookEventSchema.safeParse(verified);
      if (!event.success) {
        throw new InReplyError(
          'invalid_payload',
          `Unexpected webhook payload shape: ${event.error.message}`,
          { cause: event.error },
        );
      }

      // Delivery receipts, opens, clicks, ... — not inbound email.
      if (event.data.type !== 'email.received') return null;

      const received = emailReceivedEventSchema.safeParse(event.data);
      if (!received.success) {
        throw new InReplyError(
          'invalid_payload',
          `email.received event is missing data.email_id: ${received.error.message}`,
          { cause: received.error },
        );
      }

      const email = await fetchReceivedEmail(client, received.data.data.email_id);
      return toInboundEmail(email);
    },
  };
}
