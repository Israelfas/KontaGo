import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MotivoMerma } from '../../../common/enums/motivo-merma.enum';
import { EsCantidad } from '../../../common/validacion/es-cantidad';

export class RegistrarMermaDto {
  @IsUUID()
  productoId: string;

  @EsCantidad({ positiva: true })
  cantidad: number;

  @IsEnum(MotivoMerma)
  motivo: MotivoMerma;

  // De qué lote sale (ej. dar de baja el lote vencido). Omitido: del que
  // vence antes, igual que una venta.
  @IsOptional()
  @IsUUID()
  loteId?: string;
}
