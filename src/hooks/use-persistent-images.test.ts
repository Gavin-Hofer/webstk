// @vitest-environment jsdom
import { act } from 'react';

import { renderHook, waitFor } from '@testing-library/react';

import '@vitest/web-worker';
import 'vitest-localstorage-mock';
import '@/test/mocks/navigator';
import '@/test/mocks/vips';
import 'fake-indexeddb/auto';

import superjson from 'superjson';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { imageCache, usePersistentImages } from './use-persistent-images';

vi.mock('client-only', () => ({}));

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

// Supports cloning file objects, like structuredClone does in the browser
function superjsonClone<T>(value: T): T {
  return superjson.deserialize(superjson.serialize(value));
}

describe('usePersistentImages', () => {
  beforeEach(async () => {
    vi.stubGlobal('structuredClone', superjsonClone);
    vi.clearAllMocks();
    await imageCache.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      const [images] = result.current;
      expect(images).toHaveLength(2);
    });

    expect(result.current[0][0].filename).toBe('old.png');
    expect(result.current[0][1].filename).toBe('new.png');

    act(() => {
      result.current[0][0].setFilename('renamed.png');
    });

    await waitFor(() => {
      const [images] = result.current;
      expect(images[0].filename).toBe('renamed.png');
    });

    await waitFor(async () => {
      const renamedImage = await imageCache.get('1');
      expect(renamedImage?.filename).toBe('renamed.png');
    });
  });

  test('attempts real conversion with wasm-vips and keeps item removable on conversion failure', async () => {
    vi.mock('@/lib/image-tools', () => ({
      convertImage: vi.fn().mockRejectedValue(new Error('Conversion failed')),
    }));
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
