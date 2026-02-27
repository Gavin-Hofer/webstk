import type { ConvertImageOptions } from './types';
import type { WorkerResponse } from './convert-image-vips.worker';

// #region Worker management
// =============================================================================

let worker: Worker | null = null;
let nextId = 0;

function getWorker(): Worker {
  worker ??= new Worker(
    new URL('./convert-image-vips.worker.ts', import.meta.url),
  );
  return worker;
}

// #endregion

// #region Main Function
// =============================================================================

/**
 * Converts an image file to a specified format using wasm-vips in a Web Worker.
 *
 * Delegates heavy encoding work to a background worker so the main thread
 * stays responsive. The worker loads wasm-vips and performs the actual
 * decode/resize/encode pipeline.
 *
 * @param file - The input image file to convert.
 * @param options - Conversion options (format, quality, width, height, filename).
 * @param signal - Optional AbortSignal to cancel the conversion.
 * @returns The converted image as a File.
 */
export function convertImageVips(
  file: File,
  options: ConvertImageOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  signal?.throwIfAborted();

  const id = nextId++;
  const w = getWorker();

  return new Promise<File>((resolve, reject) => {
    const onAbort = () => {
      w.removeEventListener('message', onMessage);
      reject(signal!.reason);
    };

    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMessage);
      signal?.removeEventListener('abort', onAbort);

      if ('error' in e.data) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.file);
      }
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    w.addEventListener('message', onMessage);
    w.postMessage({ id, file, options });
  });
}

// #endregion
