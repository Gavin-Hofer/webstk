import { useState } from 'react';

/**
 * Returns the previous value of a reactive value.
 *
 * @param value - The current value to track.
 * @returns The value from the previous render.
 */
export function usePreviousValue<T>(value: T): T {
  const [prev, setPrev] = useState<T>(value);
  const [current, setCurrent] = useState<T>(value);

  if (value !== current) {
    setPrev(current);
    setCurrent(value);
  }

  return prev;
}
