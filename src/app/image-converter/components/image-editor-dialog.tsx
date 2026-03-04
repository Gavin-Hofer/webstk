'use client';

// #region Imports
// =============================================================================
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  ContrastIcon,
  CropIcon,
  Droplets,
  Expand,
  FlipHorizontal,
  FlipVertical,
  Lock,
  LockOpen,
  RotateCcw,
  RotateCw,
  SunIcon,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useDebounceValue } from 'usehooks-ts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileImage } from '@/components/ui/file-image';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ManagedImage } from '@/hooks/use-persistent-images';
import { getImageFormatFromFile } from '@/hooks/use-persistent-images';
import { convertImage } from '@/lib/image-tools';
import type { ImageEditOptions } from '@/lib/image-tools/types';
import { cn } from '@/lib/utils';

// #endregion

// #region Types
// =============================================================================

type NormalizedCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeConfig = {
  scaleX: number;
  scaleY: number;
};

type TouchupConfig = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
};

type TransformConfig = {
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
};

/**
 * Single source of truth for all editor settings. Stored in one useState so
 * that multi-field mutations (e.g. rotate updates cropRect + resizeConfig +
 * transform together) are applied atomically in a single render. Splitting
 * these into separate useState hooks caused intermediate renders where some
 * fields were stale, leading to desync between crop and resize previews.
 */
type EditorState = {
  cropRect: NormalizedCropRect;
  resizeConfig: ResizeConfig;
  touchup: TouchupConfig;
  transform: TransformConfig;
};

type ImageEditorDialogProps = {
  image: ManagedImage;
};

type DragHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';
type ResizeDragHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type EditMode = 'crop' | 'resize';
type TouchupControl = 'brightness' | 'contrast' | 'saturation' | 'sharpen';
type ResizeTargetAxis = 'width' | 'height' | 'auto';

// #endregion

// #region Constants
// =============================================================================

const MIN_CROP_SIZE = 0.05;
const MIN_RESIZE_DIMENSION = 1;
const MAX_RESIZE_DIMENSION = 10_000;
const PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO = 0.5;
const PREVIEW_STAGE_PADDING = 16;
const PREVIEW_MIN_ZOOM = 0.5;
const PREVIEW_MAX_ZOOM = 8;
const PREVIEW_ZOOM_STEP = 0.25;
const PREVIEW_SCROLL_ZOOM_SENSITIVITY = 0.002;
const PREVIEW_DEBOUNCE_MS = 350;

const DEFAULT_EDITOR_STATE: EditorState = {
  cropRect: { x: 0, y: 0, width: 1, height: 1 },
  resizeConfig: { scaleX: 1, scaleY: 1 },
  touchup: { brightness: 100, contrast: 100, saturation: 100, sharpen: 0 },
  transform: { rotation: 0, flipHorizontal: false, flipVertical: false },
};

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
];

// #endregion

// #region Helper functions
// =============================================================================

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rotateLeft(
  rotation: TransformConfig['rotation'],
): TransformConfig['rotation'] {
  if (rotation === 0) {
    return 270;
  }
  if (rotation === 90) {
    return 0;
  }
  if (rotation === 180) {
    return 90;
  }
  return 180;
}

function rotateRight(
  rotation: TransformConfig['rotation'],
): TransformConfig['rotation'] {
  if (rotation === 0) {
    return 90;
  }
  if (rotation === 90) {
    return 180;
  }
  if (rotation === 180) {
    return 270;
  }
  return 0;
}

