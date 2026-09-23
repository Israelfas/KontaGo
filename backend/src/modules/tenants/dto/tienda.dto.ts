import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { esRucValido } from '../ruc';

@ValidatorConstraint({ name: 'ruc' })
class RucEcuador implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return valor === null || (typeof valor === 'string' && esRucValido(valor));
  }
  defaultMessage(): string {
    return 'El RUC tiene que tener 13 números (ej. tu cédula seguida de 001)';
  }
}

// Texto opcional: sin espacios de más, y vacío = borrarlo (null).
const textoOpcional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Datos de la tienda que edita el admin. Todo lo que no venga, no cambia. */
export class ActualizarTiendaDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre?: string;

  // Como figura en el SRI (puede ser distinta del nombre del letrero).
  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(200)
  razonSocial?: string | null;

  @IsOptional()
  // Se aceptan espacios o guiones al tipear ("1712345678 001").
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') || null : value,
  )
  @Validate(RucEcuador)
  ruc?: string | null;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(250)
  direccion?: string | null;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(30)
  telefono?: string | null;

  // Va al pie del ticket ("Horario: 7h a 21h", "Síguenos en…").
  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(200)
  mensajeTicket?: string | null;
}

export interface TiendaDto {
  nombre: string;
  razonSocial: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  mensajeTicket: string | null;
}
