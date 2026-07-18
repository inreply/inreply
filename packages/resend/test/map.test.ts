import { describe, expect, it } from 'vitest';
import { parseAddress, toInboundEmail } from '../src/map.js';
import { receivedEmailSchema } from '../src/schemas.js';

describe('parseAddress', () => {
  it.each([
    ['dip@example.com', { email: 'dip@example.com' }],
    ['<dip@example.com>', { email: 'dip@example.com' }],
    ['Dip <dip@example.com>', { email: 'dip@example.com', name: 'Dip' }],
    ['"Dip Dhameliya" <dip@example.com>', { email: 'dip@example.com', name: 'Dip Dhameliya' }],
    ['  Ava from Acme <ava@acme.dev>  ', { email: 'ava@acme.dev', name: 'Ava from Acme' }],
  ])('%s', (input, expected) => {
    expect(parseAddress(input)).toEqual(expected);
  });
});

describe('toInboundEmail', () => {
  const base = receivedEmailSchema.parse({
    id: 'id-1',
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    message_id: '<m1@x.com>',
    created_at: '2026-07-13T10:00:00.000Z',
  });

  it('handles a minimal email with no headers or bodies', () => {
    const email = toInboundEmail(base);
    expect(email.messageId).toBe('m1@x.com');
    expect(email.references).toEqual([]);
    expect(email.inReplyTo).toBeUndefined();
    expect(email.text).toBeUndefined();
    expect(email.html).toBeUndefined();
    expect(email.replyTo).toEqual([]);
  });

  it('lowercases header names', () => {
    const email = toInboundEmail({
      ...base,
      headers: { 'In-Reply-To': '<m0@x.com>', 'X-Custom': 'yes' },
    });
    expect(email.headers).toEqual({ 'in-reply-to': '<m0@x.com>', 'x-custom': 'yes' });
    expect(email.inReplyTo).toBe('m0@x.com');
  });

  it('parses folded References chains oldest-first', () => {
    const email = toInboundEmail({
      ...base,
      headers: { References: '<m0@x.com>\r\n <m1@x.com>' },
    });
    expect(email.references).toEqual(['m0@x.com', 'm1@x.com']);
  });

  it('defaults attachment filename and content type', () => {
    const email = toInboundEmail({
      ...base,
      attachments: [
        {
          id: 'att-1',
          filename: null,
          content_type: null,
          content_id: null,
          content_disposition: null,
          size: null,
        },
      ],
    });
    expect(email.attachments[0]).toEqual({
      id: 'att-1',
      filename: 'attachment',
      contentType: 'application/octet-stream',
    });
  });
});
