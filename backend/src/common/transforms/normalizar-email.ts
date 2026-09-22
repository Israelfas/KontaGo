import { Transform } from 'class-transformer';

/**
 * El email identifica a la persona en toda la plataforma (login, Clerk),
 * así que se guarda y se busca siempre en minúsculas y sin espacios: si
 * no, "Juan@gmail.com" y "juan@gmail.com" eran dos cuentas distintas, y
 * el login fallaba según cómo lo tipeara la persona.
 */
export function NormalizarEmail() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
