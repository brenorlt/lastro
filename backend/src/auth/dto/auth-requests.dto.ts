import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword, PASSWORD_POLICY_DESCRIPTION } from '../password/password.policy.js';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class EmailField {
  @ApiProperty({ example: 'ana@exemplo.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsString({ message: 'Informe um e-mail' })
  @MaxLength(254, { message: 'E-mail muito longo' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;
}

export class RegisterDto extends EmailField {
  @ApiProperty({ example: 'Ana Souza', minLength: 2, maxLength: 80 })
  @Transform(trim)
  @IsString({ message: 'Informe seu nome' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name: string;

  @ApiProperty({ example: 'minhaSenha2026', description: PASSWORD_POLICY_DESCRIPTION })
  @IsStrongPassword()
  password: string;
}

export class LoginDto extends EmailField {
  @ApiProperty({ example: 'minhaSenha2026' })
  @IsString({ message: 'Informe a senha' })
  @IsNotEmpty({ message: 'Informe a senha' })
  @MaxLength(128, { message: 'E-mail ou senha incorretos' })
  password: string;
}

export class EmailDto extends EmailField {}

export class TokenDto {
  @ApiProperty({ description: 'Token recebido no link do e-mail' })
  @IsString({ message: 'Link inválido ou expirado' })
  @IsNotEmpty({ message: 'Link inválido ou expirado' })
  @MaxLength(256, { message: 'Link inválido ou expirado' })
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ example: 'novaSenha2026', description: PASSWORD_POLICY_DESCRIPTION })
  @IsStrongPassword()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'Informe a senha atual' })
  @IsNotEmpty({ message: 'Informe a senha atual' })
  @MaxLength(128, { message: 'Senha atual incorreta' })
  currentPassword: string;

  @ApiProperty({ example: 'novaSenha2026', description: PASSWORD_POLICY_DESCRIPTION })
  @IsStrongPassword()
  newPassword: string;
}
