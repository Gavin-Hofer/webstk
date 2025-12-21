const DB_NAME = 'app-cache';
const STORE_NAME = 'cache';
const DB_VERSION = 2;
const MAX_ENTRIES = 10_000;

// #region Types
// =============================================================================

type CacheEntry<T> = {
  key: string;
  value: T;
  lastAccessed: number;
};

// #endregion

// #region Helper functions
// =============================================================================

/** Opens (or creates) the IndexedDB database. */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      // Delete old store if upgrading
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      // Create store with keyPath and index on lastAccessed
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    };
  });
}

// #endregion

// #region Main functions
// =============================================================================

/**
 * Retrieves a value from the cache by key and updates its last accessed time.
 *
 * @param key - The cache key to look up.
 * @returns The cached value, or undefined if not found.
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const entry = request.result as CacheEntry<T> | undefined;
      if (entry) {
        // Update last accessed time
        entry.lastAccessed = Date.now();
        store.put(entry);
        resolve(entry.value);
      } else {
        resolve(undefined);
      }
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Stores a value in the cache with the given key.
 *
 * @param key - The cache key.
 * @param value - The value to store (can be any structured-cloneable type including Blob, ArrayBuffer, etc.).
 */
export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const entry: CacheEntry<T> = {
      key,
      value,
      lastAccessed: Date.now(),
    };
    const request = store.put(entry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Removes a value from the cache by key.
 *
 * @param key - The cache key to remove.
 */
export async function cacheDelete(key: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Removes the oldest entries if cache exceeds MAX_ENTRIES.
 *
 * @returns The number of entries deleted.
 */
export async function cachePurge(): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;
      const excess = count - MAX_ENTRIES;

      if (excess <= 0) {
        resolve(0);
        return;
      }

      // Open cursor on lastAccessed index (ascending = oldest first)
      const index = store.index('lastAccessed');
      const cursorRequest = index.openCursor();
      let deleted = 0;

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor && deleted < excess) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    };

    countRequest.onerror = () => reject(countRequest.error);
    transaction.oncomplete = () => db.close();
  });
}

// #endregion
