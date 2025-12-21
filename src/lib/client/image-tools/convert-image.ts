import { retry } from '@/lib/utils';
import { convertImageFFmpeg } from './convert-image-ffmpeg';
import { convertImageCanvasAPI } from './convert-image-canvas-api';
import type { ImageFormat } from './image-formats';
import { ConvertImageOptions } from './types';

// Formats that FFmpeg-WASM doesn't support (missing codecs in base build)
const CANVAS_API_ONLY_FORMATS = new Set<ImageFormat>(['avif']);

function convert(
  file: File,
  options: ConvertImageOptions = {},
  { signal, useCanvas }: { signal?: AbortSignal; useCanvas?: boolean } = {},
): Promise<File> {
  const { format } = options;
  if (useCanvas || (format && CANVAS_API_ONLY_FORMATS.has(format))) {
    return convertImageCanvasAPI(file, options, { signal });
  }
  return convertImageFFmpeg(file, options, { signal });
}

/**
 * Converts an image file to a specified format.
 *
 * Takes an input image file and converts it to the desired format using FFmpeg WASM.
 * Supports all major image formats including PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF, and ICO.
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
  const shouldRetry = () => {
    return signal?.aborted === true;
  };
  try {
    const onAttemptFailure = (error: unknown, attempt: number) => {
      console.error(
        `Failed to convert image using ffmpeg (attempt ${attempt}):`,
        error,
      );
    };
    return await retry(() => convert(file, options, { signal }), {
      shouldRetry,
      onAttemptFailure,
    });
  } catch (error) {
    // Fallback to rendering with canvas
    console.error(
      'Failed to convert with ffmpeg, attempting with canvas:',
      error,
    );
    const onAttemptFailure = (error: unknown, attempt: number) => {
      console.error(
        `Failed to convert image using canvas (attempt ${attempt}):`,
        error,
      );
    };
    return await retry(
      () => convert(file, options, { signal, useCanvas: true }),
      {
        shouldRetry,
        onAttemptFailure,
      },
    );
  }
}
