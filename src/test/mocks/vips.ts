/* eslint-disable @typescript-eslint/consistent-type-imports */
import { vi } from 'vitest';
import Vips from 'wasm-vips';

vi.mock('@/lib/vips', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vips')>();
  return {
    ...actual,
    getVips: async () => {
      const vips = await Vips();
      return vips;
    },
  };
});
