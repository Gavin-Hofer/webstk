'use client';

import { FileUpIcon } from 'lucide-react';
import { useState, useRef } from 'react';

import { cn } from '@/lib/utils';

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
    timeoutRef.current = setTimeout(() => setShowOverlay(false), 1000);
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
            'bg-primary/80 text-primary-foreground fixed inset-0 z-20 flex h-screen w-screen items-center justify-center gap-4 text-4xl',
            'animate-in fade-in-0',
            'transition-opacity duration-500 ease-out',
            !isDragging && 'opacity-0',
            overlayClassName,
          )}
        >
          {overlayContent ?? (
            <>
              <FileUpIcon className='size-8' />
              Drop to add files
              <div className='bg-background/80 absolute top-5 left-5 h-1 w-32' />
              <div className='bg-background/80 absolute top-5 left-5 h-32 w-1' />
              <div className='bg-background/80 absolute top-5 right-5 h-1 w-32' />
              <div className='bg-background/80 absolute top-5 right-5 h-32 w-1' />
              <div className='bg-background/80 absolute bottom-5 left-5 h-1 w-32' />
              <div className='bg-background/80 absolute bottom-5 left-5 h-32 w-1' />
              <div className='bg-background/80 absolute right-5 bottom-5 h-1 w-32' />
              <div className='bg-background/80 absolute right-5 bottom-5 h-32 w-1' />
            </>
          )}
        </div>
      )}
    </div>
  );
};
