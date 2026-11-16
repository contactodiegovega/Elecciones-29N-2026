"use client";
import { useMemo, useState } from "react";
import type { ProvinceData } from "@/lib/province";
import { generateScenarios, type Scenario } from "@/lib/scenarios";
import { shortCandidacy } from "@/lib/last-seat";
import { fmtInt } from "@/lib/utils";
import SeatStrip from "./SeatStrip";

const titles = { first: "Su primer diputado", extra: "Un diputado adicional", transfer: "Una transferencia, otro reparto", unchanged: "Más votos, los mismos diputados" };
export default function ScenarioCards({ data, onSelect }: { data: ProvinceData; onSelect: (s: Scenario) => void }) {
  const scenarios = useMemo(() => generateScenarios(data), [data]);
  const [kind, setKind] = useState<Scenario["kind"] | "all">("all");
  const [count, setCount] = useState(4);
  const available = kind === "all" ? [...Object.keys(titles).flatMap(k => scenarios.filter(s => s.kind === k).slice(0, 1)), ...scenarios.filter(s => !Object.keys(titles).some(k => scenarios.find(x => x.kind === k)?.id === s.id))] : scenarios.filter(s => s.kind === kind);
  return <section aria-label="Escenarios calculados" className="space-y-4">
    <div><p className="eyebrow">Ejemplos calculados · no son pronósticos</p><h2 className="mt-2 text-2xl font-bold">Un cambio de votos. ¿Otro reparto?</h2><p className="mt-2 text-sm text-stone-600">{data.name} · {data.seats2023} diputados en 2023. {data.seats2023 <= 5 ? "Con pocos diputados, hay menos puestos disponibles." : "Con más diputados, se comparan más cocientes."} Cada mínimo se comprueba junto con el voto anterior. Se estudian todas las candidaturas por igual.</p></div>
    <label className="block text-sm">Explorar ejemplos<select className="ml-2 rounded-lg border border-line bg-white p-2" value={kind} onChange={e => { setKind(e.target.value as typeof kind); setCount(4); }}><option value="all">Selección diversa</option>{Object.entries(titles).map(([k, t]) => <option value={k} key={k}>{t}</option>)}</select></label>
    <div className="grid gap-4 md:grid-cols-2">{available.slice(0, count).map(s => <article className="scenario-card" key={s.id} data-testid="scenario-card">
      <p className="eyebrow">{data.name} · generales 2023</p><h3 className="mt-2 text-xl font-bold">{titles[s.kind]}</h3>
      <p className="my-4 text-3xl font-extrabold tabular" style={{ color: data.colors[s.to] }}>+{fmtInt(s.votes)} <span className="text-sm font-normal text-ink">a {shortCandidacy(s.to)}</span></p>
      <p className="mb-4 text-sm leading-relaxed text-stone-600">{s.mode === "transfer" ? `Se transfieren desde ${shortCandidacy(s.from!)} y se conserva el total.` : "Se añaden votos nuevos, manteniendo las demás candidaturas y el blanco constantes."} {s.kind === "unchanged" ? "No cambia ningún escaño: es un valor derivado del mínimo calculado, justo antes del cambio o del empate previo." : `${shortCandidacy(s.to)} pasa de ${s.before.allocation[s.to]} a ${s.after.allocation[s.to]} diputados.${s.losers.length ? ` Pierde representación: ${s.losers.map(shortCandidacy).join(", ")}.` : ""}`}</p>
      <div className="space-y-3"><SeatStrip allocation={s.before.allocation} colors={data.colors} label="Antes · oficial 2023" /><SeatStrip allocation={s.after.allocation} colors={data.colors} label="Después · supuesto" /></div>
      {s.after.drawRequired && <p className="mt-3 text-sm text-amber-900">Parte del reparto depende de un sorteo; el orden mostrado es provisional.</p>}
      {s.previousRequiresDraw && <p className="mt-3 text-xs text-stone-500">Con un voto menos hay empate: no se garantiza el diputado.</p>}
      <p className="mt-3 text-xs text-stone-500">Último adjudicado: {s.before.last && shortCandidacy(s.before.last.label)} → {s.after.last && shortCandidacy(s.after.last.label)}.</p>
      <button className="button-primary mt-5 w-full" onClick={() => onSelect(s)}>Abrir este escenario →</button>
    </article>)}</div>
    {!available.length && <p className="text-sm text-stone-600">No hay ejemplos de este tipo en esta provincia.</p>}
    {available.length > count && <button className="button-secondary" onClick={() => setCount(n => n + 4)}>Explorar más ejemplos ({available.length - count})</button>}
    <a className="inline-block text-xs text-accent underline" href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907">Referencia: resultados oficiales de 2023 · JEC / BOE ↗</a>
  </section>;
}
