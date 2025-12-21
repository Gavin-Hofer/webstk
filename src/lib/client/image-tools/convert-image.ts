import { retry } from '@/lib/utils';
import { convertImageFFmpeg } from './convert-image-ffmpeg';
import { convertImageCanvasAPI } from './convert-image-canvas-api';
import type { ImageFormat } from './image-formats';
import { ConvertImageOptions } from './types';
import { cacheDelete, cacheGet, cacheSet } from '@/lib/client/cache';

// Formats that FFmpeg-WASM doesn't support (missing codecs in base build)
const CANVAS_API_ONLY_FORMATS = new Set<ImageFormat>(['avif']);

async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
  {
    signal,
    useCanvas = false,
  }: { signal?: AbortSignal; useCanvas?: boolean } = {},
): Promise<File> {
  const checksum = await computeHash(file);
  const cacheKey = JSON.stringify({ options, useCanvas, checksum });
  const cachedFile = await cacheGet<File>(cacheKey);
  if (cachedFile instanceof File) {
    return cachedFile;
  }
  if (cachedFile) {
    // Cached file was not valid
    await cacheDelete(cacheKey);
  }
  const shouldRetry = () => {
    return signal?.aborted === true;
  };
  const errorLogger = (api: 'ffmpeg' | 'canvas', level: 'info' | 'error') => {
    return (error: unknown, attempt: number) => {
      if (!signal?.aborted) {
        console[level](
          `Failed to convert image using ${api} (attempt ${attempt}):`,
          error,
        );
      }
    };
  };
  try {
    const convertedFile = await retry(
      () => convert(file, options, { signal, useCanvas }),
      {
        shouldRetry,
        onAttemptFailure: errorLogger('ffmpeg', 'info'),
      },
    );
    await cacheSet<File>(cacheKey, convertedFile);
    return convertedFile;
  } catch (error) {
    // Fallback to rendering with canvas
    console.info(
      'Failed to convert with ffmpeg, attempting with canvas:',
      error,
    );
    return await retry(
      () => convert(file, options, { signal, useCanvas: true }),
      {
        shouldRetry,
        onAttemptFailure: errorLogger('canvas', 'info'),
        onFailure: errorLogger('canvas', 'error'),
      },
    );
  }
}
