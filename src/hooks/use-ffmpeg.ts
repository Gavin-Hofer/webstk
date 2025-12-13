import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useSuspenseQuery } from '@tanstack/react-query';

const BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

export function useFFmpeg() {
  const { data: ffmpeg, error } = useSuspenseQuery({
    queryKey: [BASE_URL],
    async queryFn() {
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    },
  });
  return { ffmpeg, error };
}
