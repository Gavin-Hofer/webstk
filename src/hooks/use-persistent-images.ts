import 'client-only';

import { useCallback, useEffect, useState } from 'react';

import { useLocalStorage } from 'usehooks-ts';
import * as uuid from 'uuid';
import { z } from 'zod';

import { convertImage, imageConverterCache } from '@/lib/image-tools';
import type { ImageEditOptions } from '@/lib/image-tools/types';
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

const ImageSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  file: z.instanceof(File),
  originalFile: z.instanceof(File).optional(),
  preview: z.instanceof(File),
  ready: z.boolean(),
  filename: z.string().default('Image.png'),
  format: z.enum(IMAGE_FORMATS).default('png'),
  quality: z.number().int().min(0).max(100).default(DEFAULT_IMAGE_QUALITY),
  edits: z.custom<ImageEditOptions>().optional(),
});

type ImageType = z.infer<typeof ImageSchema>;

export type ManagedImage = Omit<ImageType, 'originalFile'> & {
  originalFile: File;
  setFilename: (name: string) => void;
  setFormat: (format: ImageFormat) => void;
  setQuality: (quality: number) => void;
  setEdits: (edits?: ImageEditOptions) => void;
  resetEdits: () => void;
  remove: () => void;
};

export type ImageID = ManagedImage['id'];

// #endregion

// #region IndexedDB Cache
// =============================================================================

export const imageCache = new IndexedDBCache({
  dbName: INDEXEDDB_DB_NAME,
  dbVersion: 3,
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
    originalFile: file,
    preview: file,
    timestamp: new Date(),
    ready: false,
    filename: file.name,
    format: preferredFormat,
    quality: DEFAULT_IMAGE_QUALITY,
    edits: undefined,
  } satisfies ImageType;
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
  useEffect(() => {
    // Ensure the IndexedDB caches exist to prevent duplicates
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

  const applyEditsById = useCallback(
    async (id: string, edits?: ImageEditOptions) => {
      updateImageById(id, { ready: false, edits });
      try {
        const current = await imageCache.get(id);
        if (!current) {
          return;
        }
        const originalFile = current.originalFile ?? current.file;
        const editingFormat = getImageFormatFromFile(originalFile);
        const editedFile = await convertImage(originalFile, {
          format: editingFormat,
          quality: 100,
          filename: originalFile.name,
          edits,
        });
        const preview = await convertImage(editedFile, {
          format: 'webp',
          quality: 50,
          width: 128,
          height: 128,
          thumbnail: true,
        });
        updateImageById(id, {
          file: editedFile,
          preview,
          edits,
          ready: true,
        });
      } catch (error) {
        console.error('Failed to apply image edits:', error);
        updateImageById(id, { ready: true });
      }
    },
    [updateImageById],
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
      const originalFile = image.originalFile ?? image.file;
      return {
        ...image,
        originalFile,
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
        setEdits: (edits) => {
          void applyEditsById(image.id, edits);
        },
        resetEdits: () => {
          void applyEditsById(image.id, undefined);
        },
      };
    },
    [removeImageById, updateImageById, applyEditsById],
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
              thumbnail: true,
            });
            const updatedImage = {
              ...image,
              file,
              originalFile: file,
              edits: undefined,
              preview,
              ready: true,
            };
            void imageCache.set(updatedImage.id, updatedImage);
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
    [resolveImage, preferredFormat],
  );

  // Convert images to an array sorted by id
  const imageList = Array.from(Object.values(images)).toSorted((a, b) =>
    a.id < b.id ? -1 : 1,
  );
  return [imageList, addFiles];
}

// #endregion
