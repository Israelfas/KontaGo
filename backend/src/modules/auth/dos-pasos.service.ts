import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { SeguridadService, type ContextoPedido } from './seguridad.service';
import { cifrar, descifrar } from '../../common/seguridad/cifrado';
import {
  enlaceOtpauth,
  generarSecreto,
  verificarCodigo,
} from '../../common/seguridad/totp';

/** Cuántos códigos de recuperación se entregan al activarla. */
const CANTIDAD_DE_CODIGOS = 8;
// Sin letras ni números que se confundan (0/o, 1/l/i).
const ALFABETO_CODIGOS = 'abcdefghjkmnpqrstuvwxyz23456789';

export type ComoSeVerifico = 'app' | 'recuperacion';

const CODIGO_INCORRECTO =
  'El código no es correcto. Usa el que muestra ahora la app (cambia cada 30 segundos).';

/**
 * Verificación en dos pasos (ISO/IEC 27002:2022, 8.5): además de la
 * contraseña, un código de 6 dígitos de una app autenticadora. Por si se
 * pierde el celular, al activarla se entregan códigos de recuperación de
 * un solo uso.
 *
 * El secreto se guarda cifrado; los códigos de recuperación, solo su hash.
 * Un código aceptado no sirve otra vez (ni aunque llegue dos veces a la vez).
 */
