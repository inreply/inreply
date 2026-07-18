import EmailReplyParser from 'email-reply-parser';
import { convert } from 'html-to-text';

/**
 * Convert HTML mail to plain text. Quoted history in HTML mail almost always
 * lives inside <blockquote>, so skipping it removes most of the thread before
 * reply parsing even runs.
 */
function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'blockquote', format: 'skip' },
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
    ],
  });
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[​‌‍﻿]/g, '') // zero-width characters
    .replace(/ /g, ' '); // non-breaking spaces
}

/** Trailing noise the reply parser occasionally lets through. */
const TRAILING_NOISE: RegExp[] = [
  // A dangling attribution line with nothing after it: "On ..., X wrote:"
  /\n\s*On [^\n]{1,200}wrote:\s*$/,
  // Mobile signatures
  /\n\s*Sent from my (iPhone|iPad|Android|Galaxy|Samsung)[^\n]*\s*$/i,
  /\n\s*Get Outlook for (iOS|Android)[^\n]*\s*$/i,
  // RFC 3676 signature delimiter and everything after it
  /\n-- \n[\s\S]*$/,
];

function stripTrailingNoise(text: string): string {
  let result = text;
  for (const pattern of TRAILING_NOISE) {
    result = result.replace(pattern, '');
  }
  return result;
}

function collapseNewlines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract the latest human message from an email body: prefer the text part,
 * fall back to converted HTML, then strip quoted replies and signatures.
 *
 * Never returns an empty string when the input had content — if stripping
 * removes everything (e.g. an email that is only an inline reply inside
 * quoted text), the un-stripped text is returned instead.
 */
export function cleanReplyText(body: { text?: string; html?: string }): string {
  const source = body.text?.trim() ? body.text : body.html ? htmlToText(body.html) : '';
  if (!source.trim()) return '';

  const normalized = normalizeWhitespace(source);

  const parsed = new EmailReplyParser().read(normalized);
  const visible = parsed
    .getFragments()
    .filter((f) => !f.isQuoted() && !f.isSignature() && !f.isHidden())
    .map((f) => f.getContent())
    .join('\n');

  const cleaned = collapseNewlines(stripTrailingNoise(visible));
  if (cleaned) return cleaned;

  // Safety net: never hand the model an empty string when the user wrote something.
  return collapseNewlines(normalized);
}
