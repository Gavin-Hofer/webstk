'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, XIcon, FileDownIcon, PencilIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ManagedImage } from '@/hooks/use-persistent-images';
import { Input } from '@/components/ui/input';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { convertImageFFmpeg } from '@/lib/client/image-tools';
import { downloadFile } from '@/lib/client/download-file';
import { useContextRequired } from '@/hooks/use-context-required';
import { FFmpegContext } from '@/components/context/ffmpeg';

import { FormatSelect } from './format-select';

// #region Subcomponents
// =============================================================================

const DownloadImageButton: React.FC<{
  disabled: boolean;
  onClick: () => void;
  isPending: boolean;
}> = ({ disabled, onClick, isPending }) => {
  return (
    <Button disabled={disabled} onClick={onClick} className='w-32 sm:w-36'>
      {!isPending && (
        <>
          <FileDownIcon className='h-4 w-4' />
          <span className='hidden sm:inline'>Download</span>
          <span className='sm:hidden'>Save</span>
        </>
      )}
      {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
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
      size='icon'
      className={cn(
        'text-muted-foreground hover:text-destructive h-9 w-9',
        className,
      )}
      onClick={onClick}
      aria-label='Remove image'
    >
      <XIcon className='h-5 w-5' />
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
        className={cn(
          'flex min-w-0 cursor-pointer flex-row items-center gap-2 rounded-md px-2 py-1',
          'text-left transition-colors duration-200',
          'hover:bg-secondary',
        )}
        type='button'
        onClick={() => setEditing(true)}
      >
        <span className='truncate text-sm'>{filename}</span>
        <PencilIcon className='text-muted-foreground h-3 w-3 flex-shrink-0' />
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
        className='h-8 w-full flex-grow text-sm'
        value={filename}
        onChange={(event) => setFilename(event.target.value)}
        autoFocus
      />
      <Button variant='secondary' type='submit' size='sm'>
        Save
      </Button>
    </form>
  );
};

const ImageRow: React.FC<{
  image: ManagedImage;
}> = ({ image }) => {
  const { loadFFmpeg } = useContextRequired(FFmpegContext);
  const queryClient = useQueryClient();

  const queryKey = [image.id, image.format];
  const queryFn = async () => {
    const ffmpeg = await loadFFmpeg();
    const file = await convertImageFFmpeg(ffmpeg, image.file, {
      format: image.format,
      filename: image.filename,
    });
    return file;
  };

  // Optimistically start converting as soon as the image is ready
  useQuery({ queryKey, queryFn, enabled: image.ready });

  const downloadMutation = useMutation({
    async mutationFn() {
      const file = await queryClient.ensureQueryData({ queryKey, queryFn });
      downloadFile(file);
    },
  });

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-between gap-3 p-3 sm:flex-row',
        'border-border bg-card/50 rounded-lg border',
        'hover:bg-card transition-colors duration-200',
      )}
    >
      {/* Left side: thumbnail + filename */}
      <div className='flex w-full flex-row items-center gap-3 sm:w-auto sm:flex-1'>
        {/* Thumbnail */}
        {!image.ready && (
          <div className='bg-secondary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md'>
            <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          </div>
        )}
        {image.ready && (
          <img // @eslint-disable  @next/next/no-img-element
            src={URL.createObjectURL(image.preview)}
            alt={image.file.name}
            className='h-10 w-10 flex-shrink-0 rounded-md object-cover'
          />
        )}
        {/* Filename */}
        <div className='min-w-0 flex-1'>
          <ImageFilenameEditor
            filename={image.filename}
            setFilename={image.setFilename}
          />
        </div>
        {/* Mobile remove button */}
        <RemoveImageButton
          onClick={() => image.remove()}
          className='sm:hidden'
        />
      </div>

      {/* Right side: format select + download + remove */}
      <div className='flex w-full items-center justify-end gap-2 sm:w-auto'>
        <FormatSelect format={image.format} setFormat={image.setFormat} />
        <DownloadImageButton
          disabled={!image.ready || downloadMutation.isPending}
          isPending={downloadMutation.isPending}
          onClick={() => downloadMutation.mutate()}
        />
        <RemoveImageButton
          onClick={() => image.remove()}
          className='hidden sm:flex'
        />
      </div>
    </div>
  );
};

// #endregion

// #region Main Component
// =============================================================================

export const ImageCardList: React.FC<{
  images: ManagedImage[];
}> = ({ images }) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 overflow-auto rounded-lg',
        images.length > 3 && 'max-h-[50vh]',
      )}
    >
      {images.map((image) => (
        <ImageRow key={image.id} image={image} />
      ))}
    </div>
  );
};

// #endregion
