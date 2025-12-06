import 'client-only';

import { useState, useRef } from 'react';


export type Notification = {
  show: boolean;
  transparent: boolean;
  trigger: () => void;
};

/**
 * @description A hook to manage state for showing a notification.
 * @param delay - The duration before the notification starts to fade out in milliseconds.
 * @returns An object with the show state, the transparent state, and a trigger function.
 */
export function useNotification(delay: number = 1000): Notification {
  const [show, setShow] = useState<boolean>(false);
  const [transparent, setTransparent] = useState<boolean>(true);
  const timeoutRef1 = useRef<NodeJS.Timeout | undefined>(undefined);
  const timeoutRef2 = useRef<NodeJS.Timeout | undefined>(undefined);

  const trigger = () => {
    clearTimeout(timeoutRef1.current);
    clearTimeout(timeoutRef2.current);
    setShow(true);
    setTransparent(false);
    timeoutRef1.current = setTimeout(() => {
      setTransparent(true);
    }, delay);
    timeoutRef2.current = setTimeout(() => {
      setShow(false);
    }, delay + 1000);
  };
  return { show, transparent, trigger };
}
