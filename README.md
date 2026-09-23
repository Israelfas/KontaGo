# KontaGo

Sistema de gestión de inventarios escalable, entregado como app híbrida
(web + móvil). El celular del usuario reemplaza el hardware de escaneo
tradicional (lectores de código de barras, POS físicos): cámara para
escanear, y la app hace el resto del proceso de venta e inventario.

## Estructura del monorepo

\`\`\`
kontago/
├── backend/    → API NestJS + PostgreSQL + Redis (Fase 1, en desarrollo)
├── web/        → Frontend web (Next.js) — fases posteriores
├── mobile/     → App móvil (React Native) — fases posteriores
├── docs/       → Documentación y specs del proyecto
└── docker-compose.yml  → Postgres + Redis para desarrollo local
\`\`\`

## Levantar el entorno de desarrollo

1. Levantar Postgres y Redis:
   \`\`\`bash
   docker compose up -d
   \`\`\`
2. Configurar variables de entorno del backend:
   \`\`\`bash
   cd backend
   cp .env.example .env
   \`\`\`
3. Instalar dependencias y correr migraciones:
   \`\`\`bash
   npm install
   npm run migration:run
   \`\`\`
4. Levantar la API:
   \`\`\`bash
   npm run start:dev
   \`\`\`

La API queda disponible en `http://localhost:3000`. Health check: `GET /health`.

5. (Opcional) Cargar una tienda de demostración con un mes de ventas
   (30 días más hoy), lotes con distintas fechas de vencimiento (uno ya
   vencido), alertas, anulaciones y equipo, para probar cada pantalla:
   \`\`\`bash
   npm run seed:demo
   \`\`\`
   Admin `demo@kontago.test` y cajero `cajero@kontago.test`, ambos con
   clave `demo1234`. Se puede correr las veces que haga falta: rearma la
   demo con ventas hasta el día en que se corre (tarda unos segundos).

## Tests

```bash
cd backend
npm test            # unitarios (lógica de lotes, rangos de fechas)
npm run test:e2e    # la API completa contra una base aparte
```

Los e2e crean desde cero la base `DB_NAME_TEST` (por defecto
`kontago_test`, en el mismo Postgres del docker compose), le corren las
migraciones y prueban sesiones, aislamiento entre tiendas, ventas,
anulaciones, lotes e historial. **Borran esa base en cada corrida**:
nunca apuntar `DB_NAME_TEST` a la de desarrollo ni a la de producción.

## Producción

El backend no arranca si falta algo de esto (con `NODE_ENV=production`):

- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`: valores largos y al azar,
  distintos entre sí.
- `DB_PASSWORD`: la de la base de producción.
- `CORS_ORIGINS`: la dirección de la web (ej. `https://app.kontago.ec`).

Además:

- `TRUST_PROXY` con la cantidad de proxies delante del backend (ver
  `backend/.env.example`), para que el límite de intentos de login use la
  IP real.
- Correr `npm run migration:run` antes de cada versión nueva.
- Web: `NEXT_PUBLIC_API_URL` con la dirección del backend.
- App: `EXPO_PUBLIC_API_URL`, y el contacto de soporte
  (`EXPO_PUBLIC_SOPORTE_CORREO` / `_WHATSAPP`, ver `mobile/.env.example`).

## Roadmap

Ver `docs/` para el spec completo del proyecto y el detalle de cada fase.

- **Fase 1 (en curso):** MVP — productos, checkout con control de
  concurrencia, ganancia del día, auth JWT con roles.
- **Fase 2:** pérdidas, abastecimiento, notificaciones.
- **Fase 3:** estadísticas históricas y primer plan de suscripción.
- **Fase 4:** recomendaciones y analítica avanzada.
- **Fase 5:** OCR de facturas, multi-sucursal, modo offline.