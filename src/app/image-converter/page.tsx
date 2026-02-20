'use client';

import type { NextPage } from 'next';
import { ImageIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { usePersistentImages } from '@/hooks/use-persistent-images';

import { Dropzone } from '@/components/ui/dropzone';

import { ImageCardList } from './components/image-card-list';
import { AddImageFilesInput } from './components/add-image-files-input';
import { DownloadAllButton } from './components/download-all-button';

// #region Subcomponents
// =============================================================================

const EmptyState: React.FC = () => {
  return (
    <div className='border-border bg-card/30 flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center'>
      <div className='bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
        <ImageIcon className='text-primary h-8 w-8' />
      </div>
      <h3 className='mb-2 text-lg font-medium'>No images yet</h3>
      <p className='text-muted-foreground max-w-sm text-sm'>
        Drag and drop images here, or click the button below to select files
        from your device.
      </p>
    </div>
  );
};

type ImageConverterContentProps = {
  images: ReturnType<typeof usePersistentImages>[0];
  addFiles: ReturnType<typeof usePersistentImages>[1];
};

const ImageConverterContent: React.FC<ImageConverterContentProps> = ({
  images,
  addFiles,
}) => {
  return (
    <Dropzone className='flex min-h-[50vh] flex-col gap-4' onChange={addFiles}>
      {/* Empty state or image list */}
      {images.length === 0 && <EmptyState />}
      {images.length > 0 && <ImageCardList images={images} />}

      {/* Actions */}
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-4 sm:flex-row',
          images.length > 0 && 'justify-between',
        )}
      >
        <AddImageFilesInput onChange={addFiles} />
        {images.length > 0 && <DownloadAllButton images={images} />}
      </div>
    </Dropzone>
  );
};

// #endregion

// #region Page
// =============================================================================

const Page: NextPage = () => {
  const [images, addFiles] = usePersistentImages();
  return (
    <div className='flex w-full flex-col items-center px-4 py-12 sm:px-6 sm:py-16'>
      <div className='w-full max-w-4xl'>
        {/* Header */}
        <div className='mb-8 flex flex-col gap-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md'>
              <ImageIcon className='h-5 w-5' />
            </div>
            <h1 className='text-2xl font-bold'>Image Converter</h1>
          </div>
          <p className='text-muted-foreground text-sm'>
            Convert images between formats directly in your browser. Supports
            PNG, JPEG, WebP, GIF, TIFF, and AVIF. Drag and drop files anywhere
            on this page.
          </p>
        </div>
        <ImageConverterContent images={images} addFiles={addFiles} />
      </div>
    </div>
  );
};

export default Page;

// #endregion
