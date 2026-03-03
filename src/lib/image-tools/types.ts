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

export type ImageEditOptions = {
  crop?: ImageCropOptions;
  resize?: ImageResizeOptions;
  touchup?: ImageTouchupOptions;
};

export type ConvertImageOptions = {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  filename?: string;
  edits?: ImageEditOptions;
};
