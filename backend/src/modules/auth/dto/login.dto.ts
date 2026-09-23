import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizarEmail } from '../../../common/transforms/normalizar-email';

export class LoginDto {
  @NormalizarEmail()
  @IsEmail()
  email: string;

  // Sin mínimo: las contraseñas que ya existen (de antes de la política
  // de 8) tienen que seguir sirviendo para entrar.
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;

  // Por ahora el tenant se resuelve por email (único por tenant, ver índice
  // compuesto en Usuario). Si más adelante un mismo email debe poder
  // pertenecer a varias tiendas, esto se ajusta a subdominio/slug.
}
