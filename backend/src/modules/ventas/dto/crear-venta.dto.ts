import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
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
}
