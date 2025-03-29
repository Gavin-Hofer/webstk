'use client';

import type { NextPage } from 'next';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { convertImage, type ImageFormat } from '@/lib/client/image-tools';
import { replaceFileExtension } from '@/lib/utils';
import { useMutex } from '@/hooks/use-mutex';
import { Button } from '@/components/ui/button';

// #region Page
// =============================================================================

const Page: NextPage = () => {
  const mutex = useMutex(30);
  const [outputFormat, setOutputFormat] = useState<ImageFormat>('png');

  const inputChangeMutation = useMutation({
    async mutationFn(fileList: FileList | null) {
      if (!fileList) {
        return;
      }
      const files = await loadImages(fileList, mutex);
      return files;
    },
  });

  const convertAndDownloadMutation = useMutation({
    async mutationFn(files: File[]) {
      return await Promise.all(
        files.map(async (file) => {
          const newFile = await convertImage(file, { format: outputFormat });
          const objectUrl = URL.createObjectURL(newFile);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = newFile.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);
          return newFile;
        }),
      );
    },
  });

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    inputChangeMutation.mutate(event.target.files);
  };

  const handleConvert = () => {
    if (imageFiles) {
      convertAndDownloadMutation.mutate(imageFiles);
    }
  };

  const imageFiles = inputChangeMutation.data;

  return (
    <div className='m-4 flex w-full flex-col gap-4'>
      <h1 className='text-2xl font-bold'>Image Converter</h1>
      <input
        type='file'
        accept='image/*'
        onChange={handleInputChange}
        multiple
      />

      <div className='flex flex-row gap-2'>
        <Button
          disabled={!imageFiles}
          onClick={handleConvert}
          className='w-fit'
        >
          Convert and Download
        </Button>
      </div>

      {inputChangeMutation.isPending && <Loader2 className='animate-spin' />}
      {imageFiles && (
        <ul className='list-disc'>
          {imageFiles.map((file) => (
            <li key={file.name}>{file.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Page;

// #region Helper Functions
// =============================================================================

/** Converts the image to a supported type if necessary. */
async function loadImage(
  file: File,
  mutex: ReturnType<typeof useMutex>,
): Promise<File | null> {
  if (!file.type.startsWith('image/')) {
    return null;
  }
  if (file.type.endsWith('heic') || file.type.endsWith('heif')) {
    // Need to convert to a type supported by native browser APIs
    // This is a heavy import, so avoid loading it more than once concurrently.
    const { default: heic2any } = await mutex.runExclusive(
      () => import('heic2any'),
    );
    const blob: Blob | Blob[] = await heic2any({
      blob: file,
      toType: 'image/png',
    });
    const blobs: Blob[] = Array.isArray(blob) ? blob : [blob];
    return new File(blobs, replaceFileExtension(file.name, 'png'), {
      type: 'image/png',
    });
  }
  return file;
}

/** Filters the list of images and converts any HEIC images to PNG. */
async function loadImages(
  fileList: FileList,
  mutex: ReturnType<typeof useMutex>,
): Promise<File[]> {
  const files = await Promise.all(
    [...fileList].map((file) => loadImage(file, mutex)),
  );
  return files.filter((file) => file !== null);
}
