import 'client-only';

import { useCallback, useEffect, useState } from 'react';

import { useLocalStorage } from 'usehooks-ts';
import * as uuid from 'uuid';
import { z } from 'zod';

import { convertImage, imageConverterCache } from '@/lib/image-tools';
import type {
  ImageEditOptions,
  ImageTransformations,
} from '@/lib/image-tools/types';
import { IndexedDBCache } from '@/lib/indexeddb';
import { promisePool } from '@/lib/promises/promise-pool';
import {
  IMAGE_FORMAT_MIME_TYPES,
  IMAGE_FORMATS,
  type ImageFormat,
} from '@/lib/vips';

const INDEXEDDB_DB_NAME = 'PersistentImagesDB';
const DEFAULT_IMAGE_QUALITY = 85;
const IMAGE_FORMAT_SET = new Set<string>(IMAGE_FORMATS);

// #region Types and Schemas
// =============================================================================

const ImageTransformationsSchema = z.object({
  format: z.enum(IMAGE_FORMATS).default('png'),
  quality: z.number().int().min(0).max(100).default(DEFAULT_IMAGE_QUALITY),
  edits: z.custom<ImageEditOptions>().optional(),
});

const ImageSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  originalFile: z.instanceof(File),
  preview: z.instanceof(File),
  ready: z.boolean(),
  filename: z.string().default('Image.png'),
  transformations: ImageTransformationsSchema,
});

type ImageType = z.infer<typeof ImageSchema>;

export type ManagedImage = ImageType & {
  setFilename: (name: string) => void;
  setTransformations: (transformations: ImageTransformations) => void;
  remove: () => void;
};

export type ImageID = ManagedImage['id'];

// #endregion

// #region IndexedDB Cache
// =============================================================================

export const imageCache = new IndexedDBCache({
  dbName: INDEXEDDB_DB_NAME,
  dbVersion: 4,
  storeName: 'images',
  schema: ImageSchema,
});

// #endregion

// #region Helper Functions - Image
// =============================================================================

/**
 * Checks if a file is in HEIC/HEIF format.
 *
 * @param file - The file to check
 * @returns Boolean indicating if the file is in HEIC/HEIF format
 */
function isHeic(file: File) {
  return file.type === 'image/heic' || file.type === 'image/heif';
}

/**
 * Converts HEIC/HEIF images to JPEG format.
 *
 * If the input file is not HEIC/HEIF, returns the original file unchanged.
 *
 * @param file - The image file to convert
 * @returns Promise resolving to the converted JPEG file or original file
 */
async function heic2jpeg(file: File): Promise<File> {
  if (!isHeic(file)) {
    return file;
  }
  const { default: heic2any } = await import('heic2any');
  const blob: Blob | Blob[] = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.5,
  });
  const blobs: Blob[] = Array.isArray(blob) ? blob : [blob];
  return new File(blobs, file.name, { type: 'image/jpeg' });
}

/** Creates an ImageType object from a file. */
function fileToImageType(file: File, preferredFormat: ImageFormat): ImageType {
  return {
    id: `${new Date().toISOString()} ${uuid.v4()}`,
    originalFile: file,
    preview: file,
    timestamp: new Date(),
    ready: false,
    filename: file.name,
    transformations: {
      format: preferredFormat,
      quality: DEFAULT_IMAGE_QUALITY,
      edits: undefined,
    },
  };
}

function getImageFormatFromFile(file: File): ImageFormat {
  const mimeType = file.type.toLowerCase();
  for (const format of IMAGE_FORMATS) {
    const type = IMAGE_FORMAT_MIME_TYPES[format];
    if (type === mimeType) {
      return format;
    }
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg') {
    return 'jpeg';
  }
  if (extension && isImageFormat(extension)) {
    return extension;
  }
  return 'png';
}

function isImageFormat(value: string): value is ImageFormat {
  return IMAGE_FORMAT_SET.has(value);
}

// #endregion

// #region Hooks
// =============================================================================

/**
 * Requests persistent storage from the browser if available.
 *
 * This helps prevent the browser from automatically clearing IndexedDB storage
 * when disk space is low.
 */
function enablePersistentStorage() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (navigator.storage && navigator.storage.persist) {
    void navigator.storage.persist().then((isPersisted) => {
      console.info(
        `Storage persistence is ${isPersisted ? 'enabled' : 'not enabled'}`,
      );
    });
  }
}

