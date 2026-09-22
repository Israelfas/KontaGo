import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Lo consulta el hosting (Railway, Render, un balanceador...) para
   * saber si esta instancia puede atender pedidos. Sin base de datos no
   * puede hacer nada útil, así que en ese caso responde 503 en vez de
   * "ok" — así el hosting la reinicia o deja de mandarle tráfico.
   */
  async getHealth() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'kontago-backend',
        database: 'down',
      });
    }
    return { status: 'ok', service: 'kontago-backend', database: 'up' };
  }
}
