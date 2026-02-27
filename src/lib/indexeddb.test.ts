import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { IndexedDBCache } from './indexeddb';

function makeCache(overrides?: { dbName?: string; maxEntries?: number }) {
  return new IndexedDBCache({
    dbName: overrides?.dbName ?? 'test-db',
    storeName: 'test-store',
    schema: z.string(),
    maxEntries: overrides?.maxEntries,
  });
}

describe('IndexedDBCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- get / set basics ---

  test('get returns undefined for a missing key', async () => {
    const cache = makeCache();
    expect(await cache.get('missing')).toBeUndefined();
  });

  test('set then get returns the stored value', async () => {
    const cache = makeCache();
    await cache.set('k1', 'v1');
    expect(await cache.get('k1')).toBe('v1');
  });

  test('set overwrites an existing key', async () => {
    const cache = makeCache();
    await cache.set('k1', 'first');
    await cache.set('k1', 'second');
    expect(await cache.get('k1')).toBe('second');
  });

  test('stores multiple independent keys', async () => {
    const cache = makeCache();
    await cache.set('a', 'alpha');
    await cache.set('b', 'bravo');
    expect(await cache.get('a')).toBe('alpha');
    expect(await cache.get('b')).toBe('bravo');
  });

  // --- schema validation ---

  test('set throws when the value does not match the schema', async () => {
    const cache = new IndexedDBCache({
      dbName: 'schema-db',
      storeName: 'store',
      schema: z.number(),
    });
    // @ts-expect-error -- intentionally passing wrong type
    await expect(cache.set('k', 'not-a-number')).rejects.toThrow();
  });

  test('works with a complex schema', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const cache = new IndexedDBCache({
      dbName: 'complex-db',
      storeName: 'store',
      schema,
    });
    const value = { name: 'Alice', age: 30 };
    await cache.set('user', value);
    expect(await cache.get('user')).toEqual(value);
  });

  // --- purge ---

  test('purge is a no-op when entry count <= numToKeep', async () => {
    const cache = makeCache();
    await cache.set('a', '1');
    await cache.set('b', '2');
    await cache.purge(5);
    expect(await cache.get('a')).toBe('1');
    expect(await cache.get('b')).toBe('2');
  });

  test('purge removes the least-recently-accessed entries', async () => {
    const cache = makeCache({ dbName: 'purge-db' });

    const now = 1000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await cache.set('old1', 'v1');

    vi.spyOn(Date, 'now').mockReturnValue(now + 1);
    await cache.set('old2', 'v2');

    vi.spyOn(Date, 'now').mockReturnValue(now + 2);
    await cache.set('new1', 'v3');

    vi.spyOn(Date, 'now').mockReturnValue(now + 3);
    await cache.set('new2', 'v4');

    await cache.purge(2);

    expect(await cache.get('old1')).toBeUndefined();
    expect(await cache.get('old2')).toBeUndefined();
    expect(await cache.get('new1')).toBeDefined();
    expect(await cache.get('new2')).toBeDefined();
  });

  test('purge removes all entries when numToKeep is 0', async () => {
    const cache = makeCache({ dbName: 'purge-all-db' });
    await cache.set('a', '1');
    await cache.set('b', '2');
    await cache.purge(0);
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('b')).toBeUndefined();
  });

  // --- get updates lastAccessed ---

  test('get bumps lastAccessed so the entry is not purged early', async () => {
    const cache = makeCache({ dbName: 'bump-db' });

    const now = 1000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await cache.set('early', 'e');

    vi.spyOn(Date, 'now').mockReturnValue(now + 1);
    await cache.set('middle', 'm');

    vi.spyOn(Date, 'now').mockReturnValue(now + 2);
    await cache.set('late', 'l');

    // Access "early" at a later timestamp so it becomes the most-recently-accessed
    vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    await cache.get('early');

    await cache.purge(1);

    expect(await cache.get('early')).toBe('e');
    expect(await cache.get('middle')).toBeUndefined();
    expect(await cache.get('late')).toBeUndefined();
  });

  // --- isolation between instances ---

  test('separate cache instances with different dbNames are isolated', async () => {
    const cacheA = makeCache({ dbName: 'iso-a' });
    const cacheB = makeCache({ dbName: 'iso-b' });

    await cacheA.set('shared-key', 'from-a');
    await cacheB.set('shared-key', 'from-b');

    expect(await cacheA.get('shared-key')).toBe('from-a');
    expect(await cacheB.get('shared-key')).toBe('from-b');
  });
});
