'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Aperture,
  ContrastIcon,
  CropIcon,
  Droplets,
  Expand,
  Lock,
  LockOpen,
  SunIcon,
  WandSparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ManagedImage } from '@/hooks/use-persistent-images';
import type { ImageEditOptions } from '@/lib/image-tools/types';
import { cn } from '@/lib/utils';

type NormalizedCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeConfig = {
  width: number;
  height: number;
  preserveAspectRatio: boolean;
};

type TouchupConfig = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
};

type ImageEditorDialogProps = {
  image: ManagedImage;
};

type DragHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';
type ResizeDragHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type EditMode = 'crop' | 'resize';
type TouchupControl = 'brightness' | 'contrast' | 'saturation' | 'sharpen';

const MIN_CROP_SIZE = 0.05;
const MIN_RESIZE_DIMENSION = 1;
const MAX_RESIZE_DIMENSION = 10_000;
const PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO = 0.5;
const PREVIEW_STAGE_PADDING = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCropRect(
  crop: ImageEditOptions['crop'],
  width: number,
  height: number,
): NormalizedCropRect {
  if (!crop || width <= 0 || height <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  return {
    x: clamp(crop.left / width, 0, 1),
    y: clamp(crop.top / height, 0, 1),
    width: clamp(crop.width / width, MIN_CROP_SIZE, 1),
    height: clamp(crop.height / height, MIN_CROP_SIZE, 1),
  };
}

function isDefaultCrop(rect: NormalizedCropRect) {
  const epsilon = 0.001;
  return (
    Math.abs(rect.x) < epsilon &&
    Math.abs(rect.y) < epsilon &&
    Math.abs(rect.width - 1) < epsilon &&
    Math.abs(rect.height - 1) < epsilon
  );
}

const handles: DragHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const resizeHandles: ResizeDragHandle[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];
const touchupControls: {
  id: TouchupControl;
  label: string;
  min: number;
  max: number;
  formatValue: (value: number) => string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}[] = [
  {
    id: 'brightness',
    label: 'Brightness',
    min: 0,
    max: 200,
    formatValue: (value) => `${value}%`,
    icon: SunIcon,
  },
  {
    id: 'contrast',
    label: 'Contrast',
    min: 0,
    max: 200,
    formatValue: (value) => `${value}%`,
    icon: ContrastIcon,
  },
  {
    id: 'saturation',
    label: 'Saturation',
    min: 0,
    max: 200,
    formatValue: (value) => `${value}%`,
    icon: Droplets,
  },
  {
    id: 'sharpen',
    label: 'Sharpen',
    min: 0,
    max: 300,
    formatValue: (value) => (value / 100).toFixed(2),
    icon: Aperture,
  },
];

export const ImageEditorDialog: React.FC<ImageEditorDialogProps> = ({
  image,
}) => {
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<EditMode>('crop');
  const [activeTouchupControl, setActiveTouchupControl] =
    useState<TouchupControl | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [resizeConfig, setResizeConfig] = useState<ResizeConfig>({
    width: 1,
    height: 1,
    preserveAspectRatio: true,
  });
  const [cropRect, setCropRect] = useState<NormalizedCropRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const [touchup, setTouchup] = useState<TouchupConfig>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpen: 0,
  });
  const cropDragRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startRect: NormalizedCropRect;
  } | null>(null);
  const resizeDragRef = useRef<{
    handle: ResizeDragHandle;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const wasOpenRef = useRef(false);
  const lastAppliedSignatureRef = useRef<string | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const touchupPopoverRef = useRef<HTMLDivElement>(null);
  const [previewBounds, setPreviewBounds] = useState({
    width: 0,
    maxHeight: 0,
  });

  const updateResizeDimensions = useCallback(
    (
      nextWidth: number,
      nextHeight: number,
      targetAxis: 'width' | 'height' | 'auto',
      forcePreserveAspectRatio = false,
    ) => {
      setResizeConfig((prev) => {
        const safeAspect = Math.max(
          prev.width / Math.max(prev.height, Number.EPSILON),
          Number.EPSILON,
        );
        const clampedWidth = clamp(
          Math.round(nextWidth),
          MIN_RESIZE_DIMENSION,
          MAX_RESIZE_DIMENSION,
        );
        const clampedHeight = clamp(
          Math.round(nextHeight),
          MIN_RESIZE_DIMENSION,
          MAX_RESIZE_DIMENSION,
        );

        const shouldPreserveAspectRatio =
          prev.preserveAspectRatio || forcePreserveAspectRatio;

        if (!shouldPreserveAspectRatio) {
          if (clampedWidth === prev.width && clampedHeight === prev.height) {
            return prev;
          }
          return {
            ...prev,
            width: clampedWidth,
            height: clampedHeight,
          };
        }

        let width = clampedWidth;
        let height = clampedHeight;
        if (targetAxis === 'width') {
          height = clamp(
            Math.round(width / safeAspect),
            MIN_RESIZE_DIMENSION,
            MAX_RESIZE_DIMENSION,
          );
        } else if (targetAxis === 'height') {
          width = clamp(
            Math.round(height * safeAspect),
            MIN_RESIZE_DIMENSION,
            MAX_RESIZE_DIMENSION,
          );
        } else {
          const widthFromHeight = clamp(
            Math.round(clampedHeight * safeAspect),
            MIN_RESIZE_DIMENSION,
            MAX_RESIZE_DIMENSION,
          );
          const heightFromWidth = clamp(
            Math.round(clampedWidth / safeAspect),
            MIN_RESIZE_DIMENSION,
            MAX_RESIZE_DIMENSION,
          );
          const widthError = Math.abs(clampedWidth - widthFromHeight);
          const heightError = Math.abs(clampedHeight - heightFromWidth);
          if (widthError <= heightError) {
            width = clampedWidth;
            height = heightFromWidth;
          } else {
            width = widthFromHeight;
            height = clampedHeight;
          }
        }

        if (width === prev.width && height === prev.height) {
          return prev;
        }
        return {
          ...prev,
          width,
          height,
        };
      });
    },
    [],
  );

  useEffect(() => {
    const nextUrl = URL.createObjectURL(image.originalFile);
    setSourceUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [image.originalFile]);

  const restoreFromImage = useCallback(() => {
    const sourceWidth = naturalSize.width || image.edits?.resize?.width || 1;
    const sourceHeight = naturalSize.height || image.edits?.resize?.height || 1;
    const existingResize = image.edits?.resize;
    setResizeConfig({
      width: existingResize?.width ?? sourceWidth,
      height: existingResize?.height ?? sourceHeight,
      preserveAspectRatio: true,
    });
    setCropRect(
      normalizeCropRect(image.edits?.crop, sourceWidth, sourceHeight),
    );
    setTouchup({
      brightness: Math.round((image.edits?.touchup?.brightness ?? 1) * 100),
      contrast: Math.round((image.edits?.touchup?.contrast ?? 1) * 100),
      saturation: Math.round((image.edits?.touchup?.saturation ?? 1) * 100),
      sharpen: Math.round((image.edits?.touchup?.sharpen ?? 0) * 100),
    });
  }, [image, naturalSize.height, naturalSize.width]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      restoreFromImage();
      setIsInitialized(true);
    } else if (!open && wasOpenRef.current) {
      setIsInitialized(false);
      setMode('crop');
      setActiveTouchupControl(null);
      lastAppliedSignatureRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open, restoreFromImage]);

  const cropStyle = useMemo(() => {
    return {
      left: `${cropRect.x * 100}%`,
      top: `${cropRect.y * 100}%`,
      width: `${cropRect.width * 100}%`,
      height: `${cropRect.height * 100}%`,
    };
  }, [cropRect]);

  const onCropPointerDown = useCallback(
    (handle: DragHandle, event: React.PointerEvent<HTMLElement>) => {
      cropDragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startRect: cropRect,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [cropRect],
  );

  const onCropPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!cropDragRef.current || !cropContainerRef.current) {
        return;
      }
      const { handle, startX, startY, startRect } = cropDragRef.current;
      const { width, height } =
        cropContainerRef.current.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        return;
      }
      const dx = (event.clientX - startX) / width;
      const dy = (event.clientY - startY) / height;
      let { x, y, width: rectWidth, height: rectHeight } = startRect;

      if (handle === 'move') {
        x = clamp(startRect.x + dx, 0, 1 - rectWidth);
        y = clamp(startRect.y + dy, 0, 1 - rectHeight);
      } else {
        const left = startRect.x;
        const top = startRect.y;
        const right = startRect.x + startRect.width;
        const bottom = startRect.y + startRect.height;
        let nextLeft = left;
        let nextTop = top;
        let nextRight = right;
        let nextBottom = bottom;
        if (handle.includes('w')) {
          nextLeft = clamp(left + dx, 0, right - MIN_CROP_SIZE);
        }
        if (handle.includes('e')) {
          nextRight = clamp(right + dx, left + MIN_CROP_SIZE, 1);
        }
        if (handle.includes('n')) {
          nextTop = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
        }
        if (handle.includes('s')) {
          nextBottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1);
        }
        x = nextLeft;
        y = nextTop;
        rectWidth = nextRight - nextLeft;
        rectHeight = nextBottom - nextTop;
      }
      setCropRect({ x, y, width: rectWidth, height: rectHeight });
    },
    [],
  );

  const resizePreviewScale = useMemo(() => {
    const safeNaturalWidth = Math.max(naturalSize.width, 1);
    const safeNaturalHeight = Math.max(naturalSize.height, 1);
    const cropPixelWidth = Math.max(cropRect.width * safeNaturalWidth, 1);
    const cropPixelHeight = Math.max(cropRect.height * safeNaturalHeight, 1);
    const frameLogicalWidth = Math.max(resizeConfig.width, 1);
    const frameLogicalHeight = Math.max(resizeConfig.height, 1);
    const stageLogicalWidth = Math.max(frameLogicalWidth, cropPixelWidth);
    const stageLogicalHeight = Math.max(frameLogicalHeight, cropPixelHeight);
    const fallbackViewportWidth =
      typeof window === 'undefined' ? 1024 : window.innerWidth;
    const fallbackViewportHeight =
      typeof window === 'undefined' ? 768 : window.innerHeight;
    const hasMeasuredWidth = previewBounds.width > PREVIEW_STAGE_PADDING;
    const hasMeasuredHeight = previewBounds.maxHeight > 0;
    const availableWidth = Math.max(
      hasMeasuredWidth ?
        previewBounds.width - PREVIEW_STAGE_PADDING
      : fallbackViewportWidth - PREVIEW_STAGE_PADDING,
      1,
    );
    const availableHeight = Math.max(
      hasMeasuredHeight ?
        previewBounds.maxHeight
      : fallbackViewportHeight * PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
      1,
    );
    return Math.min(
      1,
      availableWidth / stageLogicalWidth,
      availableHeight / stageLogicalHeight,
    );
  }, [
    cropRect.height,
    cropRect.width,
    naturalSize.height,
    naturalSize.width,
    previewBounds.maxHeight,
    previewBounds.width,
    resizeConfig.height,
    resizeConfig.width,
  ]);

  const onResizePointerDown = useCallback(
    (handle: ResizeDragHandle, event: React.PointerEvent<HTMLElement>) => {
      resizeDragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: resizeConfig.width,
        startHeight: resizeConfig.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [resizeConfig.height, resizeConfig.width],
  );

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeDragRef.current) {
        return;
      }

      const { handle, startX, startY, startWidth, startHeight } =
        resizeDragRef.current;
      const logicalScale = Math.max(resizePreviewScale, Number.EPSILON);
      // The preview frame is center-aligned, so handle movement is half of size
      // delta. Scale pointer deltas so the dragged handle tracks the pointer.
      const dx = ((event.clientX - startX) * 2) / logicalScale;
      const dy = ((event.clientY - startY) * 2) / logicalScale;

      let nextWidth = startWidth;
      let nextHeight = startHeight;
      let targetAxis: 'width' | 'height' | 'auto' = 'auto';

      if (handle.includes('e')) {
        nextWidth = startWidth + dx;
        targetAxis = 'width';
      }
      if (handle.includes('w')) {
        nextWidth = startWidth - dx;
        targetAxis = 'width';
      }
      if (handle.includes('s')) {
        nextHeight = startHeight + dy;
        targetAxis = targetAxis === 'width' ? 'auto' : 'height';
      }
      if (handle.includes('n')) {
        nextHeight = startHeight - dy;
        targetAxis = targetAxis === 'width' ? 'auto' : 'height';
      }

      const isCornerHandle = handle.length === 2;
      updateResizeDimensions(nextWidth, nextHeight, targetAxis, isCornerHandle);
    },
    [resizePreviewScale, updateResizeDimensions],
  );

  const getCurrentEdits = useCallback((): ImageEditOptions | undefined => {
    if (naturalSize.width <= 0 || naturalSize.height <= 0) {
      return undefined;
    }
    const edits: ImageEditOptions = {};
    if (!isDefaultCrop(cropRect)) {
      edits.crop = {
        left: Math.round(cropRect.x * naturalSize.width),
        top: Math.round(cropRect.y * naturalSize.height),
        width: Math.round(cropRect.width * naturalSize.width),
        height: Math.round(cropRect.height * naturalSize.height),
      };
    }

    const shouldResize =
      resizeConfig.width !== naturalSize.width ||
      resizeConfig.height !== naturalSize.height;
    if (shouldResize) {
      edits.resize = {
        width: resizeConfig.width,
        height: resizeConfig.height,
      };
    }

    const brightness = touchup.brightness / 100;
    const contrast = touchup.contrast / 100;
    const saturation = touchup.saturation / 100;
    const sharpen = touchup.sharpen / 100;
    const hasTouchup =
      brightness !== 1 || contrast !== 1 || saturation !== 1 || sharpen !== 0;
    if (hasTouchup) {
      edits.touchup = {
        brightness,
        contrast,
        saturation,
        sharpen,
      };
    }

    return edits.crop || edits.resize || edits.touchup ? edits : undefined;
  }, [cropRect, naturalSize, resizeConfig, touchup]);

  useEffect(() => {
    if (
      !open ||
      !isInitialized ||
      naturalSize.width <= 0 ||
      naturalSize.height <= 0
    ) {
      return;
    }
    const edits = getCurrentEdits();
    const signature = JSON.stringify(edits ?? null);
    if (lastAppliedSignatureRef.current === signature) {
      return;
    }
    lastAppliedSignatureRef.current = signature;
    image.setEdits(edits);
  }, [
    getCurrentEdits,
    image,
    isInitialized,
    naturalSize.height,
    naturalSize.width,
    open,
  ]);

  const filterStyle = useMemo(() => {
    return {
      filter: `brightness(${touchup.brightness}%) contrast(${touchup.contrast}%) saturate(${touchup.saturation}%)`,
    };
  }, [touchup.brightness, touchup.contrast, touchup.saturation]);

  const activeTouchupMeta = useMemo(
    () =>
      touchupControls.find((control) => control.id === activeTouchupControl),
    [activeTouchupControl],
  );

  useEffect(() => {
    if (!open || !activeTouchupControl) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (touchupPopoverRef.current?.contains(target)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest('[data-touchup-control-button="true"]')
      ) {
        return;
      }

      setActiveTouchupControl(null);
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [activeTouchupControl, open]);

  const handlePreviewImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const target = event.currentTarget;
      const nextSize = {
        width: target.naturalWidth,
        height: target.naturalHeight,
      };
      setNaturalSize(nextSize);
      setResizeConfig((prev) => {
        if (prev.width > 1 || prev.height > 1) {
          return prev;
        }
        return {
          ...prev,
          width: nextSize.width,
          height: nextSize.height,
        };
      });
    },
    [],
  );

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) {
      return;
    }

    const updatePreviewBounds = () => {
      setPreviewBounds({
        width: Math.max(viewport.clientWidth, 0),
        maxHeight: Math.max(
          window.innerHeight * PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
          0,
        ),
      });
    };
    updatePreviewBounds();

    const observer = new ResizeObserver(() => {
      updatePreviewBounds();
    });
    observer.observe(viewport);

    window.addEventListener('resize', updatePreviewBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreviewBounds);
    };
  }, [open]);

  const resizePreview = useMemo(() => {
    const safeNaturalWidth = Math.max(naturalSize.width, 1);
    const safeNaturalHeight = Math.max(naturalSize.height, 1);
    const cropPixelWidth = Math.max(cropRect.width * safeNaturalWidth, 1);
    const cropPixelHeight = Math.max(cropRect.height * safeNaturalHeight, 1);
    const scaleX = resizeConfig.width / cropPixelWidth;
    const scaleY = resizeConfig.height / cropPixelHeight;
    const frameLogicalWidth = Math.max(resizeConfig.width, 1);
    const frameLogicalHeight = Math.max(resizeConfig.height, 1);
    const stageLogicalWidth = Math.max(frameLogicalWidth, cropPixelWidth);
    const stageLogicalHeight = Math.max(frameLogicalHeight, cropPixelHeight);
    const scale = resizePreviewScale;
    const displayStageWidth = stageLogicalWidth * scale;
    const displayStageHeight = stageLogicalHeight * scale;
    const displayFrameWidth = frameLogicalWidth * scale;
    const displayFrameHeight = frameLogicalHeight * scale;
    const imageWidth = safeNaturalWidth * scaleX * scale;
    const imageHeight = safeNaturalHeight * scaleY * scale;
    return {
      scale,
      stageStyle: {
        width: `${displayStageWidth}px`,
        height: `${displayStageHeight}px`,
      },
      frameStyle: {
        width: `${displayFrameWidth}px`,
        height: `${displayFrameHeight}px`,
      },
      imageStyle: {
        ...filterStyle,
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${-cropRect.x * imageWidth}px, ${-cropRect.y * imageHeight}px)`,
      },
    };
  }, [
    cropRect,
    filterStyle,
    naturalSize.height,
    naturalSize.width,
    resizePreviewScale,
    resizeConfig.height,
    resizeConfig.width,
  ]);

  const handleResetToOriginal = useCallback(() => {
    setCropRect({ x: 0, y: 0, width: 1, height: 1 });
    setTouchup({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sharpen: 0,
    });
    setResizeConfig({
      width: Math.max(naturalSize.width, 1),
      height: Math.max(naturalSize.height, 1),
      preserveAspectRatio: true,
    });
    image.resetEdits();
  }, [image, naturalSize.height, naturalSize.width]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            aria-label='Edit image'
            onClick={() => {
              setOpen(true);
            }}
          >
            <WandSparkles className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Edit</TooltipContent>
      </Tooltip>
      <DialogContent className='max-h-[90vh] max-w-[95vw] overflow-y-auto p-4 sm:max-w-6xl sm:p-6'>
        <DialogHeader>
          <DialogTitle className='truncate'>Edit {image.filename}</DialogTitle>
        </DialogHeader>

        <div className='space-y-3'>
          {/* Main editor canvas and overlays. */}
          <div className='relative p-3'>
            {/* Image preview viewport where crop/resize interactions happen. */}
            <div
              ref={previewViewportRef}
              className='bg-background relative flex min-h-[55vh] items-center justify-center overflow-auto rounded-md border p-2 pt-14 sm:pt-16'
            >
              {/* Aspect ratio lock control shown only in resize mode. */}
              {mode === 'resize' && (
                <div className='absolute top-4 left-4 z-30 rounded-md p-1 backdrop-blur-sm'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        aria-label={
                          resizeConfig.preserveAspectRatio ?
                            'Unlock aspect ratio'
                          : 'Lock aspect ratio'
                        }
                        onClick={() => {
                          setResizeConfig((prev) => ({
                            ...prev,
                            preserveAspectRatio: !prev.preserveAspectRatio,
                          }));
                        }}
                      >
                        {resizeConfig.preserveAspectRatio ?
                          <Lock className='h-4 w-4' />
                        : <LockOpen className='h-4 w-4' />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='top'>
                      {resizeConfig.preserveAspectRatio ?
                        'Unlock aspect ratio'
                      : 'Lock aspect ratio'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
              {/* Top-right mode toggle controls for crop/resize. */}
              <div className='absolute top-4 right-4 z-30 flex items-center gap-2 rounded-md p-1 backdrop-blur-sm'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === 'crop' ? 'secondary' : 'ghost'}
                      size='icon'
                      className='h-8 w-8'
                      aria-label='Crop'
                      onClick={() => {
                        setMode('crop');
                      }}
                    >
                      <CropIcon className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top'>Crop</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === 'resize' ? 'secondary' : 'ghost'}
                      size='icon'
                      className='h-8 w-8'
                      aria-label='Resize'
                      onClick={() => {
                        setMode('resize');
                      }}
                    >
                      <Expand className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top'>Resize</TooltipContent>
                </Tooltip>
              </div>
              {sourceUrl && (
                <div
                  ref={cropContainerRef}
                  className='relative inline-block'
                  onPointerMove={
                    mode === 'crop' ? onCropPointerMove : undefined
                  }
                  onPointerUp={() => {
                    cropDragRef.current = null;
                    resizeDragRef.current = null;
                  }}
                  onPointerCancel={() => {
                    cropDragRef.current = null;
                    resizeDragRef.current = null;
                  }}
                >
                  {/* Base preview rendering, switches by active mode. */}
                  {mode === 'crop' ?
                    <img
                      src={sourceUrl}
                      alt={image.filename}
                      className='max-h-[50vh] max-w-full object-contain select-none'
                      style={filterStyle}
                      onLoad={handlePreviewImageLoad}
                      draggable={false}
                    />
                  : <div
                      className='relative max-h-[50vh] max-w-full'
                      style={resizePreview.stageStyle}
                    >
                      <div
                        className='absolute top-1/2 left-1/2 border-2 border-transparent'
                        style={{
                          ...resizePreview.frameStyle,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onPointerMove={onResizePointerMove}
                      >
                        <div className='absolute inset-0 overflow-hidden'>
                          <img
                            src={sourceUrl}
                            alt={image.filename}
                            className='absolute top-0 left-0 max-h-none max-w-none select-none'
                            style={resizePreview.imageStyle}
                            onLoad={handlePreviewImageLoad}
                            draggable={false}
                          />
                          <div className='pointer-events-none absolute inset-0 border-2 border-white/70' />
                        </div>
                        {/* Resize handles for frame adjustments. */}
                        {resizeHandles.map((handle) => {
                          const position =
                            handle === 'n' ?
                              'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'
                            : handle === 's' ?
                              'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'
                            : handle === 'e' ?
                              'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
                            : handle === 'w' ?
                              'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
                            : handle === 'ne' ?
                              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'
                            : handle === 'nw' ?
                              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'
                            : handle === 'se' ?
                              'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
                            : 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize';
                          return (
                            <button
                              key={handle}
                              type='button'
                              className={cn(
                                'absolute z-10 flex h-6 w-6 touch-none items-center justify-center rounded-full',
                                position,
                              )}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                onResizePointerDown(handle, event);
                              }}
                              aria-label={`Adjust resize ${handle}`}
                            >
                              <span
                                aria-hidden
                                className='bg-primary h-3 w-3 rounded-full border border-white'
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  }
                  {/* Crop overlay with draggable bounds and corner/edge handles. */}
                  {mode === 'crop' && (
                    <>
                      <div
                        className='border-primary pointer-events-auto absolute border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                        style={cropStyle}
                        onPointerDown={(event) => {
                          onCropPointerDown('move', event);
                        }}
                      >
                        {handles.map((handle) => {
                          const position =
                            handle === 'n' ?
                              'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'
                            : handle === 's' ?
                              'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'
                            : handle === 'e' ?
                              'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
                            : handle === 'w' ?
                              'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
                            : handle === 'ne' ?
                              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'
                            : handle === 'nw' ?
                              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'
                            : handle === 'se' ?
                              'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
                            : 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize';
                          return (
                            <button
                              key={handle}
                              type='button'
                              className={cn(
                                'absolute z-10 flex h-6 w-6 touch-none items-center justify-center rounded-full',
                                position,
                              )}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                onCropPointerDown(handle, event);
                              }}
                              aria-label={`Adjust crop ${handle}`}
                            >
                              <span
                                aria-hidden
                                className='bg-primary h-3 w-3 rounded-full border border-white'
                              />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick-access touchup controls (brightness, contrast, etc.). */}
        <div className='relative'>
          {/* Floating slider for the selected touchup adjustment. */}
          {activeTouchupMeta && (
            <div className='pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2 flex justify-center'>
              <div
                ref={touchupPopoverRef}
                className='bg-background pointer-events-auto w-[min(420px,calc(100%-2rem))] rounded-lg border p-4 shadow-xl'
              >
                <div className='mb-3 flex items-center justify-between'>
                  <div className='text-sm font-medium'>
                    {activeTouchupMeta.label}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {activeTouchupMeta.formatValue(
                      touchup[activeTouchupMeta.id],
                    )}
                  </div>
                </div>
                <Slider
                  value={[touchup[activeTouchupMeta.id]]}
                  min={activeTouchupMeta.min}
                  max={activeTouchupMeta.max}
                  step={1}
                  onValueChange={([value]) => {
                    setTouchup((prev) => ({
                      ...prev,
                      [activeTouchupMeta.id]: value,
                    }));
                  }}
                />
              </div>
            </div>
          )}
          <div className='flex items-center justify-center gap-2 p-1'>
            {touchupControls.map((control) => {
              const Icon = control.icon;
              return (
                <Tooltip key={control.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeTouchupControl === control.id ?
                          'secondary'
                        : 'ghost'
                      }
                      size='icon'
                      data-touchup-control-button='true'
                      aria-label={control.label}
                      onClick={() => {
                        setActiveTouchupControl((prev) =>
                          prev === control.id ? null : control.id,
                        );
                      }}
                    >
                      <Icon className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top'>{control.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Final actions for reset or closing the editor dialog. */}
        <DialogFooter className='mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between'>
          <Button variant='ghost' onClick={handleResetToOriginal}>
            Reset to Original
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              setOpen(false);
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
