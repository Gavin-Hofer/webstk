import type { ImageFormat } from '@/lib/vips';

export type ConvertImageOptions = {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  filename?: string;
};
