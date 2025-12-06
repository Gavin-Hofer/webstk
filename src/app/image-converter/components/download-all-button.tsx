'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileDownIcon, Loader2 } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';

import type { ManagedImage } from '@/hooks/use-persistent-images';
import type { ImageFormat } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { convertImageCanvasAPI } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';
import { promisePool } from '@/lib/promises/promise-pool';

import { FormatSelect } from './format-select';

// #region Main Component
// =============================================================================

export const DownloadAllButton: React.FC<{ images: ManagedImage[] }> = ({
  images,
}) => {
  const [format, setFormat] = useLocalStorage<ImageFormat | undefined>(
    'preferred-image-format',
    'png',
  );

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
          const file = await convertImageCanvasAPI(image.file, {
            format,
            filename: image.filename,
          });
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
    <div className='flex w-full flex-row sm:w-auto'>
      <Button
        onClick={() => mutation.mutate(images)}
        className='h-11 flex-1 rounded-r-none sm:w-40'
        disabled={disabled}
        size='lg'
      >
        {!mutation.isPending && (
          <>
            <FileDownIcon className='h-5 w-5' />
            Download All
          </>
        )}
        {mutation.isPending && (
          <>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span className='tabular-nums'>
              {downloadProgress}/{numImages}
            </span>
          </>
        )}
      </Button>
      <FormatSelect
        format={format}
        setFormat={setFormat}
        className={cn(
          'h-11 min-w-20 rounded-l-none border-l-0',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'focus:ring-0 focus:ring-offset-0',
          'focus-visible:ring-0 focus-visible:ring-offset-0',
        )}
        disabled={disabled}
      />
    </div>
  );
};

// #endregion
