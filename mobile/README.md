# KontaGo Mobile

App móvil (Expo / React Native) — espejo de las 6 pantallas del web:
login, registro, resumen del día, productos, vender (con cámara), inventario.

## Primer arranque

```powershell
cd mobile
npm install
```

## Configurar la IP del backend

El celular no puede usar `localhost` — eso apuntaría al propio celular, no
a tu PC. Hay que apuntarlo a la IP de LAN de tu PC (la misma que ya usás
para las pruebas de cámara por WiFi en el web, ver memoria del proyecto:
`192.168.1.23`, puede cambiar si el router reasigna IPs).

Editá `mobile/app.json`:

```json
"extra": {
  "apiUrl": "http://TU_IP_DE_LAN:3000"
}
```

Para confirmar tu IP actual en Windows:
```powershell
ipconfig
```
Buscá "Dirección IPv4" de tu adaptador WiFi.

**El backend debe estar escuchando en `0.0.0.0`, no solo en `localhost`**,
para aceptar conexiones desde otros dispositivos de la LAN. Si `main.ts`
del backend hace `app.listen(3000)` sin especificar host, Nest ya escucha
en todas las interfaces por defecto — no debería hacer falta tocar nada,
pero si el celular no puede conectar, ese es el primer lugar a revisar.

## Levantar la app

Con el backend (`npm run start:dev` en `backend/`) y el celular en la
**misma red WiFi** que la PC:

```powershell
cd mobile
npm start
```

Esto abre Metro con un QR. Instalá **Expo Go** desde Play Store en tu
Android, escaneá el QR desde la app (no desde la cámara del sistema) y
debería cargar KontaGo ahí.

Si el celular no logra conectar al servidor de Metro (problema típico de
firewall de Windows), probá:

```powershell
npm start -- --tunnel
```

Esto es más lento pero rutea a través de un túnel de Expo en vez de
depender de que la LAN deje pasar la conexión directa.

## Permisos de cámara

La primera vez que entrás a "Vender" → "Escanear con la cámara", Android
va a pedir permiso de cámara — hay que aceptarlo. Si lo rechazaste sin
querer, se revoca desde Ajustes → Apps → Expo Go → Permisos.

## Notas de arquitectura

- **Cliente API** (`src/lib/api.ts`): mismo cliente que el web, solo
  cambia de dónde saca `API_URL` (acá viene de `app.json > expo.extra`,
  en vez de una variable de entorno de Next).
- **Sesión** (`src/lib/auth-context.tsx`): usa `expo-secure-store` en vez
  de `localStorage` — el token queda cifrado en el dispositivo. La lógica
  de decodificar el JWT es la misma.
- **Navegación**: `RootNavigator` alterna entre el stack de auth
  (login/registro) y las tabs principales según haya token o no — no hay
  rutas protegidas manuales como en el web, es automático por diseño de
  React Navigation.
- **Escaneo de código de barras** (`VentaScreen.tsx`): usa `expo-camera`
  (`CameraView` con `onBarcodeScanned`), no `@zxing/browser` como el web
  — son cámaras nativas, no cámaras de navegador, así que la librería es
  distinta pero el resultado (un string de código de barras) es el mismo.
  **Todavía no probado contra un código de barras físico real** — mismo
  pendiente que tenía el escaneo del web.
