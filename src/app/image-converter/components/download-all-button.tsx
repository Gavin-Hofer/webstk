'use client';

import { FileDownIcon, Loader2 } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';

import type { ManagedImage } from '@/hooks/use-persistent-images';
import type { ImageFormat } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { FormatSelect } from './format-select';
import { useDownloadAll } from './hooks';

export const DownloadAllButton: React.FC<{ images: ManagedImage[] }> = ({
  images,
}) => {
  const [format, setFormat] = useLocalStorage<ImageFormat | undefined>(
    'preferred-image-format',
    'png',
  );
  const download = useDownloadAll(format ?? 'png');

  const allReady = images.every((image) => image.ready);
  const disabled = !allReady || !format || download.isPending;
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
        onClick={() => download.mutate(images)}
        className={cn(
          'h-11 flex-1 rounded-l-full rounded-r-none sm:w-40',
          'border-none bg-transparent shadow-none',
          'hover:bg-transparent',
        )}
        disabled={disabled}
        size='lg'
      >
        {!download.isPending && (
          <>
            <FileDownIcon className='h-5 w-5' />
            Download All
          </>
        )}
        {download.isPending && (
          <>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span className='tabular-nums'>
              {download.progress}/{numImages}
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
