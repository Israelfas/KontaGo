import { IsEmail, IsString, MinLength } from 'class-validator';
import { NormalizarEmail } from '../../../common/transforms/normalizar-email';

export class LoginDto {
  @NormalizarEmail()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  // Por ahora el tenant se resuelve por email (único por tenant, ver índice
  // compuesto en Usuario). Si más adelante un mismo email debe poder
  // pertenecer a varias tiendas, esto se ajusta a subdominio/slug.
}
