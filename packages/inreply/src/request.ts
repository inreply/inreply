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

/**
 * Webhook payloads are small JSON documents (a few KB). Anything above this
 * is not a webhook, and refusing it early keeps an unauthenticated endpoint
 * from buffering arbitrarily large bodies.
 */
const MAX_BODY_BYTES = 1_048_576; // 1 MiB

function isWebRequest(input: Request | RawWebhookInput): input is Request {
  return (
    typeof (input as Request).text === 'function' && (input as Request).headers instanceof Headers
  );
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined> | Headers,
): Record<string, string> {
  // Null prototype: header names are attacker-controlled object keys.
  const normalized: Record<string, string> = Object.create(null);
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

function assertBodySize(bytes: number): void {
  if (bytes > MAX_BODY_BYTES) {
    throw new InReplyError(
      'invalid_request',
      `Request body is ${bytes} bytes; webhook payloads are never larger than ${MAX_BODY_BYTES} bytes.`,
    );
  }
}

/** Normalize a web `Request` or raw input into lowercase headers + raw string body. */
export async function normalizeRequest(
  input: Request | RawWebhookInput,
): Promise<NormalizedRequest> {
  if (isWebRequest(input)) {
    const declared = Number(input.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > 0) assertBodySize(declared);

    // Reading the body ourselves guarantees the raw bytes the signature was
    // computed over - the #1 webhook verification bug is a re-serialized body.
    const body = await input.text();
    assertBodySize(body.length);
    return { headers: normalizeHeaders(input.headers), body };
  }

  if (!input || typeof input !== 'object' || input.body === undefined || !input.headers) {
    throw new InReplyError(
      'invalid_request',
      'Expected a web Request or { headers, body } with the raw request body.',
    );
  }

  const body = typeof input.body === 'string' ? input.body : new TextDecoder().decode(input.body);
  assertBodySize(body.length);
  return { headers: normalizeHeaders(input.headers), body };
}
