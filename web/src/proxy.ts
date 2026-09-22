import { clerkMiddleware } from '@clerk/nextjs/server';

// Desde Next.js 16, este archivo se llama "proxy.ts" en vez de
// "middleware.ts" — la función y el comportamiento son los mismos, solo
// cambió el nombre del archivo (ver docs oficiales de Next.js 16).
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};