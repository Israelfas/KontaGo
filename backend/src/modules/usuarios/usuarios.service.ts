import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from '../auth/entities/usuario.entity';
import { AuthService } from '../auth/auth.service';
import { SeguridadService } from '../auth/seguridad.service';
import { Rol } from '../../common/enums/rol.enum';
import { bloquearEmail } from '../../common/db/bloquear-email';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

// Lo que se expone de un usuario: nunca el passwordHash.
export interface UsuarioPublico {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  createdAt: Date;
  // Bloqueada por intentos fallidos hasta esta hora (null si no lo está).
  bloqueadoHasta: Date | null;
  // Solo en la lista (las respuestas de una sola persona no lo traen).
  ultimoIngreso?: Date | null;
}

function aPublico(u: Usuario): UsuarioPublico {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    createdAt: u.createdAt,
    bloqueadoHasta:
      u.bloqueadoHasta && u.bloqueadoHasta > new Date()
        ? u.bloqueadoHasta
        : null,
  };
}

/**
 * Equipo de una tienda: el admin da de alta a sus cajeros (o a otro
 * admin), les resetea la contraseña y los desactiva cuando dejan de
 * trabajar ahí. Desactivar no borra: sus ventas pasadas los referencian.
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
    private readonly seguridad: SeguridadService,
  ) {}

  async listar(tenantId: string): Promise<UsuarioPublico[]> {
    const [usuarios, ingresos] = await Promise.all([
      this.usuarioRepo.find({
        where: { tenantId },
        order: { activo: 'DESC', createdAt: 'ASC' },
      }),
      this.seguridad.ultimosIngresos(tenantId),
    ]);
    return usuarios.map((u) => ({
      ...aPublico(u),
      ultimoIngreso: ingresos.get(u.id) ?? null,
    }));
  }

  /** Dónde tiene la sesión abierta y qué pasó con su cuenta. */
  async actividad(tenantId: string, id: string, sesionActualId?: string) {
    const usuario = await this.buscar(tenantId, id);
    return this.seguridad.actividadDe(usuario.id, sesionActualId);
  }

  /**
   * Cierra la sesión de alguien del equipo en todos sus dispositivos
   * (perdió el celular, dejó la caja abierta en otra compu).
   */
  async cerrarSesiones(tenantId: string, id: string): Promise<void> {
    const usuario = await this.buscar(tenantId, id);
    await this.authService.revocarSesionesDe(usuario.id, 'cerradas_por_admin');
    await this.seguridad.registrar('sesiones_cerradas', { usuario });
  }

  /** Levanta el bloqueo por intentos fallidos antes de que venza solo. */
  async desbloquear(tenantId: string, id: string): Promise<UsuarioPublico> {
    const usuario = await this.buscar(tenantId, id);
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    const guardado = await this.usuarioRepo.save(usuario);
    await this.seguridad.registrar('cuenta_desbloqueada', {
      usuario: guardado,
    });
    return aPublico(guardado);
  }

  async crear(tenantId: string, dto: CrearUsuarioDto): Promise<UsuarioPublico> {
    const passwordHash = await this.authService.hashPassword(dto.password);

    const usuario = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);

      // El email es único en toda la plataforma (el login busca solo
      // por email), no solo dentro de esta tienda.
      await bloquearEmail(manager, dto.email);
      if (await repo.exists({ where: { email: dto.email } })) {
        throw new ConflictException('Ese email ya está registrado');
      }

      return repo.save(
        repo.create({
          tenantId,
          nombre: dto.nombre,
          email: dto.email,
          passwordHash,
          rol: dto.rol ?? Rol.CAJERO,
        }),
      );
    });

    return aPublico(usuario);
  }

  async desactivar(
    tenantId: string,
    id: string,
    usuarioActualId: string,
  ): Promise<UsuarioPublico> {
    // Si el admin se desactivara a sí mismo, la tienda podría quedar sin
    // nadie que pueda administrarla.
    if (id === usuarioActualId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    const usuario = await this.buscar(tenantId, id);
    usuario.activo = false;
    const guardado = await this.usuarioRepo.save(usuario);
    // JwtStrategy ya lo rechaza por inactivo; además se cierran sus
    // sesiones, así reactivarlo no revive los tokens viejos.
    await this.authService.revocarSesionesDe(id, 'usuario_desactivado');
    await this.seguridad.registrar('usuario_desactivado', {
      usuario: guardado,
    });
    return aPublico(guardado);
  }

  async reactivar(tenantId: string, id: string): Promise<UsuarioPublico> {
    const usuario = await this.buscar(tenantId, id);
    usuario.activo = true;
    const guardado = await this.usuarioRepo.save(usuario);
    await this.seguridad.registrar('usuario_reactivado', { usuario: guardado });
    return aPublico(guardado);
  }

  /**
   * El admin le pone una contraseña nueva a alguien de su equipo (por
   * ejemplo, un cajero sin email propio que se la olvidó). La cuenta se
   * desbloquea si estaba bloqueada por intentos fallidos.
   */
  async cambiarPassword(
    tenantId: string,
    id: string,
    password: string,
  ): Promise<UsuarioPublico> {
    const usuario = await this.buscar(tenantId, id);
    usuario.passwordHash = await this.authService.hashPassword(password);
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    const guardado = await this.usuarioRepo.save(usuario);
    // Contraseña nueva = hay que volver a entrar en todos lados (si la
    // cambiaron porque alguien la sabía, esa persona queda afuera).
    await this.authService.revocarSesionesDe(id, 'password_cambiada');
    await this.seguridad.registrar('password_cambiada_por_admin', {
      usuario: guardado,
    });
    return aPublico(guardado);
  }

  private async buscar(tenantId: string, id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id, tenantId } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return usuario;
  }
}
