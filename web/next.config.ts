import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite acceder al servidor de desarrollo desde el celular en la
  // misma red wifi (por defecto Next.js solo confía en localhost).
  allowedDevOrigins: ["192.168.1.16"],

  // Encabezados de seguridad (ISO/IEC 27002:2022, 8.26): que otra página
  // no pueda mostrar KontaGo adentro para engañar clics, que el navegador
  // no adivine tipos de archivo, y que al salir a otro sitio no viaje la
  // dirección completa (el enlace de recuperar contraseña lleva un token).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Cámara solo para el escáner de códigos, desde la propia web.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;