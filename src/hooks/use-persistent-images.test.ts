// @vitest-environment jsdom
import { act } from 'react';

import fs from 'node:fs/promises';
import path from 'node:path';

import { renderHook, waitFor } from '@testing-library/react';

import '@vitest/web-worker';
import 'vitest-localstorage-mock';

import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { usePersistentImages } from './use-persistent-images';

vi.mock('client-only', () => ({}));

// React 19 act() environment flag for test runners.
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('uuid', () => {
  let counter = 0;
  return {
    v4: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
});

class MockFileList implements FileList {
  [index: number]: File;

  readonly length: number;

  constructor(private readonly files: File[]) {
    this.length = files.length;
    files.forEach((file, index) => {
      this[index] = file;
    });
  }

  item(index: number): File | null {
    return this.files[index] ?? null;
  }

  [Symbol.iterator](): ArrayIterator<File> {
    return this.files.values();
  }
}

function fileListFrom(files: File[]): FileList {
  return new MockFileList(files);
}

function createPngFile(name: string): File {
  const png1x1Transparent = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
    0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120,
    156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 167, 195, 89, 57, 0, 0, 0, 0, 73,
    69, 78, 68, 174, 66, 96, 130,
  ]);
  return new File([png1x1Transparent], name, { type: 'image/png' });
}

type StoredImage = {
  id: string;
  timestamp: Date;
  file: File;
  preview: File;
  ready: boolean;
  filename: string;
  format: 'png' | 'jpeg' | 'webp' | 'gif' | 'avif';
  quality: number;
};

function isStoredImage(value: unknown): value is StoredImage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'timestamp' in value &&
    value.timestamp instanceof Date &&
    'file' in value &&
    value.file instanceof File &&
    'preview' in value &&
    value.preview instanceof File &&
    'ready' in value &&
    typeof value.ready === 'boolean' &&
    'filename' in value &&
    typeof value.filename === 'string' &&
    'format' in value &&
    typeof value.format === 'string' &&
    'quality' in value &&
    typeof value.quality === 'number'
  );
}

async function resetDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const transaction = request.result.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      store.clear();
      transaction.addEventListener('complete', () => {
        request.result.close();
        resolve();
      });
      transaction.addEventListener('error', () => {
        reject(transaction.error ?? new Error('Failed to clear database'));
      });
    };
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open database'));
    });
  });
}

async function seedDatabase(records: StoredImage[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const transaction = request.result.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      records.forEach((record) => {
        store.put(record);
      });
      transaction.addEventListener('complete', () => {
        request.result.close();
        resolve();
      });
      transaction.addEventListener('error', () => {
        reject(transaction.error ?? new Error('Failed to seed database'));
      });
    };
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open database'));
    });
  });
}

async function getAllStoredImages(): Promise<StoredImage[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const transaction = request.result.transaction(['files'], 'readonly');
      const getAllRequest = transaction.objectStore('files').getAll();
      getAllRequest.onsuccess = () => {
        request.result.close();
        const images = getAllRequest.result.filter((value) =>
          isStoredImage(value),
        );
        resolve(images);
      };
      getAllRequest.addEventListener('error', () => {
        reject(getAllRequest.error ?? new Error('Failed to read images'));
      });
    };
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open database'));
    });
  });
}

async function getStoredImageCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const getAllRequest = request.result
        .transaction(['files'], 'readonly')
        .objectStore('files')
        .getAll();
      getAllRequest.onsuccess = () => {
        request.result.close();
        resolve(getAllRequest.result.length);
      };
      getAllRequest.addEventListener('error', () => {
        reject(getAllRequest.error ?? new Error('Failed to read image count'));
      });
    };
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open database'));
    });
  });
}

const originalStructuredClone = globalThis.structuredClone;
const originalSharedArrayBuffer = globalThis.SharedArrayBuffer;

async function linkVipsAssetsToRoot(): Promise<void> {
  const assets = [
    'vips-es6.js',
    'vips.wasm',
    'vips-heif.wasm',
    'vips-jxl.wasm',
  ];
  await Promise.all(
    assets.map(async (asset) => {
      const source = path.resolve(process.cwd(), 'public', asset);
      const destination = path.resolve('/', asset);
      try {
        await fs.unlink(destination);
      } catch {
        // no-op if destination does not exist
      }
      await fs.symlink(source, destination);
    }),
  );
}

