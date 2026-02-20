/// <reference lib='webworker' />

import { z } from 'zod';

import { IMAGE_FORMATS, IMAGE_FORMAT_MIME_TYPES } from './image-formats';

type VipsImage = {
  width: number;
  height: number;
  resize: (scale: number, options?: { vscale?: number }) => VipsImage;
  deleteLater: () => VipsImage;
  writeToBuffer: (formatString: string) => Uint8Array;
  jpegsaveBuffer: (options: { Q: number }) => Uint8Array;
  webpsaveBuffer: (options: { Q: number }) => Uint8Array;
  pngsaveBuffer: (options: { compression: number }) => Uint8Array;
  heifsaveBuffer: (options: { Q: number; compression: string }) => Uint8Array;
  tiffsaveBuffer: () => Uint8Array;
  gifsaveBuffer: () => Uint8Array;
};

type VipsModule = {
  Image: {
    newFromBuffer: (buffer: Uint8Array, options: string) => VipsImage;
  };
};

type VipsFactory = (config?: {
  locateFile?: (path: string) => string;
}) => Promise<VipsModule>;

const WASM_VIPS_VERSION = '0.0.16';
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/wasm-vips@${WASM_VIPS_VERSION}/lib/`;
const WASM_SCRIPT_URL = `${WASM_BASE_URL}vips.js`;

const WorkerPayloadSchema = z.object({
  file: z.instanceof(File),
  options: z
    .object({
      format: z.enum(IMAGE_FORMATS).default('webp'),
      quality: z.number().int().min(0).max(100).default(85),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
    .default({}),
});

let vipsModulePromise: Promise<VipsModule> | undefined;

function getVipsModule() {
  if (!vipsModulePromise) {
    self.importScripts(WASM_SCRIPT_URL);
    const Vips = (self as WorkerGlobalScope & { Vips?: VipsFactory }).Vips;
    if (!Vips) {
      throw new Error('Failed to load wasm-vips runtime');
    }

    vipsModulePromise = Vips({
      locateFile(path) {
        return `${WASM_BASE_URL}${path}`;
      },
    });
  }

  return vipsModulePromise;
}

function getResizeScale(
  inputWidth: number,
  inputHeight: number,
  options: { width?: number; height?: number },
) {
  const { width, height } = options;

  if (!width && !height) {
    return { scale: 1, vscale: 1 };
  }

  if (width && height) {
    return { scale: width / inputWidth, vscale: height / inputHeight };
  }

  const ratio = (width ?? 0) / inputWidth || (height ?? 0) / inputHeight;
  return { scale: ratio, vscale: ratio };
}

function encodeImage(
  image: VipsImage,
  options: { format: (typeof IMAGE_FORMATS)[number]; quality: number },
): Uint8Array {
  const { format, quality } = options;

  switch (format) {
    case 'jpeg':
      return image.jpegsaveBuffer({ Q: quality });
    case 'webp':
      return image.webpsaveBuffer({ Q: quality });
    case 'png':
      return image.pngsaveBuffer({ compression: 6 });
    case 'avif':
      return image.heifsaveBuffer({ Q: quality, compression: 'av1' });
    case 'tiff':
      return image.tiffsaveBuffer();
    case 'gif':
      return image.gifsaveBuffer();
    default:
      return image.writeToBuffer(`.${format}`);
  }
}

self.onmessage = async (event: MessageEvent<unknown>) => {
  const parsedPayload = WorkerPayloadSchema.safeParse(event.data);
  if (!parsedPayload.success) {
    self.postMessage({ error: parsedPayload.error.message });
    return;
  }

  const { file, options } = parsedPayload.data;

  try {
    const vips = await getVipsModule();
    const sourceBuffer = new Uint8Array(await file.arrayBuffer());

    const sourceImage = vips.Image.newFromBuffer(sourceBuffer, '');
    const { scale, vscale } = getResizeScale(
      sourceImage.width,
      sourceImage.height,
      options,
    );

    const processedImage =
      scale === 1 && vscale === 1 ?
        sourceImage
      : sourceImage.resize(scale, { vscale });

    const outputBuffer = encodeImage(processedImage, {
      format: options.format,
      quality: options.quality,
    });

    const outputBytes = new Uint8Array(outputBuffer.byteLength);
    outputBytes.set(outputBuffer);
    const outputBlob = new Blob([outputBytes], {
      type: IMAGE_FORMAT_MIME_TYPES[options.format],
    });

    sourceImage.deleteLater();
    if (processedImage !== sourceImage) {
      processedImage.deleteLater();
    }

    self.postMessage({ blob: outputBlob });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ error: message });
  }
};
