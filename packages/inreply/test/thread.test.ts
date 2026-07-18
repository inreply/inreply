import { describe, expect, it } from 'vitest';
import {
  buildReplyContext,
  normalizeMessageId,
  normalizeSubject,
  parseReferences,
  resolveThreadId,
  toWireId,
} from '../src/thread.js';
import type { InboundEmail } from '../src/provider.js';

const baseEmail = (overrides: Partial<InboundEmail> = {}): InboundEmail => ({
  messageId: 'msg-3@mail.example.com',
  references: ['msg-1@mail.example.com', 'msg-2@mail.example.com'],
  from: { email: 'user@example.com', name: 'User' },
  to: [{ email: 'agent@yourapp.dev' }],
  cc: [],
  replyTo: [],
  subject: 'Re: Re: Upgrade my plan',
  text: 'hello',
  date: '2026-07-13T09:14:00.000Z',
  attachments: [],
  headers: {},
  raw: {},
  ...overrides,
});

describe('normalizeMessageId / toWireId', () => {
  it('strips one pair of angle brackets and whitespace', () => {
    expect(normalizeMessageId('  <abc@x.com> ')).toBe('abc@x.com');
    expect(normalizeMessageId('abc@x.com')).toBe('abc@x.com');
  });

  it('reconstructs wire format idempotently', () => {
    expect(toWireId('abc@x.com')).toBe('<abc@x.com>');
    expect(toWireId('<abc@x.com>')).toBe('<abc@x.com>');
  });
});

describe('parseReferences', () => {
  it('parses a space-separated chain', () => {
    expect(parseReferences('<a@x.com> <b@x.com>')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('handles folded multi-line headers', () => {
    expect(parseReferences('<a@x.com>\r\n <b@x.com>\n\t<c@x.com>')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
  });

  it('ignores tokens that are not message-ids', () => {
    expect(parseReferences('junk <a@x.com> more-junk')).toEqual(['a@x.com']);
  });

  it('returns [] for missing headers', () => {
    expect(parseReferences(undefined)).toEqual([]);
    expect(parseReferences('')).toEqual([]);
  });
});

describe('resolveThreadId', () => {
  it('uses the root of the References chain', () => {
    expect(resolveThreadId(baseEmail())).toBe('msg-1@mail.example.com');
  });

  it('falls back to In-Reply-To when References is absent', () => {
    expect(
      resolveThreadId(baseEmail({ references: [], inReplyTo: 'msg-2@mail.example.com' })),
    ).toBe('msg-2@mail.example.com');
  });

  it('falls back to the message own id for a new thread', () => {
    expect(resolveThreadId(baseEmail({ references: [] }))).toBe('msg-3@mail.example.com');
  });
});

describe('normalizeSubject', () => {
  it.each([
    ['Re: Hello', 'Hello'],
    ['RE: RE: Hello', 'Hello'],
    ['Fwd: Hello', 'Hello'],
    ['FW: Hello', 'Hello'],
    ['AW: Hello', 'Hello'],
    ['Re[2]: Hello', 'Hello'],
    ['re:  fwd: Hello', 'Hello'],
    ['Hello', 'Hello'],
    ['Regarding the launch', 'Regarding the launch'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSubject(input)).toBe(expected);
  });
});

describe('buildReplyContext', () => {
  it('builds a threaded reply from a mid-thread message', () => {
    const reply = buildReplyContext(baseEmail());
    expect(reply.to).toBe('user@example.com');
    expect(reply.from).toBe('agent@yourapp.dev');
    expect(reply.subject).toBe('Re: Upgrade my plan');
    expect(reply.inReplyTo).toBe('<msg-3@mail.example.com>');
    expect(reply.references).toBe(
      '<msg-1@mail.example.com> <msg-2@mail.example.com> <msg-3@mail.example.com>',
    );
    expect(reply.headers).toEqual({
      'In-Reply-To': '<msg-3@mail.example.com>',
      References: '<msg-1@mail.example.com> <msg-2@mail.example.com> <msg-3@mail.example.com>',
    });
  });

  it('prefers Reply-To over From', () => {
    const reply = buildReplyContext(
      baseEmail({ replyTo: [{ email: 'replies@example.com' }] }),
    );
    expect(reply.to).toBe('replies@example.com');
  });

  it('starts a References chain for a brand-new thread', () => {
    const reply = buildReplyContext(baseEmail({ references: [], subject: 'Hello' }));
    expect(reply.references).toBe('<msg-3@mail.example.com>');
    expect(reply.subject).toBe('Re: Hello');
  });

  it('uses In-Reply-To as the chain when References is missing', () => {
    const reply = buildReplyContext(
      baseEmail({ references: [], inReplyTo: 'msg-2@mail.example.com' }),
    );
    expect(reply.references).toBe('<msg-2@mail.example.com> <msg-3@mail.example.com>');
  });
});
