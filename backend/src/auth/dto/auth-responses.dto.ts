import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../modules/users/dto/user.dto.js';

export { UserDto };

export class AuthPayloadDto {
  @ApiProperty({ description: 'JWT de acesso (Authorization: Bearer)' }) accessToken: string;
  @ApiProperty({ description: 'Validade do access token em segundos', example: 900 })
  expiresIn: number;
  @ApiProperty({ type: UserDto }) user: UserDto;
}

export class MessageDto {
  @ApiProperty({ example: 'Se o e-mail puder ser usado, enviaremos as instruções.' })
  message: string;
}

export class VerifiedDto {
  @ApiProperty({ example: true }) verified: true;
}

export class ResetDoneDto {
  @ApiProperty({ example: true }) reset: true;
}

export class PasswordChangedDto {
  @ApiProperty({ example: true }) changed: true;
}

export class RevokedCountDto {
  @ApiProperty({ example: 2 }) revoked: number;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, nullable: true }) userAgent: string | null;
  @ApiProperty({ type: String, nullable: true }) ip: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastUsedAt: string | null;
  @ApiProperty({ description: 'Sessão da requisição atual' }) current: boolean;
}
