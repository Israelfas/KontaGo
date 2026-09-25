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

export class CantidadConDecimalesError extends BadRequestException {
  constructor(nombre: string) {
    super(
      `${nombre} se vende por unidad: la cantidad va sin decimales. Si lo vendes por peso, cambia su unidad en Productos.`,
    );
  }
}

export class UnidadConStockDecimalError extends BadRequestException {
  constructor(stock: number) {
    super(
      `Quedan ${stock.toLocaleString('es-EC')} en stock: para venderlo por unidad, el stock tiene que ser un número entero. Corrígelo con una merma o un abastecimiento.`,
    );
  }
}
