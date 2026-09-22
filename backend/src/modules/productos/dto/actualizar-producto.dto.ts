import {
  IsBoolean,
  IsDateString,
  Matches,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { FORMATO_FECHA } from '../../../common/formato-fecha';

// A diferencia de CrearProductoDto, acá TODO es opcional — es un PATCH,
// el cliente solo manda los campos que quiere cambiar. codigoBarras no
// se puede editar (es la identidad del producto para el escaneo; si
// cambió, es un producto distinto, no una edición).
export class ActualizarProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  precioVentaCentavos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costoUnitarioCentavos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  // Solo 'AAAA-MM-DD': con hora incluida ('...T05:00:00Z') el día
  // dependería de la zona horaria.
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(FORMATO_FECHA, {
    message: 'fechaVencimiento debe tener formato AAAA-MM-DD',
  })
  fechaVencimiento?: string;

  // Como fechaVencimiento con @IsDateString() no acepta null, borrar la
  // fecha (producto que dejó de tener vencimiento) es un flag aparte en
  // vez de mandar fechaVencimiento: null.
  @IsOptional()
  @IsBoolean()
  quitarFechaVencimiento?: boolean;

  @IsOptional()
  @IsBoolean()
  ivaExento?: boolean;
}
