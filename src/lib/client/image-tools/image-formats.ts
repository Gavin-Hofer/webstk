/** Supported image formats to convert to. */
export const IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const;

/** Supported image format. */
export type ImageFormat = (typeof IMAGE_FORMATS)[number];
