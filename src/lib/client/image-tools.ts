import 'client-only';

import { replaceFileExtension } from '@/lib/utils';

// #region Constants and types
// =============================================================================

/** Supported image formats to convert to. */
export const IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const;

/** Supported image format. */
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

// #region Exported Functions
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
export function convertImage(
  file: File,
  options: {
    format: ImageFormat;
    quality?: number;
    width?: number;
    height?: number;
  },
): Promise<File> {
  const { format = 'webp', quality = 85, width, height } = options;
  const filename = replaceFileExtension(file.name, format);

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
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
