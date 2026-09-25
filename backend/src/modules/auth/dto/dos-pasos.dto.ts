import { IsString, Length, MaxLength } from 'class-validator';

/** Un código de la app (6 dígitos) o de recuperación ("k7m2-p9qx"). */
export class CodigoDosPasosDto {
  @IsString()
  @Length(6, 20)
  codigo: string;
}

/** Segundo paso del ingreso: el desafío que dio /auth/login y el código. */
export class IngresoConCodigoDto extends CodigoDosPasosDto {
  @IsString()
  @MaxLength(2000)
  desafio: string;
}
