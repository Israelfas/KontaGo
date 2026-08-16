import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}