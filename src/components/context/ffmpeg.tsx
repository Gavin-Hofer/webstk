import { FFmpeg } from '@ffmpeg/ffmpeg';
import { createContext, useCallback, useEffect, useRef } from 'react';
import { toBlobURL } from '@ffmpeg/util';

const BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

async function fetchFFmpeg() {
  const ffmpeg = new FFmpeg();
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  ]);
  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

export type FFmpegContextValue = {
  loadFFmpeg: () => Promise<FFmpeg>;
};

export const FFmpegContext = createContext<FFmpegContextValue | undefined>(
  undefined,
);

export const FFmpegProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const ffmpegRef = useRef<FFmpeg | undefined>(undefined);
  const promiseRef = useRef<Promise<FFmpeg> | undefined>(undefined);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }
    if (promiseRef.current) {
      ffmpegRef.current = await promiseRef.current;
      return ffmpegRef.current;
    }
    promiseRef.current = fetchFFmpeg();
    ffmpegRef.current = await promiseRef.current;
    return ffmpegRef.current;
  }, []);

  useEffect(() => {
    // Begin loading ffmpeg immediately.
    loadFFmpeg();
  }, [loadFFmpeg]);

  return (
    <FFmpegContext.Provider value={{ loadFFmpeg }}>
      {children}
    </FFmpegContext.Provider>
  );
};
