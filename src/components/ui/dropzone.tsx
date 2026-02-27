/* eslint-disable @typescript-eslint/no-unnecessary-condition */
'use client';

import { useRef, useState } from 'react';

import { FileUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// #region Main Component
// =============================================================================

export const Dropzone: React.FC<
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
    overlayContent?: React.ReactNode;
    overlayClassName?: string;
    onChange?: (files: FileList) => void;
  }
> = ({
  children,
  overlayContent,
  overlayClassName,
  onChange,
  className,
  ...props
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const onDragStart = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
    setIsDragging(true);
    setShowOverlay(true);
  };

  const onDragStop = () => {
    clearTimeout(timeoutRef.current);
    setIsDragging(false);
    timeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, 1000);
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onDragStart();
  };
  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onDragStop();
  };
  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onDragStop();
    if (
      onChange &&
      event.dataTransfer.files &&
      event.dataTransfer.files.length > 0
    ) {
      onChange(event.dataTransfer.files);
    }
  };

  return (
    <div
      {...props}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn('relative', className)}
      data-dropzone-dragging={isDragging}
    >
      {children}
      {showOverlay && (
        <div
          className={cn(
            'fixed inset-0 z-20 flex h-screen w-screen flex-col items-center justify-center gap-4',
            'bg-background/95 backdrop-blur-sm',
            'animate-in fade-in-0',
            'transition-opacity duration-500 ease-out',
            !isDragging && 'opacity-0',
            overlayClassName,
          )}
        >
          {overlayContent ?? (
            <>
              <div className='bg-primary/10 flex h-24 w-24 items-center justify-center rounded-full'>
                <FileUpIcon className='text-primary h-12 w-12' />
              </div>
              <p className='text-2xl font-medium'>Drop files to add</p>
              <p className='text-muted-foreground'>
                Release to upload your images
              </p>
              {/* Corner decorations */}
              <div className='border-primary/50 absolute top-8 left-8 h-16 w-16 border-t-2 border-l-2' />
              <div className='border-primary/50 absolute top-8 right-8 h-16 w-16 border-t-2 border-r-2' />
              <div className='border-primary/50 absolute bottom-8 left-8 h-16 w-16 border-b-2 border-l-2' />
              <div className='border-primary/50 absolute right-8 bottom-8 h-16 w-16 border-r-2 border-b-2' />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// #endregion
