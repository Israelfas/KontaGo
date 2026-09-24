import { Rol } from '../../../common/enums/rol.enum';

// Lo que va DENTRO del JWT firmado.
export interface JwtPayload {
  sub: string; // usuarioId
  tenantId: string;
  rol: Rol;
  // Sesión a la que pertenece el token (ver Sesion). Los tokens de antes
  // de las sesiones no lo traen: se rechazan.
  sid?: string;
  // Solo en el refreshToken: cuál de las rotaciones es (ver Sesion.jtiActual).
  jti?: string;
}

// Lo que queda en request.user después de validar el JWT.
export interface AuthenticatedUser {
  usuarioId: string;
  tenantId: string;
  rol: Rol;
  // La sesión del pedido (para marcar "este dispositivo").
  sesionId?: string;
}
