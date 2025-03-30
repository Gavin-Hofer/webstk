'use client';

import { useRef } from 'react';

import { Mutex, withTimeout, type MutexInterface } from 'async-mutex';

/**
 * Creates a persistent mutex that can be used to synchronize asynchronous operations.
 *
 * This hook provides a reusable mutex instance that persists across component renders.
 * The mutex can optionally timeout after a specified duration.
 *
 * @param timeout - Optional timeout in milliseconds after which mutex acquisition will fail.
 */
export function useMutex(timeout?: number): MutexInterface {
  const mutexRef = useRef(
    timeout ? withTimeout(new Mutex(), timeout) : new Mutex(),
  );
  return mutexRef.current;
}
