import {
  IsBoolean,
  IsDateString,
  IsEnum,
  Matches,
  MaxLength,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { FORMATO_FECHA } from '../../../common/formato-fecha';
import { UnidadDeVenta } from '../../../common/cantidad';
import { EsCantidad } from '../../../common/validacion/es-cantidad';

export class CrearProductoDto {
  // Sin código (pan, huevos, lo suelto): se le asigna uno interno.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  codigoBarras?: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsInt()
  @Min(0)
  precioVentaCentavos: number;

  // Costo inicial opcional; si no se manda, arranca en 0 y se fija en el
  // primer reabastecimiento (módulo de inventario, Fase 2).
  @IsOptional()
  @IsInt()
  @Min(0)
  costoUnitarioCentavos?: number;

  // Cómo se vende: por unidad (lo de siempre) o por peso (libra, kilo).
  @IsOptional()
  @IsEnum(UnidadDeVenta)
  unidad?: UnidadDeVenta;

  @IsOptional()
  @EsCantidad({ positiva: false })
  stockInicial?: number;

  @IsOptional()
  @EsCantidad({ positiva: false })
  stockMinimo?: number;

  // Solo 'AAAA-MM-DD': con hora incluida ('...T05:00:00Z') el día
  // dependería de la zona horaria.
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(FORMATO_FECHA, {
    message: 'fechaVencimiento debe tener formato AAAA-MM-DD',
  })
  fechaVencimiento?: string;

  // Tarifa 0% de IVA (alimentos básicos, medicinas, etc — ver art. 55
  // LRTI). Si se omite, el producto queda con tarifa general (15%).
  @IsOptional()
  @IsBoolean()
  ivaExento?: boolean;
}
