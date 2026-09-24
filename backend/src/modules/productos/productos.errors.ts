import { BadRequestException, ConflictException } from '@nestjs/common';

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
      `No se puede reactivar: ya hay otro producto activo con el código de barras "${codigoBarras}". Dalo de baja primero si quieres volver a usar este.`,
    );
  }
}

export class VariosLotesError extends BadRequestException {
  constructor(cantidadLotes: number) {
    super(
      `Este producto tiene ${cantidadLotes} lotes con distinta fecha de vencimiento: corrígelos desde Inventario → Lotes.`,
    );
  }
}

export class FechaSinStockError extends BadRequestException {
  constructor() {
    super(
      'Sin unidades en stock no hay nada que venza: la fecha de vencimiento se carga con el stock inicial o al abastecer.',
    );
  }
}
