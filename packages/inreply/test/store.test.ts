import { describe, expect, it } from 'vitest';
import { InMemoryThreadStore } from '../src/store.js';
import type { Message } from '../src/types.js';

const msg = (id: string): Message => ({
  id,
  role: 'user',
  from: { email: 'user@example.com' },
  to: [{ email: 'agent@yourapp.dev' }],
  text: `text of ${id}`,
  original: {},
  subject: 'Hello',
  date: '2026-07-13T09:14:00.000Z',
  attachments: [],
});

describe('InMemoryThreadStore', () => {
  it('returns [] for an unknown thread', async () => {
    const store = new InMemoryThreadStore();
    expect(await store.get('nope')).toEqual([]);
  });

  it('appends and returns messages in order', async () => {
    const store = new InMemoryThreadStore();
    await store.append('t1', msg('a'));
    await store.append('t1', msg('b'));
    expect((await store.get('t1')).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('returns a defensive copy', async () => {
    const store = new InMemoryThreadStore();
    await store.append('t1', msg('a'));
    const first = await store.get('t1');
    first.push(msg('rogue'));
    expect(await store.get('t1')).toHaveLength(1);
  });

  it('evicts the least recently used thread beyond maxThreads', async () => {
    const store = new InMemoryThreadStore({ maxThreads: 2 });
    await store.append('t1', msg('a'));
    await store.append('t2', msg('b'));
    await store.get('t1'); // touch t1 so t2 is now the LRU
    await store.append('t3', msg('c'));
    expect(await store.get('t2')).toEqual([]);
    expect((await store.get('t1')).map((m) => m.id)).toEqual(['a']);
    expect((await store.get('t3')).map((m) => m.id)).toEqual(['c']);
  });
});
