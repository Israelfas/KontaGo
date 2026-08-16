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

## Roadmap

Ver `docs/` para el spec completo del proyecto y el detalle de cada fase.

- **Fase 1 (en curso):** MVP — productos, checkout con control de
  concurrencia, ganancia del día, auth JWT con roles.
- **Fase 2:** pérdidas, abastecimiento, notificaciones.
- **Fase 3:** estadísticas históricas y primer plan de suscripción.
- **Fase 4:** recomendaciones y analítica avanzada.
- **Fase 5:** OCR de facturas, multi-sucursal, modo offline.