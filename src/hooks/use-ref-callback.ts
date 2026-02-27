import { useCallback, useEffect, useRef } from 'react';

type RefEffectCallback<T> = (element: T | null) => undefined | (() => void);

/**
 * A callback ref that runs a setup/cleanup effect when the ref element changes.
 *
 * Similar to React's `useEffect` but tied to the ref lifecycle instead of
 * component render. The callback receives the DOM node and may return a
 * cleanup function that is invoked when the node changes or unmounts.
 *
 * @param callback - Called with the new element (or null on unmount). May return a cleanup function.
 * @returns A stable ref callback suitable for passing to a JSX `ref` prop.
 */
export function useRefCallback<T>(callback: RefEffectCallback<T>) {
  const nodeRef = useRef<T | null>(null);
  const cleanupRef = useRef<undefined | (() => void)>(undefined);
  const callbackRef = useRef<RefEffectCallback<T>>(callback);
  // eslint-disable-next-line react-hooks/refs
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
      nodeRef.current = null;
    };
  }, []);

  const refCallback = useCallback((node: T | null) => {
    if (node !== nodeRef.current) {
      cleanupRef.current?.();
    }
    nodeRef.current = node;
    cleanupRef.current = callbackRef.current(node);
  }, []);

  return { refCallback, refObject: nodeRef };
}
