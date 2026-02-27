import { replaceFileExtension } from '@/lib/utils';

import type { ConvertImageOptions } from './types';
import { VipsImageBuilder } from './vips';

// #region Types
// =============================================================================

type WorkerRequest = {
  id: number;
  file: File;
  options: ConvertImageOptions;
};

export type WorkerResponse =
  | { id: number; file: File }
  | { id: number; error: string };

// #endregion

// #region Worker message handler
// =============================================================================

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, file, options } = e.data;
  try {
    const {
      format = 'webp',
      quality = 85,
      filename = replaceFileExtension(file.name, format),
      width,
      height,
    } = options;

    const imageBuilder = await VipsImageBuilder.fromFile(file);
    try {
      const result = imageBuilder
        .resize({ width, height })
        .toFile({ format, quality, filename });
      postMessage({ id, file: result } satisfies WorkerResponse);
    } finally {
      imageBuilder.dispose();
    }
  } catch (error) {
    postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
};

// #endregion
