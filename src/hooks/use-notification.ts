import 'client-only';

import { useRef, useState } from 'react';

type Timeout = ReturnType<typeof setTimeout>;

export type Notification = {
  show: boolean;
  transparent: boolean;
  trigger: (delay?: number) => void;
};

export type UseNotificationOptions = {
  delay?: number;
  autoClose?: number;
};

/**
 * @description A hook to manage state for showing a notification.
 * @param delay - The duration before the notification starts to fade out in milliseconds.
 * @returns An object with the show state, the transparent state, and a trigger function.
 */
export function useNotification({
  delay = 0,
  autoClose = 1000,
}: UseNotificationOptions = {}): Notification {
  const [show, setShow] = useState<boolean>(false);
  const [transparent, setTransparent] = useState<boolean>(true);

  const timeoutRef1 = useRef<Timeout | undefined>(undefined);
  const timeoutRef2 = useRef<Timeout | undefined>(undefined);
  const timeoutRef3 = useRef<Timeout | undefined>(undefined);

  const trigger = (notificationDelay: number = delay) => {
    clearTimeout(timeoutRef1.current);
    clearTimeout(timeoutRef2.current);
    clearTimeout(timeoutRef3.current);

    timeoutRef1.current = setTimeout(() => {
      setShow(true);
      setTransparent(false);
    }, notificationDelay);

    timeoutRef2.current = setTimeout(() => {
      setTransparent(true);
    }, autoClose);

    timeoutRef3.current = setTimeout(() => {
      setShow(false);
    }, autoClose + 1000);
  };
  return { show, transparent, trigger };
}
