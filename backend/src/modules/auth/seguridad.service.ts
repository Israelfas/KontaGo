import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EventoSeguridad,
  type TipoEventoSeguridad,
} from './entities/evento-seguridad.entity';

/** De dónde vino un pedido: se guarda con cada evento de seguridad. */
export interface ContextoPedido {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Registro de eventos de seguridad (ISO/IEC 27002:2022, 8.15). Anotar un
 * evento nunca hace fallar el pedido que lo generó: si la base no
 * responde, queda al menos en el log del servidor.
 */
@Injectable()
export class SeguridadService {
  private readonly logger = new Logger('Seguridad');

  constructor(
    @InjectRepository(EventoSeguridad)
    private readonly eventoRepo: Repository<EventoSeguridad>,
  ) {}

  async registrar(
    tipo: TipoEventoSeguridad,
    datos: {
      usuario?: { id: string; tenantId: string; email: string } | null;
      email?: string | null;
      contexto?: ContextoPedido;
    },
  ): Promise<void> {
    const email = datos.usuario?.email || datos.email || null;
    const ip = datos.contexto?.ip?.slice(0, 64) ?? null;
    try {
      await this.eventoRepo.insert({
        tipo,
        usuarioId: datos.usuario?.id ?? null,
        tenantId: datos.usuario?.tenantId ?? null,
        email: email?.slice(0, 150) ?? null,
        ip,
        userAgent: datos.contexto?.userAgent?.slice(0, 200) ?? null,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el evento ${tipo}: ${error instanceof Error ? error.message : error}`,
      );
    }
    // Los fallos y bloqueos también al log, para verlos sin consultar la base.
    if (tipo !== 'ingreso' && tipo !== 'cierre_sesion') {
      this.logger.log(`${tipo} · ${email ?? '—'} · ${ip ?? 'sin IP'}`);
    }
  }
}
