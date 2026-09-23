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

export class LoteDeOtroProductoError extends NotFoundException {
  constructor(loteId: string) {
    super(`El lote ${loteId} no existe o no es de este producto`);
  }
}

export class StockDelLoteInsuficienteError extends BadRequestException {
  constructor(disponible: number, solicitado: number) {
    super(
      `Ese lote tiene ${disponible} unidad${disponible === 1 ? '' : 'es'}: no se pueden sacar ${solicitado}`,
    );
  }
}

export class LotesNoSumanElStockError extends BadRequestException {
  constructor(suma: number, stock: number) {
    super(
      `Los lotes suman ${suma} unidades pero hay ${stock} en stock. Si falta mercadería, registrala como pérdida; si sobra, como abastecimiento.`,
    );
  }
}
