import { describe, expect, it } from '@jest/globals';
import { detectImageType } from './file-type.js';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('detectImageType', () => {
  it('reconhece JPEG, PNG e WebP pelos magic bytes', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))?.ext).toBe('jpg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.ext).toBe(
      'png',
    );
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
    expect(detectImageType(webp)).toEqual({ ext: 'webp', mime: 'image/webp' });
  });

  it('rejeita texto, GIF, SVG e arquivos truncados', () => {
    expect(detectImageType(Buffer.from('isto não é uma imagem'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(
      detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')])),
    ).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
