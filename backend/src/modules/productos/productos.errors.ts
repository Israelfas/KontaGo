import { ConflictException } from '@nestjs/common';

export class CodigoBarrasDuplicadoError extends ConflictException {
  constructor(codigoBarras: string) {
    super(
      `Ya existe un producto con el código de barras "${codigoBarras}" en esta tienda`,
    );
  }
}

export class CodigoBarrasEnUsoAlReactivarError extends ConflictException {
  constructor(codigoBarras: string) {
    super(
      `No se puede reactivar: ya hay otro producto activo con el código de barras "${codigoBarras}". Dalo de baja primero si querés volver a usar este.`,
    );
  }
}
