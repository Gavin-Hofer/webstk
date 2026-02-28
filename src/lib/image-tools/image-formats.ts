/**
 * Supported image formats for wasm-vips conversion.
 */
export const IMAGE_FORMATS = [
  'png',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'avif',
] as const;

/** Supported image format. */
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

/** Maps image format to its MIME type. */
export const IMAGE_FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  avif: 'image/avif',
};
