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

// #endregion
