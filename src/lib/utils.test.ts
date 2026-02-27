import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { replaceFileExtension, retry } from './utils';

describe('replaceFileExtension', () => {
  test('replaces an existing extension', () => {
    expect(replaceFileExtension('photo.png', 'jpg')).toBe('photo.jpg');
  });

  test('accepts filetype with leading dot', () => {
    expect(replaceFileExtension('archive.tar.gz', '.zip')).toBe(
      'archive.tar.zip',
    );
  });

  test('returns original filename when no extension exists', () => {
    expect(replaceFileExtension('README', 'md')).toBe('README');
  });
});

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(globalThis.Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns value on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, value: 42 });

    await expect(retry(fn)).resolves.toEqual({ ok: true, value: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries failed attempts and eventually succeeds', async () => {
    const onAttemptFailure = vi.fn();
    const fn = vi
      .fn<() => Promise<{ done: boolean }>>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ done: true });

    const promise = retry(fn, {
      attempts: 3,
      delay: 20,
      backoff: 2,
      jitter: 0.1,
      onAttemptFailure,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ done: true });
    expect(onAttemptFailure).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('stops retrying when shouldRetry returns false', async () => {
    const error = new Error('fatal');
    const onFailure = vi.fn();
    const fn = vi.fn().mockRejectedValue(error);

    const promise = retry(fn, {
      attempts: 5,
      shouldRetry: () => false,
      onFailure,
    });

    await expect(promise).rejects.toThrow('fatal');
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
