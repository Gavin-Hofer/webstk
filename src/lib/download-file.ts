import 'client-only';

// #region Helper Functions
// =============================================================================

function isMobileOrTablet(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPod|Android/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ reports as Macintosh but has touch support
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    isMobileOrTablet() &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })
  );
}

function downloadFileDom(file: File): void {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// #endregion

// #region Main Functions
// =============================================================================

/**
 * Downloads a file to the user's device.
 *
 * On devices that support the Web Share API with files (e.g. mobile), presents
 * the native share sheet which allows saving to the photo library. Falls back
 * to a standard browser download otherwise.
 *
 * Assumptions:
 *  - Must be called in a browser environment
 *
 * Side Effects:
 *  - Triggers a native share sheet or browser file download
 *
 * @param file - The file to download.
 */
export async function downloadFile(file: File): Promise<void> {
  if (typeof window === 'undefined') {
    throw new TypeError('Attempted to call downloadFile on the server.');
  }

  if (canShareFiles([file])) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    }
  }

  downloadFileDom(file);
}

/**
 * Downloads multiple files to the user's device.
 *
 * On devices that support the Web Share API with files (e.g. mobile), presents
 * a single native share sheet for all files. Falls back to individual browser
 * downloads otherwise.
 *
 * Assumptions:
 *  - Must be called in a browser environment
 *
 * Side Effects:
 *  - Triggers a native share sheet or browser file downloads
 *
 * @param files - The files to download.
 */
export async function downloadFiles(files: File[]): Promise<void> {
  if (typeof window === 'undefined') {
    throw new TypeError('Attempted to call downloadFiles on the server.');
  }

  if (files.length === 0) {
    return;
  }

  if (canShareFiles(files)) {
    try {
      await navigator.share({ files });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    }
  }

  for (const file of files) {
    downloadFileDom(file);
  }
}

// #endregion
