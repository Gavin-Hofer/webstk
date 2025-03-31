'use client';

import type { NextPage } from 'next';

import { FileUpIcon, ScanLineIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { usePersistentImages } from '@/hooks/use-persistent-images';

import { Dropzone } from '@/components/ui/dropzone';

import { ImageCardList } from './components/image-card-list';
import { AddImageFilesInput } from './components/add-image-files-input';
import { DownloadAllButton } from './components/download-all-button';

// #region Page
// =============================================================================

const Page: NextPage = () => {
  const [images, addFiles] = usePersistentImages();
  return (
    <Dropzone
      className='m-4 flex min-h-[calc(100vh-10rem)] w-full max-w-7xl flex-col gap-4'
      onChange={addFiles}
    >
      <h1 className='text-2xl font-bold'>Image Converter</h1>
      <ImageCardList images={images} />
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-4 sm:flex-row',
          images.length && 'justify-between',
        )}
      >
        <AddImageFilesInput onChange={addFiles} />
        {images.length > 0 && <DownloadAllButton images={images} />}
      </div>
    </Dropzone>
  );
};

export default Page;
