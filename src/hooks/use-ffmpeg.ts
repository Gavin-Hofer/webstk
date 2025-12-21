'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useCallback, useEffect, useRef } from 'react';
import { toBlobURL } from '@ffmpeg/util';

const BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

async function fetchFFmpeg() {
  const ffmpeg = new FFmpeg();
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  ]);
  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

export function useFFmpeg() {
  const promiseRef = useRef<Promise<FFmpeg> | undefined>(undefined);

  const loadFFmpeg = useCallback(() => {
    if (!promiseRef.current) {
      promiseRef.current = fetchFFmpeg();
    }
    return promiseRef.current;
  }, []);

  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]);

  return { loadFFmpeg };
}
