import { replaceFileExtension } from '@/lib/utils';

import { IMAGE_FORMAT_MIME_TYPES } from './image-formats';
import type { ImageFormat } from './image-formats';
import type { ConvertImageOptions } from './types';

// #region Types
// =============================================================================

type VipsFactory = (config?: {
  mainScriptUrlOrBlob?: string | Blob;
  locateFile?: (url: string, scriptDirectory: string) => string;
}) => Promise<VipsModule>;

type VipsModule = {
  Image: {
    newFromBuffer(data: Uint8Array): VipsImage;
  };
};

type VipsImage = {
  readonly width: number;
  readonly height: number;
  readonly bands: number;
  thumbnailImage(width: number, options?: { height?: number }): VipsImage;
  jpegsaveBuffer(options: { Q: number }): Uint8Array;
  pngsaveBuffer(options: { compression: number }): Uint8Array;
  webpsaveBuffer(options: { Q: number }): Uint8Array;
  heifsaveBuffer(options: { compression: string; Q: number }): Uint8Array;
  gifsaveBuffer(): Uint8Array;
  tiffsaveBuffer(): Uint8Array;
  writeToBuffer(suffix: string): Uint8Array;
  writeToMemory(): Uint8Array;
  delete(): void;
};

// #endregion

// #region Vips initialization
// =============================================================================

let vipsPromise: Promise<VipsModule> | null = null;

function loadVipsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((globalThis as Record<string, unknown>).Vips) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '/vips.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load vips.js'));
    document.head.appendChild(script);
  });
}

function getVips(): Promise<VipsModule> {
  vipsPromise ??= loadVipsScript().then(() => {
    const Vips = (globalThis as Record<string, unknown>).Vips as VipsFactory;
    return Vips({
      locateFile: (fileName: string) => `/${fileName}`,
    });
  });
  return vipsPromise;
}

// #endregion

// #region Helper functions
// =============================================================================

function saveToBytes(
  img: VipsImage,
  format: ImageFormat,
  quality: number,
): Uint8Array {
  switch (format) {
    case 'jpeg':
      return img.jpegsaveBuffer({ Q: quality });
    case 'png':
      return img.pngsaveBuffer({
        compression: Math.round(((100 - quality) / 100) * 9),
      });
    case 'webp':
      return img.webpsaveBuffer({ Q: quality });
    case 'avif':
      return img.heifsaveBuffer({ compression: 'av1', Q: quality });
    case 'gif':
      return img.gifsaveBuffer();
    case 'tiff':
      return img.tiffsaveBuffer();
    case 'bmp':
      return encodeBmp(img);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Encodes a vips image as a 24-bit BMP.
 *
 * libvips has no buffer-based BMP saver, so we build the file manually from
 * raw pixel data (BITMAPINFOHEADER, bottom-to-top rows, BGR channel order,
 * rows padded to 4-byte boundaries).
 */
function encodeBmp(img: VipsImage): Uint8Array {
  const { width, height, bands } = img;
  const raw = img.writeToMemory();

  const bpp = 24;
  const rowBytes = width * 3;
  const rowPadding = (4 - (rowBytes % 4)) % 4;
  const stride = rowBytes + rowPadding;
  const pixelDataSize = stride * height;

  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const dataOffset = fileHeaderSize + dibHeaderSize;
  const fileSize = dataOffset + pixelDataSize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  // File header
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, dataOffset, true);

  // BITMAPINFOHEADER
  view.setUint32(14, dibHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, bpp, true);
  view.setUint32(34, pixelDataSize, true);

  // Pixel data: top-to-bottom RGB(A) -> bottom-to-top BGR
  for (let y = 0; y < height; y++) {
    const srcRow = y * width * bands;
    const dstRow = dataOffset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * bands;
      const di = dstRow + x * 3;
      out[di] = raw[si + 2]; // B
      out[di + 1] = raw[si + 1]; // G
      out[di + 2] = raw[si]; // R
    }
  }

  return out;
}

// #endregion

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

  const format = (options.format ?? 'webp') as ImageFormat;
  const quality = options.quality ?? 85;
  const { width, height } = options;

  const vips = await getVips();
  signal?.throwIfAborted();

  const arrayBuffer = await file.arrayBuffer();
  signal?.throwIfAborted();

  const data = new Uint8Array(arrayBuffer);
  const img = vips.Image.newFromBuffer(data);
  let resized: VipsImage | null = null;

  try {
    if (width || height) {
      if (width && height) {
        resized = img.thumbnailImage(width, { height });
      } else if (width) {
        resized = img.thumbnailImage(width);
      } else {
        resized = img.thumbnailImage(img.width * 10, { height });
      }
    }

    const target = resized ?? img;
    const mimeType = IMAGE_FORMAT_MIME_TYPES[format];
    const bytes = saveToBytes(target, format, quality);
    const blob = new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], {
      type: mimeType,
    });
    const outFormat = blob.type.split('/')[1];
    const filename = replaceFileExtension(
      options.filename ?? file.name,
      outFormat,
    );
    return new File([blob], filename, { type: blob.type });
  } finally {
    img.delete();
    resized?.delete();
  }
}

// #endregion
