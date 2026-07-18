import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isInReplyError } from 'inreply';
import { resend } from '../src/provider.js';
import { signWebhook, TEST_SECRET } from './helpers/sign.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const receivedEvent = fixture('email-received-event.json');
const sentEvent = fixture('email-sent-event.json');
const receivedEmail = JSON.parse(fixture('received-email.json'));

/** Stub the network: the SDK's receiving.get() hits this instead of api.resend.com. */
function stubReceivingApi(response: { status?: number; body?: unknown } = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(JSON.stringify(response.body ?? receivedEmail), {
        status: response.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

const provider = () => resend({ apiKey: 're_test_123', webhookSecret: TEST_SECRET });

const request = (payload: string, headers = signWebhook(payload)) => ({
  headers,
  body: payload,
});

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resend() configuration', () => {
  it('throws missing_config eagerly without an API key', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    expect(() => resend()).toThrowError(/RESEND_API_KEY/);
  });

  it('throws missing_config eagerly without a webhook secret', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    expect(() => resend({ apiKey: 're_test_123' })).toThrowError(
      /webhookSecret|RESEND_WEBHOOK_SECRET/,
    );
  });

  it('reads credentials from the environment', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', TEST_SECRET);
    expect(resend().name).toBe('resend');
  });
});

describe('receive() verification', () => {
  it('rejects requests without svix headers as invalid_request', async () => {
    await expect(provider().receive({ headers: {}, body: receivedEvent })).rejects.toSatisfy(
      (e: unknown) => isInReplyError(e) && e.code === 'invalid_request' && e.status === 400,
    );
  });

  it('rejects a tampered body as invalid_signature', async () => {
    const headers = signWebhook(receivedEvent);
    const tampered = receivedEvent.replace('email.received', 'email.received '); // one byte
    await expect(provider().receive({ headers, body: tampered })).rejects.toSatisfy(
      (e: unknown) => isInReplyError(e) && e.code === 'invalid_signature' && e.status === 401,
    );
  });

  it('rejects a stale timestamp as invalid_signature', async () => {
    const stale = Math.floor(Date.now() / 1000) - 60 * 60; // 1h old
    const headers = signWebhook(receivedEvent, { timestamp: stale });
    await expect(provider().receive({ headers, body: receivedEvent })).rejects.toSatisfy(
      (e: unknown) => isInReplyError(e) && e.code === 'invalid_signature',
    );
  });
});

describe('receive() events', () => {
  it('returns null for verified non-inbound events', async () => {
    const calls = stubReceivingApi();
    const result = await provider().receive(request(sentEvent));
    expect(result).toBeNull();
    expect(calls).toHaveLength(0); // no pointless API call
  });

  it('fetches and maps an email.received event to an InboundEmail', async () => {
    const calls = stubReceivingApi();
    const email = await provider().receive(request(receivedEvent));

    expect(calls[0]).toContain('/emails/receiving/56761188-7520-42d8-8898-ff6fc54ce618');
    expect(email).not.toBeNull();
    expect(email!.messageId).toBe('msg-2@mail.example.com');
    expect(email!.inReplyTo).toBe('msg-1@mail.example.com');
    expect(email!.references).toEqual(['msg-1@mail.example.com']);
    expect(email!.from).toEqual({ email: 'dip@example.com', name: 'Dip Dhameliya' });
    expect(email!.to).toEqual([{ email: 'support@yourapp.dev' }]);
    expect(email!.cc).toEqual([{ email: 'ava@acme.dev', name: 'Ava' }]);
    expect(email!.subject).toBe('Re: Upgrade my plan');
    expect(email!.text).toContain('Yes, upgrade me to Pro please!');
    expect(email!.date).toBe('2026-07-13T10:00:00.000Z');
    expect(email!.headers['in-reply-to']).toBe('<msg-1@mail.example.com>');
    expect(email!.attachments).toEqual([
      {
        id: '2a0c9ce0-3112-4728-976e-47ddcd16a318',
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
        contentDisposition: 'attachment',
        size: 13264,
      },
    ]);
    expect(email!.raw).toMatchObject({ id: '56761188-7520-42d8-8898-ff6fc54ce618' });
  });

  it('throws invalid_payload when email.received is missing data.email_id', async () => {
    const malformed = JSON.stringify({ type: 'email.received', data: {} });
    await expect(provider().receive(request(malformed))).rejects.toSatisfy(
      (e: unknown) => isInReplyError(e) && e.code === 'invalid_payload',
    );
  });

  it('throws fetch_failed when the Received Emails API errors', async () => {
    stubReceivingApi({
      status: 404,
      body: { statusCode: 404, name: 'not_found', message: 'Email not found' },
    });
    await expect(provider().receive(request(receivedEvent))).rejects.toSatisfy(
      (e: unknown) => isInReplyError(e) && e.code === 'fetch_failed' && e.status === 502,
    );
  });
});
