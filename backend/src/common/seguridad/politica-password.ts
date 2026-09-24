import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Política de contraseñas (ISO/IEC 27002:2022, control 5.17 "Información
 * de autenticación", en línea con NIST SP 800-63B):
 *
 * - Largo antes que complejidad: mínimo 8. Obligar a mayúsculas y
 *   símbolos produce "Kontago1!" y post-its pegados en la caja; una frase
 *   larga es más segura y más fácil de recordar.
 * - Máximo 72: bcrypt ignora lo que pasa de 72 bytes, y dejar escribir
 *   más daría una falsa sensación de seguridad.
 * - No de las más usadas (las primeras que se prueban en un ataque), ni
 *   el propio email, ni el nombre de la app.
 *
 * Aplica a las contraseñas NUEVAS (registro, alta de cajero, cambio,
 * recuperación). Las que ya existen siguen sirviendo para entrar.
 *
 * Copia de las reglas en web/src/lib/validacion.ts y mobile (para avisar
 * mientras se escribe).
 */
export const LARGO_MINIMO_PASSWORD = 8;
export const LARGO_MAXIMO_PASSWORD = 72;

const MAS_USADAS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  '12341234',
  '11223344',
  'password',
  'password1',
  'password123',
  'contraseña',
  'contrasena',
  'contrasena1',
  'qwerty123',
  'qwertyui',
  'asdfghjk',
  'iloveyou',
  'abcd1234',
  'abc12345',
  'admin123',
  'administrador',
  'kontago',
  'kontago1',
  'kontago123',
  'ecuador1',
  'ecuador123',
  'tienda123',
  'minimarket',
  'bienvenido',
]);

/** Qué tiene de malo una contraseña nueva, o null si sirve. */
export function problemaDePassword(
  password: string,
  email?: string,
): string | null {
  if (password.length < LARGO_MINIMO_PASSWORD)
    return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  if (Buffer.byteLength(password, 'utf8') > LARGO_MAXIMO_PASSWORD)
    return `La contraseña puede tener hasta ${LARGO_MAXIMO_PASSWORD} caracteres.`;
  const normalizada = password.trim().toLowerCase();
  if (MAS_USADAS.has(normalizada) || /^(.)\1+$/.test(normalizada))
    return 'Esa contraseña es de las más usadas: elige otra.';
  const emailNormalizado = email?.trim().toLowerCase();
  if (
    emailNormalizado &&
    (normalizada === emailNormalizado ||
      normalizada === emailNormalizado.split('@')[0])
  )
    return 'La contraseña no puede ser tu email.';
  return null;
}

@ValidatorConstraint({ name: 'passwordSegura' })
class PasswordSeguraConstraint implements ValidatorConstraintInterface {
  validate(valor: unknown, args: ValidationArguments): boolean {
    if (typeof valor !== 'string') return false;
    const email = (args.object as { email?: unknown }).email;
    return (
      problemaDePassword(
        valor,
        typeof email === 'string' ? email : undefined,
      ) === null
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const email = (args.object as { email?: unknown }).email;
    return (
      problemaDePassword(
        typeof args.value === 'string' ? args.value : '',
        typeof email === 'string' ? email : undefined,
      ) ?? 'Contraseña inválida.'
    );
  }
}

/** Contraseña nueva según la política (ver arriba). */
export function PasswordSegura(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: PasswordSeguraConstraint,
    });
}
