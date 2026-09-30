import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UploadErrorsInterceptor } from '../users/upload-errors.interceptor.js';
import {
  CommitImportDto,
  IMPORT_MAX_BYTES,
  ImportPreviewDto,
  ImportResultDto,
  PreviewImportDto,
} from './dto/import.dto.js';
import { ImportsService } from './imports.service.js';

const TARGET_ERRORS = [
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.ACCOUNT_NOT_FOUND,
  ErrorCode.ACCOUNT_ARCHIVED,
  ErrorCode.CARD_NOT_FOUND,
  ErrorCode.CARD_UNAVAILABLE,
] as const;

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    UploadErrorsInterceptor,
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES, files: 1, fields: 3 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'OFX ou CSV, até 2 MB' },
        accountId: { type: 'string', format: 'uuid' },
        creditCardId: { type: 'string', format: 'uuid' },
        invertSigns: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({
    summary: 'Lê um extrato OFX/CSV e classifica cada linha, sem gravar nada',
    description:
      'Formato detectado pelo conteúdo. Cada linha traz uma impressão digital (`externalId`), o status (nova, possível duplicata, já importada, não importável) e uma categoria sugerida pelo histórico do usuário.',
  })
  @ApiEnvelope(ImportPreviewDto)
  @ApiErrors(
    ...TARGET_ERRORS,
    ErrorCode.IMPORT_UNREADABLE,
    ErrorCode.IMPORT_EMPTY,
    ErrorCode.FILE_TOO_LARGE,
  )
  preview(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PreviewImportDto,
  ): Promise<ImportPreviewDto> {
    return this.imports.preview(user.id, file, dto);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria os lançamentos revisados na prévia',
    description:
      'Uma transação para o lote inteiro. Datas até hoje entram como CLEARED (alteram o saldo). Linhas com `externalId` já ativo são ignoradas.',
  })
  @ApiEnvelope(ImportResultDto, { status: 201 })
  @ApiErrors(...TARGET_ERRORS, ErrorCode.CATEGORY_NOT_FOUND, ErrorCode.CATEGORY_TYPE_MISMATCH)
  commit(@CurrentUser() user: AuthUser, @Body() dto: CommitImportDto): Promise<ImportResultDto> {
    return this.imports.commit(user.id, dto);
  }
}
