"use client";
import { useMemo, useState } from "react";
import type { ProvinceData } from "@/lib/province";
import { historicalScenarios, illustrativeScenarios, seatChanges, withinIntroductoryBound, type ContextScenario, type History, type SimulationMode } from "@/lib/contextual-scenarios";
import { shortCandidacy } from "@/lib/last-seat";
import { fmtDec, fmtInt } from "@/lib/utils";
import SeatStrip from "./SeatStrip";

const modeNames = { add: "Añadir votos nuevos", transfer: "Transferir entre dos listas", redistribute: "Redistribuir proporcionalmente" };
export default function ScenarioCards({ data, history, onSelect }: { data: ProvinceData; history: History | null; onSelect: (s: ContextScenario) => void }) {
  const [type, setType] = useState("all");
  const [mode, setMode] = useState<SimulationMode>("add");
  const [pp, setPP] = useState<0.5 | 1 | 2>(1);
  const [candidate, setCandidate] = useState("all");
  const [count, setCount] = useState(2);
  const [expandMagnitude, setExpandMagnitude] = useState(false);
  const observed = useMemo(() => history ? historicalScenarios(data, history) : [], [data, history]);
  const allExercises = useMemo(() => illustrativeScenarios(data, mode, pp), [data, mode, pp]);
  const exercises = expandMagnitude ? allExercises : allExercises.filter(withinIntroductoryBound);
  const catalogue = type === "historical" ? observed : type === "illustrative" ? exercises : [observed[0], exercises[0], ...observed.slice(1), ...exercises.slice(1)].filter((s): s is ContextScenario => !!s);
  const available = catalogue.filter(s => candidate === "all" || s.to === candidate || s.from === candidate);
  const resetPage = () => setCount(2);
  return <section aria-label="Escenarios contextualizados" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{data.name} · datos y supuestos separados</p><h2 className="mt-2 text-2xl font-bold">Observa un cambio. Explora un supuesto.</h2></div><a className="text-sm font-semibold text-accent underline" href="#calculadora">Abrir calculadora avanzada ↓</a></div>
    <div className="editorial-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium">Tipo de ejemplo<select aria-label="Tipo de ejemplo" className="mt-2 w-full rounded-lg border border-line bg-white p-3 text-sm" value={type} onChange={e => { setType(e.target.value); resetPage(); }}><option value="all">Historia y simulación</option><option value="historical">Cambio histórico observado</option><option value="illustrative">Simulación ilustrativa</option></select></label>
      <label className="text-xs font-medium">Modo ilustrativo<select disabled={type === "historical"} aria-label="Modo ilustrativo" className="mt-2 w-full rounded-lg border border-line bg-white p-3 text-sm disabled:opacity-40" value={mode} onChange={e => { setMode(e.target.value as SimulationMode); resetPage(); }}>{Object.entries(modeNames).map(([k, title]) => <option key={k} value={k}>{title}</option>)}</select></label>
      <label className="text-xs font-medium">Escala ilustrativa<select disabled={type === "historical"} aria-label="Escala ilustrativa" className="mt-2 w-full rounded-lg border border-line bg-white p-3 text-sm disabled:opacity-40" value={pp} onChange={e => { setPP(Number(e.target.value) as typeof pp); resetPage(); }}>{[0.5, 1, 2].map(n => <option key={n} value={n}>{String(n).replace(".", ",")} {n === 1 ? "punto" : "puntos"} del voto válido 2023</option>)}</select></label>
      <label className="text-xs font-medium">Candidatura<select aria-label="Filtrar candidatura" className="mt-2 w-full rounded-lg border border-line bg-white p-3 text-sm" value={candidate} onChange={e => { setCandidate(e.target.value); resetPage(); }}><option value="all">Todas · orden alfabético</option>{[...data.rows].sort((a, b) => shortCandidacy(a.label).localeCompare(shortCandidacy(b.label), "es")).map(r => <option key={r.label} value={r.label}>{shortCandidacy(r.label)}</option>)}</select></label>
    </div>
    <label className="flex items-start gap-2 text-xs leading-relaxed text-stone-600"><input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={expandMagnitude} onChange={e => { setExpandMagnitude(e.target.checked); resetPage(); }} />Incluir también ejercicios que cambien más del 10 % de los votos originales de alguna lista afectada.</label>
    <p className="text-xs leading-relaxed text-stone-500">Las escalas de 0,5, 1 y 2 puntos son ilustrativas. La selección inicial limita además el cambio al 10 % de los votos de cada lista afectada: es una regla didáctica común, no evidencia de plausibilidad. No se selecciona por ganar escaños; las transferencias sin votos suficientes se excluyen.</p>
    <div className="grid items-start gap-5 lg:grid-cols-2">{available.slice(0, count).map(s => {
      const historical = s.type === "historical";
      const colors = { ...s.reference.colors, ...s.modified.colors };
      const old = s.reference.rows.find(r => r.label === s.to)!;
      const updated = s.modified.rows.find(r => r.label === s.to)!;
      return <article className="scenario-card" key={s.id} data-testid="scenario-card" data-type={s.type}>
        <p className="eyebrow">{historical ? "Cambio histórico observado" : "Simulación ilustrativa"}</p>
        <p className="mt-2 text-xs text-stone-500">{data.name} · {s.reference.election}{historical ? ` → ${s.modified.election}` : " · resultado de referencia"}</p>
        <h3 className="mt-3 text-xl font-bold">{historical ? `¿Qué cambió entre elecciones para ${shortCandidacy(s.to)}?` : `¿Qué cambiaría con esta variación para ${shortCandidacy(s.to)}?`}</h3>
        <p className="mt-4 text-3xl font-bold tabular" style={{ color: colors[s.to] }}>{s.votes >= 0 ? "+" : ""}{fmtInt(s.votes)} <span className="text-sm font-normal text-ink">votos{!historical && s.from ? ` desde ${shortCandidacy(s.from)}` : ""}</span></p>
        <p className="mt-2 text-sm text-stone-600">{fmtDec(s.referencePercent)} % del voto válido provincial de referencia. Cuota {historical ? "observada" : "resultante"}: {fmtDec(old.v / s.before.validVotes * 100)} % → {fmtDec(updated.v / s.after.validVotes * 100)} % ({s.shareDeltaPP >= 0 ? "+" : ""}{fmtDec(s.shareDeltaPP)} pp).</p>
        <p className="mt-2 text-xs text-stone-500">Cambio respecto a los votos de {shortCandidacy(s.to)}: {s.votes >= 0 ? "+" : ""}{fmtDec(s.votes / old.v * 100)} %.{s.from && ` Sobre los votos del origen: −${fmtDec(s.votes / s.reference.rows.find(r => r.label === s.from)!.v * 100)} %.`}{!historical && !withinIntroductoryBound(s) ? " Ejercicio ampliado: supera el límite didáctico inicial, sin evidencia de que vaya a suceder." : ""}</p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">{historical ? "Comparamos todos los votos de ambas elecciones, no un movimiento aislado de esta lista." : modeNames[s.mode as SimulationMode] + "."}</p>
        <div className="my-5 space-y-4"><SeatStrip allocation={s.before.allocation} colors={colors} label={`Antes: resultado oficial · ${s.reference.election} · ${s.reference.seats} escaños`} /><SeatStrip allocation={s.after.allocation} colors={colors} label={historical ? `Después: resultado oficial observado · ${s.modified.election} · ${s.modified.seats} escaños` : "Después: escenario hipotético"} /></div>
        <p className="rounded-lg bg-stone-50 p-3 text-sm font-semibold">{seatChanges(s)}</p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">{s.after.last ? `${shortCandidacy(s.after.last.label)} obtiene el último diputado con ${fmtDec(s.after.last.value)}${s.modified.seats === 1 ? " votos" : " de cociente"}.` : "No hay un último cociente adjudicado."} {s.after.next && `El primero excluido es ${shortCandidacy(s.after.next.label)} (${fmtDec(s.after.next.value)}).`}{s.after.drawRequired ? " El corte requiere sorteo; el orden es provisional." : " Se recalculan el umbral y todos los cocientes elegibles."}</p>
        {historical && <p className="mt-3 text-xs text-stone-500">Participación observada: {fmtDec(s.reference.turnout.votantes / s.reference.turnout.electores * 100)} % → {fmtDec(s.modified.turnout.votantes / s.modified.turnout.electores * 100)} %. Voto válido: {fmtInt(s.before.validVotes)} → {fmtInt(s.after.validVotes)}.{s.reference.seats !== s.modified.seats ? " También cambió la asignación provincial de escaños." : ""}</p>}
        <details className="mt-4 border-t border-line pt-3"><summary className="cursor-pointer text-xs font-semibold">Procedencia y justificación del supuesto</summary><p className="mt-3 text-xs leading-relaxed text-stone-600">{s.justification}</p>{s.identityNote && <p className="mt-3 text-xs leading-relaxed text-stone-600">{s.identityNote}</p>}<p className="mt-2 break-words text-xs text-stone-500">Artefactos: {s.artifacts.join(" · ")}</p>{s.sources.map((url, i) => <a key={url} className="mt-2 mr-4 inline-block text-xs text-accent underline" href={url} target="_blank" rel="noreferrer">{i === 0 && historical ? "Interior · resultados históricos" : "JEC · resultados oficiales 2023"} ↗</a>)}</details>
        <button className="button-primary mt-5 w-full" onClick={() => onSelect(s)}>Explorar este escenario →</button>
      </article>;
    })}</div>
    {!available.length && <p role="status" className="text-sm text-stone-600">No hay ejemplos con datos suficientes y magnitud dentro de estos filtros. Puedes ampliar el límite didáctico para consultar otros ejercicios hipotéticos. Una ausencia de correspondencia histórica no equivale a cero votos ni a continuidad entre coaliciones.</p>}
    {available.length > count && <button className="button-secondary" onClick={() => setCount(n => n + 2)}>Explorar otros ejemplos ({available.length - count})</button>}
  </section>;
}
