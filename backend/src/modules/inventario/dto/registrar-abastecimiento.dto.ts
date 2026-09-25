import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { FORMATO_FECHA } from '../../../common/formato-fecha';
import { EsCantidad } from '../../../common/validacion/es-cantidad';

export class RegistrarAbastecimientoDto {
  @IsUUID()
  productoId: string;

  @EsCantidad({ positiva: true })
  cantidad: number;

  @IsInt()
  @Min(0)
  costoUnitarioCentavos: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  proveedor?: string;

  // Vencimiento de ESTA mercadería: entra como un lote aparte (o se suma
  // al lote de la misma fecha). Omitido: el producto no vence, o no se
  // sabe (va al lote "sin fecha" si el producto ya maneja lotes).
  @IsOptional()
  @Matches(FORMATO_FECHA, {
    message: 'fechaVencimiento debe tener formato AAAA-MM-DD',
  })
  fechaVencimiento?: string;
}
