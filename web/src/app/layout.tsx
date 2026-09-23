import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "KontaGo",
  description: "El celular reemplaza la caja registradora.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-papel text-tinta">
        {/* signInUrl/signUpUrl: nuestras pantallas. Sin esto, cuando un
            flujo de Clerk no puede continuar (por ejemplo si se pierde la
            transacción al volver de Google), Clerk manda a SU portal de
            cuentas alojado en accounts.dev en vez de a KontaGo.
            Los fallback marcan a dónde volver cuando el flujo sí termina. */}
        <ClerkProvider
          signInUrl="/login"
          signUpUrl="/registro"
          signInFallbackRedirectUrl="/clerk-bridge"
          signUpFallbackRedirectUrl="/clerk-bridge"
          afterSignOutUrl="/login"
        >
          <AuthProvider>{children}</AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}