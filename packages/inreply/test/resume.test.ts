import { describe, expect, it, vi } from 'vitest';
import { createInReply } from '../src/create-inreply.js';
import { InReplyError, isInReplyError } from '../src/errors.js';
import { InMemoryThreadStore } from '../src/store.js';
import type { InboundEmail, InboundProvider, NormalizedRequest } from '../src/provider.js';

const inboundEmail = (overrides: Partial<InboundEmail> = {}): InboundEmail => ({
  messageId: 'msg-2@mail.example.com',
  inReplyTo: 'msg-1@mail.example.com',
  references: ['msg-1@mail.example.com'],
  from: { email: 'customer@example.com', name: 'Customer' },
  to: [{ email: 'support@yourapp.dev' }],
  cc: [],
  replyTo: [],
  subject: 'Re: Upgrade my plan',
  text: 'Yes, upgrade me to Pro please!\n\nOn Mon, Jul 13, 2026 at 9:14 AM Support <support@yourapp.dev> wrote:\n> Which plan would you like?\n',
  date: '2026-07-13T10:00:00.000Z',
  attachments: [],
  headers: { 'in-reply-to': '<msg-1@mail.example.com>' },
  raw: { original: true },
  ...overrides,
});

/** A provider that skips verification and returns a canned email - core sees only the contract. */
const fakeProvider = (
  email: InboundEmail | null,
  onReceive?: (request: NormalizedRequest) => void,
): InboundProvider => ({
  name: 'fake',
  async receive(request) {
    onReceive?.(request);
    return email;
  },
});

const webhookRequest = () =>
  new Request('https://example.com/webhook', {
    method: 'POST',
    headers: { 'svix-id': 'msg_1' },
    body: '{"type":"email.received"}',
  });

describe('createInReply', () => {
  it('throws missing_config eagerly without a provider', () => {
    // @ts-expect-error - deliberately missing provider
    expect(() => createInReply({})).toThrowError(InReplyError);
    try {
      // @ts-expect-error - deliberately missing provider
      createInReply({});
    } catch (error) {
      expect(isInReplyError(error) && error.code === 'missing_config').toBe(true);
    }
  });

  it('throws missing_config for a provider without receive()', () => {
    expect(() =>
      // @ts-expect-error - deliberately broken provider
      createInReply({ provider: { name: 'broken' } }),
    ).toThrowError(/does not implement receive/);
  });
});

describe('resumeConversation', () => {
  it('turns an inbound webhook into a Conversation', async () => {
    const { resumeConversation } = createInReply({ provider: fakeProvider(inboundEmail()) });
    const conversation = await resumeConversation(webhookRequest());

    expect(conversation).not.toBeNull();
    expect(conversation!.threadId).toBe('msg-1@mail.example.com');
    expect(conversation!.subject).toBe('Re: Upgrade my plan');
    expect(conversation!.topic).toBe('Upgrade my plan');
    expect(conversation!.message.text).toBe('Yes, upgrade me to Pro please!');
    expect(conversation!.message.role).toBe('user');
    expect(conversation!.messages).toEqual([conversation!.message]);
    expect(conversation!.reply).toEqual({
      to: 'customer@example.com',
      from: 'support@yourapp.dev',
      subject: 'Re: Upgrade my plan',
      inReplyTo: '<msg-2@mail.example.com>',
      references: '<msg-1@mail.example.com> <msg-2@mail.example.com>',
      headers: {
        'In-Reply-To': '<msg-2@mail.example.com>',
        References: '<msg-1@mail.example.com> <msg-2@mail.example.com>',
      },
    });
    expect(conversation!.raw).toEqual({ original: true });
  });

  it('hands the provider the raw body and lowercased headers', async () => {
    const seen: NormalizedRequest[] = [];
    const { resumeConversation } = createInReply({
      provider: fakeProvider(inboundEmail(), (request) => seen.push(request)),
    });
    await resumeConversation(webhookRequest());
    expect(seen[0]!.body).toBe('{"type":"email.received"}');
    expect(seen[0]!.headers['svix-id']).toBe('msg_1');
  });

  it('returns null when the provider skips the event', async () => {
    const { resumeConversation } = createInReply({ provider: fakeProvider(null) });
    expect(await resumeConversation(webhookRequest())).toBeNull();
  });

  it('propagates provider errors with their status', async () => {
    const provider: InboundProvider = {
      name: 'fake',
      receive: async () => {
        throw new InReplyError('invalid_signature', 'Webhook signature verification failed.');
      },
    };
    const { resumeConversation } = createInReply({ provider });
    await expect(resumeConversation(webhookRequest())).rejects.toSatisfy(
      (e: unknown) => isInReplyError(e) && e.code === 'invalid_signature' && e.status === 401,
    );
  });

  it('includes history from the thread store', async () => {
    const threadStore = new InMemoryThreadStore();
    const first = inboundEmail({
      messageId: 'msg-1@mail.example.com',
      references: [],
      subject: 'Upgrade my plan',
      text: 'Which plans do you offer?',
    });
    delete (first as Partial<InboundEmail>).inReplyTo;

    const providerEmails = [first, inboundEmail()];
    let call = 0;
    const provider: InboundProvider = {
      name: 'fake',
      receive: async () => providerEmails[call++]!,
    };

    const { resumeConversation } = createInReply({ provider, threadStore });

    const c1 = await resumeConversation(webhookRequest());
    expect(c1!.threadId).toBe('msg-1@mail.example.com');
    expect(c1!.messages).toHaveLength(1);

    const c2 = await resumeConversation(webhookRequest());
    expect(c2!.threadId).toBe('msg-1@mail.example.com');
    expect(c2!.messages).toHaveLength(2);
    expect(c2!.messages.map((m) => m.id)).toEqual([
      'msg-1@mail.example.com',
      'msg-2@mail.example.com',
    ]);
  });

  it('is idempotent across webhook redeliveries', async () => {
    const threadStore = new InMemoryThreadStore();
    const { resumeConversation } = createInReply({
      provider: fakeProvider(inboundEmail()),
      threadStore,
    });

    const first = await resumeConversation(webhookRequest());
    const redelivered = await resumeConversation(webhookRequest());

    expect(redelivered!.messages).toHaveLength(1);
    expect(redelivered!.messages).toEqual(first!.messages);
    expect(await threadStore.get('msg-1@mail.example.com')).toHaveLength(1);
  });

  it('emits debug events through onDebug', async () => {
    const onDebug = vi.fn();
    const { resumeConversation } = createInReply({
      provider: fakeProvider(inboundEmail()),
      onDebug,
    });
    await resumeConversation(webhookRequest());
    const events = onDebug.mock.calls.map(([event]) => event);
    expect(events).toContain('request:normalized');
    expect(events).toContain('provider:received');
    expect(events).toContain('thread:resolved');
  });
});