const originalFetch = globalThis.fetch;

async function createVipsWasmResponse(url: string): Promise<Response | null> {
  const fileName = ['vips.wasm', 'vips-heif.wasm', 'vips-jxl.wasm'].find(
    (candidate) => url.endsWith(candidate),
  );
  if (!fileName) {
    return null;
  }
  const filePath = path.resolve(
    process.cwd(),
    'node_modules/wasm-vips/lib',
    fileName,
  );
  const bytes = await fs.readFile(filePath);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/wasm',
    },
  });
}

describe('usePersistentImages', () => {
  beforeEach(async () => {
    globalThis.structuredClone = (<T>(value: T): T =>
      value) as typeof structuredClone;
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: fakeIndexedDB,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'SharedArrayBuffer', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: {
        persist: vi.fn(async () => true),
      },
      configurable: true,
    });
    localStorage.clear();
    localStorage.setItem('preferred-image-format', JSON.stringify('png'));
    await linkVipsAssetsToRoot();
    globalThis.fetch = vi.fn(async (input: URL | RequestInfo) => {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL ? input.toString()
        : input.url;
      const wasmResponse = await createVipsWasmResponse(url);
      if (wasmResponse) {
        return wasmResponse;
      }
      return originalFetch(input);
    });
    await resetDatabase();
  });

  afterEach(() => {
    globalThis.structuredClone = originalStructuredClone;
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'SharedArrayBuffer', {
      value: originalSharedArrayBuffer,
      configurable: true,
    });
  });

  test('loads persisted images sorted by timestamp and updates filename in IndexedDB', async () => {
    const oldFile = new File(['old'], 'old.png', { type: 'image/png' });
    const newFile = new File(['new'], 'new.png', { type: 'image/png' });

    await seedDatabase([
      {
        id: '11111111-1111-4111-8111-111111111111',
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        file: oldFile,
        preview: oldFile,
        ready: true,
        filename: 'old.png',
        format: 'png',
        quality: 85,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        timestamp: new Date('2024-01-02T00:00:00.000Z'),
        file: newFile,
        preview: newFile,
        ready: true,
        filename: 'new.png',
        format: 'png',
        quality: 85,
      },
    ]);

    const { result } = renderHook(() => usePersistentImages());

    await waitFor(() => {
      expect(result.current[0]).toHaveLength(2);
    });

    expect(result.current[0][0].filename).toBe('old.png');
    expect(result.current[0][1].filename).toBe('new.png');

    act(() => {
      result.current[0][0].setFilename('renamed.png');
    });

    await waitFor(() => {
      expect(result.current[0][0].filename).toBe('renamed.png');
    });

    const storedImages = await getAllStoredImages();
    const renamedImage = storedImages.find(
      (image) => image.id === '11111111-1111-4111-8111-111111111111',
    );

    expect(renamedImage?.filename).toBe('renamed.png');
  });

  test('attempts real conversion with wasm-vips and keeps item removable on conversion failure', async () => {
    globalThis.structuredClone = originalStructuredClone;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePersistentImages());

    const inputFile = createPngFile('test.png');

    act(() => {
      result.current[1](fileListFrom([inputFile]));
    });

    await waitFor(() => {
      expect(result.current[0]).toHaveLength(1);
    });

    await waitFor(
      () => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error converting image: test.png\n'),
          expect.any(Error),
        );
      },
      { timeout: 15_000 },
    );

    const [image] = result.current[0];
    expect(image.ready).toBe(false);

    await waitFor(async () => {
      expect(await getStoredImageCount()).toBe(0);
    });

    act(() => {
      image.remove();
    });

    await waitFor(() => {
      expect(result.current[0]).toHaveLength(0);
    });

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(async () => {
      expect(await getStoredImageCount()).toBe(0);
    });

    errorSpy.mockRestore();
  }, 20_000);
});
