'use client';

import { useState } from 'react';
import { Loader2, FileUpIcon, XIcon, FileDownIcon } from 'lucide-react';

import type { ImageFile } from '@/hooks/use-persistent-files';
import type { ImageFormat } from '@/lib/client/image-tools';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { convertImageCanvasAPI } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';

import { FormatSelect } from './format-select';

// #region Component
// =============================================================================

export const ImageCardList: React.FC<{
  images: ImageFile[];
  removeImage: (id: string) => void;
}> = ({ images, removeImage }) => {
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
        <ImageRow
          key={image.id}
          image={image}
          removeImage={() => removeImage(image.id)}
        />
      ))}
    </div>
  );
};

// #region Subcomponents
// =============================================================================

const ImageRow: React.FC<{
  image: ImageFile;
  removeImage: () => void;
}> = ({ image, removeImage }) => {
  const [format, setFormat] = useState<ImageFormat | undefined>('png');
  const handleDownload = () => {
    if (!image.ready || !format) {
      return;
    }
    convertImageCanvasAPI(image.file, { format }).then(downloadFile);
  };
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
          onClick={() => removeImage()}
        >
          <XIcon strokeWidth={2} />
        </Button>
      </div>
      <div className='flex w-full items-center justify-end gap-4'>
        <FormatSelect format={format} setFormat={setFormat} />
        <Button
          disabled={!image.ready || !format}
          onClick={() => handleDownload()}
        >
          <FileDownIcon />
          Download
        </Button>
        <Button
          variant='ghost'
          className='hidden text-red-500 sm:inline [&_svg]:size-6'
          onClick={() => removeImage()}
        >
          <XIcon strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
};
