import { InReplyError } from './errors.js';
import { resume } from './resume.js';
import type { DebugHook } from './resume.js';
import type { InboundProvider } from './provider.js';
import type { RawWebhookInput } from './request.js';
import type { Conversation, ThreadStore } from './types.js';

export interface InReplyConfig {
  /** The inbound email provider — e.g. `resend()` from `@inreply/resend`. */
  provider: InboundProvider;
  /** Optional thread persistence. When set, `conversation.messages` includes history. */
  threadStore?: ThreadStore;
  /** Optional debug hook. InReply is silent by default. */
  onDebug?: DebugHook;
}

export interface InReply {
  /**
   * Turn an inbound webhook request into a resumable conversation.
   *
   * Returns `null` for verified events that are not inbound email — respond
   * 200 and move on. Throws {@link InReplyError} for anything that deserves
   * a non-200 response.
   */
  resumeConversation(request: Request | RawWebhookInput): Promise<Conversation | null>;
}

/** Create an InReply instance bound to a provider. */
export function createInReply(config: InReplyConfig): InReply {
  if (!config || typeof config !== 'object' || !config.provider) {
    throw new InReplyError(
      'missing_config',
      "createInReply requires a provider: createInReply({ provider: resend() }) — import { resend } from '@inreply/resend'.",
    );
  }
  if (typeof config.provider.receive !== 'function') {
    throw new InReplyError(
      'missing_config',
      `The configured provider${config.provider.name ? ` "${config.provider.name}"` : ''} does not implement receive(). Providers must implement the InboundProvider interface.`,
    );
  }

  const deps = {
    provider: config.provider,
    threadStore: config.threadStore,
    onDebug: config.onDebug,
  };

  return {
    resumeConversation: (request) => resume(deps, request),
  };
}
