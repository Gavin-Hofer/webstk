'use client';

import React, { useRef, useState } from 'react';

import {
  FileDownIcon,
  Loader2,
  PencilIcon,
  TriangleAlert,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FileImage } from '@/components/ui/file-image';
import { ImageViewerDialog } from '@/components/ui/image-viewer-dialog';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ManagedImage } from '@/hooks/use-persistent-images';
import { cn } from '@/lib/utils';
import { COMPRESSION_SUPPORTED, type ImageFormat } from '@/lib/vips';
import { FormatSelect } from './format-select';
import { useConvertImage } from './hooks';
import { ImageEditorDialog } from './image-editor-dialog';
import { QualitySlider } from './quality-slider';

// #region Subcomponents
// =============================================================================

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

  const handleSubmit = (event: React.SubmitEvent | React.FocusEvent) => {
    event.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
        onClick={() => {
          setEditing(true);
        }}
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
        onChange={(event) => {
          setFilename(event.target.value);
        }}
        autoFocus
      />
      <Button variant='secondary' type='submit' size='sm'>
        Save
      </Button>
    </form>
  );
};

const ImagePreview: React.FC<{
  image: ManagedImage;
  convertedFile?: File;
}> = ({ image, convertedFile }) => {
  const thumbnailSource = convertedFile ?? image.preview;

  return (
    <ImageViewerDialog
      file={image.originalFile}
      transformations={image.transformations}
    >
      <button
        data-testid='image-preview-trigger'
        className='hover:border-glow cursor-pointer rounded-lg border transition-all duration-500 ease-out hover:opacity-80'
      >
        <FileImage
          data-testid='image-preview-thumbnail'
          file={thumbnailSource}
          alt={image.originalFile.name}
          className='h-10 w-10 flex-shrink-0 rounded-md object-cover'
        />
      </button>
    </ImageViewerDialog>
  );
};

const DownloadImageButton: React.FC<{
  image: ManagedImage;
  conversion: ReturnType<typeof useConvertImage>['conversion'];
  download: ReturnType<typeof useConvertImage>['download'];
  formattedFileSize: string | undefined;
  lastFormattedFileSize: string | undefined;
}> = ({
  image,
  conversion,
  download,
  formattedFileSize,
  lastFormattedFileSize,
}) => {
  const status =
    conversion.isPending ? 'converting'
    : download.isPending ? 'downloading'
    : image.ready ? 'ready'
    : 'not_ready';

  const statusMessage =
    status === 'converting' ? 'Image is converting. Please wait'
    : status === 'downloading' ? 'Image is downloading. Please wait'
    : status === 'not_ready' ? 'Image is not yet ready to download'
    : 'Download Image';

  const displayFileSize = formattedFileSize ?? lastFormattedFileSize;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button
            data-testid='download-button'
            disabled={status !== 'ready'}
            onClick={() => {
              download.mutate();
            }}
            className={cn(
              'relative w-32 sm:w-36',
              status === 'converting' && 'animate-racetrack',
            )}
          >
            <div
              className={cn(
                'relative flex items-center justify-evenly gap-2',
                download.isPending && 'opacity-20',
              )}
            >
              <FileDownIcon className='h-4 w-4' />
              {displayFileSize ?
                <span
                  data-testid='file-size'
                  className={cn(
                    'inline-flex w-24 items-center justify-center',
                    conversion.isPending && 'animate-pulse opacity-80',
                  )}
                >
                  {formattedFileSize ?
                    formattedFileSize
                  : conversion.error ?
                    <TriangleAlert className='text-amber-600 dark:text-amber-400' />
                  : displayFileSize}
                </span>
              : <>
                  <span className='hidden sm:inline'>Download</span>
                  <span className='inline sm:hidden'>Save</span>
                </>
              }
            </div>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{statusMessage}</TooltipContent>
    </Tooltip>
  );
};

const ImageRow: React.FC<{
  image: ManagedImage;
}> = ({ image }) => {
  const { conversion, download, formattedFileSize, lastFormattedFileSize } =
    useConvertImage(image);
  const { format, quality } = image.transformations;
  const compressionSupported = COMPRESSION_SUPPORTED[format];

  const setFormat = (f: ImageFormat) => {
    image.setTransformations({ ...image.transformations, format: f });
  };

  const setQuality = (q: number) => {
    image.setTransformations({ ...image.transformations, quality: q });
  };

  return (
    <div
      data-testid='image-card'
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
          <ImagePreview image={image} convertedFile={conversion.data} />
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
          onClick={() => {
            image.remove();
          }}
          className='sm:hidden'
        />
      </div>

      {/* Right side: format select + quality + download + remove */}
      <div className='flex w-full items-center justify-end gap-2 sm:w-auto'>
        <FormatSelect
          format={format}
          setFormat={setFormat}
          data-testid='format-select'
        />
        <QualitySlider
          quality={compressionSupported ? quality : 100}
          setQuality={setQuality}
          disabled={!compressionSupported}
          tooltipTitle={
            compressionSupported ?
              'Adjust the image quality'
            : `Quality adjustment is not supported for ${format}`
          }
        />
        <ImageEditorDialog image={image} />
        <DownloadImageButton
          image={image}
          conversion={conversion}
          download={download}
          formattedFileSize={formattedFileSize}
          lastFormattedFileSize={lastFormattedFileSize}
        />
        <RemoveImageButton
          onClick={() => {
            image.remove();
          }}
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
