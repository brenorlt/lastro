import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AssetDto, CreateAssetDto, UpdateAssetDto } from './asset.dto.js';
import { AssetsService } from './assets.service.js';

const AssetId = () => Param('id', new ParseIdPipe(ErrorCode.ASSET_NOT_FOUND));

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'Bens (imóveis, veículos, outros) com total e por tipo' })
  @ApiEnvelope(AssetDto, { isArray: true })
  list(@CurrentUser() user: AuthUser) {
    return this.assets.list(user.id);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiEnvelope(AssetDto)
  @ApiErrors(ErrorCode.ASSET_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @AssetId() id: string): Promise<AssetDto> {
    return this.assets.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra bem' })
  @ApiEnvelope(AssetDto, { status: 201 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetDto): Promise<AssetDto> {
    return this.assets.create(user.id, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiEnvelope(AssetDto)
  @ApiErrors(ErrorCode.ASSET_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @AssetId() id: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetDto> {
    return this.assets.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.ASSET_NOT_FOUND)
  remove(@CurrentUser() user: AuthUser, @AssetId() id: string): Promise<void> {
    return this.assets.remove(user.id, id);
  }
}
