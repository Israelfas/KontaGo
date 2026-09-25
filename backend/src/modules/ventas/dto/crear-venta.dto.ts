import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '../../../common/enums/metodo-pago.enum';

export class VentaItemDto {
  @IsUUID()
  productoId: string;

  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CrearVentaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VentaItemDto)
  items: VentaItemDto[];

  // Omitido: efectivo (lo único que había antes).
  @IsOptional()
  @IsEnum(MetodoPago)
  metodoPago?: MetodoPago;

  // Monto recibido en centavos, para calcular el vuelto. Obligatorio en
  // efectivo; en transferencia no se usa (se toma el total exacto).
  @IsOptional()
  @IsInt()
  @Min(0)
  montoRecibidoCentavos?: number;

  // La genera el celular. Si una venta con esta clave ya existe, se
  // devuelve esa en vez de cobrar otra vez.
  @IsOptional()
  @IsUUID()
  claveIdempotencia?: string;

  // Cuándo se cobró, si fue sin conexión y llega después. Se respeta, pero
  // nunca antes de abrir la caja ni en el futuro.
  @IsOptional()
  @IsISO8601()
  vendidaEn?: string;
}
