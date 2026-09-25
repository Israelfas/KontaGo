import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MetodoDeAbono } from '../entities/abono-fiado.entity';
import type { UnidadDeVenta } from '../../../common/cantidad';

// Dígitos, espacios, guiones y un + adelante: "099 123 4567", "+593 99…".
const TELEFONO = /^\+?[\d\s-]{7,20}$/;

export class CrearClienteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @Matches(TELEFONO, { message: 'Revisa el teléfono: solo números.' })
  telefono?: string;
}

export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre?: string;

  // '' lo borra.
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`${TELEFONO.source}|^$`), {
    message: 'Revisa el teléfono: solo números.',
  })
  telefono?: string;

  // false = archivarlo (ya no se le fía). Solo si no debe nada.
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AbonoDto {
  @IsInt()
  @Min(1)
  montoCentavos: number;

  @IsEnum(MetodoDeAbono)
  metodoPago: MetodoDeAbono;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota?: string;
}

/** Un cliente con lo que debe (negativo: tiene saldo a favor). */
export interface ClienteConSaldoDto {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  saldoCentavos: number;
  // Su última compra al fiado o su último abono.
  ultimoMovimiento: Date | null;
}

export type MovimientoDeFiadoDto =
  | {
      tipo: 'venta';
      id: string;
      fecha: Date;
      numero: number;
      totalCentavos: number;
      anuladoCentavos: number;
      items: { nombre: string; cantidad: number; unidad: UnidadDeVenta }[];
    }
  | {
      tipo: 'abono';
      id: string;
      fecha: Date;
      montoCentavos: number;
      metodoPago: MetodoDeAbono;
      registradoPor: string;
      nota: string | null;
    };

export interface DetalleClienteDto extends ClienteConSaldoDto {
  movimientos: MovimientoDeFiadoDto[];
}
