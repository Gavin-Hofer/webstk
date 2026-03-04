// @vitest-environment jsdom
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { FileImage, isWebDisplayable } from './file-image';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('client-only', () => ({}));

vi.mock('@/lib/image-tools/convert-image', () => ({
  convertImage: vi.fn(
    async (file: File) =>
      new File(['converted'], file.name, { type: 'image/webp' }),
  ),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

function createFile(name: string, type: string, content = 'data'): File {
  return new File([content], name, { type });
}

let createObjectURLCount = 0;
let revokeObjectURLCount = 0;

beforeEach(() => {
  createObjectURLCount = 0;
  revokeObjectURLCount = 0;

  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    createObjectURLCount++;
    return `blob:mock-url-${createObjectURLCount}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
    revokeObjectURLCount++;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('isWebDisplayable', () => {
  test('returns true for standard web image types', () => {
    expect(isWebDisplayable(createFile('a.png', 'image/png'))).toBe(true);
    expect(isWebDisplayable(createFile('a.jpg', 'image/jpeg'))).toBe(true);
    expect(isWebDisplayable(createFile('a.gif', 'image/gif'))).toBe(true);
    expect(isWebDisplayable(createFile('a.webp', 'image/webp'))).toBe(true);
    expect(isWebDisplayable(createFile('a.svg', 'image/svg+xml'))).toBe(true);
    expect(isWebDisplayable(createFile('a.bmp', 'image/bmp'))).toBe(true);
    expect(isWebDisplayable(createFile('a.avif', 'image/avif'))).toBe(true);
  });

  test('returns false for non-displayable types', () => {
    expect(isWebDisplayable(createFile('a.tiff', 'image/tiff'))).toBe(false);
    expect(isWebDisplayable(createFile('a.heic', 'image/heic'))).toBe(false);
    expect(isWebDisplayable(createFile('a.raw', 'image/x-raw'))).toBe(false);
    expect(isWebDisplayable(createFile('a.bin', ''))).toBe(false);
  });
});

describe('FileImage', () => {
  test('renders img with object URL for displayable file', async () => {
    const { Wrapper } = createWrapper();
    const file = createFile('photo.png', 'image/png');

    render(
      <Wrapper>
        <FileImage file={file} alt='test image' data-testid='the-img' />
      </Wrapper>,
    );

    await waitFor(() => {
      const el = screen.getByTestId('the-img');
      expect(el.tagName).toBe('IMG');
    });

    const img = screen.getByTestId('the-img');
    expect(img).toBeInstanceOf(HTMLImageElement);
    if (!(img instanceof HTMLImageElement)) {
      throw new TypeError('Expected img to be HTMLImageElement');
    }
    expect(img.src).toContain('blob:');
    expect(img.alt).toBe('test image');
  });

  test('converts non-displayable file to webp before rendering', async () => {
    const { convertImage } = await import('@/lib/image-tools/convert-image');
    const { Wrapper } = createWrapper();
    const file = createFile('photo.tiff', 'image/tiff');

    render(
      <Wrapper>
        <FileImage file={file} alt='tiff image' data-testid='the-img' />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('the-img').tagName).toBe('IMG');
    });

    expect(convertImage).toHaveBeenCalledWith(
      file,
      { format: 'webp' },
      { signal: expect.any(AbortSignal) },
    );
  });

  test('does not convert displayable file', async () => {
    const { convertImage } = await import('@/lib/image-tools/convert-image');
    vi.mocked(convertImage).mockClear();
    const { Wrapper } = createWrapper();
    const file = createFile('photo.png', 'image/png');

    render(
      <Wrapper>
        <FileImage file={file} data-testid='the-img' />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('the-img').tagName).toBe('IMG');
    });

    expect(convertImage).not.toHaveBeenCalled();
  });

  test('shows placeholder div while loading', () => {
    const { Wrapper } = createWrapper();
    const file = createFile('photo.png', 'image/png');

    render(
      <Wrapper>
        <FileImage
          file={file}
          alt='loading'
          className='w-10 h-10'
          data-testid='the-img'
        />
      </Wrapper>,
    );

    const placeholder = screen.getByTestId('the-img');
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder.getAttribute('role')).toBe('img');
    expect(placeholder.getAttribute('aria-label')).toBe('loading');
    expect(placeholder.classList.contains('w-10')).toBe(true);
    expect(placeholder.classList.contains('h-10')).toBe(true);
  });

  test('shows spinner in placeholder when showLoadingSpinner is true', () => {
    const { Wrapper } = createWrapper();
    const file = createFile('photo.tiff', 'image/tiff');

    const { container } = render(
      <Wrapper>
        <FileImage file={file} showLoadingSpinner data-testid='the-img' />
      </Wrapper>,
    );

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  test('does not show spinner when showLoadingSpinner is false', () => {
    const { Wrapper } = createWrapper();
    const file = createFile('photo.tiff', 'image/tiff');

    const { container } = render(
      <Wrapper>
        <FileImage file={file} data-testid='the-img' />
      </Wrapper>,
    );

    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  test('passes through standard img props', async () => {
    const { Wrapper } = createWrapper();
    const file = createFile('photo.png', 'image/png');

    render(
      <Wrapper>
        <FileImage
          file={file}
          alt='custom alt'
          className='custom-class'
          draggable={false}
          data-testid='the-img'
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('the-img').tagName).toBe('IMG');
    });

    const img = screen.getByTestId('the-img');
    expect(img).toBeInstanceOf(HTMLImageElement);
    if (!(img instanceof HTMLImageElement)) {
      throw new TypeError('Expected img to be HTMLImageElement');
    }
    expect(img.alt).toBe('custom alt');
    expect(img.classList.contains('custom-class')).toBe(true);
    expect(img.draggable).toBe(false);
  });

  test('revokes old object URL when file changes', async () => {
    const { Wrapper } = createWrapper();
    const file1 = createFile('a.png', 'image/png', 'data-a');
    const file2 = createFile('b.png', 'image/png', 'data-b');

    const { rerender } = render(
      <Wrapper>
        <FileImage file={file1} data-testid='the-img' />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('the-img').tagName).toBe('IMG');
    });

    const revokeCountBefore = revokeObjectURLCount;

    rerender(
      <Wrapper>
        <FileImage file={file2} data-testid='the-img' />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(revokeObjectURLCount).toBeGreaterThan(revokeCountBefore);
    });
  });

  test('revokes object URL on unmount', async () => {
    const { Wrapper } = createWrapper();
    const file = createFile('photo.png', 'image/png');

    const { unmount } = render(
      <Wrapper>
        <FileImage file={file} data-testid='the-img' />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('the-img').tagName).toBe('IMG');
    });

    const revokeCountBefore = revokeObjectURLCount;
    unmount();
    expect(revokeObjectURLCount).toBeGreaterThan(revokeCountBefore);
  });
});
