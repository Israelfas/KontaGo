import { BadRequestException, NotFoundException } from '@nestjs/common';

export class ProductoNoEncontradoError extends NotFoundException {
  constructor(productoId: string) {
    super(`Producto ${productoId} no existe o no pertenece a esta tienda`);
  }
}

export class StockInsuficienteError extends BadRequestException {
  constructor(productoId: string, disponible: number, solicitado: number) {
    super(
      `Stock insuficiente para el producto ${productoId}: disponible ${disponible}, solicitado ${solicitado}`,
    );
  }
}

export class FaltaMontoRecibidoError extends BadRequestException {
  constructor() {
    super('En efectivo hay que indicar cuánto pagó el cliente');
  }
}

export class MontoRecibidoInsuficienteError extends BadRequestException {
  constructor(totalCentavos: number, montoRecibidoCentavos: number) {
    super(
      `El monto recibido (${montoRecibidoCentavos}) es menor al total de la venta (${totalCentavos})`,
    );
  }
}

export class VentaNoEncontradaError extends NotFoundException {
  constructor(ventaId: string) {
    super(`Venta ${ventaId} no existe o no pertenece a esta tienda`);
  }
}

export class VentaDeOtroDiaError extends BadRequestException {
  constructor() {
    super(
      'Solo se pueden anular ventas del día. Una venta de un día anterior ya forma parte de reportes cerrados.',
    );
  }
}

export class VentaYaAnuladaError extends BadRequestException {
  constructor() {
    super('Esta venta ya está anulada por completo');
  }
}

export class LineaDeOtraVentaError extends BadRequestException {
  constructor(ventaItemId: string) {
    super(`La línea ${ventaItemId} no pertenece a esta venta`);
  }
}

export class CantidadAAnularInvalidaError extends BadRequestException {
  constructor(nombre: string, pendiente: number, solicitada: number) {
    super(
      `No se pueden anular ${solicitada} unidades de "${nombre}": quedan ${pendiente} sin anular en esta venta`,
    );
  }
}
