// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { usePreviousValue } from './use-previous-value';

describe('usePreviousValue', () => {
  test('returns previous value after prop changes', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => usePreviousValue(value),
      {
        initialProps: { value: 'first' },
      },
    );

    expect(result.current).toBe('first');

    rerender({ value: 'second' });
    expect(result.current).toBe('first');

    rerender({ value: 'third' });
    expect(result.current).toBe('second');
  });

  test('keeps previous value unchanged when input stays equal', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => usePreviousValue(value),
      {
        initialProps: { value: 5 },
      },
    );

    rerender({ value: 5 });

    expect(result.current).toBe(5);
  });
});
