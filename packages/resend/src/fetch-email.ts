import { InReplyError } from 'inreply';
import type { Resend } from 'resend';
import { receivedEmailSchema } from './schemas.js';
import type { ReceivedEmail } from './schemas.js';

/**
 * Resend's `email.received` webhook carries metadata only — the body and
 * full headers live behind the Received Emails API.
 */
export async function fetchReceivedEmail(client: Resend, emailId: string): Promise<ReceivedEmail> {
  let data: unknown;
  let error: { message: string; name: string } | null;
  try {
    ({ data, error } = await client.emails.receiving.get(emailId));
  } catch (cause) {
    throw new InReplyError(
      'fetch_failed',
      `Failed to fetch received email ${emailId} from Resend.`,
      { cause },
    );
  }

  if (error || !data) {
    throw new InReplyError(
      'fetch_failed',
      `Resend returned an error for received email ${emailId}: ${error?.message ?? 'empty response'}`,
    );
  }

  const parsed = receivedEmailSchema.safeParse(data);
  if (!parsed.success) {
    throw new InReplyError(
      'invalid_payload',
      `Unexpected Received Emails API response shape for ${emailId}: ${parsed.error.message}`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
