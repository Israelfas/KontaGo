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

export class MontoRecibidoInsuficienteError extends BadRequestException {
  constructor(totalCentavos: number, montoRecibidoCentavos: number) {
    super(
      `El monto recibido (${montoRecibidoCentavos}) es menor al total de la venta (${totalCentavos})`,
    );
  }
}
