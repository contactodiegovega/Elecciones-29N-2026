"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const MAIN_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/provincias", label: "Provincias" },
  { href: "/encuestas", label: "Encuestas" },
  { href: "/aprende", label: "Aprende" },
];

export default function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href) ||
    (href === "/aprende" && ["/historico", "/participacion", "/demografia", "/laboratorio", "/metodologia", "/analisis", "/partidos", "/territorio", "/simulador", "/prediccion", "/campana"].some(p => path.startsWith(p))) ||
    (href === "/provincias" && path === "/diputados");
  return <>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="nav-principal" className="ml-auto rounded-lg border border-line px-3 py-2 text-sm lg:hidden">Menú</button>
    <nav id="nav-principal" aria-label="Principal" className={`${open ? "flex" : "hidden"} w-full flex-col gap-1 text-sm lg:ml-auto lg:flex lg:w-auto lg:flex-row`}>
      {MAIN_NAV.map(n => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active(n.href) ? "page" : undefined}
        className={`rounded-lg px-3 py-2 transition ${active(n.href) ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100"}`}>{n.label}</Link>)}
    </nav>
  </>;
}
