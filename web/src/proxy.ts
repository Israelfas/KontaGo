import { clerkMiddleware } from '@clerk/nextjs/server';

// Desde Next.js 16, este archivo se llama "proxy.ts" en vez de
// "middleware.ts" — la función y el comportamiento son los mismos, solo
// cambió el nombre del archivo (ver docs oficiales de Next.js 16).
export default clerkMiddleware();

// Todo menos los archivos estáticos y /api, que es el reenvío al backend
// (ver next.config.ts): ahí Clerk no tiene nada que hacer.
export const config = {
  matcher: [
    '/((?!_next|api/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
