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
}

function aPublico(u: Usuario): UsuarioPublico {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    createdAt: u.createdAt,
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
  ) {}

  async listar(tenantId: string): Promise<UsuarioPublico[]> {
    const usuarios = await this.usuarioRepo.find({
      where: { tenantId },
      order: { activo: 'DESC', createdAt: 'ASC' },
    });
    return usuarios.map(aPublico);
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
      throw new BadRequestException('No podés desactivar tu propia cuenta');
    }
    const usuario = await this.buscar(tenantId, id);
    usuario.activo = false;
    const guardado = await this.usuarioRepo.save(usuario);
    // JwtStrategy ya lo rechaza por inactivo; además se cierran sus
    // sesiones, así reactivarlo no revive los tokens viejos.
    await this.authService.revocarSesionesDe(id, 'usuario_desactivado');
    return aPublico(guardado);
  }

  async reactivar(tenantId: string, id: string): Promise<UsuarioPublico> {
    const usuario = await this.buscar(tenantId, id);
    usuario.activo = true;
    return aPublico(await this.usuarioRepo.save(usuario));
  }

  /**
   * No hay recuperación de contraseña por email todavía: si un cajero
   * se la olvida, el admin le pone una nueva desde acá.
   */
  async cambiarPassword(
    tenantId: string,
    id: string,
    password: string,
  ): Promise<UsuarioPublico> {
    const usuario = await this.buscar(tenantId, id);
    usuario.passwordHash = await this.authService.hashPassword(password);
    const guardado = await this.usuarioRepo.save(usuario);
    // Contraseña nueva = hay que volver a entrar en todos lados (si la
    // cambiaron porque alguien la sabía, esa persona queda afuera).
    await this.authService.revocarSesionesDe(id, 'password_cambiada');
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
