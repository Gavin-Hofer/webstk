'use client';

import { z } from 'zod';
import { useState, useEffect } from 'react';
import { convertImage } from '@/lib/client/image-tools';
import * as uuid from 'uuid';

const ImageFileSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.date(),
  file: z.instanceof(File),
  preview: z.instanceof(File),
  ready: z.boolean(),
});

export type ImageFile = z.infer<typeof ImageFileSchema>;

export function usePersistentImages(): [
  ImageFile[],
  (files: FileList | null) => void,
  (id: string) => void,
] {
  const [images, setImages] = useState<ImageFile[]>([]);

  useEffect(() => {
    // Retrieve files from storage on load.
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((isPersisted) => {
        console.log(
          `Storage persistence is ${isPersisted ? 'enabled' : 'not enabled'}`,
        );
      });
    }
    retrieveFilesFromIndexedDB().then(setImages);
  }, []);

  const updateImage = (image: ImageFile) => {
    setImages((prevState) => {
      const nextState = [...prevState];
      const index = nextState.findIndex((im) => im.id === image.id);
      if (index >= 0) {
        nextState[index] = image;
      }
      nextState.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
      return nextState;
    });
  };

  const addFiles = (files: FileList | null) => {
    if (!files) {
      return;
    }
    const fileList = Array.from(files)
      .filter((file) => file)
      .map((file) => ({ id: uuid.v4(), file, timestamp: new Date() }));

    // Add files to the state.
    setImages((prevState) => {
      const nextState = [...prevState];
      for (const { id, file, timestamp } of fileList) {
        nextState.push({
          id,
          file,
          ready: false,
          preview: file,
          timestamp,
        });
      }
      return nextState;
    });

    // Convert any HEIC images to PNG and save to indexedDB.
    fileList.forEach(async ({ id, file: original, timestamp }) => {
      const file = await heic2png(original);
      const preview = await convertImage(file, {
        format: 'webp',
        quality: 50,
        width: 128,
        height: 128,
      });
      const image = { id, file, preview, ready: true, timestamp };
      updateImage(image);
      saveToIndexedDB(image);
    });
  };

  const removeImage = (id: string) => {
    setImages((prevState) => {
      const nextState = prevState.filter((image) => image.id !== id);
      nextState.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
      return nextState;
    });
    removeFromIndexedDB(id);
  };

  return [images, addFiles, removeImage];
}

// #region IndexedDB Helpers
// =============================================================================

function removeFromIndexedDB(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = (event) => {
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

function saveToIndexedDB(item: ImageFile): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      store.put(item);

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    };

    request.onerror = (e) => reject(e);
  });
}

/**
 * Retrieves stored image files from IndexedDB
 *
 * @returns Promise that resolves with array of stored file objects
 */
async function retrieveFilesFromIndexedDB(): Promise<ImageFile[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageConverterDB', 1);

    request.onupgradeneeded = (event) => {
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
            const { error, data } = ImageFileSchema.safeParse(item);
            if (error) {
              console.error('Error loading image from IndexedDB:', error);
            }
            return data;
          })
          .filter((image) => image !== undefined);
        result.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
        console.debug('Loaded images from IndexedDB:', result);
        resolve(result);
      };

      getAllRequest.onerror = (e) => reject(e);
    };

    request.onerror = (e) => reject(e);
  });
}

// #region Image Helpers
// =============================================================================

function isHeic(file: File) {
  return file.type === 'image/heic' || file.type === 'image/heif';
}

async function heic2png(file: File): Promise<File> {
  if (!isHeic(file)) {
    return file;
  }
  const { default: heic2any } = await import('heic2any');
  const blob: Blob | Blob[] = await heic2any({
    blob: file,
    toType: 'image/png',
  });
  const blobs: Blob[] = Array.isArray(blob) ? blob : [blob];
  return new File(blobs, file.name, { type: 'image/png' });
}
