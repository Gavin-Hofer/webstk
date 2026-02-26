import { cacheDelete, cacheGet, cacheSet } from '@/lib/client/cache';
import { retry } from '@/lib/utils';

import { convertImageVips } from './convert-image-vips';
import type { ConvertImageOptions } from './types';

async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts an image file to a specified format.
 *
 * Takes an input image file and converts it to the desired format using wasm-vips.
 * Supports PNG, JPEG, WebP, GIF, BMP, TIFF, and AVIF output formats.
 *
 * @param file - The input image file to convert
 * @param options - Conversion options
 * @param options.format - Target format to convert to (defaults to 'webp')
 * @param options.quality - Quality setting for lossy formats (0-100, defaults to 85)
 * @param options.width - Target width in pixels (preserves aspect ratio if height not specified)
 * @param options.height - Target height in pixels (preserves aspect ratio if width not specified)
 * @param options.filename - Output filename (defaults to original filename with new extension)
 * @returns A Promise that resolves with the converted image as a File
 */
export async function convertImage(
  file: File,
  options: ConvertImageOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  const checksum = await computeHash(file);
  const cacheKey = JSON.stringify({ options, checksum });
  const cachedFile = await cacheGet<File>(cacheKey);
  if (cachedFile instanceof File) {
    return cachedFile;
  }
  if (cachedFile) {
    await cacheDelete(cacheKey);
  }
  const shouldRetry = () => {
    return signal?.aborted === true;
  };
  const onAttemptFailure = (error: unknown, attempt: number) => {
    if (!signal?.aborted) {
      console.info(
        `Failed to convert image using vips (attempt ${attempt}):`,
        error,
      );
    }
  };
  const onFailure = (error: unknown, attempt: number) => {
    if (!signal?.aborted) {
      console.error(
        `Failed to convert image using vips (attempt ${attempt}):`,
        error,
      );
    }
  };
  const convertedFile = await retry(
    () => convertImageVips(file, options, { signal }),
    {
      shouldRetry,
      onAttemptFailure,
      onFailure,
    },
  );
  await cacheSet<File>(cacheKey, convertedFile);
  return convertedFile;
}
