import type { ImageFormat } from '@/lib/vips';

export type ImageCropOptions = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ImageResizeOptions = {
  width?: number;
  height?: number;
};

export type ImageTouchupOptions = {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpen?: number;
};

export type ImageTransformOptions = {
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
};

export type ImageEditOptions = {
  crop?: ImageCropOptions;
  resize?: ImageResizeOptions;
  touchup?: ImageTouchupOptions;
  transform?: ImageTransformOptions;
};

export type ConvertImageOptions = {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  thumbnail?: boolean;
  filename?: string;
  edits?: ImageEditOptions;
};
