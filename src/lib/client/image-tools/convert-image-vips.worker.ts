/// <reference lib="webworker" />

import Vips from '@denodecom/wasm-vips';
import { z } from 'zod';

import { IMAGE_FORMAT_MIME_TYPES, IMAGE_FORMATS } from './image-formats';
import type { ImageFormat } from './image-formats';

// #region Schemas
// =============================================================================

const WorkerEventDataSchema = z.object({
  file: z.instanceof(File),
  options: z.object({
    format: z.enum(IMAGE_FORMATS).default('webp'),
    quality: z.number().int().min(0).max(100).default(85),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
});

type WorkerEventData = z.infer<typeof WorkerEventDataSchema>;
type WorkerResponse = { blob: Blob } | { error: string };

// #endregion

// #region Vips initialization
// =============================================================================

let vipsPromise: ReturnType<typeof Vips> | null = null;

function getVips() {
  vipsPromise ??= Vips({ locateFile: () => '/vips.wasm' });
  return vipsPromise;
}

// #endregion

// #region Web worker handler
// =============================================================================

self.onmessage = async (event) => {
  try {
    const eventData: WorkerEventData = WorkerEventDataSchema.parse(event.data);
    const response: WorkerResponse = await convertImageVips(eventData);
    self.postMessage(response);
  } catch (error) {
    console.error('Error converting image in vips web worker', error);
    const response: WorkerResponse = { error: 'Failed to convert image' };
    self.postMessage(response);
  }
};

// #endregion

// #region Conversion
// =============================================================================

async function convertImageVips({
  file,
  options,
}: WorkerEventData): Promise<WorkerResponse> {
  const { format, quality, width, height } = options;
  const vips = await getVips();

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const img = vips.Image.newFromBuffer(data);
  let resized: typeof img | null = null;

  try {
    if (width || height) {
      if (width && height) {
        resized = img.thumbnailImage(width, { height });
      } else if (width) {
        resized = img.thumbnailImage(width);
      } else {
        // thumbnailImage requires a width arg; use large value so height drives resize
        resized = img.thumbnailImage(img.width * 10, { height });
      }
    }

    const target = resized ?? img;
    const mimeType = IMAGE_FORMAT_MIME_TYPES[format as ImageFormat];
    const bytes = saveToBytes(target, format as ImageFormat, quality);
    // Cast required: vips returns Uint8Array<ArrayBufferLike>, Blob expects ArrayBuffer
    const blob = new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], {
      type: mimeType,
    });
    return { blob };
  } finally {
    img.delete();
    resized?.delete();
  }
}

type VipsModule = Awaited<ReturnType<typeof Vips>>;
type VipsImage = InstanceType<VipsModule['Image']>;

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
      return img.writeToBuffer('.bmp');
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

// #endregion
