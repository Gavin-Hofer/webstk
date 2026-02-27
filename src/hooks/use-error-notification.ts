import { useEffect, useRef } from 'react';

import { toast, type ExternalToast } from 'sonner';

const toastOptions = {
  position: 'top-center',
  dismissible: true,
  closeButton: true,
  duration: Number.POSITIVE_INFINITY,
} as const satisfies ExternalToast;

export function useErrorNotification(error: unknown) {
  const activeToast = useRef<number | string | undefined>(undefined);

  useEffect(() => {
    if (activeToast.current) {
      toast.dismiss(activeToast.current);
      activeToast.current = undefined;
    }
    if (!error) {
      return;
    }
    if (typeof error === 'string') {
      activeToast.current = toast.error(error, toastOptions);
      return;
    }
    if (error instanceof Error) {
      activeToast.current = toast.error(error.message, toastOptions);
      return;
    }
    if (typeof error === 'object' && 'message' in error) {
      activeToast.current = toast.error(String(error.message), toastOptions);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    activeToast.current = toast.error(String(error), toastOptions);
  }, [error]);
}
