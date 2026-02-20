import { cacheDelete, cacheGet, cacheSet } from '@/lib/client/cache';
import { replaceFileExtension } from '@/lib/utils';

import { IMAGE_FORMAT_MIME_TYPES } from './image-formats';
import { ConvertImageOptions } from './types';

async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function convertImage(
  file: File,
  options: ConvertImageOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      const checksum = await computeHash(file);
      const cacheKey = JSON.stringify({ options, checksum, engine: 'libvips' });
      const cachedFile = await cacheGet<File>(cacheKey);
      if (cachedFile instanceof File) {
        resolve(cachedFile);
        return;
      }
      if (cachedFile) {
        await cacheDelete(cacheKey);
      }

      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }

      const worker = new Worker(
        new URL('./convert-image-libvips.worker.ts', import.meta.url),
      );

      const onAbort = () => {
        worker.terminate();
        reject(signal?.reason);
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      worker.onmessage = async (
        event: MessageEvent<{ blob?: Blob; error?: string }>,
      ) => {
        signal?.removeEventListener('abort', onAbort);

        if (event.data.error) {
          worker.terminate();
          reject(new Error(event.data.error));
          return;
        }

        if (!event.data.blob) {
          worker.terminate();
          reject(new Error('Worker returned an empty response'));
          return;
        }

        const format = options.format ?? 'webp';
        const filename = replaceFileExtension(
          options.filename ?? file.name,
          format,
        );
        const mimeType =
          event.data.blob.type ||
          IMAGE_FORMAT_MIME_TYPES[format] ||
          'application/octet-stream';
        const convertedFile = new File([event.data.blob], filename, {
          type: mimeType,
        });

        await cacheSet<File>(cacheKey, convertedFile);
        worker.terminate();
        resolve(convertedFile);
      };

      worker.onerror = (event) => {
        signal?.removeEventListener('abort', onAbort);
        worker.terminate();
        reject(new Error(`Unhandled worker error: ${event.message}`));
      };

      worker.postMessage({ file, options });
    };

    run().catch(reject);
  });
}
