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
  const ffmpegRef = useRef<FFmpeg | undefined>(undefined);
  const promiseRef = useRef<Promise<FFmpeg> | undefined>(undefined);

  const load = useCallback(async () => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }
    if (promiseRef.current) {
      ffmpegRef.current = await promiseRef.current;
      promiseRef.current = undefined;
      return ffmpegRef.current;
    }
    promiseRef.current = fetchFFmpeg();
    ffmpegRef.current = await promiseRef.current;
    promiseRef.current = undefined;
    return ffmpegRef.current;
  }, []);

  const terminate = useCallback(() => {
    const ffmpeg = ffmpegRef.current;
    ffmpegRef.current = undefined;
    promiseRef.current = undefined;
    if (ffmpeg) {
      ffmpeg.terminate();
    }
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { load, terminate };
}
