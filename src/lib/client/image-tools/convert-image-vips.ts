import { replaceFileExtension } from '@/lib/utils';

import type { ConvertImageOptions } from './types';
import { VipsImageBuilder } from './vips';


// #region Main Function
// =============================================================================

/**
 * Converts an image file to a specified format using wasm-vips.
 *
 * Loads vips in the main thread (avoiding nested workers for WebKit
 * compatibility) and delegates heavy computation to vips's internal
 * pthread pool.
 *
 * @param file - The input image file to convert.
 * @param options - Conversion options (format, quality, width, height, filename).
 * @param signal - Optional AbortSignal to cancel the conversion.
 * @returns The converted image as a File.
 */
export async function convertImageVips(
  file: File,
  options: ConvertImageOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<File> {
  signal?.throwIfAborted();

  const {
    format = 'webp',
    quality = 85,
    filename = replaceFileExtension(file.name, format),
    width,
    height,
  } = options;

  const imageBuilder = await VipsImageBuilder.fromFile(file);
  try {
    return imageBuilder
      .resize({ width, height })
      .toFile({ format, quality, filename });
  } finally {
    imageBuilder.dispose();
  }
}

// #endregion
