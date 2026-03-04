'use client';

import { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { convertImage } from '@/lib/image-tools/convert-image';
import { cn } from '@/lib/utils';
import { Loader } from './loader';

// #region Constants
// =============================================================================

/**
 * MIME types that modern browsers can natively display in an <img> element.
 * Files with types outside this set are converted to webp before display.
 */
const WEB_DISPLAYABLE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

// #endregion

// #region Helper functions
// =============================================================================

function isWebDisplayable(file: File): boolean {
  return WEB_DISPLAYABLE_MIME_TYPES.has(file.type);
}

// #endregion

// #region Hooks
// =============================================================================

/**
 * Resolves a File to a browser-displayable object URL.
 *
 * If the file's MIME type is not natively displayable, converts it to webp
 * first. Properly revokes stale object URLs when the source changes.
 */
function useFileObjectUrl(file: File) {
  const [src, setSrc] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: ['file-image', file.name, file.type, file.lastModified],
    queryFn: async ({ signal }) => {
      if (isWebDisplayable(file)) {
        return file;
      }
      return convertImage(file, { format: 'webp' }, { signal });
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!query.data) {
      setSrc(undefined);
      return;
    }
    const url = URL.createObjectURL(query.data);
    setSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [query.data]);

  return {
    src,
    isPending: query.isPending,
    isLoading: query.isLoading,
  };
}

// #endregion

// #region Main component
// =============================================================================

type FileImageProps = Omit<React.ComponentPropsWithoutRef<'img'>, 'src'> & {
  file: File;
  showLoadingSpinner?: boolean;
};

/**
 * Renders an image from a File object, converting to webp if necessary.
 *
 * Accepts all standard <img> props (except src) plus a File. When the file's
 * MIME type is not natively displayable by browsers (e.g. TIFF, HEIC), it is
 * automatically converted to webp via wasm-vips before display.
 *
 * @param props.file - The image File to display.
 * @param props.showLoadingSpinner - When true, overlays a spinner while the
 *   image is pending (no cached data available yet).
 */
export const FileImage: React.FC<FileImageProps> = ({
  file,
  showLoadingSpinner = false,
  className,
  style,
  alt,
  ...imgProps
}) => {
  const { src, isPending, isLoading } = useFileObjectUrl(file);

  if (isLoading) {
    return (
      <div
        role='img'
        aria-label={alt ?? ''}
        className={cn('bg-muted', className)}
        style={style}
        {...imgProps}
      >
        {showLoadingSpinner && (
          <div className='absolute inset-0 flex items-center justify-center'>
            <Loader className='h-5 w-5' />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {src && (
        <img
          src={src}
          className={className}
          style={style}
          alt={alt}
          {...imgProps}
        />
      )}
      {showLoadingSpinner && isPending && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <Loader className='h-5 w-5' />
        </div>
      )}
    </>
  );
};

// #endregion

// #region Exports
// =============================================================================

export { WEB_DISPLAYABLE_MIME_TYPES, isWebDisplayable };

// #endregion
