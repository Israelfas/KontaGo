import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NormalizarEmail } from '../../../common/transforms/normalizar-email';
import { Rol } from '../../../common/enums/rol.enum';

export class CrearUsuarioDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @NormalizarEmail()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  // Por defecto cajero. Se permite admin para sumar un socio/encargado
  // con los mismos permisos que el dueño.
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;
}
