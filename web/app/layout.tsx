import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observatorio Electoral España — 1977–2023",
  description: "Resultados históricos del Congreso, demografía, encuestas y evaluación retrospectiva de modelos. Sin pronósticos.",
};

const NAV = [
  { href: "/", label: "Portada" },
  { href: "/historico", label: "Histórico" },
  { href: "/territorio", label: "Territorio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/encuestas", label: "Encuestas" },
  { href: "/demografia", label: "Demografía" },
  { href: "/laboratorio-ml", label: "Laboratorio ML" },
  { href: "/metodologia", label: "Metodología" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-paper font-sans text-ink antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-white">
          Saltar al contenido
        </a>
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-serif text-xl font-bold" aria-label="Inicio del observatorio">
              España en las urnas
            </Link>
            <nav aria-label="Principal" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.slice(1).map((n) => (
                <Link key={n.href} href={n.href} className="text-stone-600 hover:text-accent hover:underline">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-stone-500">
            Datos: Ministerio del Interior (resultados), INE (CC BY 4.0), Wikipedia-compilación
            de encuestas (CC BY-SA 4.0), Eurostat GISCO (geometría). Sin pronósticos del 29N-2026.
            Mediciones retrospectivas con fines de investigación.
          </div>
        </footer>
      </body>
    </html>
  );
}
