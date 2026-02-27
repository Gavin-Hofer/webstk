// @vitest-environment jsdom
import { act } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useNotification } from './use-notification';

// React 19 act() environment flag for test runners.
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('client-only', () => ({}));

describe('useNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('transitions through show/transparent states with configured timing', async () => {
    const { result } = renderHook(() =>
      useNotification({ delay: 50, autoClose: 200 }),
    );

    expect(result.current).toEqual({
      show: false,
      transparent: true,
      trigger: expect.any(Function),
    });

    act(() => {
      result.current.trigger();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current).toEqual({
      show: true,
      transparent: false,
      trigger: expect.any(Function),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current).toEqual({
      show: true,
      transparent: true,
      trigger: expect.any(Function),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current).toEqual({
      show: false,
      transparent: true,
      trigger: expect.any(Function),
    });
  });

  test('uses trigger delay override when provided', async () => {
    const { result } = renderHook(() =>
      useNotification({ delay: 100, autoClose: 300 }),
    );

    act(() => {
      result.current.trigger(20);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(19);
    });

    expect(result.current).toEqual({
      show: false,
      transparent: true,
      trigger: expect.any(Function),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(result.current).toEqual({
      show: true,
      transparent: false,
      trigger: expect.any(Function),
    });
  });
});
