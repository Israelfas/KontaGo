import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Sesion } from './entities/sesion.entity';
import { describirDispositivo } from '../../common/seguridad/dispositivo';
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
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
  ) {}

  /**
   * Actividad de una cuenta: dónde tiene la sesión abierta y sus últimos
   * eventos (ingresos, fallos, bloqueos, cambios de contraseña).
   */
  async actividadDe(usuarioId: string, sesionActualId?: string) {
    const [sesiones, eventos] = await Promise.all([
      this.sesionRepo.find({
        where: {
          usuarioId,
          revocadaEn: IsNull(),
          expiraEn: MoreThan(new Date()),
        },
        order: { createdAt: 'DESC' },
      }),
      this.eventoRepo.find({
        where: { usuarioId },
        order: { createdAt: 'DESC' },
        take: 30,
      }),
    ]);
    return {
      sesiones: sesiones
        .map((s) => ({
          id: s.id,
          dispositivo: describirDispositivo(s.userAgent),
          ip: s.ip,
          abiertaEn: s.createdAt,
          // Se renueva sola mientras se usa: la última renovación es el último uso.
          ultimoUso: s.rotadaEn ?? s.createdAt,
          esEsta: s.id === sesionActualId,
        }))
        .sort((a, b) => b.ultimoUso.getTime() - a.ultimoUso.getTime()),
      eventos: eventos.map((e) => ({
        tipo: e.tipo,
        dispositivo: e.userAgent ? describirDispositivo(e.userAgent) : null,
        ip: e.ip,
        fecha: e.createdAt,
      })),
    };
  }

  /** Último ingreso de cada persona de la tienda (para la lista de Equipo). */
  async ultimosIngresos(tenantId: string): Promise<Map<string, Date>> {
    const filas = await this.eventoRepo.query<
      { usuario_id: string; ultimo: Date }[]
    >(
      `SELECT usuario_id, max(created_at) AS ultimo FROM eventos_seguridad
       WHERE tenant_id = $1 AND tipo IN ('ingreso', 'ingreso_google') AND usuario_id IS NOT NULL
       GROUP BY usuario_id`,
      [tenantId],
    );
    return new Map(filas.map((f) => [f.usuario_id, f.ultimo]));
  }

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
