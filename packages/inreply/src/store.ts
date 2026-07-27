import type { Message, ThreadStore } from './types.js';

export interface InMemoryThreadStoreOptions {
  /**
   * Maximum number of threads to keep. When exceeded, the least recently
   * used thread is evicted. Defaults to 1000.
   */
  maxThreads?: number;
  /**
   * Maximum messages kept per thread. When exceeded, the oldest messages are
   * dropped. Bounds memory even if one sender floods a single thread.
   * Defaults to 500.
   */
  maxMessagesPerThread?: number;
}

/**
 * A Map-backed ThreadStore for development and demos.
 * State resets on every deploy or restart - bring your own store in production.
 */
export class InMemoryThreadStore implements ThreadStore {
  private readonly threads = new Map<string, Message[]>();
  private readonly maxThreads: number;
  private readonly maxMessagesPerThread: number;

  constructor(options: InMemoryThreadStoreOptions = {}) {
    this.maxThreads = options.maxThreads ?? 1000;
    this.maxMessagesPerThread = options.maxMessagesPerThread ?? 500;
  }

  async get(threadId: string): Promise<Message[]> {
    const messages = this.threads.get(threadId);
    if (!messages) return [];
    this.touch(threadId, messages);
    return [...messages];
  }

  async append(threadId: string, message: Message): Promise<void> {
    const messages = this.threads.get(threadId) ?? [];
    messages.push(message);
    if (messages.length > this.maxMessagesPerThread) {
      messages.splice(0, messages.length - this.maxMessagesPerThread);
    }
    this.touch(threadId, messages);
    this.evict();
  }

  /** Re-insert to move the thread to the back of the Map's iteration order (LRU). */
  private touch(threadId: string, messages: Message[]): void {
    this.threads.delete(threadId);
    this.threads.set(threadId, messages);
  }

  private evict(): void {
    while (this.threads.size > this.maxThreads) {
      const oldest = this.threads.keys().next().value;
      if (oldest === undefined) break;
      this.threads.delete(oldest);
    }
  }
}
