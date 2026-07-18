import { createHmac } from 'node:crypto';

export const TEST_SECRET = `whsec_${Buffer.from('inreply-test-signing-secret-0001').toString('base64')}`;

/**
 * Compute a real svix signature the way Resend's webhook infrastructure does:
 * base64(HMAC-SHA256(secret, `${id}.${timestamp}.${payload}`)).
 */
export function signWebhook(
  payload: string,
  { id = 'msg_inreply_test', timestamp = Math.floor(Date.now() / 1000) }: { id?: string; timestamp?: number } = {},
): Record<string, string> {
  const secretBytes = Buffer.from(TEST_SECRET.slice('whsec_'.length), 'base64');
  const signedContent = `${id}.${timestamp}.${payload}`;
  const signature = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  return {
    'svix-id': id,
    'svix-timestamp': String(timestamp),
    'svix-signature': `v1,${signature}`,
  };
}