@Injectable()
export class DosPasosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly config: ConfigService,
    private readonly seguridad: SeguridadService,
  ) {}

  private get clave(): string {
    return this.config.get<string>('claveCifrado')!;
  }

  /** El usuario con los datos de la verificación (que no se leen solos). */
  private async cargar(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect([
        'u.dosPasosSecreto',
        'u.dosPasosPendiente',
        'u.dosPasosUltimoPaso',
        'u.dosPasosCodigos',
      ])
      .where('u.id = :usuarioId', { usuarioId })
      .getOne();
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async estado(usuarioId: string) {
    const usuario = await this.cargar(usuarioId);
    return {
      activa: usuario.dosPasosActivoDesde !== null,
      desde: usuario.dosPasosActivoDesde,
      codigosRestantes: usuario.dosPasosCodigos?.length ?? 0,
    };
  }

  /** Paso 1: un secreto nuevo (pendiente) para cargar en la app. */
  async iniciar(usuarioId: string) {
    const usuario = await this.cargar(usuarioId);
    if (usuario.dosPasosActivoDesde) {
      throw new ConflictException(
        'La verificación en dos pasos ya está activada.',
      );
    }
    const secreto = generarSecreto();
    await this.usuarios.update(usuarioId, {
      dosPasosPendiente: cifrar(secreto, this.clave),
    });
    return {
      // En grupos de 4, para escribirlo a mano si no se puede escanear.
      secreto: secreto.match(/.{1,4}/g)!.join(' '),
      enlace: enlaceOtpauth(secreto, usuario.email),
    };
  }

  /** Paso 2: con un código de la app, queda activada. */
  async activar(usuarioId: string, codigo: string, contexto: ContextoPedido) {
    const usuario = await this.cargar(usuarioId);
    if (usuario.dosPasosActivoDesde) {
      throw new ConflictException(
        'La verificación en dos pasos ya está activada.',
      );
    }
    if (!usuario.dosPasosPendiente) {
      throw new BadRequestException('Primero genera el código para escanear.');
    }
    const paso = verificarCodigo(
      descifrar(usuario.dosPasosPendiente, this.clave),
      codigo,
    );
    if (paso === null) {
      throw new BadRequestException(
        `${CODIGO_INCORRECTO} Revisa también que la hora del celular esté bien.`,
      );
    }
    const codigos = Array.from({ length: CANTIDAD_DE_CODIGOS }, nuevoCodigo);
    await this.usuarios.update(usuarioId, {
      dosPasosSecreto: usuario.dosPasosPendiente,
      dosPasosPendiente: null,
      dosPasosActivoDesde: new Date(),
      dosPasosUltimoPaso: paso,
      dosPasosCodigos: codigos.map(hashDeCodigo),
    });
    await this.seguridad.registrar('dos_pasos_activada', { usuario, contexto });
    // Se muestran una sola vez: después solo queda su hash.
    return { codigosRecuperacion: codigos };
  }

  /** La apaga quien la tiene, con un código de la app o de recuperación. */
  async desactivar(
    usuarioId: string,
    codigo: string,
    contexto: ContextoPedido,
  ) {
    const usuario = await this.cargar(usuarioId);
    if (!usuario.dosPasosActivoDesde) {
      throw new BadRequestException(
        'No tienes activada la verificación en dos pasos.',
      );
    }
    if (!(await this.gastarCodigo(usuario, codigo))) {
      throw new BadRequestException(CODIGO_INCORRECTO);
    }
    await this.limpiar(usuarioId);
    await this.seguridad.registrar('dos_pasos_desactivada', {
      usuario,
      contexto,
    });
  }

  /** Un admin se la quita a alguien de su equipo que perdió el celular. */
  async quitarPorAdmin(usuario: Usuario, contexto: ContextoPedido = {}) {
    await this.limpiar(usuario.id);
    await this.seguridad.registrar('dos_pasos_quitada_por_admin', {
      usuario,
      contexto,
    });
  }

  /** Para el ingreso: comprueba el código y lo gasta. */
  async verificarParaIngresar(
    usuarioId: string,
    codigo: string,
  ): Promise<ComoSeVerifico | null> {
    return this.gastarCodigo(await this.cargar(usuarioId), codigo);
  }

  /**
   * Un código de la app (6 dígitos) o de recuperación. Si sirve, se gasta
   * en la misma sentencia que lo comprueba: dos pedidos simultáneos con el
   * mismo código no pueden pasar los dos.
   */
  private async gastarCodigo(
    usuario: Usuario,
    codigo: string,
  ): Promise<ComoSeVerifico | null> {
    const limpio = codigo.replace(/\s/g, '');

    if (/^\d{6}$/.test(limpio)) {
      if (!usuario.dosPasosSecreto) return null;
      const paso = verificarCodigo(
        descifrar(usuario.dosPasosSecreto, this.clave),
        limpio,
      );
      if (paso === null) return null;
      const [filas] = await this.usuarios.query<[{ id: string }[], number]>(
        `UPDATE usuarios SET dos_pasos_ultimo_paso = $2
          WHERE id = $1 AND (dos_pasos_ultimo_paso IS NULL OR dos_pasos_ultimo_paso < $2)
          RETURNING id`,
        [usuario.id, paso],
      );
      return filas.length > 0 ? 'app' : null;
    }

    const hash = hashDeCodigo(limpio);
    const [filas] = await this.usuarios.query<[{ id: string }[], number]>(
      `UPDATE usuarios SET dos_pasos_codigos = dos_pasos_codigos - $2::text
        WHERE id = $1 AND dos_pasos_codigos ? $2::text
        RETURNING id`,
      [usuario.id, hash],
    );
    return filas.length > 0 ? 'recuperacion' : null;
  }

  private async limpiar(usuarioId: string) {
    await this.usuarios.update(usuarioId, {
      dosPasosSecreto: null,
      dosPasosPendiente: null,
      dosPasosActivoDesde: null,
      dosPasosUltimoPaso: null,
      dosPasosCodigos: null,
    });
  }
}

/** 'k7m2-p9qx': 8 caracteres al azar, en dos grupos. */
function nuevoCodigo(): string {
  const letras = Array.from(
    { length: 8 },
    () => ALFABETO_CODIGOS[randomInt(ALFABETO_CODIGOS.length)],
  ).join('');
  return `${letras.slice(0, 4)}-${letras.slice(4)}`;
}

/** Se compara sin guiones ni mayúsculas: "K7M2 P9QX" = "k7m2-p9qx". */
function hashDeCodigo(codigo: string): string {
  const normalizado = codigo.toLowerCase().replace(/[^a-z0-9]/g, '');
  return createHash('sha256').update(normalizado).digest('hex');
}
