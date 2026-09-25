import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { TagDto, UpdateTagDto } from './tag.dto.js';
import { TagsService } from './tags.service.js';

const TagId = () => Param('id', new ParseIdPipe(ErrorCode.TAG_NOT_FOUND));

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'Tags do usuário com contagem de lançamentos' })
  @ApiEnvelope(TagDto, { isArray: true })
  list(@CurrentUser() user: AuthUser): Promise<TagDto[]> {
    return this.tags.list(user.id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Renomeia/recolore uma tag' })
  @ApiEnvelope(TagDto)
  @ApiErrors(ErrorCode.TAG_NOT_FOUND, ErrorCode.TAG_ALREADY_EXISTS, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @TagId() id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagDto> {
    return this.tags.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Exclui a tag (remove os vínculos)' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.TAG_NOT_FOUND)
  remove(@CurrentUser() user: AuthUser, @TagId() id: string): Promise<void> {
    return this.tags.remove(user.id, id);
  }
}
