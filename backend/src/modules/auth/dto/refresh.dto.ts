import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * El token de renovación. La app lo manda acá; la web no: le viaja en una
 * cookie httpOnly (ver common/seguridad/cookie-sesion).
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  refreshToken?: string;
}
