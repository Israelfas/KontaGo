import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { FORMATO_FECHA } from '../../../common/formato-fecha';

/** ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD — sin fechas, es hoy. */
export class RangoFechasDto {
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'desde debe tener formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'hasta debe tener formato AAAA-MM-DD' })
  hasta?: string;
}

/** Listado paginado: un mes entero no se manda de una sola vez. */
export class ListarVentasDto extends RangoFechasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;

  // Buscar un ticket por su número (ignora las fechas).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numero?: number;
}
