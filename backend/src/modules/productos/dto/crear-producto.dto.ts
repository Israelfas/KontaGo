import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CrearProductoDto {
  @IsString()
  @MinLength(1)
  codigoBarras: string;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  stockInicial?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