function getTransformedDimensions(
  width: number,
  height: number,
  rotation: TransformConfig['rotation'],
) {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

function rotateCropRectLeft(rect: NormalizedCropRect): NormalizedCropRect {
  return {
    x: rect.y,
    y: 1 - rect.x - rect.width,
    width: rect.height,
    height: rect.width,
  };
}

function rotateCropRectRight(rect: NormalizedCropRect): NormalizedCropRect {
  return {
    x: 1 - rect.y - rect.height,
    y: rect.x,
    width: rect.height,
    height: rect.width,
  };
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

function getHandlePosition(handle: ResizeDragHandle | DragHandle) {
  if (handle === 'n') {
    return 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize';
  }
  if (handle === 's') {
    return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize';
  }
  if (handle === 'e') {
    return 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize';
  }
  if (handle === 'w') {
    return 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize';
  }
  if (handle === 'ne') {
    return 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize';
  }
  if (handle === 'nw') {
    return 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize';
  }
  if (handle === 'se') {
    return 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize';
  }
  return 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize';
}

function getCropPixelDimensions(params: {
  cropRect: NormalizedCropRect;
  transformedNaturalSize: { width: number; height: number };
}) {
  const { cropRect, transformedNaturalSize } = params;
  return {
    width: Math.max(
      cropRect.width * Math.max(transformedNaturalSize.width, 1),
      1,
    ),
    height: Math.max(
      cropRect.height * Math.max(transformedNaturalSize.height, 1),
      1,
    ),
  };
}

function getResizePixelDimensions(params: {
  cropRect: NormalizedCropRect;
  transformedNaturalSize: { width: number; height: number };
  resizeConfig: ResizeConfig;
}) {
  const { cropRect, transformedNaturalSize, resizeConfig } = params;
  const cropPixels = getCropPixelDimensions({
    cropRect,
    transformedNaturalSize,
  });
  return {
    width: clamp(
      Math.round(cropPixels.width * resizeConfig.scaleX),
      MIN_RESIZE_DIMENSION,
      MAX_RESIZE_DIMENSION,
    ),
    height: clamp(
      Math.round(cropPixels.height * resizeConfig.scaleY),
      MIN_RESIZE_DIMENSION,
      MAX_RESIZE_DIMENSION,
    ),
  };
}

function isDefaultResizeScale(resizeConfig: ResizeConfig) {
  const epsilon = 0.0001;
  return (
    Math.abs(resizeConfig.scaleX - 1) < epsilon &&
    Math.abs(resizeConfig.scaleY - 1) < epsilon
  );
}

/** Builds the full ImageEditOptions for final output (on dialog close). */
function buildEditsFromState(
  naturalSize: { width: number; height: number },
  state: EditorState,
): ImageEditOptions | undefined {
  const { cropRect, resizeConfig, touchup, transform } = state;
  if (naturalSize.width <= 0 || naturalSize.height <= 0) {
    return undefined;
  }

  const transformedNaturalSize = getTransformedDimensions(
    naturalSize.width,
    naturalSize.height,
    transform.rotation,
  );
  const edits: ImageEditOptions = {};
  const cropPixelDimensions = getCropPixelDimensions({
    cropRect,
    transformedNaturalSize,
  });

  if (!isDefaultCrop(cropRect)) {
    edits.crop = {
      left: Math.round(cropRect.x * transformedNaturalSize.width),
      top: Math.round(cropRect.y * transformedNaturalSize.height),
      width: Math.round(cropRect.width * transformedNaturalSize.width),
      height: Math.round(cropRect.height * transformedNaturalSize.height),
    };
  }

  if (!isDefaultResizeScale(resizeConfig)) {
    edits.resize = {
      width: clamp(
        Math.round(cropPixelDimensions.width * resizeConfig.scaleX),
        MIN_RESIZE_DIMENSION,
        MAX_RESIZE_DIMENSION,
      ),
      height: clamp(
        Math.round(cropPixelDimensions.height * resizeConfig.scaleY),
        MIN_RESIZE_DIMENSION,
        MAX_RESIZE_DIMENSION,
      ),
    };
  }

  const brightness = touchup.brightness / 100;
  const contrast = touchup.contrast / 100;
  const saturation = touchup.saturation / 100;
  const sharpen = touchup.sharpen / 100;
  if (brightness !== 1 || contrast !== 1 || saturation !== 1 || sharpen !== 0) {
    edits.touchup = { brightness, contrast, saturation, sharpen };
  }

  if (
    transform.rotation !== 0 ||
    transform.flipHorizontal ||
    transform.flipVertical
  ) {
    edits.transform = {
      rotation: transform.rotation,
      flipHorizontal: transform.flipHorizontal,
      flipVertical: transform.flipVertical,
    };
  }

  return edits.crop || edits.resize || edits.touchup || edits.transform ?
      edits
    : undefined;
}

/**
 * Builds server-side edits for the crop mode preview.
 *
 * Only includes sharpen -- everything else is handled client-side:
 * - brightness/contrast/saturation: CSS `filter` property (via filterStyle)
 * - rotation/flip: CSS `transform` property (via previewTransform)
 * - resize: CSS scaling in the layout math
 * - crop: the interactive overlay
 *
 * IMPORTANT: Do NOT add brightness/contrast/saturation here. They must stay
 * CSS-only so the preview always reflects the live slider values instantly.
 * Baking them into the server-side draft causes desync when the draft is stale
 * (during debounce or after a reset).
 */
function buildCropPreviewEdits(
  touchup: TouchupConfig,
): ImageEditOptions | undefined {
  const sharpen = touchup.sharpen / 100;
  if (sharpen === 0) {
    return undefined;
  }
  return { touchup: { brightness: 1, contrast: 1, saturation: 1, sharpen } };
}

/**
 * Builds server-side edits for the resize mode preview.
 *
 * Includes geometric ops that CSS cannot do: crop, resize, sharpen, and
 * transform (rotation/flip). The server must apply transform so that crop
 * coordinates (defined in post-rotation space) are correct.
 *
 * IMPORTANT: Do NOT add brightness/contrast/saturation here -- same reason
 * as buildCropPreviewEdits. CSS filterStyle handles them in both modes so
 * there is never a mismatch between live state and what the preview shows.
 */
function buildResizePreviewEdits(
  naturalSize: { width: number; height: number },
  state: EditorState,
): ImageEditOptions | undefined {
  const { cropRect, resizeConfig, touchup, transform } = state;
  if (naturalSize.width <= 0 || naturalSize.height <= 0) {
    return undefined;
  }

  const transformedNaturalSize = getTransformedDimensions(
    naturalSize.width,
    naturalSize.height,
    transform.rotation,
  );
  const edits: ImageEditOptions = {};
  const cropPixelDimensions = getCropPixelDimensions({
    cropRect,
    transformedNaturalSize,
  });

  if (!isDefaultCrop(cropRect)) {
    edits.crop = {
      left: Math.round(cropRect.x * transformedNaturalSize.width),
      top: Math.round(cropRect.y * transformedNaturalSize.height),
      width: Math.round(cropRect.width * transformedNaturalSize.width),
      height: Math.round(cropRect.height * transformedNaturalSize.height),
    };
  }

  if (!isDefaultResizeScale(resizeConfig)) {
    edits.resize = {
      width: clamp(
        Math.round(cropPixelDimensions.width * resizeConfig.scaleX),
        MIN_RESIZE_DIMENSION,
        MAX_RESIZE_DIMENSION,
      ),
      height: clamp(
        Math.round(cropPixelDimensions.height * resizeConfig.scaleY),
        MIN_RESIZE_DIMENSION,
        MAX_RESIZE_DIMENSION,
      ),
    };
  }

  const sharpen = touchup.sharpen / 100;
  if (sharpen !== 0) {
    edits.touchup = { brightness: 1, contrast: 1, saturation: 1, sharpen };
  }

  if (
    transform.rotation !== 0 ||
    transform.flipHorizontal ||
    transform.flipVertical
  ) {
    edits.transform = {
      rotation: transform.rotation,
      flipHorizontal: transform.flipHorizontal,
      flipVertical: transform.flipVertical,
    };
  }

  return edits.crop || edits.resize || edits.touchup || edits.transform ?
      edits
    : undefined;
}

function restoreEditorState(
  edits: ImageEditOptions | undefined,
  naturalSize: { width: number; height: number },
): EditorState {
  const restoredTransform: TransformConfig = {
    rotation: edits?.transform?.rotation ?? 0,
    flipHorizontal: edits?.transform?.flipHorizontal ?? false,
    flipVertical: edits?.transform?.flipVertical ?? false,
  };
  const transformedNaturalSize = getTransformedDimensions(
    naturalSize.width,
    naturalSize.height,
    restoredTransform.rotation,
  );
  const restoredCropRect = normalizeCropRect(
    edits?.crop,
    transformedNaturalSize.width,
    transformedNaturalSize.height,
  );
  const cropPixels = getCropPixelDimensions({
    cropRect: restoredCropRect,
    transformedNaturalSize,
  });

  return {
    cropRect: restoredCropRect,
    resizeConfig: {
      scaleX: edits?.resize?.width ? edits.resize.width / cropPixels.width : 1,
      scaleY:
        edits?.resize?.height ? edits.resize.height / cropPixels.height : 1,
    },
    touchup: {
      brightness: Math.round((edits?.touchup?.brightness ?? 1) * 100),
      contrast: Math.round((edits?.touchup?.contrast ?? 1) * 100),
      saturation: Math.round((edits?.touchup?.saturation ?? 1) * 100),
      sharpen: Math.round((edits?.touchup?.sharpen ?? 0) * 100),
    },
    transform: restoredTransform,
  };
}

// #endregion

// #region Hooks
// =============================================================================

/** Returns server-side draft Files for crop and resize previews. */
function useEditorPreview(params: {
  open: boolean;
  mode: EditMode;
  originalFile: File;
  naturalSize: { width: number; height: number };
  editorState: EditorState;
}) {
  const { open, mode, originalFile, naturalSize, editorState } = params;

  const previewFormat = getImageFormatFromFile(originalFile);

  const cropEdits = useMemo(
    () => buildCropPreviewEdits(editorState.touchup),
    [editorState.touchup],
  );

  const resizeEdits = useMemo(
    () => buildResizePreviewEdits(naturalSize, editorState),
    [naturalSize, editorState],
  );

  const sourceKey = useMemo(
    () => [originalFile.name, originalFile.size, originalFile.lastModified],
    [originalFile],
  );

  const [debouncedCropEdits] = useDebounceValue(cropEdits, PREVIEW_DEBOUNCE_MS);
  const [debouncedResizeEdits] = useDebounceValue(
    resizeEdits,
    PREVIEW_DEBOUNCE_MS,
  );

  // Deliberately NOT using keepPreviousData / placeholderData here. Stale
  // drafts have sharpen (and in resize mode: crop/resize/transform) baked in
  // at old values. CSS filterStyle provides visual continuity during the
  // debounce window, so there's no flash when the draft clears.
  const cropPreviewQuery = useQuery({
    queryKey: ['editor-crop-preview', sourceKey, debouncedCropEdits],
    queryFn: ({ signal }) =>
      convertImage(
        originalFile,
        { edits: debouncedCropEdits, quality: 100, format: previewFormat },
        { signal },
      ),
    enabled: open && mode === 'crop' && debouncedCropEdits !== undefined,
    staleTime: Infinity,
  });

  const resizePreviewQuery = useQuery({
    queryKey: ['editor-resize-preview', sourceKey, debouncedResizeEdits],
    queryFn: ({ signal }) =>
      convertImage(
        originalFile,
        { edits: debouncedResizeEdits, quality: 100, format: previewFormat },
        { signal },
      ),
    enabled: open && mode === 'resize' && debouncedResizeEdits !== undefined,
    staleTime: Infinity,
  });

  const cropDraftFile =
    open && cropPreviewQuery.data ? cropPreviewQuery.data : undefined;
  const resizeDraftFile =
    open && resizePreviewQuery.data ? resizePreviewQuery.data : undefined;

  return { cropDraftFile, resizeDraftFile };
}

function usePreviewBounds(open: boolean) {
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const [previewBounds, setPreviewBounds] = useState({
    width: 0,
    maxHeight: 0,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
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
    const observer = new ResizeObserver(updatePreviewBounds);
    observer.observe(viewport);
    window.addEventListener('resize', updatePreviewBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreviewBounds);
    };
  }, [open]);

  return { previewViewportRef, previewBounds };
}

function usePreviewZoom(open: boolean) {
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => {
    if (!open) {
      setPreviewZoom(1);
    }
  }, [open]);

  const clampPreviewZoom = useCallback((value: number) => {
    return clamp(value, PREVIEW_MIN_ZOOM, PREVIEW_MAX_ZOOM);
  }, []);

  const zoomInPreview = useCallback(() => {
    setPreviewZoom((prev) => clampPreviewZoom(prev + PREVIEW_ZOOM_STEP));
  }, [clampPreviewZoom]);

  const zoomOutPreview = useCallback(() => {
    setPreviewZoom((prev) => clampPreviewZoom(prev - PREVIEW_ZOOM_STEP));
  }, [clampPreviewZoom]);

  const resetPreviewZoom = useCallback(() => {
    setPreviewZoom(1);
  }, []);

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (
        event.target instanceof Element &&
        event.target.closest('button, input, [role="slider"]')
      ) {
        return;
      }
      event.preventDefault();
      const factor = 1 - event.deltaY * PREVIEW_SCROLL_ZOOM_SENSITIVITY;
      setPreviewZoom((prev) => clampPreviewZoom(prev * factor));
    },
    [clampPreviewZoom],
  );

  const handlePreviewDoubleClick = useCallback(() => {
    setPreviewZoom((prev) => (prev > 1 ? 1 : 2));
  }, []);

  return {
    previewZoom,
    zoomInPreview,
    zoomOutPreview,
    resetPreviewZoom,
    handlePreviewWheel,
    handlePreviewDoubleClick,
  };
}

