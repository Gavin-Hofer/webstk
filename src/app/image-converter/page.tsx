'use client';

import type { NextPage } from 'next';
import { useState } from 'react';

import { Loader2, FileUpIcon, XIcon, FileDownIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  convertImageCanvasAPI,
  type ImageFormat,
  IMAGE_FORMATS,
} from '@/lib/client/image-tools';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { downloadFile } from '@/lib/client/download-file';
import {
  usePersistentImages,
  type ImageFile,
} from '@/hooks/use-persistent-files';

// #region Page
// =============================================================================

const Page: NextPage = () => {
  const [images, addFiles, removeImage] = usePersistentImages();
  const [format, setFormat] = useState<ImageFormat | undefined>('png');

  const allReady = images.every((image) => image.ready);
  const handleDownload = () => {
    if (!allReady) {
      return;
    }
    images.forEach((image) =>
      convertImageCanvasAPI(image.file, { format }).then(downloadFile),
    );
  };

  return (
    <div className='m-4 flex w-full max-w-7xl flex-col gap-4'>
      <h1 className='text-2xl font-bold'>Image Converter</h1>
      <ImageList images={images} removeImage={removeImage} />
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-4 sm:flex-row',
          images.length && 'justify-between',
        )}
      >
        <label
          className={cn(
            buttonVariants({ variant: 'default' }),
            'h-12 w-full cursor-pointer px-8 text-lg sm:w-fit [&_svg]:size-6',
          )}
        >
          <FileUpIcon />
          Add image files
          <input
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(event) => addFiles(event.target.files)}
            multiple
          />
        </label>

        {images.length > 0 && (
          <div
            className={cn(
              'text-primary-foreground relative flex h-12 w-full flex-row text-lg sm:w-72',
            )}
          >
            <button
              onClick={handleDownload}
              disabled={!allReady || !format}
              className='bg-primary flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg text-lg transition-colors duration-500 ease-out hover:bg-zinc-800 disabled:cursor-default sm:rounded-r-none [&_svg]:size-6'
            >
              <FileDownIcon />
              Download All
            </button>
            <FormatSelect
              format={format}
              setFormat={setFormat}
              className='bg-primary absolute top-0 right-0 mx-0 h-12 w-20 flex-shrink-0 rounded-none rounded-r-lg border-none transition-colors duration-500 ease-out hover:bg-zinc-800 focus:outline-none sm:hidden'
            />
            <FormatSelect
              format={format}
              setFormat={setFormat}
              className='bg-primary mx-0 hidden h-12 w-20 flex-shrink-0 rounded-none rounded-r-lg border-none transition-colors duration-500 ease-out hover:bg-zinc-800 focus:outline-none sm:flex'
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;

// #region Subcomponents
// =============================================================================

const FormatSelect: React.FC<{
  children?: React.ReactNode;
  format: ImageFormat | undefined;
  setFormat: (format: ImageFormat) => void;
  className?: string;
}> = ({ children, format, setFormat, className }) => {
  return (
    <Select value={format} onValueChange={(f: ImageFormat) => setFormat(f)}>
      <SelectTrigger className={cn('h-10 w-24 cursor-pointer', className)}>
        {children ?? <SelectValue placeholder='Format' />}
      </SelectTrigger>
      <SelectContent>
        {IMAGE_FORMATS.map((fmt) => (
          <SelectItem key={fmt} value={fmt}>
            {fmt.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

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

const ImageList: React.FC<{
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
