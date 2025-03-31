'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileDownIcon } from 'lucide-react';

import type { ManagedImage } from '@/hooks/use-persistent-images';
import type { ImageFormat } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { convertImageCanvasAPI } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';
import { promisePool } from '@/lib/promises/promise-pool';

import { FormatSelect } from './format-select';

export const DownloadAllButton: React.FC<{ images: ManagedImage[] }> = ({
  images,
}) => {
  const [format, setFormat] = useState<ImageFormat | undefined>('png');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const mutation = useMutation({
    async mutationFn(images: ManagedImage[]) {
      // Convert images one at a time to avoid locking up the browser.
      setDownloadProgress(0);
      if (!images.every((image) => image.ready)) {
        console.warn('Images not ready');
        return;
      }
      // Limit to processing up to 10 images concurrently.
      const tasks = images.map((image) => {
        return async () => {
          const file = await convertImageCanvasAPI(image.file, { format });
          downloadFile(file);
          setDownloadProgress((prev) => prev + 1);
        };
      });
      await promisePool(tasks, 10);
    },
    onSettled() {
      setDownloadProgress(0);
    },
  });

  const allReady = images.every((image) => image.ready);
  const disabled = !allReady || !format || mutation.isPending;
  const numImages = images.length;

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
            'absolute flex w-32 items-center justify-center gap-2',
            'absolute right-1/2 left-1/2 -translate-x-1/2',
            'sm:static sm:translate-x-0',
          )}
        >
          {!mutation.isPending && (
            <>
              <FileDownIcon />
              Download All
            </>
          )}
          {mutation.isPending && (
            <>
              Converting ({downloadProgress} / {numImages})
            </>
          )}
        </div>
      </button>
      <FormatSelect
        format={format}
        setFormat={setFormat}
        className={cn(
          buttonVariants(),
          'h-full rounded-l-none',
          'border-none outline-none',
          'focus:ring-0 focus:ring-offset-0',
          'focus-visible:ring-0 focus-visible:ring-offset-0',
        )}
        disabled={disabled}
      />
    </div>
  );
};
