"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { loadColors, loadLatestPolls, type ColorEntry } from "@/lib/data";
import type { LatestPolls as LatestData } from "@/lib/types";
import { ErrorBox, Loading } from "./ui";
import { fmtDate, fmtInt, fmtPct, partyColor } from "@/lib/utils";

const PollExplorer = dynamic(() => import("./PollExplorer"), { loading: () => <Loading what="el archivo y sus gráficos" /> });

export default function LatestPolls() {
  const [data, setData] = useState<LatestData | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([loadLatestPolls(), loadColors()]).then(([d, c]) => { if (alive) { setData(d); setColors(c); } }).catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);
  return <div className="space-y-7">
    <section className="border-b border-line pb-5"><p className="eyebrow">Qué se ha publicado, con su fuente</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Últimas encuestas</h1><p className="mt-3 max-w-3xl text-stone-600">Una ficha por sondeo. Estimaciones nacionales de voto, sin mezclarlas ni convertirlas en diputados provinciales.</p></section>
    {error ? <ErrorBox message={error} /> : !data ? <Loading what="las publicaciones verificadas" /> : data.restricted ? <p role="status" className="rounded-xl bg-stone-100 p-5">{data.note} Los archivos estáticos de sondeos y derivados se generan vacíos.</p> : <>
      <p className="text-xs leading-relaxed text-stone-500">Ordenadas por fecha real de publicación. {data.note} {data.last_update ? `Última consulta: ${fmtDate(data.last_update)}.` : "Todavía no hay una actualización verificada."}</p>
      {!data.polls.length ? <div className="rounded-xl border border-dashed border-line p-6"><h2 className="font-semibold">Aún no hay publicaciones verificadas para esta vista</h2><p className="mt-2 text-sm text-stone-600">El archivo histórico sigue disponible debajo. No asignamos una fecha de publicación a partir del fin del trabajo de campo.</p></div> : <div className="grid gap-x-7 gap-y-9 md:grid-cols-2 xl:grid-cols-3">
        {data.polls.map(p => <article key={p.id} data-testid="latest-poll" className="poll-publication">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-stone-500">{p.sponsor ?? "Medio no indicado"}</p><h2 className="mt-1 text-2xl font-bold">{p.pollster}</h2></div><time className="whitespace-nowrap rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-900" dateTime={p.published_at ?? undefined}>{fmtDate(p.published_at)}</time></div>
          <p className="mt-3 text-xs text-stone-500">Campo: {p.fw_start && p.fw_end ? `${fmtDate(p.fw_start)} – ${fmtDate(p.fw_end)}` : p.fieldwork_text ?? "no consta una ventana completa verificada"}<br />Muestra: {p.n ? `${fmtInt(p.n)} entrevistas` : "no indicada"}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{p.type === "estimated_vote" ? "Estimación de voto" : "Intención directa · no comparable con estimación"}</p>
          <ul className="mt-4 space-y-2.5" aria-label={`Voto por partido del sondeo de ${p.pollster} publicado ${p.published_at}`}>
            {[...p.est].sort((a, b) => b.v - a.v).map(e => <li key={e.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs"><span>{e.label}</span><strong className="tabular">{fmtPct(e.v, 1)}</strong></div><div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full" style={{ width: `${e.v}%`, backgroundColor: partyColor(e.p, colors).origin === "registry" ? partyColor(e.p, colors).hex : "#8c8983" }} /></div>
            </li>)}
          </ul>
          {p.quality_flags?.includes("partial_estimates") && <p className="mt-3 text-xs text-stone-500">Datos parciales: solo las candidaturas citadas en la nota original. No se completa el resto.</p>}
          <a href={p.original_url ?? undefined} target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs font-semibold text-accent underline underline-offset-4">Consultar publicación original ↗</a>
          <details className="mt-3 text-xs text-stone-500"><summary className="cursor-pointer">Ficha y procedencia</summary><p className="mt-2 leading-relaxed">{p.source_license}. Fuente primaria verificada con snapshot y SHA-256. Las cifras del CIS se reutilizan con atribución y sin respaldo institucional.</p>{p.estimate_url && <a className="mt-2 block underline" href={p.estimate_url} target="_blank" rel="noreferrer">Documento de estimación ↗</a>}{p.technical_url && <a className="mt-2 block underline" href={p.technical_url} target="_blank" rel="noreferrer">Ficha técnica original ↗</a>}</details>
        </article>)}
      </div>}
      <p className="text-xs text-stone-500">Cobertura actual: {new Set(data.polls.map(p => p.pollster)).size} encuestadora(s) en esta selección. Los conectores de medios sin extracción autorizada solo detectan publicaciones para revisión. Una encuesta no es un resultado electoral.</p>
      <details className="text-xs text-stone-500"><summary className="cursor-pointer">Estado y límites de las fuentes</summary><ul className="mt-3 space-y-1">{data.sources.map(s => <li key={s.id}>{s.id}: {s.status === "ok" ? "datos verificados" : s.status === "discovery_only" ? "detección de publicaciones, sin estimaciones extraídas" : "consulta no disponible; se conservan los últimos datos válidos"}</li>)}</ul><p className="mt-3">No se sortean bloqueos ni restricciones de robots. Las publicaciones sin permiso o sin evidencia suficiente quedan pendientes.</p></details>
      <section className="border-t border-line pt-6"><button className="button-secondary" aria-expanded={expanded} aria-controls="poll-explorer" onClick={() => setExpanded(!expanded)}>Explorar todas las encuestas y su evolución <span aria-hidden="true">{expanded ? "−" : "+"}</span></button>{expanded && <div id="poll-explorer" className="mt-7"><PollExplorer /></div>}</section>
    </>}
  </div>;
}
