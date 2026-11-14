"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CsvButton, ErrorBox, Loading, selectClass } from "./ui";
import ProvincePicker from "./ProvincePicker";
import SeatStrip from "./SeatStrip";
import { ProvinceDataSchema, type ProvinceData, type ProvinceIndex } from "@/lib/province";
import { addVotes, analyzeLastSeat, DEFAULT_PROVINCE, minimumAdditionalVotes, shortCandidacy, transferVotes } from "@/lib/last-seat";
import { useProvinceUrl } from "@/lib/use-province-url";
import { fmtDec, fmtInt, fmtPct } from "@/lib/utils";

const ProvinceMap = dynamic(() => import("./ProvinceMap"), { ssr: false, loading: () => <Loading what="el mapa" /> });
const BOE2023 = "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907";
const cache = new Map<string, ProvinceData>();

function ProvinceAnalysis({ data }: { data: ProvinceData }) {
  const { rows, colors, turnout } = data;
  const parties = [...rows].sort((a, b) => shortCandidacy(a.label).localeCompare(shortCandidacy(b.label), "es"));
  const [mode, setMode] = useState<"add" | "transfer">("add");
  const [from, setFrom] = useState(parties[0].label);
  const [to, setTo] = useState(parties[1]?.label ?? parties[0].label);
  const [amount, setAmount] = useState("0");
  const [seatYear, setSeatYear] = useState("2023");
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [blank, setBlank] = useState(turnout.votos_blancos);
  const [sensitivityParty, setSensitivityParty] = useState(parties[0].label);
  const [shareMessage, setShareMessage] = useState("");
  const seats = seatYear === "2023" ? data.seats2023 : data.seats2026;
  const baseline = useMemo(() => analyzeLastSeat(rows, data.seats2023, turnout.votos_blancos), [rows, data.seats2023, turnout.votos_blancos]);
  const calculation = useMemo(() => {
    const edited = rows.map(r => ({ ...r, v: edits[r.label] ?? r.v }));
    try {
      const n = amount.trim() === "" ? 0 : Number(amount);
      const current = mode === "add" ? addVotes(edited, to, n) : transferVotes(edited, from, to, n);
      return { rows: current, result: analyzeLastSeat(current, seats, blank), error: "" };
    } catch (e) { return { rows: edited, result: analyzeLastSeat(edited, seats, blank), error: (e as Error).message }; }
  }, [rows, edits, amount, mode, to, from, seats, blank]);
  const minimum = useMemo(() => minimumAdditionalVotes(calculation.rows, seats, blank, sensitivityParty), [calculation.rows, seats, blank, sensitivityParty]);
  const scenario = calculation.result;
  const changed = seatYear !== "2023" || blank !== turnout.votos_blancos || calculation.rows.some((r, i) => r.v !== rows[i].v);
  const reset = () => { setEdits({}); setAmount("0"); setBlank(turnout.votos_blancos); setSeatYear("2023"); };
  const last = baseline.last;
  const next = baseline.next;
  const choiceOptions = parties.map(r => <option key={r.label} value={r.label}>{shortCandidacy(r.label)}</option>);

  return <div className="space-y-7" data-testid="province-analysis" data-province={data.code}>
    <section id="provincia" className="province-story" aria-label={`Resultados oficiales de ${data.name} en 2023`}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div><p className="eyebrow">Elecciones generales · 23 julio 2023</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{data.name}<span className="ml-3 text-lg font-normal text-stone-500"> {data.seats2023} {data.seats2023 === 1 ? "diputado" : "diputados"}</span></h2></div>
        <a href={BOE2023} target="_blank" rel="noreferrer" className="text-xs text-accent underline underline-offset-4">Fuente: Interior / JEC ↗</a>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500">
        <div><dt className="inline">Participación </dt><dd className="inline font-semibold text-ink">{fmtPct(turnout.turnout_rate)}</dd></div>
        <div><dt className="inline">Votos válidos </dt><dd className="inline font-semibold text-ink">{fmtInt(turnout.votos_validos)}</dd></div>
        <div><dt className="inline">Censo </dt><dd className="inline font-semibold text-ink">{fmtInt(turnout.electores)}</dd></div>
        <div><dt className="inline">Asignación 2026 </dt><dd className="inline font-semibold text-ink">{data.seats2026} {data.seats2026 === 1 ? "diputado" : "diputados"}</dd></div>
      </dl>
      <div className="mt-5 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div><h3 className="mb-3 text-sm font-semibold">Así quedaron los diputados</h3><SeatStrip allocation={baseline.allocation} colors={colors} label="Reparto oficial 2023" />
          <p className="mt-4 hidden text-sm leading-relaxed text-stone-600 sm:block">{baseline.matchesOfficial ? "Reparto comprobado con los votos oficiales de 2023." : "Reparto histórico pendiente de revisión."} {data.seats2023 === 1 ? "Gana la candidatura con más votos." : `Los ${data.seats2023} cocientes más altos recibieron un diputado cada uno.`}</p>
        </div>
        <div>{last && next && <>
          <div className="grid grid-cols-2 gap-3">{[last, next].map((q, i) => <div key={q.rank} className={`cutoff-cell ${i === 0 ? "cutoff-winner" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{i === 0 ? "Último diputado" : "El siguiente, fuera"}</p>
            <p className="mt-2 text-xl font-bold">{shortCandidacy(q.label)}</p><p className="mt-1 text-sm tabular">{fmtInt(q.votes)} ÷ {q.divisor}</p><p className="mt-1 text-xl font-semibold tabular">{fmtDec(q.value)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-white"><div className="h-full rounded-full" style={{ backgroundColor: colors[q.label], width: `${q.value / last.value * 100}%` }} /></div>
          </div>)}</div>
          <p className="mt-3 text-sm leading-relaxed text-stone-600"><strong className="text-ink">{shortCandidacy(last.label)} obtuvo el último diputado.</strong> Su cociente superó al siguiente en {fmtDec(baseline.gap)}. Esa diferencia entre divisiones no equivale a votos que faltaban.</p>
        </>}</div>
      </div>
    </section>

    <section id="calculadora" className="calculator-workbench" aria-label="Calculadora de cambios hipotéticos">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Prueba y compara · en esta misma provincia</p><h2 className="mt-1 text-2xl font-bold tracking-tight">¿Y si cambiaran los votos?</h2></div><button type="button" className="text-xs font-semibold text-accent underline underline-offset-4" onClick={reset}>Restablecer 2023</button></div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div role="group" aria-label="Modo del escenario" className="scenario-tabs">
            <button type="button" aria-pressed={mode === "add"} onClick={() => { setMode("add"); setAmount("0"); }}>Añadir votos</button>
            <button type="button" aria-pressed={mode === "transfer"} onClick={() => { setMode("transfer"); setAmount("0"); }}>Transferir votos</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mode === "transfer" && <label className="text-xs font-medium text-stone-600">Desde<select aria-label="Candidatura de origen" value={from} onChange={e => { setFrom(e.target.value); if (e.target.value === to) setTo(from); }} className={`${selectClass} mt-1.5 w-full`}>{choiceOptions}</select></label>}
            <label className="text-xs font-medium text-stone-600">{mode === "add" ? "Candidatura" : "Hacia"}<select aria-label="Candidatura de destino" value={to} onChange={e => { setTo(e.target.value); if (mode === "transfer" && e.target.value === from) setFrom(to); }} className={`${selectClass} mt-1.5 w-full`}>{choiceOptions}</select></label>
            <label className={`text-xs font-medium text-stone-600 ${mode === "transfer" ? "sm:col-span-2" : ""}`}>Votos hipotéticos<input type="number" aria-label="Cantidad de votos hipotéticos" min="0" max="1000000000" step="1" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base font-semibold tabular" /></label>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">{mode === "add" ? "Se añaden votos solo a la candidatura elegida. Las demás y el blanco se mantienen; crece el total de votos válidos." : "Los votos salen del origen y llegan al destino: el total de votos válidos se conserva."} El reparto se actualiza al escribir.</p>
          {calculation.error && <p role="alert" className="mt-3 text-sm text-red-800">{calculation.error} Se muestra el reparto sin aplicar esa operación.</p>}
        </div>
        <div className="scenario-result" role="region" aria-live="polite" aria-label="Resultado del escenario">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{changed ? `Escenario hipotético · escaños ${seatYear}` : "Punto de partida · votos oficiales 2023"}</p>
          <div className="mt-3"><SeatStrip allocation={scenario.allocation} colors={colors} label="Reparto del escenario" /></div>
          <p className="mt-4 text-sm"><span className="text-stone-500">Último diputado: </span><strong>{scenario.last ? shortCandidacy(scenario.last.label) : "sin adjudicar"}</strong>{changed && baseline.last && <span className="ml-1 text-xs text-stone-500">(2023: {shortCandidacy(baseline.last.label)})</span>}</p>
          {scenario.next && <p className="mt-2 text-xs text-stone-500">Siguiente fuera: <strong className="text-ink">{shortCandidacy(scenario.next.label)}</strong> · {fmtInt(scenario.next.votes)} ÷ {scenario.next.divisor} = {fmtDec(scenario.next.value)}</p>}
          <p className="mt-2 text-xs text-stone-500">Votos válidos del escenario: <strong className="text-ink">{fmtInt(scenario.validVotes)}</strong></p>
          {scenario.drawRequired && <p className="mt-3 text-sm text-amber-900">Empate exacto: hace falta sorteo. El reparto mostrado es provisional.</p>}
          {changed && <p className="mt-3 text-xs text-stone-500">Es una comparación matemática, no un pronóstico ni una recomendación de voto.</p>}
        </div>
      </div>
      <details className="mt-5 border-t border-line pt-3"><summary className="cursor-pointer text-xs font-medium text-stone-600">Más controles: editar cada candidatura, blanco y asignación 2026</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(r => <label key={r.label} className="text-xs">{shortCandidacy(r.label)}<input type="number" min="0" max="100000000" aria-label={`Votos base de ${r.label}`} value={edits[r.label] ?? r.v} onChange={e => { const n = e.target.valueAsNumber; if (Number.isSafeInteger(n) && n >= 0 && n <= 100000000) setEdits(v => ({ ...v, [r.label]: n })); }} className="mt-1 block w-full rounded-md border border-line px-2 py-2 tabular" /></label>)}
          <label className="text-xs">Votos en blanco<input type="number" min="0" max="100000000" aria-label="Votos en blanco" value={blank} onChange={e => { const n = e.target.valueAsNumber; if (Number.isSafeInteger(n) && n >= 0 && n <= 100000000) setBlank(n); }} className="mt-1 block w-full rounded-md border border-line px-2 py-2" /></label>
          <label className="text-xs">Asignación provincial<select aria-label="Asignación provincial del escenario" value={seatYear} onChange={e => setSeatYear(e.target.value)} className={`${selectClass} mt-1 w-full`}><option value="2023">2023 · {data.seats2023} diputados</option><option value="2026">2026 · {data.seats2026} diputados</option></select></label>
        </div><p className="mt-3 text-xs text-stone-500">La asignación de 2026 es independiente de los votos históricos; reutilizar estas candidaturas no supone que vuelvan a presentarse.</p>
      </details>
    </section>

    <section className="sensitivity-section" aria-label="Votos mínimos adicionales">
      <div><p className="eyebrow">La sensibilidad del reparto</p><h2 className="mt-1 text-xl font-bold">¿Cuántos votos más cambiarían un diputado?</h2></div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="text-sm">Consulta cualquier candidatura<select value={sensitivityParty} onChange={e => setSensitivityParty(e.target.value)} aria-label="Candidatura para votos mínimos" className={`${selectClass} ml-0 mt-2 block min-w-48 sm:ml-3 sm:mt-0 sm:inline-block`}>{choiceOptions}</select></label>
        {minimum.status === "ok" ? <p data-testid="minimum-votes" className="text-3xl font-bold tracking-tight tabular">+{fmtInt(minimum.votes)} <span className="text-sm font-normal text-stone-500">votos para su diputado nº {minimum.target}</span></p> : <p role="status" className="text-sm text-stone-500">{minimum.status === "full" ? "Ya tiene todos los diputados de la provincia." : minimum.status === "draw" ? "El escenario actual necesita un sorteo: no se toma el orden provisional como punto de partida." : "El mínimo excede el límite de cálculo de mil millones de votos por candidatura."}</p>}
      </div>
      {minimum.status === "ok" && <p className="mt-3 text-sm text-stone-600">{minimum.losers.length ? `Perdería un escaño: ${minimum.losers.map(shortCandidacy).join(", ")}.` : minimum.after.drawRequired ? "La candidatura que pierde depende de un sorteo entre los cocientes empatados." : "Se cubriría un escaño que no estaba adjudicado."} Mínimo entero comprobado: con un voto menos no se garantiza ese diputado.{minimum.previousRequiresDraw ? " El valor anterior necesita sorteo." : ""}</p>}
      <p className="mt-2 text-xs leading-relaxed text-stone-500">Se parte de los votos del escenario visible y se mantienen constantes todas las demás candidaturas y el blanco. No es un umbral fijo para otra elección.</p>
    </section>

    <section aria-label="Votos y escaños de todas las candidaturas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Todos los votos, antes y después</h2><CsvButton filename={`${data.code}_2023_escenario.csv`} rows={rows.map(r => ({ candidatura: r.label, votos_2023: r.v, escanos_2023: r.s, votos_escenario: calculation.rows.find(x => x.label === r.label)?.v, escanos_escenario: scenario.allocation[r.label], asignacion_escenario: seatYear }))} /></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Resultados oficiales 2023 y comparación hipotética de {data.name}</caption><thead><tr className="border-b border-line text-left"><th className="py-3 pr-3">Candidatura</th><th className="px-2 py-3 text-right">Votos 2023</th><th className="px-2 py-3 text-right">Escaños 2023</th><th className="px-2 py-3 text-right">Votos escenario</th><th className="py-3 pl-2 text-right">Escaños escenario</th></tr></thead><tbody className="tabular">{rows.map(r => <tr key={r.label} className="border-b border-line"><td className="min-w-44 py-3 pr-3" title={r.label}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[r.label] }} />{shortCandidacy(r.label)}</td><td className="px-2 text-right">{fmtInt(r.v)}</td><td className="px-2 text-right font-semibold">{r.s}</td><td className="px-2 text-right">{fmtInt(calculation.rows.find(x => x.label === r.label)?.v)}</td><td className="pl-2 text-right font-semibold">{scenario.allocation[r.label]}{scenario.allocation[r.label] !== r.s && <span className="ml-2 text-xs font-normal text-stone-500">({scenario.allocation[r.label] > r.s ? "+" : ""}{scenario.allocation[r.label] - r.s})</span>}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-stone-500">{rows.length} candidaturas con votos registrados. Blanco 2023: {fmtInt(turnout.votos_blancos)}; nulos: {fmtInt(turnout.votos_nulos)}. El blanco cuenta para el umbral; el nulo no. Las celdas nacionales a cero no acreditan concurrencia provincial.</p>
    </section>

    <details className="advanced-fold"><summary>Cómo se reparten: orden, tabla D’Hondt y metodología</summary>
      <p className="mt-4 text-sm leading-relaxed text-stone-600">{seats === 1 ? "Circunscripción uninominal: gana quien más votos recibe (LOREG 163.2)." : `En este escenario se adjudican ${seats} diputados. Para entrar en el reparto se exige el 3 % de los votos válidos (${fmtDec(scenario.validVotes * 0.03)}). Se divide cada candidatura admitida entre 1, 2, 3… y se eligen los mayores cocientes.`} En un empate de cocientes prima el total de votos. A igualdad de votos, hace falta sorteo; no se atribuye certeza a ese resultado.</p>
      <h3 className="mt-5 text-sm font-semibold">Orden de adjudicación en 2023</h3><ol className="mt-2 flex flex-wrap gap-2">{baseline.quotients.filter(q => q.awarded).map(q => <li key={q.rank} className="rounded border border-line px-3 py-2 text-sm">#{q.rank} {shortCandidacy(q.label)} · {fmtInt(q.votes)} ÷ {q.divisor}</li>)}</ol>
      <h3 className="mt-5 text-sm font-semibold">Tabla completa del escenario</h3><div className="mt-2 max-h-96 overflow-auto"><table className="w-full text-xs"><caption className="sr-only">Divisores, cocientes y adjudicación del escenario</caption><thead><tr><th className="p-2 text-left">Candidatura</th>{Array.from({ length: seats + 1 }, (_, i) => <th key={i} className="p-2 text-right">÷ {i + 1}</th>)}</tr></thead><tbody>{calculation.rows.map(r => <tr key={r.label} className="border-b border-line"><td className="whitespace-nowrap p-2">{shortCandidacy(r.label)}</td>{Array.from({ length: seats + 1 }, (_, i) => {
        const quotient = scenario.quotients.find(q => q.label === r.label && q.divisor === i + 1);
        return <td key={i} className={`p-2 text-right tabular ${quotient?.awarded ? "bg-teal-50 font-bold" : ""}`}>{fmtDec(r.v / (i + 1))}{quotient?.awarded ? " ✓" : ""}</td>;
      })}</tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-stone-500">✓ = diputado. Se muestran también las divisiones de las candidaturas excluidas del umbral; no reciben adjudicación. En Ceuta y Melilla solo se compara el primer divisor. El divisor extra permite ver el primer cociente no adjudicado.</p>
      <h3 className="mt-5 text-sm font-semibold">Cómo se calcula el mínimo de votos</h3><p className="mt-2 text-sm leading-relaxed text-stone-600">Se añade un número entero solo a la candidatura consultada y se recalcula el reparto completo, incluido el nuevo umbral. Una búsqueda acotada encuentra el primer aumento que garantiza un diputado más: se verifican ese valor y el anterior. Ganar un sorteo no se considera una ganancia garantizada. Si el escenario de partida está empatado, se pide resolverlo primero.</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-accent"><a className="underline" href="https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/">Interior · resultados definitivos</a><a className="underline" href={BOE2023}>JEC · BOE 2023</a><a className="underline" href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20742">BOE · asignación 2026</a></div>
    </details>
    <div className="flex flex-wrap items-center gap-3 text-xs"><button type="button" className="text-accent underline underline-offset-4" onClick={async () => {
      try { await navigator.clipboard.writeText(`${location.origin}/?province=${data.code}`); setShareMessage("Enlace de provincia copiado. Los cambios de votos no se incluyen."); }
      catch { setShareMessage(`Comparte esta dirección: ${location.origin}/?province=${data.code}`); }
    }}>Compartir esta provincia ↗</button><span role="status" className="text-stone-500">{shareMessage}</span></div>
  </div>;
}

function Explorer({ initial, provinces }: { initial: ProvinceData; provinces: ProvinceIndex[] }) {
  const { requested, code, select: selectUrl } = useProvinceUrl(provinces.map(p => p.code));
  const [loaded, setLoaded] = useState(initial);
  const [error, setError] = useState({ code: "", message: "" });
  const [mapOpen, setMapOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (code === DEFAULT_PROVINCE || cache.has(code)) return () => controller.abort();
    fetch(`/data/provinces/${code}.json`, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("No se pudieron cargar los resultados de esta provincia.");
      const data = ProvinceDataSchema.parse(await r.json());
      if (data.code !== code) throw new Error("La ficha no corresponde a la provincia solicitada.");
      if (!controller.signal.aborted) { cache.set(code, data); setLoaded(data); setError({ code: "", message: "" }); }
    }).catch(e => { if (!controller.signal.aborted) setError({ code, message: String(e) }); });
    return () => controller.abort();
  }, [code, retry]);
  const select = (next: string) => {
    setError({ code: "", message: "" });
    selectUrl(next);
  };
  const current = code === initial.code ? initial : cache.get(code) ?? (loaded.code === code ? loaded : null);
  return <div className="space-y-6">
    <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
      <ProvincePicker provinces={provinces} selected={code} onSelect={select} />
      <button className="justify-self-start py-1 text-xs font-semibold text-accent underline underline-offset-4 sm:h-12 sm:rounded-lg sm:border sm:border-line sm:bg-white sm:px-3 sm:py-2 sm:text-sm sm:text-ink sm:no-underline" aria-expanded={mapOpen} aria-controls="province-map" onClick={() => setMapOpen(!mapOpen)}> {mapOpen ? "Cerrar mapa" : "Elegir en el mapa"} <span aria-hidden="true">↗</span></button>
    </div>
    {requested && requested !== code && <p role="status" className="text-sm text-stone-500">No reconocemos esa circunscripción. Mostramos León como punto de partida.</p>}
    {mapOpen && <div id="province-map" className="editorial-panel p-3"><ProvinceMap selected={code} onSelect={select} height={360} provinces={provinces.map(p => ({ province_code: p.code, province_name: p.name, seats: p.seats2026, seats_2023: p.seats2023, seats_2026: p.seats2026, valid_votes: 0, turnout_rate: null, baseline_votes: {}, baseline_shares: {}, seats_2023_official: {} }))} /><p className="px-3 text-xs text-stone-500">Color: diputados asignados en 2026 (1–38). Ámbar: selección. Canarias desplazada a la misma escala.</p></div>}
    {error.code === code ? <div><ErrorBox message={error.message} /><button className="button-secondary mt-2" onClick={() => { setError({ code: "", message: "" }); setRetry(x => x + 1); }}>Reintentar</button></div> : current ? <ProvinceAnalysis key={current.code} data={current} /> : <Loading what={`los resultados de ${provinces.find(p => p.code === code)?.name}`} />}
  </div>;
}

export default function ProvinceExplorer(props: { initial: ProvinceData; provinces: ProvinceIndex[] }) {
  return <Explorer {...props} />;
}
