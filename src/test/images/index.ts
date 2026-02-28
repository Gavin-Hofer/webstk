import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
};

async function loadImage(filename: string): Promise<File> {
  const filepath = path.join(import.meta.dirname, filename);
  const buffer = await readFile(filepath);
  const data = Uint8Array.from(buffer);
  const ext = filename.slice(filename.lastIndexOf('.'));
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
  return new File([data], path.basename(filename), { type: mime });
}

const [avif, bpm, gif, jpeg, png, tiff, webp] = await Promise.all([
  loadImage('test-image.avif'),
  loadImage('test-image.bmp'),
  loadImage('test-image.gif'),
  loadImage('test-image.jpeg'),
  loadImage('test-image.png'),
  loadImage('test-image.tiff'),
  loadImage('test-image.webp'),
]);

export const testImage = { avif, bpm, gif, jpeg, png, tiff, webp };
