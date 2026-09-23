import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { MotivoMerma } from '../../../common/enums/motivo-merma.enum';

export class RegistrarMermaDto {
  @IsUUID()
  productoId: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsEnum(MotivoMerma)
  motivo: MotivoMerma;

  // De qué lote sale (ej. dar de baja el lote vencido). Omitido: del que
  // vence antes, igual que una venta.
  @IsOptional()
  @IsUUID()
  loteId?: string;
}
