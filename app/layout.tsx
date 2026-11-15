import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Tipografía sans-serif única para todo el sitio (se descarga y sirve desde
// el propio dominio con next/font: sin pedidos a Google desde el navegador).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Supermercado online",
    template: "%s · Supermercado online",
  },
  description: "Hacé tu compra del súper online y retirala o recibila en tu casa.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
