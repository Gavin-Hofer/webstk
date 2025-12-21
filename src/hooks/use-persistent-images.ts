import 'client-only';

import { z } from 'zod';
import { useState, useEffect, useCallback, useContext } from 'react';
import * as uuid from 'uuid';
import { useLocalStorage } from 'usehooks-ts';

import {
  convertImageCanvasAPI,
  convertImageFFmpeg,
} from '@/lib/client/image-tools';
import { IMAGE_FORMATS, type ImageFormat } from '@/lib/client/image-tools';
import { promisePool } from '@/lib/promises/promise-pool';
import { FFmpegContext } from '@/components/context/ffmpeg';

const DEFAULT_IMAGE_QUALITY = 85;

// #region Types and Schemas
// =============================================================================

type UUID = `${string}-${string}-${string}-${string}-${string}`;

const ImageSchema = z.object({
  id: z
    .string()
    .uuid()
    .refine((s): s is UUID => true),
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
async function heic2png(file: File): Promise<File> {
  if (!isHeic(file)) {
    return file;
  }
  const { default: heic2any } = await import('heic2any');
  const blob: Blob | Blob[] = await heic2any({
    blob: file,
    toType: 'image/png',
    quality: DEFAULT_IMAGE_QUALITY,
  });
  const blobs: Blob[] = Array.isArray(blob) ? blob : [blob];
  return new File(blobs, file.name, { type: 'image/png' });
}

/** Generates a random UUID V4. */
function randomUUID(): UUID {
  return uuid.v4() as UUID;
}

/** Creates a ImageType object from a file. */
function fileToImageType(file: File, preferredFormat: ImageFormat): ImageType {
  return {
    id: randomUUID(),
    file,
    preview: file,
    timestamp: new Date(),
    ready: false,
    filename: file.name,
    format: preferredFormat,
    quality: DEFAULT_IMAGE_QUALITY,
  };
}

// #endregion

// #region Helper Functions - IndexedDB
// =============================================================================

/**
 * Removes an image record from IndexedDB by its ID.
 *
 * @param id - The UUID of the image to remove
 * @returns Promise that resolves when the deletion is complete
 */
function removeFromIndexedDB(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    };

    request.onerror = (e) => reject(e);
  });
}

/**
 * Saves or updates an image record in IndexedDB.
 *
 * @param item - The image file object to save
 * @returns Promise that resolves when the save operation is complete
 */
function saveToIndexedDB(item: ImageType): Promise<void> {
  const parsedItem = ImageSchema.parse(item);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      store.put(parsedItem);

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    };

    request.onerror = (e) => reject(e);
  });
}

/** Updates an existing record in IndexedDB. */
function updateIndexedDB(id: UUID, data: Partial<ImageType>): Promise<void> {
  const parsedData = ImageSchema.partial().parse(data);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      const itemRequest = store.get(id);

      itemRequest.onsuccess = () => {
        const { data: existing, error } = ImageSchema.safeParse(
          itemRequest.result,
        );
        if (error) {
          console.error(`Invalid data in IndexedDB while updating:`, error);
          return;
        }
        const updated: ImageType = { ...existing, ...parsedData };
        store.put(updated);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    };

    request.onerror = (e) => reject(e);
  });
}

/**
 * Retrieves stored image files from IndexedDB.
 *
 * @returns Promise that resolves with array of stored file objects
 */
async function retrieveFilesFromIndexedDB(): Promise<ImageType[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const result = getAllRequest.result
          .map((item) => {
            const { error, data } = ImageSchema.safeParse(item);
            if (error) {
              console.error('Error loading image from IndexedDB:', error);
            }
            return data;
          })
          .filter((image): image is ImageType => image !== undefined);
        result.sort((a, b) => a.timestamp.valueOf() - b.timestamp?.valueOf());
        resolve(result.filter((item) => item != null));
      };

      getAllRequest.onerror = (e) => reject(e);
    };

    request.onerror = (e) => reject(e);
  });
}

/**
 * Requests persistent storage from the browser if available.
 *
 * This helps prevent the browser from automatically clearing IndexedDB storage
 * when disk space is low.
 */
function enablePersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((isPersisted) => {
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
  const { loadFFmpeg } = useContext(FFmpegContext);
  const [images, setImages] = useState<Record<string, ManagedImage>>({});
  const [preferredFormat] = useLocalStorage<ImageFormat>(
    'preferred-image-format',
    'png',
  );

  /** Renames an image and reflects change in IndexedDB. */
  const updateImageById = useCallback(
    (id: UUID, data: Partial<ImageType>): void => {
      updateIndexedDB(id, data);
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
  const removeImageById = useCallback((id: UUID): void => {
    removeFromIndexedDB(id);
    setImages((prevState) => {
      const nextState = { ...prevState };
      delete nextState[id];
      return nextState;
    });
  }, []);

  /** Adds remove and rename functions to the ImageFile object. */
  const resolve = useCallback(
    (image: ImageType): ManagedImage => {
      return {
        ...image,
        remove: () => removeImageById(image.id),
        setFilename: (filename) => updateImageById(image.id, { filename }),
        setFormat: (format) => updateImageById(image.id, { format }),
        setQuality: (quality) => updateImageById(image.id, { quality }),
      };
    },
    [removeImageById, updateImageById],
  );

  // Retrieve files from storage on load.
  useEffect(() => {
    enablePersistentStorage();
    retrieveFilesFromIndexedDB().then((images) => {
      setImages((prevState) => {
        const nextState = { ...prevState };
        images.forEach((image) => {
          nextState[image.id] = resolve(image);
        });
        return nextState;
      });
    });
  }, [resolve]);

  /** Adds uploaded image files to state and IndexedDB. */
  const addFiles = (files: FileList | null) => {
    if (!files) {
      return;
    }

    const newImages = Array.from(files)
      .filter((file) => file !== null)
      .map((file) => fileToImageType(file, preferredFormat))
      .map(resolve);

    // Add files to the state.
    setImages((prevState) => {
      const nextState = { ...prevState };
      for (const image of newImages) {
        nextState[image.id] = image;
      }
      return nextState;
    });

    // Convert any HEIC images to PNG and save to indexedDB.
    const tasks = newImages.map((image) => {
      return async () => {
        const [file, ffmpeg] = await Promise.all([
          heic2png(image.file),
          loadFFmpeg(),
        ]);
        const preview = await convertImageFFmpeg(ffmpeg, file, {
          format: 'webp',
          quality: 50,
          width: 128,
          height: 128,
        });
        const updatedImage = { ...image, file, preview, ready: true };
        saveToIndexedDB(updatedImage);
        setImages((prevState) => ({ ...prevState, [image.id]: updatedImage }));
      };
    });
    promisePool(tasks, 10);
  };

  // Convert images to an array sorted from newest to oldest.
  const imageList = Array.from(Object.values(images)).sort(
    (a, b) => b.timestamp.valueOf() - a.timestamp.valueOf(),
  );
  return [imageList, addFiles];
}

// #endregion
