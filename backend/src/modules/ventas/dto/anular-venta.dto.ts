import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EsCantidad } from '../../../common/validacion/es-cantidad';

export class LineaAnulacionDto {
  @IsUUID()
  ventaItemId: string;

  @EsCantidad({ positiva: true })
  cantidad: number;
}

export class AnularVentaDto {
  // Obligatorio: una anulación sin motivo no se puede auditar después.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;

  // Qué anular. Si se omite, se anula todo lo que quede de la venta.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaAnulacionDto)
  items?: LineaAnulacionDto[];
}
