import { describe, expect, it } from 'vitest';
import { cleanReplyText } from '../src/clean.js';
import { normalizeSubject, parseReferences } from '../src/thread.js';

/**
 * Attacker-controlled inputs: anyone can send an email to an inbound address,
 * so subjects, bodies, and headers must be processed in roughly linear time
 * and must never hang the webhook handler.
 */
const budgetMs = 2000;

const timed = (fn: () => void): number => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

describe('adversarial inputs stay fast', () => {
  it('normalizeSubject: repeated reply prefixes', () => {
    const subject = 'Re: '.repeat(10_000) + 'x';
    expect(timed(() => normalizeSubject(subject))).toBeLessThan(budgetMs);
  });

  it('normalizeSubject: prefixes with pathological whitespace', () => {
    const subject = ('re' + ' '.repeat(50) + ':').repeat(2_000) + ' '.repeat(10_000);
    expect(timed(() => normalizeSubject(subject))).toBeLessThan(budgetMs);
  });

  it('parseReferences: enormous folded header', () => {
    const header = Array.from({ length: 20_000 }, (_, i) => `<m${i}@x.com>`).join('\r\n ');
    expect(timed(() => parseReferences(header))).toBeLessThan(budgetMs);
  });

  it('cleanReplyText: long body of quote markers', () => {
    const text = ('> quoted line with some text\n' + 'On Mon, Jan 1, 2026 someone wrote:\n').repeat(
      5_000,
    );
    expect(timed(() => cleanReplyText({ text }))).toBeLessThan(budgetMs);
  });

  it('cleanReplyText: pathological trailing attribution', () => {
    const text = 'hi\n' + 'On ' + 'a'.repeat(100_000) + ' wrote:';
    expect(timed(() => cleanReplyText({ text }))).toBeLessThan(budgetMs);
  });

  it('cleanReplyText: deeply nested HTML', () => {
    const html = '<div>'.repeat(2_000) + 'hello' + '</div>'.repeat(2_000);
    expect(timed(() => cleanReplyText({ html }))).toBeLessThan(budgetMs);
  });

  it('cleanReplyText: huge signature-delimiter soup', () => {
    const text = 'hello\n' + '-- \n'.repeat(20_000) + 'tail';
    expect(timed(() => cleanReplyText({ text }))).toBeLessThan(budgetMs);
  });
});
