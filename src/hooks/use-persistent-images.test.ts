// @vitest-environment jsdom
import { act } from 'react';

import fs from 'node:fs/promises';
import path from 'node:path';

import { renderHook, waitFor } from '@testing-library/react';

import '@vitest/web-worker';
import 'vitest-localstorage-mock';
import '@/test/mocks/navigator';
import 'fake-indexeddb/auto';
import '@/test/mocks/vips';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { imageCache, usePersistentImages } from './use-persistent-images';

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

const originalStructuredClone = globalThis.structuredClone;
const originalSharedArrayBuffer = globalThis.SharedArrayBuffer;

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
    await imageCache.clear();
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
    const oldFile = createPngFile('old.png');
    const newFile = createPngFile('new.png');

    await imageCache.set('1', {
      id: '1',
      timestamp: new Date('2024-01-01T00:00:00.000Z'),
      file: oldFile,
      preview: oldFile,
      ready: true,
      filename: 'old.png',
      format: 'png',
      quality: 85,
    });
    await imageCache.set('2', {
      id: '2',
      timestamp: new Date('2024-01-02T00:00:00.000Z'),
      file: newFile,
      preview: newFile,
      ready: true,
      filename: 'new.png',
      format: 'png',
      quality: 85,
    });

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

    const renamedImage = await imageCache.get('1');
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
      expect(await imageCache.count()).toBe(0);
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
      expect(await imageCache.count()).toBe(0);
    });

    errorSpy.mockRestore();
  }, 20_000);
});
