import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PasswordSegura } from '../../../common/seguridad/politica-password';
import { NormalizarEmail } from '../../../common/transforms/normalizar-email';

export class RegistroDto {
  @IsString()
  @MinLength(2)
  nombreTienda!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  moneda?: string; // ej. 'USD', 'ARS'. Si no se manda, queda en 'USD' (default de la entidad Tenant).

  @IsString()
  @MinLength(2)
  nombreAdmin!: string;

  @NormalizarEmail()
  @IsEmail()
  email!: string;

  @IsString()
  @PasswordSegura()
  password!: string;

  // Ley Orgánica de Protección de Datos Personales (Ecuador): sin aceptar
  // los términos y la política de privacidad no se crea la cuenta.
  @Equals(true, {
    message:
      'Para crear tu cuenta tenés que aceptar los términos y la política de privacidad.',
  })
  aceptaTerminos!: boolean;
}
