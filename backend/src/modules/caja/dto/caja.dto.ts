import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoMovimientoCaja } from '../entities/movimiento-caja.entity';

// Tope de cordura para montos tipeados a mano ($100.000): un cero de más
// no debería arruinar un arqueo.
const MONTO_MAXIMO = 10_000_000;

export class AbrirCajaDto {
  // El cambio con el que arranca el cajón.
  @IsInt()
  @Min(0)
  @Max(MONTO_MAXIMO)
  fondoInicialCentavos: number;
}

export class MovimientoCajaDto {
  @IsEnum(TipoMovimientoCaja)
  tipo: TipoMovimientoCaja;

  @IsInt()
  @Min(1)
  @Max(MONTO_MAXIMO)
  montoCentavos: number;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  motivo: string;
}

export class CerrarCajaDto {
  // Lo que se contó en el cajón.
  @IsInt()
  @Min(0)
  @Max(MONTO_MAXIMO)
  efectivoContadoCentavos: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

/** Un turno como lo ven web y móvil. */
export interface TurnoDto {
  id: string;
  estado: 'abierto' | 'cerrado';
  cajero: string;
  usuarioId: string;
  abiertoEn: Date;
  cerradoEn: Date | null;
  cerradoPor: string | null;
  fondoInicialCentavos: number;
  cantidadVentas: number;
  ventasTransferenciaCentavos: number;
  ingresosCentavos: number;
  retirosCentavos: number;
  // Lo que revela cuánto efectivo debería haber: el cajero no lo ve hasta
  // cerrar (conteo a ciegas). Sin estos campos en ese caso.
  ventasEfectivoCentavos?: number;
  efectivoEsperadoCentavos?: number;
  // Solo cerrado.
  efectivoContadoCentavos?: number;
  // contado − esperado: negativo = falta plata, positivo = sobra.
  diferenciaCentavos?: number;
  nota: string | null;
  movimientos: {
    id: string;
    tipo: TipoMovimientoCaja;
    montoCentavos: number;
    motivo: string;
    usuario: string;
    createdAt: Date;
  }[];
}
