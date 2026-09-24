import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export class CajaCerradaError extends ConflictException {
  constructor() {
    super('Abre la caja antes de cobrar: indica con cuánto cambio empiezas.');
  }
}

export class CajaYaAbiertaError extends ConflictException {
  constructor() {
    super('Ya tienes la caja abierta: ciérrala antes de abrir otra.');
  }
}

export class TurnoNoEncontradoError extends NotFoundException {
  constructor() {
    super('Ese turno de caja no existe o no es de esta tienda');
  }
}

export class TurnoYaCerradoError extends ConflictException {
  constructor() {
    super('Ese turno de caja ya está cerrado');
  }
}

export class DevolucionSinCajaError extends BadRequestException {
  constructor() {
    super(
      'Esta venta es de un turno de caja que ya se cerró (su efectivo ya se contó). Para devolver el dinero, abre tu caja: la devolución sale de ahí como retiro.',
    );
  }
}
