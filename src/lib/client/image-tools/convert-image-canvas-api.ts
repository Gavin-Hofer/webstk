import { z } from 'zod';

import { replaceFileExtension } from '@/lib/utils';

import type { ImageFormat } from './image-formats';

// #region Schema
// =============================================================================

const WorkerResponseSchema = z.union([
  z.object({
    blob: z.instanceof(Blob),
  }),
  z.object({ error: z.string() }),
]);

// #endregion

// #region Helper Functions
// =============================================================================

/** Fallback conversion function for when the web worker API is not supported. */
export function convertImageFallback(
  file: File,
  options: {
    format?: ImageFormat;
    quality?: number;
    width?: number;
    height?: number;
    filename?: string;
  } = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  const { format = 'webp', quality = 85, width, height } = options;
  const filename = replaceFileExtension(options.filename ?? file.name, format);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      if (signal?.aborted) {
        return;
      }
      let newWidth = width || img.width;
      let newHeight = height || img.height;

      // Preserve aspect ratio
      if (width && !height) {
        newHeight = (width / img.width) * img.height;
      } else if (height && !width) {
        newWidth = (height / img.height) * img.width;
      }
      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (signal?.aborted) {
            return;
          }
          if (blob) {
            const file = new File([blob], filename, { type: blob.type });
            resolve(file);
          } else {
            reject(new Error('Failed to convert to blob'));
          }
        },
        `image/${format}`,
        quality,
      );
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
}

// #endregion

// #region Main Function
// =============================================================================

/**
 * Converts an image file to a specified format with optional quality settings.
 *
 * Takes an input image file and converts it to the desired format (webp, png, or jpg)
 * using HTML Canvas. The conversion happens client-side in the browser.
 *
 * Assumptions:
 *  - Function must be called in a browser environment (requires DOM APIs)
 *  - Input file must be a valid image format that browsers can display
 *
 * @param file - The input image file to convert
 * @param options - Conversion options
 * @param options.format - Target format to convert to ('webp', 'png', or 'jpg')
 * @param options.quality - Quality setting for the output image (1-100, defaults to 85)
 * @returns A Promise that resolves with the converted image as a Blob
 */
export function convertImageCanvasAPI(
  file: File,
  options: {
    format?: ImageFormat;
    quality?: number;
    width?: number;
    height?: number;
    filename?: string;
  } = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  const originalFilename = file.name;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    console.warn(
      'Web Workers or OffscreenCanvas not supported, falling back to main thread',
    );
    return convertImageFallback(file, options, { signal });
  }

  return new Promise((resolve, reject) => {
    // Create a worker.
    const worker = new Worker(
      new URL('./convert-image-canvas-api.worker.ts', import.meta.url),
    );

    const onAbort = () => {
      worker.terminate();
      reject(signal?.reason);
    };

    signal?.addEventListener('abort', onAbort);

    // Send the file and options to the worker.
    worker.postMessage({ file, options });

    // Handle the response from the worker.
    worker.onmessage = (event) => {
      const result = WorkerResponseSchema.safeParse(event.data);
      if (!result.success) {
        const errorMessage = `Failed to parse response from worker: ${result.error.message}`;
        reject(new Error(errorMessage));
        return;
      }
      const response = result.data;
      if ('error' in response) {
        reject(new Error(response.error));
        return;
      }
      const blob = response.blob;
      const format = blob.type.split('/')[1];
      const filename = replaceFileExtension(
        options.filename ?? originalFilename,
        format,
      );

      const file = new File([response.blob], filename, {
        type: response.blob.type,
      });
      resolve(file);
    };

    // Handle errors from the worker.
    worker.onerror = (event) => {
      reject(new Error(`Unhandled worker error: ${event.message}`));
    };
  });
}

// #endregion
