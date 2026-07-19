import { InReplyError } from './errors.js';
import type { NormalizedRequest } from './provider.js';

/**
 * Raw webhook input for Node req-style frameworks (e.g. Express with
 * `express.raw({ type: 'application/json' })`). `body` MUST be the raw,
 * unparsed request body - signatures are computed over exact bytes.
 */
export interface RawWebhookInput {
  headers: Record<string, string | string[] | undefined> | Headers;
  body: string | Uint8Array;
}

function isWebRequest(input: Request | RawWebhookInput): input is Request {
  return (
    typeof (input as Request).text === 'function' && (input as Request).headers instanceof Headers
  );
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined> | Headers,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = Array.isArray(value) ? (value[0] ?? '') : value;
  }
  return normalized;
}

/** Normalize a web `Request` or raw input into lowercase headers + raw string body. */
export async function normalizeRequest(
  input: Request | RawWebhookInput,
): Promise<NormalizedRequest> {
  if (isWebRequest(input)) {
    // Reading the body ourselves guarantees the raw bytes the signature was
    // computed over - the #1 webhook verification bug is a re-serialized body.
    const body = await input.text();
    return { headers: normalizeHeaders(input.headers), body };
  }

  if (!input || typeof input !== 'object' || input.body === undefined || !input.headers) {
    throw new InReplyError(
      'invalid_request',
      'Expected a web Request or { headers, body } with the raw request body.',
    );
  }

  const body = typeof input.body === 'string' ? input.body : new TextDecoder().decode(input.body);
  return { headers: normalizeHeaders(input.headers), body };
}
