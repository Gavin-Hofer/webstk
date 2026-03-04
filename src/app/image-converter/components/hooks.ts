import { useState } from 'react';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { QueryFunction } from '@tanstack/react-query';
import { useDebounceValue } from 'usehooks-ts';

import { useErrorNotification } from '@/hooks/use-error-notification';
import type { ManagedImage } from '@/hooks/use-persistent-images';
import { usePreviousValue } from '@/hooks/use-previous-value';
import { downloadFile, downloadFiles } from '@/lib/download-file';
import { convertImage } from '@/lib/image-tools';
import type { ImageTransformations } from '@/lib/image-tools/types';
import { replaceFileExtension } from '@/lib/utils';
import type { ImageFormat } from '@/lib/vips';

/** Formats a file size in bytes to a human readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSourceKey(file: File) {
  return [file.name, file.size, file.lastModified].join(':');
}

function getQueryKey(
  imageId: string,
  file: File,
  filename: string,
  transformations: ImageTransformations,
) {
  return [
    'convert-image',
    imageId,
    getSourceKey(file),
    filename,
    transformations,
  ];
}

function getQueryFn(
  file: File,
  filename: string,
  transformations: ImageTransformations,
): QueryFunction<File> {
  return ({ signal }) => {
    return convertImage(
      file,
      {
        format: transformations.format,
        quality: transformations.quality,
        edits: transformations.edits,
        filename: replaceFileExtension(filename, transformations.format),
      },
      { signal },
    );
  };
}

export function useConvertImage(image: ManagedImage) {
  const queryClient = useQueryClient();

  const [queryKey] = useDebounceValue(
    getQueryKey(
      image.id,
      image.originalFile,
      image.filename,
      image.transformations,
    ),
    100,
  );
  const queryFn = getQueryFn(
    image.originalFile,
    image.filename,
    image.transformations,
  );

  const convertQuery = useQuery({
    queryKey: [queryKey],
    queryFn,
    enabled: image.ready,
    placeholderData: keepPreviousData,
  });
  useErrorNotification(convertQuery.error);

  const downloadMutation = useMutation({
    async mutationFn() {
      const file = await queryClient.ensureQueryData({
        queryKey: [queryKey],
        queryFn,
      });
      await downloadFile(file);
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
      const files: File[] = [];
      await Promise.allSettled(
        images.map(async (image) => {
          const resolvedFormat =
            format === 'current' ? image.transformations.format : format;
          const transformations = {
            ...image.transformations,
            format: resolvedFormat,
          };
          const queryKey = [
            getQueryKey(
              image.id,
              image.originalFile,
              image.filename,
              transformations,
            ),
          ];
          const queryFn = getQueryFn(
            image.originalFile,
            image.filename,
            transformations,
          );
          const file = await queryClient.ensureQueryData({ queryKey, queryFn });
          files.push(file);
          setProgress((prev) => prev + 1);
        }),
      );
      await downloadFiles(files);
    },
    onSettled() {
      setProgress(0);
    },
  });

  useErrorNotification(download.error);

  return { ...download, progress };
}
