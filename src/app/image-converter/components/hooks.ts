import { ManagedImage } from '@/hooks/use-persistent-images';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useFFmpeg } from '@/hooks/use-ffmpeg';
import { useDebounceValue } from 'usehooks-ts';
import type { QueryFunction } from '@tanstack/react-query';
import { ImageFormat, convertImageFFmpeg } from '@/lib/client/image-tools';
import { useEffect, useState } from 'react';
import { downloadFile } from '@/lib/client/download-file';
import { FFmpeg } from '@ffmpeg/ffmpeg';

/** Formats a file size in bytes to a human readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getQueryKey(image: ManagedImage) {
  return [[image.id, image.format, image.quality]];
}

async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<Awaited<T>> {
  const {
    attempts = 5,
    delay = 50,
    backoff = 2,
    shouldRetry = () => true,
  } = options;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || attempt == attempts) {
        throw error;
      }
      const sleepTime = delay * attempt ** backoff;
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }
  }
  throw new Error('EXPECTED UNREACHABLE');
}

function getQueryFn(
  image: ManagedImage,
  loadFFmpeg: () => Promise<FFmpeg>,
  terminateFFmpeg: () => void,
): QueryFunction<File> {
  const convertImage = async (signal: AbortSignal) => {
    signal.addEventListener('abort', terminateFFmpeg);
    try {
      const ffmpeg = await loadFFmpeg();
      const file = await convertImageFFmpeg(ffmpeg, image.file, {
        format: image.format,
        filename: image.filename,
        quality: image.quality,
      });
      return file;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('called FFmpeg.terminate()')
      ) {
        throw error;
      }
      // Force ffmpeg to reload so we can have a fresh instance on the next
      // attempt.
      terminateFFmpeg();
      console.error('Error converting image:', error);
      throw error;
    } finally {
      signal.removeEventListener('abort', terminateFFmpeg);
    }
  };

  return ({ signal }) => {
    return retry(() => convertImage(signal), {
      shouldRetry: () => !signal.aborted,
    });
  };
}

export function useConvertImage(image: ManagedImage) {
  const { load, terminate } = useFFmpeg();
  const queryClient = useQueryClient();

  // Debounce the query key to prevent lots of requests to start converting
  // when changing the slider value.
  const queryKey = useDebounceValue(getQueryKey(image), 500);
  const queryFn = getQueryFn(image, load, terminate);

  // Optimistically start converting as soon as the image is ready
  const convertQuery = useQuery({ queryKey, queryFn, enabled: image.ready });

  // Use a mutation to download the image
  const downloadMutation = useMutation({
    async mutationFn() {
      const file = await queryClient.ensureQueryData({ queryKey, queryFn });
      downloadFile(file);
    },
  });

  const formattedFileSize =
    convertQuery.data ? formatFileSize(convertQuery.data.size) : undefined;
  const [lastFormattedFileSize, setLastFormattedFileSize] =
    useState(formattedFileSize);
  useEffect(() => {
    if (formattedFileSize) {
      setLastFormattedFileSize(formattedFileSize);
    }
  }, [formattedFileSize]);

  return {
    conversion: convertQuery,
    download: downloadMutation,
    formattedFileSize,
    lastFormattedFileSize,
  };
}

export type UseDownloadAllProps = {
  images: ManagedImage[];
  format: ImageFormat;
};

export function useDownloadAll(format: ImageFormat) {
  const { load, terminate } = useFFmpeg();
  const queryClient = useQueryClient();

  const [progress, setProgress] = useState(0);
  const download = useMutation({
    async mutationFn(images: ManagedImage[]) {
      // Convert images one at a time to avoid locking up the browser.
      setProgress(0);
      if (!images.every((image) => image.ready)) {
        console.warn('Images not ready');
        return;
      }
      // Need to process serially because the ffmpeg WASM binding does not
      // multiple simultaneous conversions on one instance. However in reality,
      // images should not actually be converted here - we should just be
      // grabbing them from the query cache.
      for (const image of images) {
        const imageWithFormat = { ...image, format };
        const queryKey = getQueryKey(imageWithFormat);
        const queryFn = getQueryFn(image, load, terminate);
        const file = await queryClient.ensureQueryData({ queryKey, queryFn });
        downloadFile(file);
        setProgress((prev) => prev + 1);
      }
    },
    onSettled() {
      setProgress(0);
    },
  });

  return { ...download, progress };
}
