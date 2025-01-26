import 'client-only';

import { useState } from 'react';

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

  const trigger = () => {
    setShow(true);
    setTransparent(false);
    setTimeout(() => {
      setTransparent(true);
    }, delay);
    setTimeout(() => {
      setShow(false);
    }, delay + 1000);
  };
  return { show, transparent, trigger };
}
