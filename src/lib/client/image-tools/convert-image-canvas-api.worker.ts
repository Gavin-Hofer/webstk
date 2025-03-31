/// <reference lib="webworker" />

import { z } from 'zod';

import { IMAGE_FORMATS } from './image-formats';

// #region Schemas
// =============================================================================

export const WorkerEventDataSchema = z.object({
  file: z.instanceof(File),
  options: z.object({
    format: z.enum(IMAGE_FORMATS).default('webp'),
    quality: z.number().int().gte(1).lte(100).default(85),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
});

export const WorkerResponseSchema = z.union([
  z.object({
    blob: z.instanceof(Blob),
  }),
  z.object({ error: z.string() }),
]);

export type WorkerEventData = z.infer<typeof WorkerEventDataSchema>;
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>;

// #region Web worker handler
// =============================================================================

/** Handles incoming messages from the main thread. */
self.onmessage = async (event) => {
  try {
    const eventData: WorkerEventData = WorkerEventDataSchema.parse(event.data);
    const response: WorkerResponse = await convertImageOffscreen(eventData);
    self.postMessage(response);
  } catch (error) {
    console.error('Error converting image in web worker', error);
    const response: WorkerResponse = { error: 'Failed to convert image' };
    self.postMessage(response);
  }
};

// #region Helper Functions
// =============================================================================

/** Converts an image to the desired type using the offscreen canvas API. */
async function convertImageOffscreen({
  file,
  options,
}: WorkerEventData): Promise<WorkerResponse> {
  const { format, quality } = options;
  const arrayBuffer: ArrayBuffer = await file.arrayBuffer();
  const bitmap: ImageBitmap = await createImageBitmap(new Blob([arrayBuffer]));
  const { width, height } = getDimensions(bitmap, options);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  const blob: Blob = await canvas.convertToBlob({
    type: `image/${format}`,
    quality: 0.01 * quality,
  });
  const newFormat = blob.type.split('/')[1];
  return { blob };
}

/** Gets the dimensions for the new image, preserving the aspect ratio if only one is specified. */
function getDimensions(
  bitmap: ImageBitmap,
  options: { width?: number; height?: number },
): { height: number; width: number } {
  const { height, width } = options;
  let newWidth: number = width ?? bitmap.width;
  let newHeight: number = height ?? bitmap.height;

  // Preserve aspect ratio
  if (width && !height) {
    newHeight = (width / bitmap.width) * bitmap.height;
  } else if (height && !width) {
    newWidth = (height / bitmap.height) * bitmap.width;
  }

  return { width: newWidth, height: newHeight };
}