// #endregion

// #region Subcomponents
// =============================================================================

type PreviewCanvasProps = {
  open: boolean;
  mode: EditMode;
  setMode: React.Dispatch<React.SetStateAction<EditMode>>;
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  cropSourceFile: File;
  resizeSourceFile: File;
  hasCropDraft: boolean;
  hasResizeDraft: boolean;
  filename: string;
  naturalSize: { width: number; height: number };
  filterStyle: React.CSSProperties;
  onImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  previewZoom: number;
  zoomInPreview: () => void;
  zoomOutPreview: () => void;
  resetPreviewZoom: () => void;
  handlePreviewWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  handlePreviewDoubleClick: () => void;
};

type PreviewCanvasContextValue = PreviewCanvasProps & {
  cropDragRef: React.RefObject<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startRect: NormalizedCropRect;
  } | null>;
  resizeDragRef: React.RefObject<{
    handle: ResizeDragHandle;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>;
  previewViewportRef: React.RefObject<HTMLDivElement | null>;
  previewBounds: { width: number; maxHeight: number };
  transformedNaturalSize: { width: number; height: number };
  previewTransform: string;
  updateResizeDimensions: (
    nextWidth: number,
    nextHeight: number,
    targetAxis: ResizeTargetAxis,
    preserveAspectRatio?: boolean,
  ) => void;
};

