"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const MAIN_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/prediccion", label: "Mi predicción" },
  { href: "/encuestas", label: "Encuestas" },
  { href: "/diputados", label: "Diputados por provincia" },
];

export const MORE_NAV = [
  { href: "/analisis", label: "Todos los análisis", desc: "Índice de secciones" },
  { href: "/historico", label: "Histórico", desc: "Resultados 1977–2023" },
  { href: "/participacion", label: "Participación", desc: "Quién vota y cuánto" },
  { href: "/demografia", label: "Demografía", desc: "Edad, renta y territorio" },
  { href: "/laboratorio-ml", label: "Laboratorio de modelos", desc: "Backtest retrospectivo" },
  { href: "/simulador", label: "Simulador D'Hondt", desc: "Escenarios hipotéticos" },
  { href: "/metodologia", label: "Metodología y fuentes", desc: "Cómo y con qué datos" },
];

const LEGACY = [
  { href: "/territorio", label: "Territorio (versión anterior)" },
  { href: "/campana", label: "Campaña (versión anterior)" },
  { href: "/partidos", label: "Partidos (versión anterior)" },
];

export default function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const moreActive = MORE_NAV.some((n) => isActive(n.href)) || LEGACY.some((n) => isActive(n.href));

  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <>
      <button
        type="button"
        className="order-3 ml-auto rounded-md border border-line px-3 py-1.5 text-sm md:hidden"
        aria-expanded={open}
        aria-controls="nav-principal"
        onClick={() => setOpen((v) => !v)}
      >
        Menú
      </button>
      <nav
        id="nav-principal"
        aria-label="Principal"
        className={`${open ? "flex" : "hidden"} order-4 w-full flex-col gap-1 border-t border-line pt-2 text-sm md:order-none md:ml-auto md:flex md:w-auto md:flex-row md:items-center md:gap-0.5 md:border-0 md:pt-0`}
      >
        {MAIN_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => { setOpen(false); setMoreOpen(false); }}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={`rounded-md px-2.5 py-2 transition md:py-1.5 ${
              isActive(n.href) ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100 hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        ))}

        <div ref={moreRef} className="relative md:ml-1">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-controls="nav-mas"
            className={`flex w-full items-center justify-between gap-1 rounded-md px-2.5 py-2 text-left transition md:w-auto md:py-1.5 ${
              moreOpen || moreActive ? "bg-stone-100 text-ink" : "text-stone-600 hover:bg-stone-100 hover:text-ink"
            }`}
          >
            Más análisis
            <span aria-hidden="true" className={`text-[10px] transition ${moreOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {moreOpen && (
            <div
              id="nav-mas"
              className="mt-1 grid gap-1 rounded-xl border border-line bg-white p-2 shadow-lg md:absolute md:right-0 md:z-50 md:mt-2 md:w-[320px]"
            >
              {MORE_NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => { setOpen(false); setMoreOpen(false); }}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 transition ${
                    isActive(n.href) ? "bg-ink text-white" : "hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-medium">{n.label}</span>
                  <span className={`block text-xs ${isActive(n.href) ? "text-stone-200" : "text-stone-500"}`}>
                    {n.desc}
                  </span>
                </Link>
              ))}
              <div className="mt-1 border-t border-line px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-stone-400">
                Versiones anteriores
              </div>
              {LEGACY.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => { setOpen(false); setMoreOpen(false); }}
                  className={`rounded-lg px-3 py-1.5 text-xs transition ${
                    isActive(n.href) ? "bg-stone-100 text-ink" : "text-stone-500 hover:bg-stone-50 hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
