import { z } from 'zod';

import { replaceFileExtension } from '@/lib/utils';

import type { ConvertImageOptions } from './types';

// #region Schema
// =============================================================================

const WorkerResponseSchema = z.union([
  z.object({
    blob: z.instanceof(Blob),
  }),
  z.object({ error: z.string() }),
]);

// #endregion

// #region Main Function
// =============================================================================

/**
 * Converts an image file to a specified format using wasm-vips in a Web Worker.
 *
 * @param file - The input image file to convert
 * @param options - Conversion options (format, quality, width, height, filename)
 * @param signal - Optional AbortSignal to cancel the conversion
 * @returns A Promise that resolves with the converted image as a File
 */
export function convertImageVips(
  file: File,
  options: ConvertImageOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  const originalFilename = file.name;

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./convert-image-vips.worker.ts', import.meta.url),
    );

    const onAbort = () => {
      worker.terminate();
      reject(signal?.reason);
    };

    signal?.addEventListener('abort', onAbort);

    worker.postMessage({ file, options });

    worker.onmessage = (event) => {
      signal?.removeEventListener('abort', onAbort);
      const result = WorkerResponseSchema.safeParse(event.data);
      if (!result.success) {
        const errorMessage = `Failed to parse response from worker: ${result.error.message}`;
        reject(new Error(errorMessage));
        worker.terminate();
        return;
      }
      const response = result.data;
      if ('error' in response) {
        reject(new Error(response.error));
        worker.terminate();
        return;
      }
      const blob = response.blob;
      const format = blob.type.split('/')[1];
      const filename = replaceFileExtension(
        options.filename ?? originalFilename,
        format,
      );
      const outputFile = new File([blob], filename, { type: blob.type });
      resolve(outputFile);
      worker.terminate();
    };

    worker.onerror = (event) => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Unhandled worker error: ${event.message}`));
      worker.terminate();
    };
  });
}

// #endregion
