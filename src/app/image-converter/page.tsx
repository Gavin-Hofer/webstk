'use client';

import type { NextPage } from 'next';
import { useState, useEffect } from 'react';

import {
  convertImage,
  IMAGE_FORMATS,
  type ImageFormat,
} from '@/lib/client/image-tools';
import { replaceFileExtension } from '@/lib/utils';

// #region Page
// =============================================================================

const Page: NextPage = () => {
  const [files, setFiles] = useState<File[]>([]);
  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const files: File[] = [];
    for (let file of event.target.files ?? []) {
      if (!file.type.startsWith('image/')) {
        continue;
      }
      if (file.type.endsWith('heic') || file.type.endsWith('heif')) {
        const { default: heic2any } = await import('heic2any');
        const blob = heic2any({
          blob: file,
          toType: 'image/png',
        });
      }
    }
  };

  return (
    <div className='m-4 flex w-full flex-col gap-4'>
      <h1 className='text-2xl font-bold'>Image Converter</h1>
      <input type='file' accept='image/*' onChange={handleInputChange} />
    </div>
  );
};

export default Page;

// #region Helper Functions
// =============================================================================

/** Converts the image to a supported type if necessary. */
async function loadImage(file: File): Promise<File | null> {
  if (!file.type.startsWith('image/')) {
    return null;
  }
  if (file.type.endsWith('heic') || file.type.endsWith('heif')) {
    // Need to convert to a type supported by native browser APIs
    const { default: heic2any } = await import('heic2any');
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
async function loadImages(fileList: FileList): Promise<File[]> {
  const files = await Promise.all([...fileList].map(loadImage))
  return files.filter((file) => file !== null);
}
