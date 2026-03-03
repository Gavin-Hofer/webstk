/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Maximize2,
  Minimize2,
  RotateCcw,
  XIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useRefCallback } from '@/hooks/use-ref-callback';
import { cn } from '@/lib/utils';

// #region Constants
// =============================================================================

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.25;
const SCROLL_ZOOM_SENSITIVITY = 0.002;

// #endregion

// #region Hooks
// =============================================================================

function useImageUrl(file: File) {
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      // URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  return imageUrl;
}

function useImageViewer() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const clampZoom = useCallback((value: number) => {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  }, [clampZoom]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = clampZoom(prev - ZOOM_STEP);
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, [clampZoom]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = 1 - e.deltaY * SCROLL_ZOOM_SENSITIVITY;
      setZoom((prev) => {
        const next = clampZoom(prev * factor);
        if (next <= 1) {
          setPan({ x: 0, y: 0 });
        }
        return next;
      });
    },
    [clampZoom],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) {
        return;
      }
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffset.current = { ...pan };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pan, zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) {
        return;
      }
      setPan({
        x: panOffset.current.x + (e.clientX - panStart.current.x),
        y: panOffset.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning],
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2);
    }
  }, [zoom, resetView]);

  return {
    zoom,
    pan,
    isPanning,
    resetView,
    zoomIn,
    zoomOut,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
  };
}

// #endregion

// #region Subcomponents
// =============================================================================

type ToolbarButtonProps = {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  testId?: string;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  label,
  children,
  testId,
}) => {
  return (
    <Button
      variant='ghost'
      size='icon'
      onClick={onClick}
      className='h-8 w-8'
      aria-label={label}
      data-testid={testId}
    >
      {children}
    </Button>
  );
};

// #endregion

// #region Main component
// =============================================================================

type ImageViewerDialogProps = {
  file: File;
  children: React.ReactNode;
};

/**
 * A dialog for viewing an image with zoom, pan, and fullscreen support.
 *
 * Double-click toggles between 1x and 2x zoom. Scroll to zoom. Drag to pan
 * when zoomed in beyond 1x.
 *
 * @param props.file - The image File to display.
 * @param props.children - The trigger element that opens the dialog.
 */
export const ImageViewerDialog: React.FC<ImageViewerDialogProps> = ({
  file,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const {
    zoom,
    pan,
    isPanning,
    resetView,
    zoomIn,
    zoomOut,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
  } = useImageViewer();

  const imageUrl = useImageUrl(file);

  const { refCallback: containerRef } = useRefCallback<HTMLDivElement>(
    (node) => {
      if (!node) {
        return;
      }
      node.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        node.removeEventListener('wheel', handleWheel);
      };
    },
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        setFullscreen(false);
        resetView();
      }
    },
    [resetView],
  );

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
    resetView();
  }, [resetView]);

  // Keyboard shortcuts while the dialog is open
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case '=':
        case '+': {
          e.preventDefault();
          zoomIn();
          break;
        }
        case '-': {
          e.preventDefault();
          zoomOut();
          break;
        }
        case '0': {
          e.preventDefault();
          resetView();
          break;
        }
        case 'f': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, zoomIn, zoomOut, resetView, toggleFullscreen]);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          fullscreen ?
            'h-[95vh] w-[95vw] max-w-[95vw] sm:max-w-[95vw]'
          : 'h-[85vh] max-w-4xl sm:max-w-4xl',
        )}
        style={{
          transition:
            'width 300ms ease-out, height 300ms ease-out, max-width e00ms ease-out',
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        {/* Toolbar */}
        <div
          className={cn(
            'bg-background/80 flex items-center justify-between border-b px-4 py-2 backdrop-blur-sm',
          )}
        >
          <DialogTitle className='truncate text-sm font-medium'>
            {file.name}
          </DialogTitle>

          <div className='flex items-center gap-0.5'>
            <ToolbarButton onClick={zoomOut} label='Zoom out'>
              <ZoomOut className='h-4 w-4' />
            </ToolbarButton>
            <span
              data-testid='image-viewer-zoom-percent'
              className='text-muted-foreground min-w-[3.5rem] text-center text-xs tabular-nums'
            >
              {zoomPercent}%
            </span>
            <ToolbarButton
              onClick={zoomIn}
              label='Zoom in'
              testId='image-viewer-zoom-in'
            >
              <ZoomIn className='h-4 w-4' />
            </ToolbarButton>
            <ToolbarButton
              onClick={resetView}
              label='Reset view'
              testId='image-viewer-reset-view'
            >
              <RotateCcw className='h-4 w-4' />
            </ToolbarButton>

            <div className='bg-border mx-1 h-4 w-px' />

            <ToolbarButton
              onClick={toggleFullscreen}
              label='Toggle fullscreen'
              testId='image-viewer-toggle-fullscreen'
            >
              {fullscreen ?
                <Minimize2 className='h-4 w-4' />
              : <Maximize2 className='h-4 w-4' />}
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                handleOpenChange(false);
              }}
              label='Close'
              testId='image-viewer-close'
            >
              <XIcon className='h-4 w-4' />
            </ToolbarButton>
          </div>
        </div>

        {/* Image viewport */}
        <div
          ref={containerRef}
          data-testid='image-viewer-dialog'
          className={cn(
            'relative flex-1 overflow-hidden',
            '[background-image:linear-gradient(45deg,theme(colors.muted)_25%,transparent_25%),linear-gradient(-45deg,theme(colors.muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,theme(colors.muted)_75%),linear-gradient(-45deg,transparent_75%,theme(colors.muted)_75%)] bg-[length:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0]',
            zoom > 1 ? 'cursor-grab' : 'cursor-default',
            isPanning && 'cursor-grabbing',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        >
          <div
            className='flex h-full w-full items-center justify-center'
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isPanning ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            {imageUrl && (
              <img
                data-testid='image-viewer-image'
                src={imageUrl}
                alt={file.name}
                className='max-h-full max-w-full object-contain select-none'
                draggable={false}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// #endregion
