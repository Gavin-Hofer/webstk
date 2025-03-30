import 'client-only';

/**
 * Downloads a file to the user's device.
 *
 * Creates a temporary link element, triggers a download, and cleans up resources.
 *
 * Assumptions:
 *  - Must be called in a browser environment
 *
 * Side Effects:
 *  - Creates and removes a DOM element
 *  - Triggers a file download in the browser
 *
 * @param file - The file to download.
 */
export function downloadFile(file: File): void {
  if (typeof window === 'undefined') {
    throw new Error('Attempted to call downloadFile on the server.');
  }
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
