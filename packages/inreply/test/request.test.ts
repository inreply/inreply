import { describe, expect, it } from 'vitest';
import { normalizeRequest } from '../src/request.js';
import { isInReplyError } from '../src/errors.js';

describe('normalizeRequest', () => {
  it('reads a web Request body as raw text and lowercases headers', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: { 'Svix-Id': 'msg_1', 'Content-Type': 'application/json' },
      body: '{"hello":true}',
    });
    const normalized = await normalizeRequest(request);
    expect(normalized.body).toBe('{"hello":true}');
    expect(normalized.headers['svix-id']).toBe('msg_1');
  });

  it('accepts Node-style headers with string[] values', async () => {
    const normalized = await normalizeRequest({
      headers: { 'SVIX-ID': ['msg_1', 'dup'], 'x-empty': undefined },
      body: 'raw',
    });
    expect(normalized.headers['svix-id']).toBe('msg_1');
    expect('x-empty' in normalized.headers).toBe(false);
  });

  it('accepts a Headers instance in raw input', async () => {
    const normalized = await normalizeRequest({
      headers: new Headers({ 'Svix-Id': 'msg_1' }),
      body: 'raw',
    });
    expect(normalized.headers['svix-id']).toBe('msg_1');
  });

  it('decodes Uint8Array bodies as UTF-8', async () => {
    const normalized = await normalizeRequest({
      headers: {},
      body: new TextEncoder().encode('{"raw":"bytes"}'),
    });
    expect(normalized.body).toBe('{"raw":"bytes"}');
  });

  it('throws invalid_request for malformed input', async () => {
    await expect(
      // @ts-expect-error — deliberately wrong shape
      normalizeRequest({ nope: true }),
    ).rejects.toSatisfy((e: unknown) => isInReplyError(e) && e.code === 'invalid_request');
  });
});