const PreviewCanvasContext = createContext<PreviewCanvasContextValue | null>(
  null,
);

function usePreviewCanvasContext() {
  const context = useContext(PreviewCanvasContext);
  if (!context) {
    throw new Error('PreviewCanvasContext must be used within provider');
  }
  return context;
}

type PreviewCanvasProviderProps = PreviewCanvasProps & {
  children: React.ReactNode;
};

const PreviewCanvasProvider: React.FC<PreviewCanvasProviderProps> = (props) => {
  const { open, editorState, setEditorState, naturalSize, children, ...rest } =
    props;
  const { transform } = editorState;

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
  const { previewViewportRef, previewBounds } = usePreviewBounds(open);

  useEffect(() => {
    if (!open) {
      cropDragRef.current = null;
      resizeDragRef.current = null;
    }
  }, [open]);

  const transformedNaturalSize = useMemo(
    () =>
      getTransformedDimensions(
        naturalSize.width,
        naturalSize.height,
        transform.rotation,
      ),
    [naturalSize.height, naturalSize.width, transform.rotation],
  );

  const previewTransform = useMemo(() => {
    const scaleX = transform.flipHorizontal ? -1 : 1;
    const scaleY = transform.flipVertical ? -1 : 1;
    return `rotate(${transform.rotation}deg) scaleX(${scaleX}) scaleY(${scaleY})`;
  }, [transform.flipHorizontal, transform.flipVertical, transform.rotation]);

  const updateResizeDimensions = useCallback(
    (
      nextWidth: number,
      nextHeight: number,
      targetAxis: ResizeTargetAxis,
      shouldPreserveAspectRatio = false,
    ) => {
      setEditorState((prev) => {
        const cropPixels = getCropPixelDimensions({
          cropRect: prev.cropRect,
          transformedNaturalSize,
        });
        const safeAspect = Math.max(
          cropPixels.width / Math.max(cropPixels.height, Number.EPSILON),
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

        if (!shouldPreserveAspectRatio) {
          const scaleX = clampedWidth / cropPixels.width;
          const scaleY = clampedHeight / cropPixels.height;
          if (
            scaleX === prev.resizeConfig.scaleX &&
            scaleY === prev.resizeConfig.scaleY
          ) {
            return prev;
          }
          return { ...prev, resizeConfig: { scaleX, scaleY } };
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
          if (
            Math.abs(clampedWidth - widthFromHeight) <=
            Math.abs(clampedHeight - heightFromWidth)
          ) {
            width = clampedWidth;
            height = heightFromWidth;
          } else {
            width = widthFromHeight;
            height = clampedHeight;
          }
        }

        const scaleX = width / cropPixels.width;
        const scaleY = height / cropPixels.height;
        if (
          scaleX === prev.resizeConfig.scaleX &&
          scaleY === prev.resizeConfig.scaleY
        ) {
          return prev;
        }
        return { ...prev, resizeConfig: { scaleX, scaleY } };
      });
    },
    [setEditorState, transformedNaturalSize],
  );

  const contextValue = useMemo<PreviewCanvasContextValue>(
    () => ({
      open,
      editorState,
      setEditorState,
      naturalSize,
      ...rest,
      cropDragRef,
      resizeDragRef,
      previewViewportRef,
      previewBounds,
      transformedNaturalSize,
      previewTransform,
      updateResizeDimensions,
    }),
    [
      open,
      editorState,
      setEditorState,
      naturalSize,
      rest,
      previewBounds,
      previewTransform,
      transformedNaturalSize,
      updateResizeDimensions,
      previewViewportRef,
    ],
  );

  return (
    <PreviewCanvasContext.Provider value={contextValue}>
      {children}
    </PreviewCanvasContext.Provider>
  );
};

const PreviewTransformControls: React.FC = () => {
  const { setEditorState, editorState } = usePreviewCanvasContext();
  const { transform } = editorState;

  return (
    <div className='absolute top-2 left-2 z-30 flex items-center gap-2 rounded-md p-1'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            aria-label='Rotate left'
            onClick={() => {
              setEditorState((prev) => ({
                ...prev,
                cropRect: rotateCropRectLeft(prev.cropRect),
                resizeConfig: {
                  scaleX: prev.resizeConfig.scaleY,
                  scaleY: prev.resizeConfig.scaleX,
                },
                transform: {
                  ...prev.transform,
                  rotation: rotateLeft(prev.transform.rotation),
                },
              }));
            }}
          >
            <RotateCcw className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Rotate left</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            aria-label='Rotate right'
            onClick={() => {
              setEditorState((prev) => ({
                ...prev,
                cropRect: rotateCropRectRight(prev.cropRect),
                resizeConfig: {
                  scaleX: prev.resizeConfig.scaleY,
                  scaleY: prev.resizeConfig.scaleX,
                },
                transform: {
                  ...prev.transform,
                  rotation: rotateRight(prev.transform.rotation),
                },
              }));
            }}
          >
            <RotateCw className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Rotate right</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={transform.flipHorizontal ? 'secondary' : 'ghost'}
            size='icon'
            className='h-8 w-8'
            aria-label='Flip horizontally'
            onClick={() => {
              setEditorState((prev) => ({
                ...prev,
                cropRect: {
                  ...prev.cropRect,
                  x: 1 - prev.cropRect.x - prev.cropRect.width,
                },
                transform: {
                  ...prev.transform,
                  flipHorizontal: !prev.transform.flipHorizontal,
                },
              }));
            }}
          >
            <FlipHorizontal className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Flip horizontal</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={transform.flipVertical ? 'secondary' : 'ghost'}
            size='icon'
            className='h-8 w-8'
            aria-label='Flip vertically'
            onClick={() => {
              setEditorState((prev) => ({
                ...prev,
                cropRect: {
                  ...prev.cropRect,
                  y: 1 - prev.cropRect.y - prev.cropRect.height,
                },
                transform: {
                  ...prev.transform,
                  flipVertical: !prev.transform.flipVertical,
                },
              }));
            }}
          >
            <FlipVertical className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Flip vertical</TooltipContent>
      </Tooltip>
    </div>
  );
};

const PreviewModeControls: React.FC = () => {
  const { mode, setMode } = usePreviewCanvasContext();
  return (
    <div className='absolute top-2 right-2 z-30 flex items-center gap-2 rounded-md p-1'>
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
  );
};

const PreviewZoomControls: React.FC = () => {
  const { previewZoom, zoomInPreview, zoomOutPreview, resetPreviewZoom } =
    usePreviewCanvasContext();
  const zoomPercent = Math.round(previewZoom * 100);
  return (
    <div className='absolute top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-black/40 px-2 py-1 backdrop-blur-sm'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            aria-label='Zoom out'
            onClick={zoomOutPreview}
          >
            <ZoomOut className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Zoom out</TooltipContent>
      </Tooltip>
      <Button
        variant='ghost'
        className='h-8 min-w-[4.5rem] px-2 text-xs tabular-nums'
        onClick={resetPreviewZoom}
        aria-label='Reset zoom'
      >
        {zoomPercent}%
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            aria-label='Zoom in'
            onClick={zoomInPreview}
          >
            <ZoomIn className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>Zoom in</TooltipContent>
      </Tooltip>
    </div>
  );
};

const PreviewCropStage: React.FC = () => {
  const {
    cropSourceFile,
    hasCropDraft,
    filename,
    naturalSize,
    transformedNaturalSize,
    editorState,
    setEditorState,
    previewBounds,
    previewZoom,
    filterStyle,
    previewTransform,
    onImageLoad,
    cropDragRef,
    resizeDragRef,
  } = usePreviewCanvasContext();
  const { cropRect, resizeConfig } = editorState;
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const cropStyle = useMemo(
    () => ({
      left: `${cropRect.x * 100}%`,
      top: `${cropRect.y * 100}%`,
      width: `${cropRect.width * 100}%`,
      height: `${cropRect.height * 100}%`,
    }),
    [cropRect],
  );

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
    [cropDragRef, cropRect],
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
        let nextLeft = startRect.x,
          nextTop = startRect.y;
        let nextRight = startRect.x + startRect.width,
          nextBottom = startRect.y + startRect.height;
        if (handle.includes('w')) {
          nextLeft = clamp(startRect.x + dx, 0, nextRight - MIN_CROP_SIZE);
        }
        if (handle.includes('e')) {
          nextRight = clamp(nextRight + dx, nextLeft + MIN_CROP_SIZE, 1);
        }
        if (handle.includes('n')) {
          nextTop = clamp(startRect.y + dy, 0, nextBottom - MIN_CROP_SIZE);
        }
        if (handle.includes('s')) {
          nextBottom = clamp(nextBottom + dy, nextTop + MIN_CROP_SIZE, 1);
        }
        x = nextLeft;
        y = nextTop;
        rectWidth = nextRight - nextLeft;
        rectHeight = nextBottom - nextTop;
      }

      setEditorState((prev) => ({
        ...prev,
        cropRect: { x, y, width: rectWidth, height: rectHeight },
      }));
    },
    [cropDragRef, setEditorState],
  );

  const cropPreview = useMemo(() => {
    const safeNaturalWidth = Math.max(naturalSize.width, 1);
    const safeNaturalHeight = Math.max(naturalSize.height, 1);
    const safeTransformedWidth = Math.max(transformedNaturalSize.width, 1);
    const safeTransformedHeight = Math.max(transformedNaturalSize.height, 1);
    const scaledTransformedWidth = safeTransformedWidth * resizeConfig.scaleX;
    const scaledTransformedHeight = safeTransformedHeight * resizeConfig.scaleY;
    const fallbackW = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const fallbackH = typeof window === 'undefined' ? 768 : window.innerHeight;
    const availableWidth = Math.max(
      (previewBounds.width > PREVIEW_STAGE_PADDING ?
        previewBounds.width
      : fallbackW) - PREVIEW_STAGE_PADDING,
      1,
    );
    const availableHeight = Math.max(
      previewBounds.maxHeight > 0 ?
        previewBounds.maxHeight
      : fallbackH * PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
      1,
    );
    const baseScale = Math.min(
      1,
      availableWidth / Math.max(scaledTransformedWidth, Number.EPSILON),
      availableHeight / Math.max(scaledTransformedHeight, Number.EPSILON),
    );
    const scale = baseScale * previewZoom;

    // filterStyle is ALWAYS spread into imageStyle regardless of whether a
    // server-side draft is being used. This is critical: the draft only
    // contains sharpen, so CSS must handle brightness/contrast/saturation.
    // Conditionally skipping filterStyle was the root cause of touchup desync
    // between crop and resize views.
    return {
      frameStyle: {
        width: `${scaledTransformedWidth * scale}px`,
        height: `${scaledTransformedHeight * scale}px`,
      },
      imageStyle: {
        ...filterStyle,
        width: `${safeNaturalWidth * resizeConfig.scaleX * scale}px`,
        height: `${safeNaturalHeight * resizeConfig.scaleY * scale}px`,
        transform: `translate(-50%, -50%) ${previewTransform}`,
        transformOrigin: 'center',
      } satisfies React.CSSProperties,
    };
  }, [
    filterStyle,
    naturalSize,
    previewBounds,
    previewZoom,
    previewTransform,
    resizeConfig,
    transformedNaturalSize,
  ]);

  return (
    <div
      ref={cropContainerRef}
      className='relative inline-block'
      onPointerMove={onCropPointerMove}
      onPointerUp={() => {
        cropDragRef.current = null;
        resizeDragRef.current = null;
      }}
      onPointerCancel={() => {
        cropDragRef.current = null;
        resizeDragRef.current = null;
      }}
    >
      <div className='relative overflow-hidden' style={cropPreview.frameStyle}>
        <FileImage
          file={cropSourceFile}
          alt={filename}
          className='absolute top-1/2 left-1/2 max-h-none max-w-none select-none'
          style={cropPreview.imageStyle}
          onLoad={(event) => {
            if (!hasCropDraft) {
              onImageLoad(event);
            }
          }}
          draggable={false}
        />
      </div>
      <div
        className='border-primary pointer-events-auto absolute border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
        style={cropStyle}
        onPointerDown={(event) => {
          onCropPointerDown('move', event);
        }}
      >
        {handles.map((handle) => (
          <button
            key={handle}
            type='button'
            className={cn(
              'absolute z-10 flex h-6 w-6 touch-none items-center justify-center rounded-full',
              getHandlePosition(handle),
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
        ))}
      </div>
    </div>
  );
};

const PreviewResizeStage: React.FC = () => {
  const {
    resizeSourceFile,
    hasResizeDraft,
    filename,
    naturalSize,
    transformedNaturalSize,
    previewBounds,
    previewZoom,
    filterStyle,
    previewTransform,
    onImageLoad,
    editorState,
    resizeDragRef,
    cropDragRef,
    updateResizeDimensions,
  } = usePreviewCanvasContext();
  const { resizeConfig, cropRect } = editorState;
  const isUsingOriginalPreview = !hasResizeDraft;

  const resizePixelDimensions = useMemo(
    () =>
      getResizePixelDimensions({
        cropRect,
        transformedNaturalSize,
        resizeConfig,
      }),
    [cropRect, resizeConfig, transformedNaturalSize],
  );

  const resizePreviewScale = useMemo(() => {
    const cropPixels = getCropPixelDimensions({
      cropRect,
      transformedNaturalSize,
    });
    const frameW = Math.max(resizePixelDimensions.width, 1);
    const frameH = Math.max(resizePixelDimensions.height, 1);
    const stageW = Math.max(frameW, cropPixels.width);
    const stageH = Math.max(frameH, cropPixels.height);
    const fallbackW = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const fallbackH = typeof window === 'undefined' ? 768 : window.innerHeight;
    const availW = Math.max(
      (previewBounds.width > PREVIEW_STAGE_PADDING ?
        previewBounds.width
      : fallbackW) - PREVIEW_STAGE_PADDING,
      1,
    );
    const availH = Math.max(
      previewBounds.maxHeight > 0 ?
        previewBounds.maxHeight
      : fallbackH * PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
      1,
    );
    return Math.min(1, availW / stageW, availH / stageH) * previewZoom;
  }, [
    cropRect,
    previewBounds,
    previewZoom,
    resizePixelDimensions,
    transformedNaturalSize,
  ]);

  const onResizePointerDown = useCallback(
    (handle: ResizeDragHandle, event: React.PointerEvent<HTMLElement>) => {
      resizeDragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: resizePixelDimensions.width,
        startHeight: resizePixelDimensions.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [resizeDragRef, resizePixelDimensions],
  );

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeDragRef.current) {
        return;
      }
      const { handle, startX, startY, startWidth, startHeight } =
        resizeDragRef.current;
      const logicalScale = Math.max(resizePreviewScale, Number.EPSILON);
      const dx = ((event.clientX - startX) * 2) / logicalScale;
      const dy = ((event.clientY - startY) * 2) / logicalScale;
      let nextWidth = startWidth,
        nextHeight = startHeight;
      let targetAxis: ResizeTargetAxis = 'auto';
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
      updateResizeDimensions(
        nextWidth,
        nextHeight,
        targetAxis,
        handle.length === 2,
      );
    },
    [resizeDragRef, resizePreviewScale, updateResizeDimensions],
  );

  const resizePreview = useMemo(() => {
    const safeNW = Math.max(naturalSize.width, 1);
    const safeNH = Math.max(naturalSize.height, 1);
    const safeTW = Math.max(transformedNaturalSize.width, 1);
    const safeTH = Math.max(transformedNaturalSize.height, 1);
    const cropPixels = getCropPixelDimensions({
      cropRect,
      transformedNaturalSize,
    });
    const { scaleX, scaleY } = resizeConfig;
    const frameW = Math.max(resizePixelDimensions.width, 1);
    const frameH = Math.max(resizePixelDimensions.height, 1);
    const stageW = Math.max(frameW, cropPixels.width);
    const stageH = Math.max(frameH, cropPixels.height);
    const scale = resizePreviewScale;
    const dStageW = stageW * scale,
      dStageH = stageH * scale;
    const dFrameW = frameW * scale,
      dFrameH = frameH * scale;
    const imgW = safeNW * scaleX * scale,
      imgH = safeNH * scaleY * scale;
    const tPlaneW = safeTW * scaleX * scale,
      tPlaneH = safeTH * scaleY * scale;

    // Both paths spread filterStyle for the same reason as crop mode (see
    // comment in cropPreview). The draft path omits previewTransform because
    // the server-side draft already has rotation/flip baked in.
    const defaultImageStyle = {
      ...filterStyle,
      width: '100%',
      height: '100%',
      objectFit: 'fill',
      transform: 'translate(-50%, -50%)',
      transformOrigin: 'center',
    } satisfies React.CSSProperties;
    const editingImageStyle = {
      ...filterStyle,
      width: `${imgW}px`,
      height: `${imgH}px`,
      transform: `translate(-50%, -50%) ${previewTransform}`,
      transformOrigin: 'center',
    } satisfies React.CSSProperties;

    return {
      stageStyle: { width: `${dStageW}px`, height: `${dStageH}px` },
      frameStyle: { width: `${dFrameW}px`, height: `${dFrameH}px` },
      transformedPlaneStyle: {
        width: isUsingOriginalPreview ? `${tPlaneW}px` : `${dFrameW}px`,
        height: isUsingOriginalPreview ? `${tPlaneH}px` : `${dFrameH}px`,
        transform:
          isUsingOriginalPreview ?
            `translate(${-cropRect.x * tPlaneW}px, ${-cropRect.y * tPlaneH}px)`
          : 'none',
      },
      imageStyle:
        isUsingOriginalPreview ? editingImageStyle : defaultImageStyle,
    };
  }, [
    cropRect,
    filterStyle,
    isUsingOriginalPreview,
    naturalSize,
    transformedNaturalSize,
    resizeConfig,
    resizePixelDimensions,
    resizePreviewScale,
    previewTransform,
  ]);

  return (
    <div
      className='relative inline-block'
      onPointerUp={() => {
        cropDragRef.current = null;
        resizeDragRef.current = null;
      }}
      onPointerCancel={() => {
        cropDragRef.current = null;
        resizeDragRef.current = null;
      }}
    >
      <div
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
            <div
              className='absolute top-0 left-0'
              style={resizePreview.transformedPlaneStyle}
            >
              <FileImage
                file={resizeSourceFile}
                alt={filename}
                className='absolute top-1/2 left-1/2 max-h-none max-w-none select-none'
                style={resizePreview.imageStyle}
                onLoad={(event) => {
                  if (isUsingOriginalPreview) {
                    onImageLoad(event);
                  }
                }}
                draggable={false}
              />
            </div>
            <div className='pointer-events-none absolute inset-0 border-2 border-white/70' />
          </div>
          {resizeHandles.map((handle) => (
            <button
              key={handle}
              type='button'
              className={cn(
                'absolute z-10 flex h-6 w-6 touch-none items-center justify-center rounded-full',
                getHandlePosition(handle),
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
          ))}
        </div>
      </div>
    </div>
  );
};

const PreviewDimensionsIndicator: React.FC = () => {
  const { editorState, transformedNaturalSize, updateResizeDimensions } =
    usePreviewCanvasContext();
  const { resizeConfig, cropRect } = editorState;
  const [isOpen, setIsOpen] = useState(false);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const displayedDimensions = useMemo(
    () =>
      getResizePixelDimensions({
        cropRect,
        transformedNaturalSize,
        resizeConfig,
      }),
    [cropRect, resizeConfig, transformedNaturalSize],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (popoverRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest('[data-dimensions-indicator-button="true"]')
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isOpen]);

  return (
    <div className='absolute right-2 bottom-2 z-30'>
      {isOpen && (
        <div className='pointer-events-none absolute right-0 bottom-full mb-2'>
          <div
            ref={popoverRef}
            className='bg-popover text-popover-foreground pointer-events-auto w-72 rounded-md border p-4 shadow-md'
          >
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>Dimensions</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type='button'
                      variant={lockAspectRatio ? 'secondary' : 'ghost'}
                      size='icon'
                      className='h-8 w-8'
                      onClick={() => {
                        setLockAspectRatio((prev) => !prev);
                      }}
                      aria-pressed={lockAspectRatio}
                      aria-label={
                        lockAspectRatio ?
                          'Unlock aspect ratio'
                        : 'Lock aspect ratio'
                      }
                    >
                      {lockAspectRatio ?
                        <Lock className='h-4 w-4' />
                      : <LockOpen className='h-4 w-4' />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top'>
                    {lockAspectRatio ?
                      'Unlock aspect ratio'
                    : 'Lock aspect ratio'}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <Input
                  type='number'
                  min={MIN_RESIZE_DIMENSION}
                  max={MAX_RESIZE_DIMENSION}
                  value={displayedDimensions.width}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      updateResizeDimensions(
                        v,
                        displayedDimensions.height,
                        'width',
                        lockAspectRatio,
                      );
                    }
                  }}
                  aria-label='Width in pixels'
                />
                <Input
                  type='number'
                  min={MIN_RESIZE_DIMENSION}
                  max={MAX_RESIZE_DIMENSION}
                  value={displayedDimensions.height}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      updateResizeDimensions(
                        displayedDimensions.width,
                        v,
                        'height',
                        lockAspectRatio,
                      );
                    }
                  }}
                  aria-label='Height in pixels'
                />
              </div>
              <div className='text-muted-foreground grid grid-cols-2 gap-2 text-xs'>
                <span>Width (px)</span>
                <span>Height (px)</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <Button
        variant='secondary'
        className='h-8 rounded-md px-2 font-mono text-xs'
        aria-label='Set image dimensions'
        data-dimensions-indicator-button='true'
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        {displayedDimensions.width} x {displayedDimensions.height}px
      </Button>
    </div>
  );
};

