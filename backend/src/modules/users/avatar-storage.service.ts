import { randomBytes } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { type ImageType, MIME_BY_EXT } from '../../common/utils/file-type.js';

/** Nome gerado pelo servidor: 32 hex + extensão conhecida. Qualquer outra coisa é rejeitada. */
export const AVATAR_FILENAME_REGEX = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
export const AVATAR_URL_PREFIX = '/api/users/avatars/';

@Injectable()
export class AvatarStorageService {
  private readonly logger = new Logger(AvatarStorageService.name);
  private readonly dir: string;

  constructor(config: AppConfigService) {
    this.dir = resolve(config.get('UPLOAD_DIR'), 'avatars');
  }

  async save(buffer: Buffer, type: ImageType): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const filename = `${randomBytes(16).toString('hex')}.${type.ext}`;
    await writeFile(join(this.dir, filename), buffer, { flag: 'wx' });
    return filename;
  }

  /** Remove o arquivo referenciado por um avatarUrl nosso; ignora URLs externas/inexistentes. */
  async removeByUrl(avatarUrl: string | null): Promise<void> {
    const filename = avatarUrl?.startsWith(AVATAR_URL_PREFIX)
      ? avatarUrl.slice(AVATAR_URL_PREFIX.length)
      : null;
    if (!filename || !AVATAR_FILENAME_REGEX.test(filename)) return;
    try {
      await rm(join(this.dir, filename), { force: true });
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        'rm avatar',
      );
    }
  }

  async open(filename: string): Promise<{ stream: ReadStream; mime: string; size: number } | null> {
    const match = AVATAR_FILENAME_REGEX.exec(filename);
    if (!match) return null;
    const path = join(this.dir, filename);
    try {
      const info = await stat(path);
      if (!info.isFile()) return null;
      return {
        stream: createReadStream(path),
        mime: MIME_BY_EXT[match[1] as ImageType['ext']],
        size: info.size,
      };
    } catch {
      return null;
    }
  }
}

export const avatarUrlFor = (filename: string) => `${AVATAR_URL_PREFIX}${filename}`;
