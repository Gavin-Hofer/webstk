import { IMAGE_FORMAT_MIME_TYPES } from './image-formats';
import type { ImageFormat } from './image-formats';
import type Vips from 'wasm-vips';

// #region Vips initialization
// =============================================================================

let vipsPromise: Promise<typeof Vips> | null = null;

async function getVips() {
  // @ts-expect-error — loaded from public/ at runtime, types come from wasm-vips
  vipsPromise ??= import(/* webpackIgnore: true */ '/vips-es6.js').then(
    (m: { default: typeof Vips }) => m.default(),
  );
  return vipsPromise;
}

export async function loadVipsImage(file: File) {
  const vips = await getVips();
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  return vips.Image.newFromBuffer(data);
}

// #endregion

// #region Utilities
// =============================================================================

export const COMPRESSION_SUPPORTED = {
  avif: false,
  bmp: false,
  gif: false,
  jpeg: true,
  png: false,
  tiff: false,
  webp: true,
} as const satisfies Record<ImageFormat, boolean>;

function encodeBmp(img: Vips.Image): Uint8Array<ArrayBuffer> {
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

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, dataOffset, true);

  view.setUint32(14, dibHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, bpp, true);
  view.setUint32(34, pixelDataSize, true);

  for (let y = 0; y < height; y++) {
    const srcRow = y * width * bands;
    const dstRow = dataOffset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * bands;
      const di = dstRow + x * 3;
      out[di] = raw[si + 2];
      out[di + 1] = raw[si + 1];
      out[di + 2] = raw[si];
    }
  }

  return out;
}

// #endregion

// #region ImageBuilder
// =============================================================================

export class VipsImageBuilder {
  private readonly image: Vips.Image;
  private readonly allocated: Vips.Image[];

  constructor(image: Vips.Image, allocated?: Vips.Image[]) {
    this.image = image;
    this.allocated = allocated ?? [];
    this.allocated.push(image);
  }

  public static readonly fromFile = async (file: File) => {
    const vips = await getVips();
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const img = vips.Image.newFromBuffer(data);
    return new VipsImageBuilder(img);
  };

  public readonly resize = (size: { width?: number; height?: number }) => {
    const width = size.width ?? this.image.width;
    const height = size.height;
    if (
      width === this.image.width &&
      (height === undefined || height === this.image.height)
    ) {
      return this;
    }
    const image = this.image.thumbnailImage(width, { height });
    return new VipsImageBuilder(image, this.allocated);
  };

  public readonly scale = (scaleFactor: number) => {
    if (scaleFactor === 1) {
      return this;
    }
    const width = Math.round(this.image.width * scaleFactor);
    const image = this.image.thumbnailImage(width);
    return new VipsImageBuilder(image, this.allocated);
  };

  public readonly encode = ({
    format,
    quality = 100,
  }: {
    format: ImageFormat;
    quality?: number;
  }): Uint8Array<ArrayBufferLike> => {
    switch (format) {
      case 'jpeg':
        return this.image.jpegsaveBuffer({ Q: quality });
      case 'png':
        // Note: PNG compression doesn't reduce image quality, it just makes the
        // encoder work harder.
        return this.image.pngsaveBuffer({
          compression: 9,
        });
      case 'webp':
        return this.image.webpsaveBuffer({ Q: quality });
      case 'avif':
        return this.image.heifsaveBuffer({ compression: 'av1', Q: quality });
      case 'gif':
        return this.image.gifsaveBuffer();
      case 'tiff':
        return this.image.tiffsaveBuffer();
      case 'bmp':
        return encodeBmp(this.image);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  };

  public readonly toBlob = ({
    format,
    quality = 100,
  }: {
    format: ImageFormat;
    quality?: number;
  }) => {
    const mimeType = IMAGE_FORMAT_MIME_TYPES[format];
    const data = this.encode({ format, quality });
    return new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeType });
  };

  public readonly toFile = ({
    filename,
    format,
    quality = 100,
  }: {
    filename: string;
    format: ImageFormat;
    quality?: number;
  }) => {
    const blob = this.toBlob({ format, quality });
    return new File([blob], filename, { type: blob.type });
  };

  public readonly dispose = () => {
    for (const img of this.allocated) {
      img.delete();
    }
    this.allocated.length = 0;
  };
}

// #endregion
