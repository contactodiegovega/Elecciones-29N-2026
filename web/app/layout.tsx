import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observatorio 29N — España",
  description: "Qué sabemos del 29N: escaños por provincia, encuestas, participación e historia electoral. Sin pronósticos inventados.",
  openGraph: {
    title: "Observatorio 29N — España en las urnas",
    description: "Diputados por provincia, encuestas, participación y análisis retrospectivo. Sin pronósticos del 29N.",
    type: "website",
    locale: "es_ES",
  },
  twitter: { card: "summary", title: "Observatorio 29N", description: "Datos electorales claros, sin pronósticos inventados." },
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
              <span className="font-serif text-xl font-bold leading-none">Observatorio 29N</span>
              <span className="hidden text-[11px] font-medium uppercase tracking-widest text-accent sm:inline">
                Datos, no pronósticos
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
            <p className="font-serif text-base text-ink">Observatorio 29N · España en las urnas</p>
            <p className="mt-2 max-w-4xl">
              Resultados: Ministerio del Interior. Demografía: INE (CC BY 4.0). Compilación de encuestas:
              Wikipedia (CC BY-SA 4.0); no transfiere permisos de fuentes primarias. Geometría: Eurostat GISCO
              (© EuroGeographics). Escaños por provincia: RD 806/2026 (BOE). Evaluación retrospectiva con fines
              de investigación: <strong>sin pronósticos del 29N-2026</strong>. El simulador es una herramienta
              hipotética, no una predicción.
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
