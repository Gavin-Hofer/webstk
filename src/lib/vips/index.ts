import type Vips from 'wasm-vips';

import type {
  ImageCropOptions,
  ImageTouchupOptions,
  ImageTransformOptions,
} from '../image-tools/types';
import { PUBLIC_VIPS_PATH, PUBLIC_VIPS_PATH_NODE } from './__generated__';

// #region Image Formats
// =============================================================================

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

// #endregion

// #region Vips initialization
// =============================================================================

let vipsPromise: Promise<typeof Vips> | null = null;

function isVipsInstance(value: unknown): value is typeof Vips {
  return typeof value === 'object' && value !== null && 'Image' in value;
}

export async function getVips() {
  vipsPromise ??= (async () => {
    const isNode = typeof window === 'undefined';
    const publicVipsPath = isNode ? PUBLIC_VIPS_PATH_NODE : PUBLIC_VIPS_PATH;
    const publicVipsModule = await import(
      /* webpackIgnore: true */ /* @vite-ignore */ publicVipsPath
    );
    const initVips =
      'default' in publicVipsModule ? publicVipsModule.default : undefined;
    if (typeof initVips !== 'function') {
      throw new TypeError('Invalid vips module loaded from public assets');
    }
    const vips = await initVips();
    if (!isVipsInstance(vips)) {
      throw new TypeError('Invalid vips instance loaded from public assets');
    }
    return vips;
  })();
  return vipsPromise;
}

export function imageLoader(vips: typeof Vips) {
  return async (file: File) => {
    const data = await fileToBuffer(file);
    return vips.Image.newFromBuffer(data);
  };
}

const BMP_MIME_TYPES = new Set(['image/bmp', 'image/x-ms-bmp']);

/**
 * wasm-vips has no native BMP loader, so we decode via the browser's built-in
 * image codec and re-encode as PNG before handing the buffer to vips.
 */
