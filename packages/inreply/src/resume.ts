import { cleanReplyText } from './clean.js';
import { normalizeRequest } from './request.js';
import { inboundEmailToMessage } from './to-message.js';
import { buildReplyContext, normalizeSubject, resolveThreadId } from './thread.js';
import type { InboundProvider } from './provider.js';
import type { RawWebhookInput } from './request.js';
import type { Conversation, Message, ThreadStore } from './types.js';

export type DebugHook = (event: string, data?: Record<string, unknown>) => void;

export interface ResumeDependencies {
  provider: InboundProvider;
  threadStore?: ThreadStore | undefined;
  onDebug?: DebugHook | undefined;
}

/**
 * The whole pipeline: normalize the request, let the provider verify it and
 * produce the inbound email, clean the reply, resolve the thread, and
 * assemble the Conversation.
 */
export async function resume(
  deps: ResumeDependencies,
  input: Request | RawWebhookInput,
): Promise<Conversation | null> {
  const debug: DebugHook = deps.onDebug ?? (() => {});

  const request = await normalizeRequest(input);
  debug('request:normalized', { bodyLength: request.body.length });

  const email = await deps.provider.receive(request);
  if (!email) {
    debug('provider:skipped', { provider: deps.provider.name });
    return null;
  }
  debug('provider:received', { provider: deps.provider.name, messageId: email.messageId });

  const text = cleanReplyText({ text: email.text, html: email.html });
  const message = inboundEmailToMessage(email, text);
  const threadId = resolveThreadId(email);
  debug('thread:resolved', { threadId });

  const history = await loadHistory(deps.threadStore, threadId, message, debug);

  return {
    threadId,
    subject: email.subject,
    topic: normalizeSubject(email.subject),
    message,
    messages: [...history, message],
    reply: buildReplyContext(email),
    attachments: email.attachments,
    raw: email.raw,
  };
}

/**
 * Load prior messages and persist the inbound one. Deduplication happens
 * here, not in stores: webhook redeliveries stay idempotent no matter how
 * simple the adapter is.
 */
async function loadHistory(
  store: ThreadStore | undefined,
  threadId: string,
  message: Message,
  debug: DebugHook,
): Promise<Message[]> {
  if (!store) return [];

  const stored = await store.get(threadId);
  const isRedelivery = stored.some((m) => m.id === message.id);
  if (isRedelivery) {
    debug('store:redelivery', { threadId, messageId: message.id });
  } else {
    await store.append(threadId, message);
    debug('store:appended', { threadId, messageId: message.id });
  }
  return stored.filter((m) => m.id !== message.id);
}
