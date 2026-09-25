import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { FORMATO_FECHA } from '../../../common/formato-fecha';
import { EsCantidad } from '../../../common/validacion/es-cantidad';

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

  @EsCantidad({ positiva: false })
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
