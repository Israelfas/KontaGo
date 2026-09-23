import { IsString } from 'class-validator';
import { PasswordSegura } from '../../../common/seguridad/politica-password';

export class CambiarPasswordDto {
  @IsString()
  @PasswordSegura()
  password!: string;
}
