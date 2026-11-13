import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observatorio Electoral 29N — España",
  description: "Resultados históricos del Congreso, demografía, encuestas y evaluación retrospectiva de modelos. Sin pronósticos.",
  openGraph: {
    title: "España en las urnas — Observatorio Electoral 1977–2023",
    description: "Datos históricos, demografía, encuestas y laboratorio ML retrospectivo. Sin pronósticos del 29N.",
    type: "website",
    locale: "es_ES",
  },
  twitter: { card: "summary", title: "España en las urnas", description: "Observatorio electoral histórico 1977–2023." },
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
            <Link href="/" className="flex items-baseline gap-2" aria-label="Inicio del observatorio">
              <span className="font-serif text-xl font-bold leading-none">España en las urnas</span>
              <span className="hidden text-[11px] font-medium uppercase tracking-widest text-accent sm:inline">
                Observatorio 1977–2023
              </span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="contenido" className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>
        <footer className="mt-12 border-t border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 text-xs leading-relaxed text-stone-500">
            <p className="font-serif text-base text-ink">España en las urnas · Observatorio Electoral</p>
            <p className="mt-2 max-w-4xl">
              Resultados: Ministerio del Interior. Demografía: INE (CC BY 4.0). Compilación de encuestas:
              Wikipedia (CC BY-SA 4.0); no transfiere permisos de fuentes primarias. Geometría: Eurostat GISCO
              (© EuroGeographics). Evaluación retrospectiva con fines de investigación: <strong>sin pronósticos del 29N-2026</strong>.
              El simulador es una herramienta hipotética, no una predicción.
            </p>
            <p className="mt-2">
              Los huecos significan «dato no disponible», nunca cero. Encuestas de estimación de voto e intención
              directa se mantienen separadas.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
