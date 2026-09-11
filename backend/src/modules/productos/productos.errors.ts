import { ConflictException } from '@nestjs/common';

export class CodigoBarrasDuplicadoError extends ConflictException {
  constructor(codigoBarras: string) {
    super(
      `Ya existe un producto con el código de barras "${codigoBarras}" en esta tienda`,
    );
  }
}