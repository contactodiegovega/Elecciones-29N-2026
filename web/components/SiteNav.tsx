"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  { href: "/", label: "Portada" },
  { href: "/historico", label: "Histórico" },
  { href: "/territorio", label: "Territorio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/encuestas", label: "Encuestas" },
  { href: "/campana", label: "Campaña" },
  { href: "/demografia", label: "Demografía" },
  { href: "/laboratorio-ml", label: "Laboratorio ML" },
  { href: "/simulador", label: "Simulador" },
  { href: "/metodologia", label: "Metodología" },
];

export default function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <button
        type="button"
        className="ml-auto rounded-md border border-line px-3 py-1.5 text-sm md:hidden"
        aria-expanded={open}
        aria-controls="nav-principal"
        onClick={() => setOpen((v) => !v)}
      >
        Menú
      </button>
      <nav
        id="nav-principal"
        aria-label="Principal"
        className={`${open ? "flex" : "hidden"} w-full flex-wrap gap-x-1 gap-y-1 text-sm md:ml-auto md:flex md:w-auto`}
      >
        {NAV.slice(1).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 transition ${
              isActive(n.href)
                ? "bg-ink text-white"
                : "text-stone-600 hover:bg-stone-100 hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
