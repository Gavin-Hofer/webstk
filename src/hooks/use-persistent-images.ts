import 'client-only';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocalStorage } from 'usehooks-ts';
import * as uuid from 'uuid';
import { z } from 'zod';

import {
  convertImage,
  IMAGE_FORMATS,
  type ImageFormat,
} from '@/lib/client/image-tools';
import { IndexedDBCache } from '@/lib/indexeddb';
import { promisePool } from '@/lib/promises/promise-pool';

const INDEXEDDB_DB_NAME = 'ImageConverterDB';
const DEFAULT_IMAGE_QUALITY = 85;

// #region Types and Schemas
// =============================================================================

const ImageSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  file: z.instanceof(File),
  preview: z.instanceof(File),
  ready: z.boolean(),
  filename: z.string().default('Image.png'),
  format: z.enum(IMAGE_FORMATS).default('png'),
  quality: z.number().int().min(0).max(100).default(DEFAULT_IMAGE_QUALITY),
});

type ImageType = z.infer<typeof ImageSchema>;

export type ManagedImage = ImageType & {
  setFilename: (name: string) => void;
  setFormat: (format: ImageFormat) => void;
  setQuality: (quality: number) => void;
  remove: () => void;
};

export type ImageID = ManagedImage['id'];

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
 * Converts HEIC/HEIF images to PNG format.
 *
 * If the input file is not HEIC/HEIF, returns the original file unchanged.
 *
 * @param file - The image file to convert
 * @returns Promise resolving to the converted PNG file or original file
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

/** Creates a ImageType object from a file. */
function fileToImageType(file: File, preferredFormat: ImageFormat) {
  return {
    // Use the current datetime followed by random uuid so images maintain order
    id: `${new Date().toISOString()} ${uuid.v4()}`,
    file,
    preview: file,
    timestamp: new Date(),
    ready: false,
    filename: file.name,
    format: preferredFormat,
    quality: DEFAULT_IMAGE_QUALITY,
  } satisfies ImageType;
}

// #endregion

// #region Image cache hooks
// =============================================================================

function useImageCache() {
  const cacheRef = useRef(
    new IndexedDBCache({
      dbName: INDEXEDDB_DB_NAME,
      dbVersion: 2,
      storeName: 'images',
      schema: ImageSchema,
    }),
  );

  const getAllFromCache = useCallback(() => {
    const cache = cacheRef.current;
    return cache.getAll();
  }, []);

  const removeFromCache = useCallback((id: string) => {
    const cache = cacheRef.current;
    return cache.delete(id);
  }, []);

  const saveToCache = useCallback((image: ImageType) => {
    const cache = cacheRef.current;
    return cache.set(image.id, image);
  }, []);

  const updateCache = useCallback((id: string, data: Partial<ImageType>) => {
    const cache = cacheRef.current;
    return cache.$db(async () => {
      const existing = await cache.get(id);
      if (!existing) {
        return;
      }
      const newData = { ...existing, ...data, id };
      await cache.set(id, newData);
    });
  }, []);

  return {
    getAllFromCache,
    removeFromCache,
    saveToCache,
    updateCache,
  };
}

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
 * and creates preview images.
 *
 * Mutations:
 *  - Saves images to IndexedDB
 *  - Updates images in IndexedDB when renamed
 *  - Removes images from IndexedDB when deleted
 *
 * Side Effects:
 *  - Requests persistent storage permission from the browser
 *  - Converts HEIC/HEIF images to PNG format
 *  - Creates optimized preview images
 *
 * @param None
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
  const { getAllFromCache, saveToCache, removeFromCache, updateCache } =
    useImageCache();

  /** Renames an image and reflects change in IndexedDB. */
  const updateImageById = useCallback(
    (id: string, data: Partial<ImageType>): void => {
      void updateCache(id, data);
      setImages((prevState) => {
        const nextState = { ...prevState };
        if (!(id in nextState)) {
          return nextState;
        }
        nextState[id] = { ...nextState[id], ...data };
        return nextState;
      });
    },
    [updateCache],
  );

  /** Removes an image from state and IndexedDB. */
  const removeImageById = useCallback(
    (id: string): void => {
      void removeFromCache(id);
      setImages((prevState) => {
        return Object.fromEntries(
          Object.entries(prevState).filter(([key]) => key !== id),
        );
      });
    },
    [removeFromCache],
  );

  /** Adds remove and rename functions to the ImageFile object. */
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
        setFormat: (format) => {
          updateImageById(image.id, { format });
        },
        setQuality: (quality) => {
          updateImageById(image.id, { quality });
        },
      };
    },
    [removeImageById, updateImageById],
  );

  // Retrieve files from storage on load.
  useEffect(() => {
    enablePersistentStorage();
    void getAllFromCache().then((imagesFromCache) => {
      setImages((prevState) => {
        const nextState = { ...prevState };
        imagesFromCache.forEach((image) => {
          nextState[image.id] = resolveImage(image);
        });
        return nextState;
      });
    });
  }, [resolveImage, getAllFromCache]);

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

      // Add files to the state.
      setImages((prevState) => {
        const nextState = { ...prevState };
        for (const image of newImages) {
          nextState[image.id] = image;
        }
        return nextState;
      });

      // Convert any HEIC images to JPEG and save to indexedDB.
      const tasks = newImages.map((image) => {
        return async () => {
          try {
            // HEIC is not supported by wasm-vips, so need to convert it first.
            const file = await heic2jpeg(image.file);
            const preview = await convertImage(file, {
              format: 'webp',
              quality: 50,
              width: 128,
              height: 128,
            });
            const updatedImage = { ...image, file, preview, ready: true };
            void saveToCache(updatedImage);
            setImages((prevState) => ({
              ...prevState,
              [image.id]: updatedImage,
            }));
          } catch (error) {
            console.error(`Error converting image: ${image.filename}\n`, error);
          }
        };
      });
      void promisePool(tasks, 10);
    },
    [saveToCache, resolveImage, preferredFormat],
  );

  // Convert images to an array sorted by id
  const imageList = Array.from(Object.values(images)).toSorted((a, b) =>
    a.id < b.id ? -1 : 1,
  );
  return [imageList, addFiles];
}

// #endregion