const PreviewCanvasViewport: React.FC = () => {
  const {
    mode,
    previewViewportRef,
    handlePreviewWheel,
    handlePreviewDoubleClick,
  } = usePreviewCanvasContext();
  return (
    <div className='space-y-3'>
      <div className='relative p-3'>
        <div
          ref={previewViewportRef}
          className='bg-background relative flex h-[55vh] items-center justify-center overflow-auto rounded-md border p-2 pt-14 sm:pt-16'
          onWheel={handlePreviewWheel}
          onDoubleClick={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest('button, input, [role="slider"]')
            ) {
              return;
            }
            handlePreviewDoubleClick();
          }}
        >
          <PreviewTransformControls />
          <PreviewZoomControls />
          <PreviewModeControls />
          {mode === 'crop' ?
            <PreviewCropStage />
          : <PreviewResizeStage />}
          <PreviewDimensionsIndicator />
        </div>
      </div>
    </div>
  );
};

const PreviewCanvas: React.FC<PreviewCanvasProps> = (props) => {
  return (
    <PreviewCanvasProvider {...props}>
      <PreviewCanvasViewport />
    </PreviewCanvasProvider>
  );
};

type TouchupControlsProps = {
  open: boolean;
  touchup: TouchupConfig;
  setTouchup: (updater: (prev: TouchupConfig) => TouchupConfig) => void;
};

