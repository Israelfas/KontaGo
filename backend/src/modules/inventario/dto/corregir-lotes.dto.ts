import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { FORMATO_FECHA } from '../../../common/formato-fecha';

export class FilaLoteDto {
  // Con id: se corrige ese lote. Sin id: es un lote nuevo.
  @IsOptional()
  @IsUUID()
  id?: string;

  // null u omitido = sin fecha.
  @IsOptional()
  @Matches(FORMATO_FECHA, {
    message: 'fechaVencimiento debe tener formato AAAA-MM-DD',
  })
  fechaVencimiento?: string | null;

  @IsInt()
  @Min(0)
  cantidad: number;
}

/**
 * Cómo quedó repartido el stock después de revisar la góndola. Tiene que
 * sumar el stock actual (ver corregirLotes en inventario/lotes.ts).
 */
export class CorregirLotesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FilaLoteDto)
  lotes: FilaLoteDto[];
}
