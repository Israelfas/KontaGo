import { Rol } from '../../../common/enums/rol.enum';

// Lo que va DENTRO del JWT firmado.
export interface JwtPayload {
  sub: string; // usuarioId
  tenantId: string;
  rol: Rol;
}

// Lo que queda en request.user después de validar el JWT.
export interface AuthenticatedUser {
  usuarioId: string;
  tenantId: string;
  rol: Rol;
}
