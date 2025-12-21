import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

import { replaceFileExtension } from '@/lib/utils';

import { IMAGE_FORMAT_MIME_TYPES, type ImageFormat } from './image-formats';

// #region Types
// =============================================================================

type ConvertImageOptions = {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  filename?: string;
};

// #endregion

// #region Helper Functions
// =============================================================================

/**
 * Generates FFmpeg arguments for image conversion.
 *
 * @param options - The conversion options
 * @returns Array of FFmpeg command arguments
 */
function getFFmpegArgs(options: ConvertImageOptions): string[] {
  const { format = 'webp', quality = 85, width, height } = options;
  const args: string[] = [];

  // Add scale filter if dimensions are specified
  if (width || height) {
    const scaleW = width ?? -1;
    const scaleH = height ?? -1;
    args.push('-vf', `scale=${scaleW}:${scaleH}`);
  }

  // Add format-specific quality settings
  if (quality !== undefined) {
    switch (format) {
      case 'jpeg':
        // JPEG quality: 2-31 (lower is better), map 0-100 to 31-2
        args.push('-q:v', String(Math.round(31 - (quality / 100) * 29)));
        break;
      case 'webp':
        // WebP quality: 0-100
        args.push('-quality', String(quality));
        break;
      case 'avif':
        // AVIF uses CRF: 0-63 (lower is better), map 0-100 to 63-0
        args.push('-crf', String(Math.round(63 - (quality / 100) * 63)));
        break;
      case 'png':
        // PNG compression level: 0-9 (higher = more compression, lossless)
        // Map quality 100 → 0 (no compression), quality 0 → 9 (max compression)
        if (quality < 100) {
          const compressionLevel = Math.round(9 - (quality / 100) * 9);
          args.push('-compression_level', String(compressionLevel));
        }
        break;
      default:
        // Other formats may not support quality settings
        break;
    }
  }

  return args;
}

/**
 * Generates a unique filename for FFmpeg operations.
 *
 * @param extension - The file extension
 * @returns A unique filename
 */
function generateTempFilename(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `temp_${timestamp}_${random}.${extension}`;
}

// #endregion

// #region Main Function
// =============================================================================

/**
 * Converts an image file to a specified format using FFmpeg.
 *
 * Takes an input image file and converts it to the desired format using FFmpeg WASM.
 * Supports all major image formats including PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF, and ICO.
 *
 * Assumptions:
 *  - FFmpeg instance must be loaded and ready
 *  - Input file must be a valid image format
 *
 * @param ffmpeg - The loaded FFmpeg instance
 * @param file - The input image file to convert
 * @param options - Conversion options
 * @param options.format - Target format to convert to (defaults to 'webp')
 * @param options.quality - Quality setting for lossy formats (0-100, defaults to 85)
 * @param options.width - Target width in pixels (preserves aspect ratio if height not specified)
 * @param options.height - Target height in pixels (preserves aspect ratio if width not specified)
 * @param options.filename - Output filename (defaults to original filename with new extension)
 * @returns A Promise that resolves with the converted image as a File
 */
export async function convertImageFFmpeg(
  ffmpeg: FFmpeg,
  file: File,
  options: ConvertImageOptions = {},
): Promise<File> {
  const { format = 'webp' } = options;
  const outputFilename = replaceFileExtension(
    options.filename ?? file.name,
    format,
  );

  // Generate unique temp filenames to avoid conflicts with concurrent conversions
  const inputExtension = file.name.split('.').pop() || 'bin';
  const inputFilename = generateTempFilename(inputExtension);
  const tempOutputFilename = generateTempFilename(format);

  try {
    // Write input file to FFmpeg's virtual filesystem
    const inputData = await fetchFile(file);
    await ffmpeg.writeFile(inputFilename, inputData);

    // Build FFmpeg command arguments
    const qualityArgs = getFFmpegArgs(options);

    // Run FFmpeg conversion
    await ffmpeg.exec([
      '-i',
      inputFilename,
      ...qualityArgs,
      '-y', // Overwrite output file if exists
      tempOutputFilename,
    ]);

    // Read the output file
    const outputData = await ffmpeg.readFile(tempOutputFilename);

    // Clean up temp files
    await ffmpeg.deleteFile(inputFilename);
    await ffmpeg.deleteFile(tempOutputFilename);

    // Convert to File object
    // outputData can be string or Uint8Array - ensure we handle both
    const mimeType = IMAGE_FORMAT_MIME_TYPES[format];
    const blobData =
      typeof outputData === 'string' ?
        new TextEncoder().encode(outputData)
      : new Uint8Array(outputData);
    const blob = new Blob([blobData], { type: mimeType });
    return new File([blob], outputFilename, { type: mimeType });
  } catch (error) {
    // Attempt cleanup on error
    try {
      await ffmpeg.deleteFile(inputFilename);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(tempOutputFilename);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// #endregion