async function decodeViaBrowser(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context from canvas');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

async function fileToBuffer(file: File): Promise<Uint8Array> {
  if (
    BMP_MIME_TYPES.has(file.type) ||
    file.name.toLowerCase().endsWith('.bmp')
  ) {
    return decodeViaBrowser(file);
  }
  return new Uint8Array(await file.arrayBuffer());
}

// #endregion

// #region Utilities
// =============================================================================

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

export const COMPRESSION_SUPPORTED = {
  avif: true,
  bmp: false,
  gif: false,
  jpeg: true,
  png: true,
  tiff: false,
  webp: true,
} as const satisfies Record<ImageFormat, boolean>;

export class VipsImageBuilder {
  private readonly image: Vips.Image;
  private readonly allocated: Vips.Image[];

  constructor(image: Vips.Image, allocated?: Vips.Image[]) {
    this.image = image;
    this.allocated = allocated ?? [];
    this.allocated.push(image);
  }

  public readonly resize = (size: { width?: number; height?: number }) => {
    const width = size.width;
    const height = size.height;
    const hasWidth = typeof width === 'number' && Number.isFinite(width);
    const hasHeight = typeof height === 'number' && Number.isFinite(height);
    if (!hasWidth && !hasHeight) {
      return this;
    }

    const targetWidth =
      hasWidth ? Math.max(1, Math.round(width)) : this.image.width;
    const targetHeight =
      hasHeight ? Math.max(1, Math.round(height)) : this.image.height;
    if (
      targetWidth === this.image.width &&
      targetHeight === this.image.height
    ) {
      return this;
    }

    const scaleX = targetWidth / this.image.width;
    const scaleY = targetHeight / this.image.height;
    const image =
      hasWidth && hasHeight ?
        this.image.resize(scaleX, { vscale: scaleY })
      : this.image.resize(hasWidth ? scaleX : scaleY);
    return new VipsImageBuilder(image, this.allocated);
  };

  public readonly thumbnail = (size: { width?: number; height?: number }) => {
    const width = size.width;
    const height = size.height;
    const hasWidth = typeof width === 'number' && Number.isFinite(width);
    const hasHeight = typeof height === 'number' && Number.isFinite(height);
    if (!hasWidth && !hasHeight) {
      return this;
    }

    const targetWidth =
      hasWidth ? Math.max(1, Math.round(width)) : this.image.width;
    const targetHeight =
      hasHeight ? Math.max(1, Math.round(height)) : this.image.height;
    if (
      targetWidth === this.image.width &&
      targetHeight === this.image.height
    ) {
      return this;
    }

    const image = this.image.thumbnailImage(targetWidth, {
      height: hasHeight ? targetHeight : undefined,
    });
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

  public readonly crop = (crop: ImageCropOptions) => {
    const left = Math.max(0, Math.round(crop.left));
    const top = Math.max(0, Math.round(crop.top));
    const width = Math.max(1, Math.round(crop.width));
    const height = Math.max(1, Math.round(crop.height));
    if (
      left === 0 &&
      top === 0 &&
      width === this.image.width &&
      height === this.image.height
    ) {
      return this;
    }
    const safeWidth = Math.min(width, this.image.width - left);
    const safeHeight = Math.min(height, this.image.height - top);
    const cropped = this.image.extractArea(left, top, safeWidth, safeHeight);
    return new VipsImageBuilder(cropped, this.allocated);
  };

  public readonly touchup = (touchup: ImageTouchupOptions) => {
    const brightness = touchup.brightness ?? 1;
    const contrast = touchup.contrast ?? 1;
    const saturation = touchup.saturation ?? 1;
    const sharpen = touchup.sharpen ?? 0;

    const hasTouchup =
      brightness !== 1 || contrast !== 1 || saturation !== 1 || sharpen > 0;
    if (!hasTouchup) {
      return this;
    }

    let nextImage = this.image;

    // brightness and contrast are combined in a single linear transform:
    // output = input * contrast + offset.
    if (brightness !== 1) {
      const adjusted = nextImage.linear(
        [brightness, brightness, brightness],
        [0, 0, 0],
      );
      nextImage = adjusted;
      this.allocated.push(nextImage);
    }

    if (saturation !== 1 && nextImage.bands >= 3) {
      // Saturation is the chroma channel in LCh colorspace.
      const interpretation = nextImage.interpretation;
      if (nextImage.hasAlpha()) {
        const withoutAlpha = nextImage.extractBand(0, {
          n: nextImage.bands - 1,
        });
        this.allocated.push(withoutAlpha);

        const alpha = nextImage.extractBand(nextImage.bands - 1);
        this.allocated.push(alpha);

        const saturated = withoutAlpha
          .colourspace('lch')
          .linear([1, saturation, 1], [0, 0, 0])
          .colourspace(interpretation)
          .bandjoin(alpha);
        nextImage = saturated;
        this.allocated.push(nextImage);
      } else {
        const saturated = nextImage
          .colourspace('lch')
          .linear([1, saturation, 1], [0, 0, 0])
          .colourspace(interpretation);
        nextImage = saturated;
        this.allocated.push(nextImage);
      }
    }

    if (sharpen > 0) {
      const sharpened = nextImage.sharpen({ sigma: sharpen });
      nextImage = sharpened;
      this.allocated.push(nextImage);
    }

    return new VipsImageBuilder(nextImage, this.allocated);
  };

  public readonly transform = (transform: ImageTransformOptions) => {
    const rotation = transform.rotation ?? 0;
    const flipHorizontal = transform.flipHorizontal ?? false;
    const flipVertical = transform.flipVertical ?? false;
    const hasTransform = rotation !== 0 || flipHorizontal || flipVertical;
    if (!hasTransform) {
      return this;
    }

    let nextImage = this.image;

    if (rotation !== 0) {
      let angle: Vips.Angle;
      if (rotation === 90) {
        angle = 1;
      } else if (rotation === 180) {
        angle = 2;
      } else {
        angle = 3;
      }
      const rotated = nextImage.rot(angle);
      nextImage = rotated;
      this.allocated.push(nextImage);
    }

    if (flipHorizontal) {
      const flippedHorizontally = nextImage.flip(0);
      nextImage = flippedHorizontally;
      this.allocated.push(nextImage);
    }

    if (flipVertical) {
      const flippedVertically = nextImage.flip(1);
      nextImage = flippedVertically;
      this.allocated.push(nextImage);
    }

    return new VipsImageBuilder(nextImage, this.allocated);
  };

  public readonly encode = ({
    format,
    quality = 100,
  }: {
    format: ImageFormat;
    quality?: number;
  }): Uint8Array => {
    switch (format) {
      case 'jpeg': {
        return this.image.jpegsaveBuffer({ Q: quality });
      }
      case 'png': {
        // Note: PNG compression doesn't reduce image quality, it just makes the
        // encoder work harder.
        return this.image.pngsaveBuffer({
          // Note: PNG is lossless when palette is false
          palette: quality < 100,
          compression: 9,
          Q: quality,
        });
      }
      case 'webp': {
        return this.image.webpsaveBuffer({ Q: quality });
      }
      case 'avif': {
        return this.image.heifsaveBuffer({ compression: 'av1', Q: quality });
      }
      case 'gif': {
        return this.image.gifsaveBuffer();
      }
      case 'tiff': {
        return this.image.tiffsaveBuffer({ compression: 'deflate', level: 9 });
      }
      case 'bmp': {
        return encodeBmp(this.image);
      }
      default: {
        throw new Error(`Unsupported format: ${format}`);
      }
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
