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
   (30 días más hoy), cajas cerradas cada día (algunas con diferencia),
   ventas por transferencia, lotes con distintas fechas de vencimiento (uno
   ya vencido), alertas, anulaciones y equipo, para probar cada pantalla:
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

### La web en un navegador (Playwright)

Con el backend (:3000) y la web (:3001) levantados:

```bash
cd web
npx playwright install chromium   # solo la primera vez (en la PC usa el Chrome instalado)
npm run test:e2e                  # recarga la tienda demo y corre todo
E2E_SIN_SEED=1 npm run test:e2e   # sin recargar la demo (más rápido)
```

Todas las pruebas entran desde la misma IP y el backend limita los logins
por IP, así que en `backend/.env` va `LIMITE_INTENTOS_AUTH=1000` (se ignora
en producción y en los tests del backend).

### CI

`.github/workflows/ci.yml` corre en cada push a `main` y en cada pull
request: lint y tests del backend, tipos y lint de la web y de la app, y al
final las pruebas en el navegador. Para ese último paso el repo necesita
los secretos `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`
(Settings → Secrets and variables → Actions).

## Producción

El backend no arranca si falta algo de esto (con `NODE_ENV=production`):

- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`: valores largos y al azar,
  distintos entre sí.
- `DB_PASSWORD`: la de la base de producción.
- `CORS_ORIGINS`: la dirección de la web (ej. `https://app.kontago.ec`).
- `CLAVE_CIFRADO`: larga y al azar. Cifra en la base los secretos de la
  verificación en dos pasos; si se cambia, quien la tenga activada tiene
  que volver a activarla.

Además:

- `TRUST_PROXY` con la cantidad de proxies delante del backend (ver
  `backend/.env.example`), para que el límite de intentos de login use la
  IP real.
- Correr `npm run migration:run` antes de cada versión nueva.
- Web: `NEXT_PUBLIC_API_URL` con la dirección del backend. La web y el
  backend tienen que estar en el mismo dominio (pueden ser subdominios:
  `app.kontago.ec` y `api.kontago.ec`), por https: la sesión de la web vive
  en una cookie httpOnly `SameSite=Strict` que el navegador no manda entre
  dominios distintos.
- Web, página de inicio: `NEXT_PUBLIC_APP_ANDROID_URL` y
  `NEXT_PUBLIC_APP_IOS_URL` con el enlace de la tienda (o del `.apk`). Si
  están, los botones de descarga se activan y aparece el QR; si no, dicen
  "Muy pronto". Se leen al compilar la web.
- App: `EXPO_PUBLIC_API_URL`, y el contacto de soporte
  (`EXPO_PUBLIC_SOPORTE_CORREO` / `_WHATSAPP`, ver `mobile/.env.example`).

## Armar la app instalable (Android)

Se compila en los servidores de Expo (EAS), con una cuenta gratis de
[expo.dev](https://expo.dev). Perfiles en `mobile/eas.json`:

| Perfil | Qué arma | Para qué |
|---|---|---|
| `prueba` | APK | Probar en celulares, contra el backend de la PC (misma red Wi-Fi) |
| `produccion` | APK | Descargar desde la página de inicio, con el backend publicado |
| `play-store` | AAB | Subir a Google Play |

El `.env` de `mobile/` no se sube a Expo: las variables se cargan en cada
entorno de EAS (`preview` para `prueba`, `production` para los otros dos).
La primera vez, desde `mobile/`:

```bash
npx eas-cli login
npx eas-cli init                               # crea el proyecto en expo.dev
npx eas-cli env:push --environment preview --path .env
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value http://IP-DE-LA-PC:3000 --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_WEB_URL --value http://IP-DE-LA-PC:3001 --visibility plaintext
npx eas-cli build --platform android --profile prueba
```

Al terminar, EAS da un enlace y un QR para instalarla. Ese enlace va en
`NEXT_PUBLIC_APP_ANDROID_URL` de la web. Con una dirección `http` (la red
local) la app permite tráfico sin cifrar; con `https`, no (ver
`mobile/app.config.ts`).

Si la PC cambia de IP (otra red, o el router le dio otra), no hace falta
volver a armar el APK: en el login de la app, abajo, **Servidor · Cambiar**
deja escribir la IP nueva (la de `ipconfig`, "Dirección IPv4"), prueba que
conteste y la recuerda. Solo aparece con una dirección `http`.

Para entrar con Google desde la app instalada, en el panel de Clerk
(Native applications) hay que permitir la redirección `kontago://sso-callback`.

## Roadmap

Ver `docs/` para el spec completo del proyecto y el detalle de cada fase.

- **Fase 1 (en curso):** MVP — productos, checkout con control de
  concurrencia, ganancia del día, auth JWT con roles.
- **Fase 2:** pérdidas, abastecimiento, notificaciones.
- **Fase 3:** estadísticas históricas y primer plan de suscripción.
- **Fase 4:** recomendaciones y analítica avanzada.
- **Fase 5:** OCR de facturas, multi-sucursal.

Ya se puede **vender sin internet** en la app y en la web: con la caja
abierta, si se corta la red, los productos salen del catálogo guardado y
cada venta queda en una cola que se envía sola al volver la conexión (con
una clave para no cobrarla dos veces). En la web, la pestaña tiene que
haberse abierto con conexión: recargarla sin red no funciona.

Para la tienda de barrio:

- **Productos sin código de barras** (pan, huevos, lo suelto): se cargan
  sin código (el sistema les pone uno interno, EAN-13 con prefijo 20) y en
  la caja se buscan por nombre o con los botones de "Sin código de barras".
- **Venta por peso**: un producto se vende por unidad, por libra o por
  kilo. Las cantidades van con hasta 3 decimales (`numeric(12,3)` en la
  base) y los importes se redondean al centavo; en la caja se elige ¼, ½,
  1 o 2 libras, el peso exacto o "por cuánto dinero".
- **Fiado**: se vende a un cliente sin cobrar y queda en su cuenta. En
  Fiados se ve quién debe cuánto y se registran los abonos (en efectivo
  entran a la caja como un ingreso, así el arqueo cuadra).
- El **reporte en Excel** trae una hoja "Gráficos" con gráficos nativos
  (ventas por día u hora, cómo pagan, lo más vendido, pérdidas), que leen
  sus datos de la misma hoja.