// #endregion

// #region Main Hook
// =============================================================================

/**
 * A React hook that manages persistent image files with IndexedDB storage.
 *
 * This hook allows uploading, storing, renaming, and removing image files that
 * persist across browser sessions. It automatically handles HEIC/HEIF conversion
 * and creates preview thumbnails. Image conversion (format, quality, edits) is
 * deferred to react-query via useConvertImage.
 *
 * Mutations:
 *  - Saves images to IndexedDB
 *  - Updates images in IndexedDB when modified
 *  - Removes images from IndexedDB when deleted
 *
 * Side Effects:
 *  - Requests persistent storage permission from the browser
 *  - Converts HEIC/HEIF images to JPEG format
 *  - Creates optimized preview thumbnails
 */
export function usePersistentImages(): [
  ManagedImage[],
  (files: FileList | null) => void,
] {
  const [images, setImages] = useState<Record<string, ManagedImage>>({});
  const [preferredFormat] = useLocalStorage<ImageFormat>(
    'preferred-image-format',
    'png',
  );
  useEffect(() => {
    void imageCache.create();
    void imageConverterCache.create();
  }, []);

  /** Updates an image and reflects change in IndexedDB. */
  const updateImageById = useCallback(
    (id: string, data: Partial<ImageType>): void => {
      void imageCache.get(id).then((previousData) => {
        if (!previousData) {
          return;
        }
        void imageCache.set(id, { ...previousData, ...data, id });
      });
      setImages((prevState) => {
        const nextState = { ...prevState };
        if (!(id in nextState)) {
          return nextState;
        }
        nextState[id] = { ...nextState[id], ...data };
        return nextState;
      });
    },
    [],
  );

  /** Removes an image from state and IndexedDB. */
  const removeImageById = useCallback((id: string): void => {
    void imageCache.delete(id);
    setImages((prevState) => {
      return Object.fromEntries(
        Object.entries(prevState).filter(([key]) => key !== id),
      );
    });
  }, []);

  /** Adds image operation functions to the stored image object. */
  const resolveImage = useCallback(
    (image: ImageType): ManagedImage => {
      return {
        ...image,
        remove: () => {
          removeImageById(image.id);
        },
        setFilename: (filename) => {
          updateImageById(image.id, { filename });
        },
        setTransformations: (transformations) => {
          updateImageById(image.id, { transformations });
        },
      };
    },
    [removeImageById, updateImageById],
  );

  // Retrieve files from storage on load.
  useEffect(() => {
    enablePersistentStorage();
    void imageCache.getAll().then((imagesFromCache) => {
      setImages((prevState) => {
        const nextState = { ...prevState };
        imagesFromCache.forEach((image) => {
          nextState[image.id] = resolveImage(image);
        });
        return nextState;
      });
    });
  }, [resolveImage]);

  /** Adds uploaded image files to state and IndexedDB. */
  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) {
        return;
      }

      const newImages = Array.from(files)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, eqeqeq
        .filter((file) => file != null)
        .map((file) => fileToImageType(file, preferredFormat))
        .map((image) => resolveImage(image));

      setImages((prevState) => {
        const nextState = { ...prevState };
        for (const image of newImages) {
          nextState[image.id] = image;
        }
        return nextState;
      });

      const tasks = newImages.map((image) => {
        return async () => {
          try {
            const file = await heic2jpeg(image.originalFile);
            const preview = await convertImage(file, {
              format: 'webp',
              quality: 50,
              width: 128,
              height: 128,
              thumbnail: true,
            });
            const updatedImage: ImageType = {
              ...image,
              originalFile: file,
              preview,
              ready: true,
            };
            void imageCache.set(updatedImage.id, updatedImage);
            setImages((prevState) => ({
              ...prevState,
              [image.id]: resolveImage(updatedImage),
            }));
          } catch (error) {
            console.error(`Error converting image: ${image.filename}\n`, error);
          }
        };
      });
      void promisePool(tasks, 10);
    },
    [resolveImage, preferredFormat],
  );

  const imageList = Array.from(Object.values(images)).toSorted((a, b) =>
    a.id < b.id ? -1 : 1,
  );
  return [imageList, addFiles];
}

// #endregion

// #region Exports
// =============================================================================

export { getImageFormatFromFile };

// #endregion
