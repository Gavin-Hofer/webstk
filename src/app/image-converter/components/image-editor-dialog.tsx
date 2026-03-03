'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CropIcon, SlidersHorizontal, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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

const MIN_CROP_SIZE = 0.05;
const MIN_RESIZE_DIMENSION = 1;

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

function parseNumberInput(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const handles: DragHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const ResizePreview: React.FC<{
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  onResize: (size: { width: number; height: number }) => void;
}> = ({ width, height, preserveAspectRatio, onResize }) => {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    handle: DragHandle;
  } | null>(null);
  const boxMax = 180;
  const scale = boxMax / Math.max(width, height, 1);
  const boxWidth = Math.max(30, Math.round(width * scale));
  const boxHeight = Math.max(30, Math.round(height * scale));
  const aspectRatio = width / Math.max(height, 1);

  const handleDragStart = useCallback(
    (handle: DragHandle, event: React.PointerEvent<HTMLButtonElement>) => {
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startWidth: width,
        startHeight: height,
        handle,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [height, width],
  );

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) {
        return;
      }
      const { startX, startY, startWidth, startHeight, handle } =
        dragRef.current;
      const dx = (event.clientX - startX) / scale;
      const dy = (event.clientY - startY) / scale;

      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (handle.includes('e')) {
        nextWidth = startWidth + dx;
      }
      if (handle.includes('w')) {
        nextWidth = startWidth - dx;
      }
      if (handle.includes('s')) {
        nextHeight = startHeight + dy;
      }
      if (handle.includes('n')) {
        nextHeight = startHeight - dy;
      }

      const shouldPreserve = preserveAspectRatio || handle.length === 2;
      if (shouldPreserve) {
        if (handle === 'n' || handle === 's') {
          nextWidth = nextHeight * aspectRatio;
        } else if (handle === 'e' || handle === 'w') {
          nextHeight = nextWidth / aspectRatio;
        } else {
          const widthFromHeight = nextHeight * aspectRatio;
          const heightFromWidth = nextWidth / aspectRatio;
          const widthChange = Math.abs(nextWidth - startWidth);
          const heightChange = Math.abs(nextHeight - startHeight);
          if (widthChange >= heightChange * aspectRatio) {
            nextHeight = heightFromWidth;
          } else {
            nextWidth = widthFromHeight;
          }
        }
      }

      onResize({
        width: Math.max(MIN_RESIZE_DIMENSION, Math.round(nextWidth)),
        height: Math.max(MIN_RESIZE_DIMENSION, Math.round(nextHeight)),
      });
    },
    [aspectRatio, onResize, preserveAspectRatio, scale],
  );

  return (
    <div
      className='bg-muted/40 border-border relative flex h-52 items-center justify-center rounded-lg border'
      onPointerMove={handleDragMove}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <div
        className='border-primary/70 bg-primary/10 relative rounded border-2'
        style={{ width: boxWidth, height: boxHeight }}
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
                'bg-primary absolute h-3 w-3 rounded-full border border-white',
                position,
              )}
              onPointerDown={(event) => {
                handleDragStart(handle, event);
              }}
              aria-label={`Resize from ${handle}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export const ImageEditorDialog: React.FC<ImageEditorDialogProps> = ({
  image,
}) => {
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
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
  const cropContainerRef = useRef<HTMLDivElement>(null);

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
    if (open) {
      restoreFromImage();
    }
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

  const onApply = useCallback(() => {
    if (naturalSize.width <= 0 || naturalSize.height <= 0) {
      return;
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

    image.setEdits(
      edits.crop || edits.resize || edits.touchup ? edits : undefined,
    );
    setOpen(false);
  }, [cropRect, image, naturalSize, resizeConfig, touchup]);

  const filterStyle = useMemo(() => {
    return {
      filter: `brightness(${touchup.brightness}%) contrast(${touchup.contrast}%) saturate(${touchup.saturation}%)`,
    };
  }, [touchup.brightness, touchup.contrast, touchup.saturation]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='icon' aria-label='Edit image'>
          <WandSparkles className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90vh] max-w-[95vw] overflow-y-auto p-4 sm:max-w-6xl sm:p-6'>
        <DialogHeader>
          <DialogTitle className='truncate'>Edit {image.filename}</DialogTitle>
          <DialogDescription>
            Crop, resize, and touch up the image. Edits are non-destructive and
            you can reset back to the preserved original image at any time.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'>
          <div className='bg-muted/20 border-border rounded-lg border p-3'>
            <div className='mb-2 flex items-center gap-2 text-sm font-medium'>
              <CropIcon className='h-4 w-4' />
              Crop
            </div>
            <div className='text-muted-foreground mb-3 text-xs'>
              Drag inside the crop box to move it. Drag handles to adjust the
              crop area.
            </div>
            <div className='bg-background relative flex min-h-64 items-center justify-center overflow-hidden rounded-md border p-2'>
              {sourceUrl && (
                <div
                  ref={cropContainerRef}
                  className='relative inline-block'
                  onPointerMove={onCropPointerMove}
                  onPointerUp={() => {
                    cropDragRef.current = null;
                  }}
                  onPointerCancel={() => {
                    cropDragRef.current = null;
                  }}
                >
                  <img
                    src={sourceUrl}
                    alt={image.filename}
                    className='max-h-[50vh] max-w-full object-contain select-none'
                    style={filterStyle}
                    onLoad={(event) => {
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
                    }}
                    draggable={false}
                  />
                  <div className='pointer-events-none absolute inset-0 bg-black/30' />
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
                            'bg-primary absolute h-3 w-3 rounded-full border border-white',
                            position,
                          )}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            onCropPointerDown(handle, event);
                          }}
                          aria-label={`Adjust crop ${handle}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className='space-y-4'>
            <section className='bg-muted/20 border-border space-y-3 rounded-lg border p-3'>
              <h3 className='text-sm font-medium'>Resize</h3>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id={`preserve-aspect-${image.id}`}
                  checked={resizeConfig.preserveAspectRatio}
                  onCheckedChange={(checked) => {
                    setResizeConfig((prev) => ({
                      ...prev,
                      preserveAspectRatio: checked === true,
                    }));
                  }}
                />
                <Label htmlFor={`preserve-aspect-${image.id}`}>
                  Preserve aspect ratio
                </Label>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='space-y-1'>
                  <Label htmlFor={`resize-width-${image.id}`}>Width</Label>
                  <Input
                    id={`resize-width-${image.id}`}
                    type='number'
                    min={1}
                    value={resizeConfig.width}
                    onChange={(event) => {
                      const width = parseNumberInput(
                        event.target.value,
                        resizeConfig.width,
                      );
                      setResizeConfig((prev) => {
                        if (!prev.preserveAspectRatio || prev.height <= 0) {
                          return { ...prev, width };
                        }
                        const aspect = prev.width / prev.height;
                        return {
                          ...prev,
                          width,
                          height: Math.max(
                            MIN_RESIZE_DIMENSION,
                            Math.round(width / aspect),
                          ),
                        };
                      });
                    }}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor={`resize-height-${image.id}`}>Height</Label>
                  <Input
                    id={`resize-height-${image.id}`}
                    type='number'
                    min={1}
                    value={resizeConfig.height}
                    onChange={(event) => {
                      const height = parseNumberInput(
                        event.target.value,
                        resizeConfig.height,
                      );
                      setResizeConfig((prev) => {
                        if (!prev.preserveAspectRatio || prev.width <= 0) {
                          return { ...prev, height };
                        }
                        const aspect = prev.width / prev.height;
                        return {
                          ...prev,
                          height,
                          width: Math.max(
                            MIN_RESIZE_DIMENSION,
                            Math.round(height * aspect),
                          ),
                        };
                      });
                    }}
                  />
                </div>
              </div>
              <ResizePreview
                width={resizeConfig.width}
                height={resizeConfig.height}
                preserveAspectRatio={resizeConfig.preserveAspectRatio}
                onResize={(size) => {
                  setResizeConfig((prev) => ({ ...prev, ...size }));
                }}
              />
            </section>

            <section className='bg-muted/20 border-border space-y-4 rounded-lg border p-3'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <SlidersHorizontal className='h-4 w-4' />
                Touchup
              </div>
              <div className='space-y-3'>
                <div className='space-y-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span>Brightness</span>
                    <span>{touchup.brightness}%</span>
                  </div>
                  <Slider
                    value={[touchup.brightness]}
                    min={0}
                    max={200}
                    step={1}
                    onValueChange={([value]) => {
                      setTouchup((prev) => ({ ...prev, brightness: value }));
                    }}
                  />
                </div>
                <div className='space-y-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span>Contrast</span>
                    <span>{touchup.contrast}%</span>
                  </div>
                  <Slider
                    value={[touchup.contrast]}
                    min={0}
                    max={200}
                    step={1}
                    onValueChange={([value]) => {
                      setTouchup((prev) => ({ ...prev, contrast: value }));
                    }}
                  />
                </div>
                <div className='space-y-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span>Saturation</span>
                    <span>{touchup.saturation}%</span>
                  </div>
                  <Slider
                    value={[touchup.saturation]}
                    min={0}
                    max={200}
                    step={1}
                    onValueChange={([value]) => {
                      setTouchup((prev) => ({ ...prev, saturation: value }));
                    }}
                  />
                </div>
                <div className='space-y-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span>Sharpen</span>
                    <span>{(touchup.sharpen / 100).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[touchup.sharpen]}
                    min={0}
                    max={300}
                    step={1}
                    onValueChange={([value]) => {
                      setTouchup((prev) => ({ ...prev, sharpen: value }));
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className='mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between'>
          <Button
            variant='ghost'
            onClick={() => {
              image.resetEdits();
              setOpen(false);
            }}
            disabled={!image.ready}
          >
            Reset to Original
          </Button>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() => {
                restoreFromImage();
              }}
            >
              Revert Unsaved
            </Button>
            <Button onClick={onApply} disabled={!image.ready}>
              Apply Edits
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
