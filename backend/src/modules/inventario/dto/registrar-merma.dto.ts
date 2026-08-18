import { IsEnum, IsInt, IsUUID, Min } from 'class-validator';
import { MotivoMerma } from '../../../common/enums/motivo-merma.enum';

export class RegistrarMermaDto {
  @IsUUID()
  productoId: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsEnum(MotivoMerma)
  motivo: MotivoMerma;
}
