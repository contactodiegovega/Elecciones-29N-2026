"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useProvinceUrl } from "@/lib/use-province-url";
import ProvincePicker from "@/components/ProvincePicker";
import Hemicycle from "@/components/Hemicycle";
import provinces from "@/public/data/provinces/index.json";
import sim from "@/public/data/simulator.json";

// The map itself renders a deterministic loading frame before its effect runs.
// Keeping that frame in SSR avoids an empty client-only boundary in the atlas.
const ProvinceMap = dynamic(() => import("@/components/ProvinceMap"), {
  loading: () => <div className="flex h-[400px] items-center justify-center text-sm text-stone-500">Preparando las 52 circunscripciones…</div>,
});

export default function Provincias() {
  const { code: selected, select: setSelected } = useProvinceUrl(provinces.map(p => p.code));
  const province = provinces.find(p => p.code === selected)!;
  return <div className="space-y-7">
    <section><p className="eyebrow">El Congreso se elige provincia a provincia</p><h1 className="mt-2 text-4xl font-bold tracking-tight">52 circunscripciones. 350 diputados.</h1><p className="mt-3 max-w-3xl text-stone-600">¿Cuántos diputados elige cada provincia? El reparto oficial de 2026 depende de la población, no de los sondeos.</p></section>
    <ProvincePicker provinces={provinces} selected={selected} onSelect={setSelected} />
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section><ProvinceMap provinces={sim.provinces} selected={selected} onSelect={setSelected} height={400} /><p className="mt-2 text-xs text-stone-500">Claro: 1 diputado. Oscuro: 38. Ámbar: provincia elegida. Geometría: Eurostat GISCO © EuroGeographics.</p></section>
      <section className="self-center border-l-4 border-accent pl-6"><p className="eyebrow">Asignación provincial</p><h2 className="mt-2 text-3xl font-bold">{province.name}</h2><p className="mt-3 text-5xl font-bold">{province.seats2026} <span className="text-base font-normal text-stone-500">{province.seats2026 === 1 ? "diputado" : "diputados"} en 2026</span></p><p className="mt-3 text-sm text-stone-600">En 2023 eligió {province.seats2023}. {province.seats2026 !== province.seats2023 ? "Cambia la asignación provincial, no el resultado histórico." : "Mantiene el mismo número de diputados."}</p><Link className="button-primary mt-5 inline-block" href={`/?province=${selected}#provincia`}>Ver su último escaño y cambiar votos →</Link><a href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20742" className="mt-4 block text-xs text-accent underline">Fuente: RD 806/2026 · BOE ↗</a></section>
    </div>
    <details className="advanced-fold"><summary>Consultar las 52 asignaciones provinciales</summary><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...provinces].sort((a, b) => a.name.localeCompare(b.name, "es")).map(p => <Link key={p.code} href={`/?province=${p.code}#provincia`} className="flex justify-between border-b border-line py-2 text-sm"><span>{p.name}</span><span>{p.seats2023} → <strong>{p.seats2026}</strong></span></Link>)}</div></details>
    <details className="advanced-fold"><summary>El Congreso elegido en 2023 y la mayoría de 176</summary><div className="mt-5"><Hemicycle parties={sim.parties} /></div><p className="mt-4 text-sm text-stone-600">176 es más de la mitad de los 350 escaños: la mayoría absoluta.</p></details>
  </div>;
}
