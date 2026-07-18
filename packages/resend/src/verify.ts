import { InReplyError } from 'inreply';
import type { NormalizedRequest } from 'inreply';
import type { Resend } from 'resend';

/**
 * Verify the svix-signed webhook against the raw body and return the
 * verified event payload.
 */
export function verifyWebhook(
  client: Resend,
  request: NormalizedRequest,
  webhookSecret: string,
): unknown {
  const id = request.headers['svix-id'];
  const timestamp = request.headers['svix-timestamp'];
  const signature = request.headers['svix-signature'];

  if (!id || !timestamp || !signature) {
    throw new InReplyError(
      'invalid_request',
      'Missing svix-id, svix-timestamp, or svix-signature headers. Is this request really from a Resend webhook?',
    );
  }

  try {
    return client.webhooks.verify({
      payload: request.body,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch (cause) {
    throw new InReplyError(
      'invalid_signature',
      'Webhook signature verification failed. Check that RESEND_WEBHOOK_SECRET matches this endpoint and that you passed the raw, unparsed request body.',
      { cause },
    );
  }
}
