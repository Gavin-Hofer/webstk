'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileDownIcon } from 'lucide-react';

import type { ImageFile } from '@/hooks/use-persistent-files';
import type { ImageFormat } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { convertImageCanvasAPI } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';

import { FormatSelect } from './format-select';

export const DownloadAllButton: React.FC<{ images: ImageFile[] }> = ({
  images,
}) => {
  const [format, setFormat] = useState<ImageFormat | undefined>('png');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const mutation = useMutation({
    async mutationFn(images: ImageFile[]) {
      // Convert images one at a time to avoid locking up the browser.
      setDownloadProgress(0);
      if (!images.every((image) => image.ready)) {
        console.warn('Images not ready');
        return;
      }
      for (const image of images) {
        await convertImageCanvasAPI(image.file, { format }).then(downloadFile);
        setDownloadProgress((prev) => prev + 1);
      }
    },
    onSettled() {
      setDownloadProgress(0);
    },
  });

  const allReady = images.every((image) => image.ready);
  const disabled = !allReady || !format || mutation.isPending;

  return (
    <div className='text-primary-foreground relative flex h-12 w-full flex-row text-lg sm:w-72'>
      <button
        onClick={() => mutation.mutate(images)}
        className={cn(
          buttonVariants(),
          'h-full w-full items-center rounded-r-none pl-8 text-lg sm:w-fit [&_svg]:size-6',
        )}
        disabled={disabled}
      >
        <div
          className={cn(
            'absolute flex h-full w-full items-center justify-center gap-2',
            'absolute right-1/2 left-1/2 -translate-x-1/2',
            'sm:static sm:translate-x-0',
          )}
        >
          <FileDownIcon />
          Download All
        </div>
      </button>
      <FormatSelect
        format={format}
        setFormat={setFormat}
        className={cn(
          buttonVariants(),
          'h-full rounded-l-none border-none focus-visible:ring-0 focus-visible:ring-offset-0',
        )}
        disabled={disabled}
      />
    </div>
  );
};
