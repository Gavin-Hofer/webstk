import { ManagedImage } from '@/hooks/use-persistent-images';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useDebounceValue } from 'usehooks-ts';
import type { QueryFunction } from '@tanstack/react-query';
import { ImageFormat } from '@/lib/client/image-tools';
import { useState } from 'react';
import { downloadFile } from '@/lib/client/download-file';
import { convertImage } from '@/lib/client/image-tools/convert-image';
import { useErrorNotification } from '@/hooks/use-error-notification';
import { replaceFileExtension } from '@/lib/utils';
import { usePreviousValue } from '@/hooks/use-previous-value';

/** Formats a file size in bytes to a human readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getQueryKey(image: ManagedImage) {
  return [[image.id, image.format, image.quality]];
}

function getQueryFn(image: ManagedImage): QueryFunction<File> {
  return ({ signal }) => {
    try {
      return convertImage(
        image.file,
        {
          format: image.format,
          filename: replaceFileExtension(image.filename, image.format),
          quality: image.quality,
        },
        { signal },
      );
    } catch (error) {
      console.error('Failed to convert image:', error);
      throw error;
    }
  };
}

export function useConvertImage(image: ManagedImage) {
  const queryClient = useQueryClient();

  // Debounce the query key to prevent lots of requests to start converting
  // when changing the slider value.
  const queryKey = useDebounceValue(getQueryKey(image), 100);
  const queryFn = getQueryFn(image);

  // Optimistically start converting as soon as the image is ready
  const convertQuery = useQuery({ queryKey, queryFn, enabled: image.ready });
  useErrorNotification(convertQuery.error);

  // Use a mutation to download the image
  const downloadMutation = useMutation({
    async mutationFn() {
      const file = await queryClient.ensureQueryData({ queryKey, queryFn });
      downloadFile(file);
    },
  });
  useErrorNotification(downloadMutation.error);

  const formattedFileSize =
    convertQuery.data ? formatFileSize(convertQuery.data.size) : undefined;
  const lastFormattedFileSize = usePreviousValue(formattedFileSize);

  return {
    conversion: convertQuery,
    download: downloadMutation,
    formattedFileSize,
    lastFormattedFileSize,
  };
}

export type DownloadAllFormat = ImageFormat | 'current';

export function useDownloadAll(format: DownloadAllFormat) {
  const queryClient = useQueryClient();

  const [progress, setProgress] = useState(0);
  const download = useMutation({
    async mutationFn(images: ManagedImage[]) {
      setProgress(0);
      if (!images.every((image) => image.ready)) {
        console.warn('Images not ready');
        return;
      }
      await Promise.allSettled(
        images.map(async (image) => {
          const resolvedFormat = format === 'current' ? image.format : format;
          const imageWithFormat = { ...image, format: resolvedFormat };
          const queryKey = getQueryKey(imageWithFormat);
          const queryFn = getQueryFn(imageWithFormat);
          const file = await queryClient.ensureQueryData({ queryKey, queryFn });
          downloadFile(file);
          setProgress((prev) => prev + 1);
        }),
      );
    },
    onSettled() {
      setProgress(0);
    },
  });

  useErrorNotification(download.error);

  return { ...download, progress };
}
