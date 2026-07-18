import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanReplyText } from '../src/clean.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/replies/${name}`, import.meta.url), 'utf8');

describe('cleanReplyText', () => {
  it('strips Gmail-style quoted history', () => {
    const result = cleanReplyText({ text: fixture('gmail.txt') });
    expect(result).toBe("Sounds great, let's do Tuesday at 2pm.\n\nOne question: should I bring the deck?");
  });

  it('strips Outlook-style original message blocks', () => {
    const result = cleanReplyText({ text: fixture('outlook.txt') });
    expect(result).toBe('Approved. Please proceed with the rollout.');
  });

  it('strips Apple Mail-style quoted history', () => {
    const result = cleanReplyText({ text: fixture('apple-mail.txt') });
    expect(result).toBe('Works for me!');
  });

  it('strips signature blocks', () => {
    const result = cleanReplyText({ text: fixture('signatures.txt') });
    expect(result).toBe('Yes, ship it.');
  });

  it('strips mobile signatures', () => {
    const result = cleanReplyText({ text: fixture('mobile-sig.txt') });
    expect(result).toBe('Confirmed, see you then.');
  });

  it('keeps answers in inline (interleaved) replies', () => {
    const result = cleanReplyText({ text: fixture('inline-reply.txt') });
    expect(result).toContain('Tuesday works.');
    expect(result).toContain('Yes, add Maya and Jon.');
  });

  it('passes plaintext-only messages through untouched', () => {
    const result = cleanReplyText({ text: fixture('plaintext-only.txt') });
    expect(result).toBe("Hi! I'd like to upgrade my plan to Pro. What are the next steps?\n\nThanks!");
  });

  it('falls back to HTML conversion when there is no text part', () => {
    const result = cleanReplyText({ html: fixture('html-only.html') });
    expect(result).toBe("Perfect, invoice received. I'll process it today.");
  });

  it('never returns an empty string when the sender wrote something', () => {
    const result = cleanReplyText({ text: fixture('quoted-only.txt') });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('answer buried inside');
  });

  it('returns an empty string for an empty body', () => {
    expect(cleanReplyText({})).toBe('');
    expect(cleanReplyText({ text: '   ' })).toBe('');
  });

  it('normalizes CRLF line endings', () => {
    const result = cleanReplyText({ text: 'Line one\r\n\r\nLine two\r\n' });
    expect(result).toBe('Line one\n\nLine two');
  });

  it('collapses excessive blank lines', () => {
    const result = cleanReplyText({ text: 'One\n\n\n\n\nTwo' });
    expect(result).toBe('One\n\nTwo');
  });
});
