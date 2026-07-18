export type InReplyErrorCode =
  'invalid_signature' | 'invalid_request' | 'invalid_payload' | 'fetch_failed' | 'missing_config';

const STATUS_BY_CODE: Record<InReplyErrorCode, number> = {
  invalid_signature: 401,
  invalid_request: 400,
  invalid_payload: 400,
  fetch_failed: 502,
  missing_config: 500,
};

/**
 * The single error type thrown by InReply and its providers.
 *
 * `code` identifies what went wrong; `status` is a suggested HTTP status
 * for your webhook response.
 */
export class InReplyError extends Error {
  readonly name = 'InReplyError' as const;
  readonly code: InReplyErrorCode;
  readonly status: number;

  constructor(code: InReplyErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

/**
 * Type guard for InReplyError that works across duplicated module instances,
 * where `instanceof` would fail.
 */
export function isInReplyError(error: unknown): error is InReplyError {
  return (
    error instanceof Error &&
    error.name === 'InReplyError' &&
    'code' in error &&
    typeof (error as InReplyError).code === 'string'
  );
}
