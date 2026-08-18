import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class RegistrarAbastecimientoDto {
  @IsUUID()
  productoId: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsInt()
  @Min(0)
  costoUnitarioCentavos: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  proveedor?: string;
}
