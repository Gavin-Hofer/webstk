import type { ImageFormat } from './image-formats';

export type ConvertImageOptions = {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  filename?: string;
};
