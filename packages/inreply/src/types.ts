/** An email address, optionally with a display name. */
export interface EmailAddress {
  email: string;
  name?: string;
}

/** Attachment metadata. Content download is planned for a future version. */
export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition?: string;
  contentId?: string;
  size?: number;
}

/** A single message in a conversation, mapped 1:1 to a chat turn. */
export interface Message {
  /** RFC 5322 Message-ID with the angle brackets stripped. */
  id: string;
  /** 'user' for inbound email; 'assistant' for replies your app appended to the store. */
  role: 'user' | 'assistant';
  from: EmailAddress;
  to: EmailAddress[];
  /** Cleaned plain text — quoted replies and signatures removed. Feed this to your model. */
  text: string;
  /** The untouched bodies, before any cleaning. */
  original: { text?: string; html?: string };
  subject: string;
  /** ISO 8601 timestamp. */
  date: string;
  attachments: Attachment[];
}

/**
 * Everything you need to send a correctly-threaded reply yourself.
 * (A `conversation.reply()` send helper is planned for v0.2.)
 */
export interface ReplyContext {
  /** Where your reply should go: the sender's Reply-To if set, otherwise their From. */
  to: string;
  /** The address the user wrote to — a sensible `from` for your reply. */
  from: string;
  /** "Re: <topic>" — normalized so it never becomes "Re: Re: Re:". */
  subject: string;
  /** Message-ID of the inbound message, in wire format (`<...>`). */
  inReplyTo: string;
  /** Full References chain including the inbound message, wire format, space-separated. */
  references: string;
  /** Pass straight to your email provider's send call. */
  headers: { 'In-Reply-To': string; References: string };
}

/** A resumable email conversation — the object InReply hands to your agent. */
export interface Conversation {
  /**
   * Stable identifier for the thread: the root Message-ID of the References
   * chain (angle brackets stripped), falling back to the message's own id.
   */
  threadId: string;
  /** Subject of the inbound message, verbatim. */
  subject: string;
  /** Subject with Re:/Fwd: prefixes stripped — useful as a thread title. */
  topic: string;
  /** The inbound message, cleaned. */
  message: Message;
  /**
   * The full thread, oldest first. When a ThreadStore is configured this is
   * `[...history, message]`; otherwise just `[message]`.
   */
  messages: Message[];
  /** Everything needed to send a correctly-threaded reply. */
  reply: ReplyContext;
  /** Attachment metadata for the inbound message. */
  attachments: Attachment[];
  /** The provider's full original email object — an escape hatch, never needed on the happy path. */
  raw: unknown;
}

/**
 * Optional thread persistence. Implement these two methods over any storage
 * (Postgres, Redis, KV, ...) to give conversations history.
 */
export interface ThreadStore {
  /** Return the thread's messages oldest-first, or `[]` for an unknown thread. */
  get(threadId: string): Promise<Message[]>;
  /** Append one message to the thread. InReply handles deduplication. */
  append(threadId: string, message: Message): Promise<void>;
}
