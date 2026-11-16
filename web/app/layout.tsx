import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "El Último Escaño — Cómo se decidió el último diputado",
  description: "Descubre cómo se decidió el último diputado de tu provincia. León 2023 como punto de partida, resultados oficiales y calculadora D’Hondt integrada.",
  openGraph: {
    title: "El Último Escaño",
    description: "Explora tu provincia, reconstruye el reparto de 2023 y compara escenarios matemáticos.",
    type: "website",
    locale: "es_ES",
  },
  twitter: { card: "summary", title: "El Último Escaño", description: "El último diputado de tu provincia, explicado. Cambia los votos y compara." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-paper font-sans text-ink antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">
          Saltar al contenido
        </a>
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2.5" aria-label="El Último Escaño · Inicio">
              <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
              <span className="text-lg font-extrabold leading-none tracking-tight">El Último <span className="text-accent">Escaño</span></span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="contenido" className="mx-auto max-w-6xl px-4 py-6 md:py-8">
          {children}
        </main>
        <footer className="mt-12 border-t border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 text-xs leading-relaxed text-stone-500">
            <p className="text-base font-bold text-ink">El Último Escaño · Del voto al diputado</p>
            <p className="mt-2 max-w-4xl">
              Resultados oficiales de 2023: Ministerio del Interior y JEC. Reglas: artículo 163 de la LOREG.
              Geometría: Eurostat GISCO (© EuroGeographics). Demografía del archivo: INE (CC BY 4.0).
              Los escenarios son matemáticos e hipotéticos; no son previsiones electorales.
            </p>
            <p className="mt-2">
              <Link href="/aprende" className="underline">Aprende más</Link> · <Link href="/metodologia" className="underline">Metodología y fuentes</Link>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
