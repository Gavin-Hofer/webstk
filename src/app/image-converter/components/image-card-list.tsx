'use client';

import { useState } from 'react';
import { Loader2, XIcon, FileDownIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

import type { ManagedImage } from '@/hooks/use-persistent-images';
import type { ImageFormat } from '@/lib/client/image-tools';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { convertImageCanvasAPI } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';

import { FormatSelect } from './format-select';

// #region Component
// =============================================================================

export const ImageCardList: React.FC<{
  images: ManagedImage[];
}> = ({ images }) => {
  return (
    <div
      className={cn(
        'my-8 flex max-h-[calc(100vh-25rem)] flex-col gap-4 overflow-auto shadow-md',
        images.length > 0 && 'min-h-14',
        images.length > 1 && 'min-h-32',
        images.length > 2 && 'min-h-50',
        images.length > 3 && 'min-h-64',
      )}
    >
      {images.map((image) => (
        <ImageRow key={image.id} image={image} />
      ))}
    </div>
  );
};

// #region Subcomponents
// =============================================================================

const ImageRow: React.FC<{
  image: ManagedImage;
}> = ({ image }) => {
  const mutation = useMutation({
    async mutationFn(image: ManagedImage) {
      const file = await convertImageCanvasAPI(image.file, {
        format: image.format,
      });
      downloadFile(file);
    },
  });

  return (
    <div className='bg-accent relative flex flex-col items-center justify-between gap-4 p-2 shadow-md sm:flex-row'>
      <div className='flex w-full flex-row items-center justify-between gap-4'>
        <div className='flex items-center gap-4 sm:flex-row'>
          {!image.ready && (
            <div className='flex h-8 w-8 items-center justify-center rounded-md bg-gray-200'>
              <Loader2 className='text-accent-foreground animate-spin' />
            </div>
          )}
          {image.ready && (
            <img
              src={URL.createObjectURL(image.preview)}
              alt={image.file.name}
              className='aspect-square h-8 w-8 rounded-md object-cover'
            />
          )}
          <span className='max-w-[200px] truncate text-nowrap md:max-w-[300px] lg:max-w-[400px] xl:max-w-full'>
            {image.file.name}
          </span>
        </div>
        <Button
          variant='ghost'
          className='text-red-500 sm:hidden [&_svg]:size-6'
          onClick={() => image.remove()}
        >
          <XIcon strokeWidth={2} />
        </Button>
      </div>
      <div className='flex w-full items-center justify-end gap-4'>
        <FormatSelect format={image.format} setFormat={image.setFormat} />
        <Button
          disabled={!image.ready || mutation.isPending}
          onClick={() => mutation.mutate(image)}
          className='w-36'
        >
          {!mutation.isPending && (
            <>
              <FileDownIcon />
              Download
            </>
          )}
          {mutation.isPending && <Loader2 className='animate-spin' />}
        </Button>
        <Button
          variant='ghost'
          className='hidden text-red-500 sm:inline [&_svg]:size-6'
          onClick={() => image.remove()}
        >
          <XIcon strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
};
