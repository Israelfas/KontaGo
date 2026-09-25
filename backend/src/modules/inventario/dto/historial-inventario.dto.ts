import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RangoFechasDto } from '../../ventas/dto/consulta-ventas.dto';
import { TipoMovimientoInventario } from '../../../common/enums/tipo-movimiento-inventario.enum';
import { MotivoMerma } from '../../../common/enums/motivo-merma.enum';
import type { UnidadDeVenta } from '../../../common/cantidad';

/** ?desde&hasta&tipo&productoId&limite&desplazamiento */
export class ListarMovimientosDto extends RangoFechasDto {
  @IsOptional()
  @IsEnum(TipoMovimientoInventario)
  tipo?: TipoMovimientoInventario;

  @IsOptional()
  @IsUUID()
  productoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}

/** Un abastecimiento o una merma, como se muestra en el historial. */
export interface MovimientoDelHistorialDto {
  id: string;
  tipo: TipoMovimientoInventario;
  createdAt: Date;
  // La cantidad está en la unidad del producto (libras si va por peso).
  producto: { id: string; nombre: string; unidad: UnidadDeVenta };
  cantidad: number;
  // Abastecimiento: lo que costó esta compra. Merma: el costo del
  // producto en ese momento (así se valoriza la pérdida).
  costoUnitarioCentavos: number;
  totalCentavos: number;
  proveedor: string | null;
  motivo: MotivoMerma | null;
  // Fecha de vencimiento del lote que entró o del que salió (si fue uno).
  vencimientoLote: string | null;
  registradoPor: string;
}

/** Lo que se gastó en mercadería y lo que se perdió en un período. */
export interface ResumenInventarioPeriodoDto {
  desde: string;
  hasta: string;
  dias: number;
  egresoCentavos: number;
  cantidadAbastecimientos: number;
  perdidaCentavos: number;
  cantidadMermas: number;
  // Solo los motivos que tuvieron pérdidas, de mayor a menor.
  perdidaPorMotivo: {
    motivo: MotivoMerma;
    unidades: number;
    centavos: number;
  }[];
  // A quién se le compró más (sin proveedor cargado = null). Hasta 5.
  porProveedor: {
    proveedor: string | null;
    compras: number;
    centavos: number;
  }[];
  // Los productos con más plata perdida. Hasta 5.
  productosConMasPerdida: {
    nombre: string;
    unidades: number;
    centavos: number;
  }[];
}
