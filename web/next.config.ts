import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite acceder al servidor de desarrollo desde el celular en la
  // misma red wifi (por defecto Next.js solo confía en localhost).
  allowedDevOrigins: ["192.168.1.23"],
};

export default nextConfig;