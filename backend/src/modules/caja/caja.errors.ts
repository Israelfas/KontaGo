import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export class CajaCerradaError extends ConflictException {
  constructor() {
    super('Abrí la caja antes de cobrar: indicá con cuánto cambio empezás.');
  }
}

export class CajaYaAbiertaError extends ConflictException {
  constructor() {
    super('Ya tenés la caja abierta: cerrala antes de abrir otra.');
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
      'Esta venta es de un turno de caja que ya se cerró (su efectivo ya se contó). Para devolver la plata, abrí tu caja: la devolución sale de ahí como retiro.',
    );
  }
}
