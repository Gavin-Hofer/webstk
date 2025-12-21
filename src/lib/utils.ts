import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// #region Helper Functions
// =============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Replaces the existing filename extension of a file name. */
export function replaceFileExtension(
  filename: string,
  filetype: string,
): string {
  if (filetype.startsWith('.')) {
    filetype = filetype.substring(1);
  }
  const parts: string[] = filename.split('.');
  if (parts.length > 1) {
    parts.pop();
    parts.push(filetype);
  }
  return parts.join('.');
}

type RetryOptions = {
  attempts?: number;
  delay?: number;
  backoff?: number;
  jitter?: number;
  shouldRetry?: (error: unknown) => boolean;
};

/** Retry with exponential backoff and jitter. */
export async function retry<T>(
  fn: () => Promise<T>,
  {
    attempts = 5,
    delay = 20,
    backoff = 2,
    jitter = 0.1,
    shouldRetry = () => true,
  }: RetryOptions = {},
): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || i === attempts - 1) {
        throw error;
      }
      const sleepTime = delay * i ** backoff * (jitter * (Math.random() + 0.5));
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }
  }
  throw new Error('UNREACHABLE');
}

// #endregion
