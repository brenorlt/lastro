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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AccountsService } from './accounts.service.js';
import {
  AccountDetailDto,
  AccountDto,
  AccountsMetaDto,
  CreateAccountDto,
  ListAccountsQueryDto,
  UpdateAccountDto,
} from './dto/account.dto.js';

const AccountId = () => Param('id', new ParseIdPipe(ErrorCode.ACCOUNT_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista contas (ativas primeiro, depois por criação) com totais' })
  @ApiExtraModels(AccountDto, AccountsMetaDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(AccountDto) } },
        meta: { $ref: getSchemaPath(AccountsMetaDto) },
      },
    },
  })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.UNAUTHORIZED)
  list(@CurrentUser() user: AuthUser, @Query() query: ListAccountsQueryDto) {
    return this.accounts.list(user.id, query);
  }

  @Get(':id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe de uma conta' })
  @ApiEnvelope(AccountDetailDto)
  @ApiErrors(ErrorCode.ACCOUNT_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @AccountId() id: string): Promise<AccountDetailDto> {
    return this.accounts.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria conta (currentBalance = initialBalance)' })
  @ApiEnvelope(AccountDto, { status: 201 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.ACCOUNT_NAME_TAKEN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto): Promise<AccountDto> {
    return this.accounts.create(user.id, dto);
  }

  @Patch(':id')
  @IdParam()
  @ApiOperation({
    summary: 'Edita conta',
    description: 'Alterar initialBalance desloca currentBalance pela mesma diferença.',
  })
  @ApiEnvelope(AccountDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.ACCOUNT_NOT_FOUND, ErrorCode.ACCOUNT_NAME_TAKEN)
  update(
    @CurrentUser() user: AuthUser,
    @AccountId() id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountDto> {
    return this.accounts.update(user.id, id, dto);
  }

  @Post(':id/archive')
  @IdParam()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Arquiva a conta' })
  @ApiEnvelope(AccountDto)
  @ApiErrors(ErrorCode.ACCOUNT_NOT_FOUND)
  archive(@CurrentUser() user: AuthUser, @AccountId() id: string): Promise<AccountDto> {
    return this.accounts.setArchived(user.id, id, true);
  }

  @Post(':id/unarchive')
  @IdParam()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativa a conta' })
  @ApiEnvelope(AccountDto)
  @ApiErrors(ErrorCode.ACCOUNT_NOT_FOUND, ErrorCode.ACCOUNT_NAME_TAKEN)
  unarchive(@CurrentUser() user: AuthUser, @AccountId() id: string): Promise<AccountDto> {
    return this.accounts.setArchived(user.id, id, false);
  }

  @Delete(':id')
  @IdParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui (soft delete) uma conta sem vínculos' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.ACCOUNT_NOT_FOUND, ErrorCode.ACCOUNT_IN_USE)
  remove(@CurrentUser() user: AuthUser, @AccountId() id: string): Promise<void> {
    return this.accounts.remove(user.id, id);
  }
}