const TouchupControls: React.FC<TouchupControlsProps> = ({
  open,
  touchup,
  setTouchup,
}) => {
  const [activeTouchupControl, setActiveTouchupControl] =
    useState<TouchupControl | null>(null);
  const touchupPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setActiveTouchupControl(null);
    }
  }, [open]);

  const activeTouchupMeta = useMemo(
    () => touchupControls.find((c) => c.id === activeTouchupControl),
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

  return (
    <div className='relative'>
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
                {activeTouchupMeta.formatValue(touchup[activeTouchupMeta.id])}
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
                    activeTouchupControl === control.id ? 'secondary' : 'ghost'
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
  );
};

// #endregion

// #region Main component
// =============================================================================

export const ImageEditorDialog: React.FC<ImageEditorDialogProps> = ({
  image,
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EditMode>('crop');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  // Single state object -- all mutations go through setEditorState to ensure
  // atomicity. Do NOT split this into separate useState hooks for cropRect,
  // resizeConfig, etc., as that causes intermediate renders with mixed
  // old/new values across the different fields.
  const [editorState, setEditorState] =
    useState<EditorState>(DEFAULT_EDITOR_STATE);

  const {
    previewZoom,
    zoomInPreview,
    zoomOutPreview,
    resetPreviewZoom,
    handlePreviewWheel,
    handlePreviewDoubleClick,
  } = usePreviewZoom(open);

  // Initialize internal state when dialog opens
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setEditorState(
        restoreEditorState(image.transformations.edits, naturalSize),
      );
    }
    wasOpenRef.current = open;
  }, [open, image.transformations.edits, naturalSize]);

  // Internal preview via react-query
  const { cropDraftFile, resizeDraftFile } = useEditorPreview({
    open,
    mode,
    originalFile: image.originalFile,
    naturalSize,
    editorState,
  });

  const cropSourceFile = cropDraftFile ?? image.originalFile;
  const resizeSourceFile = resizeDraftFile ?? image.originalFile;

  const filterStyle = useMemo(
    () => ({
      filter: `brightness(${editorState.touchup.brightness}%) contrast(${editorState.touchup.contrast}%) saturate(${editorState.touchup.saturation}%)`,
    }),
    [
      editorState.touchup.brightness,
      editorState.touchup.contrast,
      editorState.touchup.saturation,
    ],
  );

  const handlePreviewImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setNaturalSize({
        width: event.currentTarget.naturalWidth,
        height: event.currentTarget.naturalHeight,
      });
    },
    [],
  );

  const handleResetToOriginal = useCallback(() => {
    setEditorState(DEFAULT_EDITOR_STATE);
  }, []);

  // Dispatch to ManagedImage only on close, not during editing. This prevents
  // the outer image list from re-converting on every slider tick.
  const handleClose = useCallback(() => {
    const edits = buildEditsFromState(naturalSize, editorState);
    image.setTransformations({ ...image.transformations, edits });
    setOpen(false);
    setMode('crop');
  }, [naturalSize, editorState, image]);

  const setTouchup = useCallback(
    (updater: (prev: TouchupConfig) => TouchupConfig) => {
      setEditorState((prev) => ({ ...prev, touchup: updater(prev.touchup) }));
    },
    [],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setOpen(true);
        } else {
          handleClose();
        }
      }}
    >
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
          <DialogTitle className='truncate pb-2'>
            Editing {image.filename}
          </DialogTitle>
        </DialogHeader>

        <PreviewCanvas
          open={open}
          mode={mode}
          setMode={setMode}
          editorState={editorState}
          setEditorState={setEditorState}
          cropSourceFile={cropSourceFile}
          resizeSourceFile={resizeSourceFile}
          hasCropDraft={Boolean(cropDraftFile)}
          hasResizeDraft={Boolean(resizeDraftFile)}
          filename={image.filename}
          naturalSize={naturalSize}
          filterStyle={filterStyle}
          onImageLoad={handlePreviewImageLoad}
          previewZoom={previewZoom}
          zoomInPreview={zoomInPreview}
          zoomOutPreview={zoomOutPreview}
          resetPreviewZoom={resetPreviewZoom}
          handlePreviewWheel={handlePreviewWheel}
          handlePreviewDoubleClick={handlePreviewDoubleClick}
        />

        <TouchupControls
          open={open}
          touchup={editorState.touchup}
          setTouchup={setTouchup}
        />

        <DialogFooter className='mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between'>
          <Button
            variant='ghost'
            onClick={() => {
              handleResetToOriginal();
              resetPreviewZoom();
            }}
          >
            <RotateCcw />
            Revert to Original
          </Button>
          <Button variant='outline' onClick={handleClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// #endregion
