import { Injectable, Logger } from '@nestjs/common';
import { PasswordService } from '../../auth/password/password.service.js';
import type { ClientContext } from '../../auth/security/client-context.js';
import { SecurityEventsService } from '../../auth/security/security-events.service.js';
import { sha256 } from '../../auth/tokens/token.util.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { detectImageType } from '../../common/utils/file-type.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { AvatarStorageService, avatarUrlFor } from './avatar-storage.service.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserDto } from './dto/user.dto.js';
import { mergeNotificationPrefs } from './notification-prefs.js';
import { toUserDto } from './user.mapper.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarStorageService,
    private readonly passwords: PasswordService,
    private readonly events: SecurityEventsService,
  ) {}

  async me(userId: string): Promise<UserDto> {
    return toUserDto(await this.findActive(userId));
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.findActive(userId);
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.theme !== undefined) data.theme = dto.theme;
    if (dto.notificationPrefs !== undefined) {
      data.notificationPrefs = {
        ...mergeNotificationPrefs(user.notificationPrefs, dto.notificationPrefs),
      };
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return toUserDto(updated);
  }

  async setAvatar(userId: string, file: Express.Multer.File | undefined): Promise<UserDto> {
    if (!file?.buffer?.length) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'file', message: 'Envie uma imagem no campo "file"' }],
      });
    }
    const type = detectImageType(file.buffer);
    if (!type) throw new AppException(ErrorCode.INVALID_FILE_TYPE);

    const user = await this.findActive(userId);
    const filename = await this.avatars.save(file.buffer, type);
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: avatarUrlFor(filename) },
      });
      await this.avatars.removeByUrl(user.avatarUrl);
      return toUserDto(updated);
    } catch (error) {
      await this.avatars.removeByUrl(avatarUrlFor(filename));
      throw error;
    }
  }

  async removeAvatar(userId: string): Promise<UserDto> {
    const user = await this.findActive(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    await this.avatars.removeByUrl(user.avatarUrl);
    return toUserDto(updated);
  }

  /**
   * Exclusão definitiva (hard delete): o cascade das FKs remove todos os dados financeiros,
   * sessões e eventos do usuário. O evento ACCOUNT_DELETED é gravado depois, sem userId,
   * apenas com o hash do e-mail.
   */
  async deleteAccount(userId: string, password: string, context: ClientContext): Promise<void> {
    const user = await this.findActive(userId);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new AppException(ErrorCode.INVALID_PASSWORD, {
        message: 'Senha incorreta',
        details: [{ field: 'password', message: 'Senha incorreta' }],
      });
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.avatars.removeByUrl(user.avatarUrl);

    const emailHash = sha256(user.email.toLowerCase());
    this.logger.warn({ emailHash, ip: context.ip }, 'Conta de usuário excluída definitivamente');
    await this.events.record({
      type: 'ACCOUNT_DELETED',
      userId: null,
      context,
      metadata: { emailHash },
    });
  }

  private async findActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new AppException(ErrorCode.UNAUTHORIZED);
    return user;
  }
}
