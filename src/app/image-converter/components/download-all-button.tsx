'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileDownIcon, Loader2 } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';

import { useContextRequired } from '@/hooks/use-context-required';
import type { ManagedImage } from '@/hooks/use-persistent-images';
import type { ImageFormat } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { convertImageFFmpeg } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';
import { promisePool } from '@/lib/promises/promise-pool';
import { FFmpegContext } from '@/components/context/ffmpeg';

import { FormatSelect } from './format-select';

export const DownloadAllButton: React.FC<{ images: ManagedImage[] }> = ({
  images,
}) => {
  const { loadFFmpeg } = useContextRequired(FFmpegContext);
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
      const ffmpeg = await loadFFmpeg();
      // FFmpeg WASM is single-threaded, so process one at a time.
      const tasks = images.map((image) => {
        return async () => {
          const file = await convertImageFFmpeg(ffmpeg, image.file, {
            format,
            filename: image.filename,
          });
          downloadFile(file);
          setDownloadProgress((prev) => prev + 1);
        };
      });
      // Process sequentially since FFmpeg WASM doesn't support concurrent operations
      await promisePool(tasks, 1);
    },
    onSettled() {
      setDownloadProgress(0);
    },
  });

  const allReady = images.every((image) => image.ready);
  const disabled = !allReady || !format || mutation.isPending;
  const numImages = images.length;

  return (
    <div
      className={cn(
        'flex w-full flex-row sm:w-auto',
        'border-primary/50 bg-primary/10 rounded-full border',
        'shadow-primary/10 shadow-sm',
        'transition-all duration-300 ease-out',
        !disabled && 'hover:border-primary/70 hover:bg-primary/15',
        disabled && 'opacity-50',
      )}
    >
      <Button
        onClick={() => mutation.mutate(images)}
        className={cn(
          'h-11 flex-1 rounded-l-full rounded-r-none sm:w-40',
          'border-none bg-transparent shadow-none',
          'hover:bg-transparent',
        )}
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
      <div className='bg-primary/30 my-2 w-px' />
      <FormatSelect
        format={format}
        setFormat={setFormat}
        className={cn(
          'h-11 w-fit min-w-20 rounded-l-none rounded-r-full',
          'text-primary border-none bg-transparent shadow-none',
          'focus:ring-0 focus:ring-offset-0',
          'focus-visible:ring-0 focus-visible:ring-offset-0',
        )}
        disabled={disabled}
      />
    </div>
  );
};
