import { z } from 'zod';

const DEFAULT_DB_VERSION = 2;

export type IndexedDBConfig = {
  dbName: string;
  storeName: string;
  dbVersion?: number;
};

export type IndexedDBCacheConfig<T> = IndexedDBConfig & {
  schema: z.ZodType<T>;
  maxEntries?: number;
};

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Unknown error in IndexedDB request'));
    });
  });
}

/** Opens (or creates) the IndexedDB database. */
function openDatabase({
  dbName,
  storeName,
  dbVersion = DEFAULT_DB_VERSION,
}: IndexedDBConfig): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Unknown indexedDB connection error'));
    });

    request.addEventListener('success', () => {
      resolve(request.result);
    });

    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      // Delete old store if upgrading
      if (db.objectStoreNames.contains(storeName)) {
        db.deleteObjectStore(storeName);
      }
      // Create store with keyPath and index on lastAccessed
      const store = db.createObjectStore(storeName, { keyPath: 'key' });
      store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    });
  });
}

export class IndexedDBObjectStore {
  constructor(public readonly store: IDBObjectStore) {}

  public readonly put = (data: unknown): Promise<IDBValidKey> => {
    return promisifyRequest(this.store.put(data));
  };

  public readonly get = (key: IDBValidKey): Promise<unknown> => {
    return promisifyRequest(this.store.get(key));
  };

  public readonly delete = (key: IDBValidKey): Promise<void> => {
    return promisifyRequest(this.store.delete(key));
  };

  public readonly count = (): Promise<number> => {
    return promisifyRequest(this.store.count());
  };

  public readonly openCursor = (
    indexName: string,
    handler: (
      resolve: () => void,
      reject: (error: Error) => void,
      cursor: IDBCursorWithValue,
    ) => void,
  ) => {
    const index = this.store.index(indexName);
    const request = index.openCursor();
    return new Promise<void>((resolve, reject) => {
      request.addEventListener('success', () => {
        const cursor = request.result;
        if (cursor === null) {
          resolve();
          return;
        }
        handler(resolve, reject, cursor);
      });
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Unknown IndexedDB cursor error'));
      });
    });
  };
}

export class IndexedDBCache<T> {
  public readonly config: IndexedDBCacheConfig<T>;
  private _db: IDBDatabase | undefined;
  private _db_depth: number;

  constructor(config: IndexedDBCacheConfig<T>) {
    this.config = config;
    this._db = undefined;
    this._db_depth = 0;
  }

  private get entrySchema() {
    return z.object({
      key: z.string(),
      lastAccessed: z.number().int(),
      data: this.config.schema,
    });
  }

  public readonly $db = async <U>(
    callback: (db: IDBDatabase) => Promise<U>,
  ) => {
    this._db ??= await openDatabase(this.config);
    this._db_depth += 1;
    try {
      return await callback(this._db);
    } finally {
      this._db_depth -= 1;
      if (this._db_depth <= 0) {
        this._db.close();
        this._db = undefined;
      }
    }
  };

  public readonly $transaction = async <U>(
    callback: (store: IndexedDBObjectStore) => Promise<U>,
  ) => {
    return this.$db((db) => {
      return new Promise<U>((resolve, reject) => {
        const trx = db.transaction(this.config.storeName, 'readwrite');
        trx.addEventListener('error', () => {
          reject(trx.error ?? new Error('Transaction error'));
        });
        trx.addEventListener('abort', () => {
          reject(trx.error ?? new Error('Transaction aborted'));
        });
        const store = trx.objectStore(this.config.storeName);
        void callback(new IndexedDBObjectStore(store))
          .then((result) => {
            resolve(result);
          })
          .catch((err: unknown) => {
            try {
              trx.abort();
            } catch {
              // already aborted/committed
            }
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(err);
          });
      });
    });
  };

  public readonly set = async (key: string, value: T): Promise<void> => {
    const data = this.config.schema.parse(value);
    const shouldPurge = await this.$transaction(async (store) => {
      const entry = {
        key,
        lastAccessed: Date.now(),
        data,
      } satisfies z.infer<typeof this.entrySchema>;
      await store.delete(key);
      await store.put(entry);
      if (this.config.maxEntries === undefined) {
        return false;
      }
      const numEntries = await store.count();
      return numEntries - this.config.maxEntries > 10;
    });

    if (shouldPurge) {
      // Purge asynchronously
      void this.purge(this.config.maxEntries).catch((error: unknown) => {
        console.error(`Error purging IndexedDBCache: ${error}`);
      });
    }
  };

  public readonly get = (key: string): Promise<T | undefined> => {
    return this.$transaction(async (store) => {
      const value = await store.get(key);
      if (value === undefined) {
        return undefined;
      }
      const entry = this.entrySchema.parse(value);
      const updatedEntry = { ...entry, lastAccessed: Date.now() };
      await store.put(updatedEntry);
      return entry.data;
    });
  };

  public readonly purge = (numToKeep?: number): Promise<void> => {
    numToKeep ??= this.config.maxEntries ?? Number.POSITIVE_INFINITY;
    return this.$transaction(async (store) => {
      const numEntries = await store.count();
      let excess = numEntries - numToKeep;
      if (excess <= 0) {
        return;
      }
      await store.openCursor('lastAccessed', (resolve, reject, cursor) => {
        if (excess <= 0) {
          resolve();
          return;
        }
        void store
          .delete(cursor.primaryKey)
          .then(() => {
            excess -= 1;
            cursor.continue();
          })
          .catch(reject);
      });
    });
  };
}
