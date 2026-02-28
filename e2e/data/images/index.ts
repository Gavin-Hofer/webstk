import path from 'node:path';

export const testImage = {
  avif: path.join(import.meta.dirname, 'test-image.avif'),
  bmp: path.join(import.meta.dirname, 'test-image.bmp'),
  gif: path.join(import.meta.dirname, 'test-image.gif'),
  jpeg: path.join(import.meta.dirname, 'test-image.jpeg'),
  png: path.join(import.meta.dirname, 'test-image.png'),
  tiff: path.join(import.meta.dirname, 'test-image.tiff'),
  webp: path.join(import.meta.dirname, 'test-image.webp'),
};
