'use client';

import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  convertImage,
  type ImageFormat,
  IMAGE_FORMATS,
} from '@/lib/client/image-tools';
import { replaceFileExtension } from '@/lib/utils';
import { useMutex } from '@/hooks/use-mutex';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { downloadFile } from '@/lib/client/download-file';

// #region Page
// =============================================================================

const Page: NextPage = () => {
  const [files, setFiles] = useState<File[]>([]);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (!event.target.files) {
      return;
    }
    const fileList = Array.from(event.target.files).filter((file) => file);
    setFiles((curr) => [...curr, ...fileList]);
  };

  return (
    <div className='m-4 flex w-full flex-col gap-4'>
      <h1 className='text-2xl font-bold'>Image Converter</h1>
      <ImageList files={files} />
      <div className='flex w-full justify-between'>
        <label
          className={cn(
            buttonVariants({ variant: 'default' }),
            'cursor-pointer',
          )}
        >
          Add Images
          <input
            type='file'
            accept='image/*'
            className='hidden'
            onChange={handleInputChange}
            multiple
          />
        </label>
      </div>
    </div>
  );
};

export default Page;

// #region Subcomponents
// =============================================================================

function isHeic(file: File) {
  return file.type === 'image/heic' || file.type === 'image/heif';
}

const ImageRow: React.FC<{
  file: File;
  mutex: ReturnType<typeof useMutex>;
}> = ({ file, mutex }) => {
  const [loadedFile, setLoadedFile] = useState(() =>
    isHeic(file) ? null : file,
  );
  useEffect(() => {
    if (isHeic(file)) {
      setLoadedFile(null);
      loadImage(file, mutex).then(setLoadedFile);
    } else {
      setLoadedFile(file);
    }
  }, [file]);

  const [format, setFormat] = useState<ImageFormat | undefined>();
  const { mutate: handleDownload, isPending } = useMutation({
    async mutationFn() {
      if (!loadedFile || !format) {
        return;
      }
      const convertedFile = await convertImage(loadedFile, { format });
      downloadFile(convertedFile);
    },
  });

  return (
    <div className='flex flex-row items-center justify-evenly bg-accent p-2 shadow-md'>
      {!loadedFile && <Loader2 className='animate-spin' />}
      {loadedFile && (
        <img
          src={URL.createObjectURL(loadedFile)}
          alt={file.name}
          className='aspect-square h-8 w-8 object-cover'
        />
      )}
      <Select value={format} onValueChange={(f: ImageFormat) => setFormat(f)}>
        <SelectTrigger className='w-[180px]'>
          <SelectValue placeholder='Convert to?' />
        </SelectTrigger>
        <SelectContent>
          {IMAGE_FORMATS.map((fmt) => (
            <SelectItem key={fmt} value={fmt}>
              {fmt.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        disabled={!loadedFile || !format || isPending}
        onClick={() => handleDownload()}
      >
        Download
      </Button>
    </div>
  );
};

const ImageList: React.FC<{ files: File[] }> = ({ files }) => {
  const mutex = useMutex(30);
  return (
    <div className='flex h-64 flex-col gap-4 overflow-auto'>
      {files.map((file, i) => (
        <ImageRow key={`${i}:${file.name}`} file={file} mutex={mutex} />
      ))}
    </div>
  );
};

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
