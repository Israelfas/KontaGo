import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizarEmail } from '../../../common/transforms/normalizar-email';
import { PasswordSegura } from '../../../common/seguridad/politica-password';

/** "Olvidé mi contraseña". */
export class PedirRecuperacionDto {
  @NormalizarEmail()
  @IsEmail()
  email!: string;
}

/** El enlace del email: ¿todavía sirve? */
export class VerificarRecuperacionDto {
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  token!: string;
}

/** Elegir la contraseña nueva con el enlace del email. */
export class RestablecerPasswordDto extends VerificarRecuperacionDto {
  @IsString()
  @PasswordSegura()
  password!: string;
}
