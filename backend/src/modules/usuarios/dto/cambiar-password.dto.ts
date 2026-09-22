import { IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @IsString()
  @MinLength(6)
  password!: string;
}
