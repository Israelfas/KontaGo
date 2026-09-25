import { BadRequestException, NotFoundException } from '@nestjs/common';

const dolares = (centavos: number) =>
  (centavos / 100).toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
  });

export class ClienteNoEncontradoError extends NotFoundException {
  constructor() {
    super('Ese cliente no existe en esta tienda (o está archivado).');
  }
}

export class FaltaClienteError extends BadRequestException {
  constructor() {
    super('Para fiar hay que elegir a quién.');
  }
}

export class AbonoMayorQueLaDeudaError extends BadRequestException {
  constructor(montoCentavos: number, saldoCentavos: number) {
    super(
      saldoCentavos <= 0
        ? 'Este cliente no debe nada.'
        : `El abono (${dolares(montoCentavos)}) es más de lo que debe (${dolares(saldoCentavos)}).`,
    );
  }
}

export class AbonoSinCajaError extends BadRequestException {
  constructor() {
    super(
      'Para recibir un abono en efectivo abre tu caja: el dinero entra al cajón.',
    );
  }
}

export class ClienteConDeudaError extends BadRequestException {
  constructor(saldoCentavos: number) {
    super(`No se puede archivar: todavía debe ${dolares(saldoCentavos)}.`);
  }
}
