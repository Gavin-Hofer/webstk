'use client';

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
            'absolute inset-0 flex h-full w-full items-center justify-center bg-black/20 text-4xl text-white',
            'animate-in fade-in-0',
            'transition-opacity duration-500 ease-out',
            !isDragging && 'opacity-0',
            overlayClassName,
          )}
        >
          {overlayContent}
        </div>
      )}
    </div>
  );
};
