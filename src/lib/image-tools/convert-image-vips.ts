import type { WorkerResponse } from './convert-image-vips.worker';
import type { ConvertImageOptions } from './types';

// #region Worker management
// =============================================================================

let worker: Worker | null = null;
let nextId = 0;

function getWorker(): Worker {
  worker ??= new Worker(
    new URL('convert-image-vips.worker.ts', import.meta.url),
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
      console.error(`Image converter aborted: ${signal?.reason}`);
      w.removeEventListener('message', onMessage);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(signal?.reason);
    };

    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const payload = e.data as {
        id?: unknown;
        file?: unknown;
        error?: unknown;
      };
      if (payload.id !== id) {
        return;
      }
      if (payload.error === undefined && !(payload.file instanceof File)) {
        return;
      }

      w.removeEventListener('message', onMessage);
      signal?.removeEventListener('abort', onAbort);

      if (typeof payload.error === 'string') {
        reject(new Error(payload.error));
        return;
      }

      if (payload.file instanceof File) {
        resolve(payload.file);
        return;
      }

      reject(new Error('Worker returned an unexpected response payload'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    w.addEventListener('message', onMessage);
    w.postMessage({ id, file, options });
  });
}

// #endregion
