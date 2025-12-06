'use client';

import { useState, useRef } from 'react';
import { Loader2, XIcon, FileDownIcon, PencilIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

import type { ManagedImage } from '@/hooks/use-persistent-images';
import { Input } from '@/components/ui/input';

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

const DownloadImageButton: React.FC<{
  disabled: boolean;
  onClick: () => void;
  isPending: boolean;
}> = ({ disabled, onClick, isPending }) => {
  return (
    <Button disabled={disabled} onClick={onClick} className='w-36'>
      {!isPending && (
        <>
          <FileDownIcon />
          Download
        </>
      )}
      {isPending && <Loader2 className='animate-spin' />}
    </Button>
  );
};

const RemoveImageButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className }) => {
  return (
    <Button
      variant='ghost'
      className={cn('text-destructive [&_svg]:size-6', className)}
      onClick={onClick}
    >
      <XIcon strokeWidth={2} />
    </Button>
  );
};

const ImageFilenameEditor: React.FC<{
  filename: string;
  setFilename: (name: string) => void;
}> = ({ filename, setFilename }) => {
  const ref = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<boolean>(false);

  const handleSubmit: React.FormEventHandler = (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const newFilename = formData.get('filename') as string | null;
    if (newFilename) {
      setFilename(newFilename);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className='hover:bg-primary/10 flex min-w-0 cursor-pointer flex-row items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors duration-500 ease-out'
        type='button'
        onClick={() => setEditing(true)}
      >
        <span className='truncate'>{filename}</span>
        <PencilIcon className='size-4 flex-shrink-0' />
      </button>
    );
  }
  return (
    <form
      ref={ref}
      onSubmit={handleSubmit}
      onBlur={handleSubmit}
      className='flex w-full flex-row items-center gap-2'
    >
      <Input
        name='filename'
        className='w-full flex-grow'
        value={filename}
        onChange={(event) => setFilename(event.target.value)}
        autoFocus
      />
      <Button variant='secondary' type='submit'>
        Save
      </Button>
    </form>
  );
};

const ImageRow: React.FC<{
  image: ManagedImage;
}> = ({ image }) => {
  const mutation = useMutation({
    async mutationFn(image: ManagedImage) {
      const file = await convertImageCanvasAPI(image.file, {
        format: image.format,
        filename: image.filename,
      });
      downloadFile(file);
    },
  });

  return (
    <div className='bg-accent relative flex flex-col items-center justify-between gap-4 p-2 shadow-md sm:flex-row'>
      <div className='flex w-full flex-row items-center justify-between gap-4'>
        <div className='flex flex-1 items-center gap-4 sm:flex-row'>
          {!image.ready && (
            <div className='bg-muted flex h-8 w-8 items-center justify-center rounded-md'>
              <Loader2 className='text-accent-foreground animate-spin' />
            </div>
          )}
          {image.ready && (
            <img // @eslint-disable  @next/next/no-img-element
              src={URL.createObjectURL(image.preview)}
              alt={image.file.name}
              className='aspect-square h-8 w-8 min-w-8 rounded-md object-cover'
            />
          )}
          <ImageFilenameEditor
            filename={image.filename}
            setFilename={image.setFilename}
          />
        </div>
        <RemoveImageButton
          onClick={() => image.remove()}
          className='inline sm:hidden'
        />
      </div>
      <div className='flex w-full items-center justify-end gap-4'>
        <FormatSelect format={image.format} setFormat={image.setFormat} />
        <DownloadImageButton
          disabled={!image.ready || mutation.isPending}
          isPending={mutation.isPending}
          onClick={() => mutation.mutate(image)}
        />
        <RemoveImageButton
          onClick={() => image.remove()}
          className='hidden sm:inline'
        />
      </div>
    </div>
  );
};
