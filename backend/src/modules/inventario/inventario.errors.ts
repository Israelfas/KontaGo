import { BadRequestException, NotFoundException } from '@nestjs/common';

export class ProductoNoEncontradoError extends NotFoundException {
  constructor(productoId: string) {
    super(`Producto ${productoId} no existe o no pertenece a esta tienda`);
  }
}

export class StockInsuficienteParaMermaError extends BadRequestException {
  constructor(productoId: string, disponible: number, solicitado: number) {
    super(
      `No se puede registrar una merma de ${solicitado} unidades: el producto ${productoId} solo tiene ${disponible} en stock`,
    );
  }
}
