import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationType } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { NotificationsService, type NotificationDto } from './notifications.service.js';

class NotificationResponseDto implements NotificationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'BUDGET_THRESHOLD' }) type: NotificationDto['type'];
  @ApiProperty({ example: 'Alimentação atingiu 80% do orçamento' }) title: string;
  @ApiProperty() body: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) data: NotificationDto['data'];
  @ApiProperty({ type: String, nullable: true }) readAt: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

class UpdatedCountDto {
  @ApiProperty({ example: 3 }) updated: number;
}

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean({ message: 'Valor inválido' })
  unread?: boolean;

  @ApiPropertyOptional({ enum: Object.values(NotificationType) })
  @IsOptional()
  @IsIn(Object.values(NotificationType), { message: 'Tipo inválido' })
  type?: NotificationType;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page inválido' })
  @Min(1, { message: 'page inválido' })
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize inválido' })
  @Min(1, { message: 'pageSize inválido' })
  @Max(50, { message: 'pageSize máximo é 50' })
  pageSize?: number;
}

class DeleteNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'true = apaga todas as já lidas' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean({ message: 'Valor inválido' })
  read?: boolean;
}

class DeletedCountDto {
  @ApiProperty({ example: 4 }) deleted: number;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Notificações paginadas (mais recentes primeiro)',
    description: 'meta: { page, pageSize, total, totalPages, unreadCount }',
  })
  @ApiEnvelope(NotificationResponseDto, { isArray: true })
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(user.id, query);
  }

  @Delete()
  @ApiOperation({ summary: 'Apaga todas as notificações lidas (?read=true)' })
  @ApiEnvelope(DeletedCountDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  async removeRead(@CurrentUser() user: AuthUser, @Query() query: DeleteNotificationsQueryDto) {
    if (query.read !== true) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'read', message: 'Use ?read=true para apagar as notificações lidas' }],
      });
    }
    return this.notifications.removeRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Apaga uma notificação' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.NOTIFICATION_NOT_FOUND)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseIdPipe(ErrorCode.NOTIFICATION_NOT_FOUND)) id: string,
  ): Promise<void> {
    return this.notifications.remove(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca todas como lidas' })
  @ApiEnvelope(UpdatedCountDto)
  readAll(@CurrentUser() user: AuthUser): Promise<{ updated: number }> {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Marca uma notificação como lida' })
  @ApiEnvelope(NotificationResponseDto)
  @ApiErrors(ErrorCode.NOTIFICATION_NOT_FOUND)
  read(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseIdPipe(ErrorCode.NOTIFICATION_NOT_FOUND)) id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(user.id, id);
  }
}
