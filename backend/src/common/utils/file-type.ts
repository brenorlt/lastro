export type ImageType = {
  ext: 'jpg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Detecta JPEG/PNG/WebP pelos magic bytes (o mimetype enviado pelo cliente não é confiável). */
export function detectImageType(buffer: Uint8Array): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buffer.length >= 8 && PNG_SIGNATURE.every((byte, i) => buffer[i] === byte)) {
    return { ext: 'png', mime: 'image/png' };
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...buffer.subarray(start, end));
  if (buffer.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export const MIME_BY_EXT: Record<ImageType['ext'], ImageType['mime']> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
