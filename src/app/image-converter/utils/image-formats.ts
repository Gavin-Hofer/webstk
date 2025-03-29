export const ImageFormats = ['png', 'jpeg', 'webp'] as const;
export type ImageFormat = (typeof ImageFormats)[number];
