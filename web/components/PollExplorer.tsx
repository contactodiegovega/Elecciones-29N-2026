"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Notice, Provenance,
  StatCard, Tag, selectClass,
} from "@/components/ui";
import { loadColors, loadPolls, loadPublicationStatus, type ColorEntry, type Poll, type PublicationStatus } from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtInt, fmtPct, median, partyColor } from "@/lib/utils";

const MAJOR = ["PP", "PSOE", "VOX", "SUMAR", "PODEMOS", "ERC", "JUNTS", "PNV", "BILDU", "CC", "BNG", "UPN"];

type Cycle = "2023" | "2026";
type PType = "estimated_vote" | "direct_intention";

function monthlyMedian(points: { x: string; y: number }[], k = 5) {
  const sorted = [...points].sort((a, b) => a.x.localeCompare(b.x));
  return sorted.map((p, i) => {
    const window = sorted.slice(Math.max(0, i - k + 1), i + 1).map((q) => q.y);
    return { x: p.x, y: +median(window).toFixed(2), n: window.length };
  });
}

export default function PollExplorer() {
  const [cycle, setCycle] = useState<Cycle>("2026");
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [loadedCycle, setLoadedCycle] = useState<Cycle | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [house, setHouse] = useState("TODAS");
  const [sponsor, setSponsor] = useState("TODOS");
  const [ptype, setPtype] = useState<PType>("estimated_vote");
  const [party, setParty] = useState("PP");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeReplicas, setIncludeReplicas] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadPolls(cycle), loadColors(), loadPublicationStatus()])
      .then(([p, c, s]) => { if (alive) { setPolls(p); setLoadedCycle(cycle); setColors(c); setStatus(s); } })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [cycle]);

  const bounds = useMemo(() => {
    const dates = (polls ?? []).map((p) => p.fw_end).filter((d): d is string => Boolean(d)).sort();
    return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
  }, [polls]);

  const usable = useMemo(() => {
    if (!polls) return [];
    return polls.filter((p) => {
      if (p.type !== ptype) return false;
      if (!includeReplicas && p.canonical !== p.id) return false;
      if (!p.fw_end) return false;
      if (house !== "TODAS" && p.pollster !== house) return false;
      if (sponsor !== "TODOS" && (p.sponsor ?? "Sin medio identificado") !== sponsor) return false;
      if (from && p.fw_end < from) return false;
      if (to && p.fw_end > to) return false;
      return true;
    });
  }, [polls, ptype, house, sponsor, from, to, includeReplicas]);

  const houses = useMemo(
    () => [...new Set((polls ?? []).map((p) => p.pollster))].sort((a, b) => a.localeCompare(b)),
    [polls],
  );
  const sponsors = useMemo(() => [...new Set((polls ?? []).map(p => p.sponsor ?? "Sin medio identificado"))].sort((a, b) => a.localeCompare(b, "es")), [polls]);

  const availableParties = useMemo(() => {
    const set = new Set<string>();
    for (const p of polls ?? []) for (const e of p.est) if (e.p && !e.p.startsWith("poll_")) set.add(e.p);
    return [...set].sort((a, b) => {
      const ia = MAJOR.indexOf(a); const ib = MAJOR.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  }, [polls]);

  const seriesPoints = useMemo(() => usable.flatMap((p) => {
    const e = p.est.find((x) => x.p === party);
    if (!e) return [];
    return [{
      x: p.fw_end as string, y: e.v, house: p.pollster, n: p.n, id: p.id,
      tracking: p.is_tracking_update ?? false, canonical: p.canonical !== p.id,
    }];
  }).sort((a, b) => a.x.localeCompare(b.x)), [usable, party]);

  const trend = useMemo(() => monthlyMedian(seriesPoints), [seriesPoints]);

  const spread = useMemo(() => {
    const withBoth = usable.filter((p) => {
      const pp = p.est.find((x) => x.p === "PP");
      const ps = p.est.find((x) => x.p === "PSOE");
      return pp && ps;
    });
    return withBoth.map((p) => ({
      x: p.fw_end as string,
      y: +(((p.est.find((x) => x.p === "PP")?.v ?? 0) - (p.est.find((x) => x.p === "PSOE")?.v ?? 0)).toFixed(2)),
      house: p.pollster, id: p.id,
    })).sort((a, b) => a.x.localeCompare(b.x));
  }, [usable]);

  const spreadTrend = useMemo(() => monthlyMedian(spread), [spread]);

  const latestByHouse = useMemo(() => {
    const m = new Map<string, { poll: Poll; value: number }>();
    for (const p of usable) {
      const e = p.est.find((x) => x.p === party);
      if (!e) continue;
      const cur = m.get(p.pollster);
      if (!cur || (p.fw_end ?? "") > (cur.poll.fw_end ?? "")) m.set(p.pollster, { poll: p, value: e.v });
    }
    return [...m.entries()]
      .map(([h, v]) => ({ house: h, value: v.value, date: v.poll.fw_end, n: v.poll.n, id: v.poll.id }))
      .sort((a, b) => b.value - a.value);
  }, [usable, party]);

  const meanLatest = latestByHouse.length ? latestByHouse.reduce((a, b) => a + b.value, 0) / latestByHouse.length : NaN;
  const unknownPublication = (polls ?? []).filter((p) => !p.published_at).length;

  if (err) return <ErrorBox message={err} />;
  if (!polls || loadedCycle !== cycle) return <Loading what={`sondeos de ${cycle}`} />;

  const color = partyColor(party, colors).hex;

  const seriesOption = {
    grid: { ...gridBase, top: 40, right: 24 },
    tooltip: {
      ...tooltipBase, trigger: "item",
      formatter: (p: { data?: { house?: string; n?: number | null; id?: string; tracking?: boolean } }) =>
        `${p.data?.house ?? ""} · n=${p.data?.n ?? "n.d."}${p.data?.tracking ? " · actualización de tracking" : ""}<br/>${p.data?.id ?? ""}`,
    },
    legend: { ...legendBase, data: ["Encuestas", "Mediana móvil (5)"] },
    xAxis: { type: "time", ...axisX, name: "fin de trabajo de campo", nameLocation: "middle", nameGap: 28, nameTextStyle: { color: "#78716c", fontSize: 11 } },
    yAxis: { type: "value", ...axisY, name: `% ${party}`, nameTextStyle: { color: "#78716c", fontSize: 11 }, scale: true },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 22, borderColor: "#e5e1d8", fillerColor: "rgba(15,118,110,0.10)" }],
    series: [
      {
        name: "Encuestas", type: "scatter",
        data: seriesPoints.map((pt) => ({ value: [pt.x, pt.y], ...pt })),
        itemStyle: { color, opacity: 0.45 }, symbolSize: 7,
        emphasis: { itemStyle: { opacity: 1 } },
      },
      {
        name: "Mediana móvil (5)", type: "line", smooth: true, showSymbol: false,
        data: trend.map((d) => [d.x, d.y]),
        lineStyle: { color: "#14213d", width: 2.4 }, itemStyle: { color: "#14213d" },
      },
    ],
  };

  const spreadOption = {
    grid: { ...gridBase, top: 36, right: 24 },
    tooltip: {
      ...tooltipBase, trigger: "item",
      formatter: (p: { data?: { house?: string; id?: string; value?: [string, number] } }) =>
        `${p.data?.house ?? ""}<br/>PP − PSOE: ${p.data?.value?.[1]?.toFixed(2) ?? "—"} pp<br/>${p.data?.id ?? ""}`,
    },
    legend: { ...legendBase, data: ["Diferencia PP − PSOE", "Mediana móvil"] },
    xAxis: { type: "time", ...axisX },
    yAxis: { type: "value", ...axisY, name: "pp", nameTextStyle: { color: "#78716c" }, scale: true },
    series: [
      {
        name: "Diferencia PP − PSOE", type: "scatter",
        data: spread.map((pt) => ({ value: [pt.x, pt.y], ...pt })),
        itemStyle: { color: "#7c3aed", opacity: 0.45 }, symbolSize: 7,
        markLine: {
          silent: true, symbol: "none", data: [{ yAxis: 0 }],
          lineStyle: { color: "#a8a29e", type: "dashed" },
          label: { formatter: "empate", fontSize: 10, color: "#78716c" },
        },
      },
      {
        name: "Mediana móvil", type: "line", smooth: true, showSymbol: false,
        data: spreadTrend.map((d) => [d.x, d.y]),
        lineStyle: { color: "#14213d", width: 2 }, itemStyle: { color: "#14213d" },
      },
    ],
  };

  const dispersionOption = {
    grid: { ...gridBase, top: 20, bottom: 64 },
    tooltip: {
      ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: { name?: string; value?: number }[]) => {
        const p = params[0];
        const row = latestByHouse.find((d) => d.house === p?.name);
        return `<strong>${p?.name ?? ""}</strong><br/>${party}: ${(p?.value ?? 0).toFixed(1)} %<br/>n=${row?.n ?? "n.d."} · ${fmtDate(row?.date)}`;
      },
    },
    xAxis: { type: "value", ...axisY, name: `% ${party}`, scale: true },
    yAxis: { type: "category", ...axisX, data: latestByHouse.map((d) => d.house).reverse(), axisLabel: { color: "#57534e", fontSize: 10 } },
    series: [{
      type: "bar", barMaxWidth: 14,
      data: [...latestByHouse].reverse().map((d) => ({
        value: d.value,
        itemStyle: { color: d.house === house ? "#14213d" : color, opacity: d.house === house ? 1 : 0.75, borderRadius: [0, 3, 3, 0] },
      })),
      markLine: {
        silent: true, symbol: "none", data: [{ xAxis: +meanLatest.toFixed(2) }],
        lineStyle: { color: "#c2410c", type: "dashed" },
        label: { formatter: `media ${meanLatest.toFixed(2)} %`, fontSize: 10, color: "#c2410c" },
      },
      label: { show: true, position: "right", fontSize: 10, color: "#57534e", formatter: (p: { value?: number }) => `${(p.value ?? 0).toFixed(1)}` },
    }],
  };

  const tableRows = [...usable]
    .sort((a, b) => (b.fw_end ?? "").localeCompare(a.fw_end ?? ""))
    .map((p) => {
      const e = p.est.find((x) => x.p === party);
      return {
        id: p.id,
        casa: p.pollster,
        patrocinador: p.sponsor ?? "",
        tipo: p.type,
        inicio_campo: p.fw_start ?? "",
        fin_campo: p.fw_end ?? "",
        muestra: p.n ?? "",
        [`${party}_pct`]: e?.v ?? "",
        tracking: p.is_tracking_update ? "sí" : "no",
        publicacion: p.published_at ?? "desconocida",
        fuente: p.original_url ?? "",
        calidad: p.quality_flags ?? "",
        replica: p.canonical !== p.id,
      };
    });

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Todas las encuestas y su evolución</h2><p className="mt-2 text-sm text-stone-600">Archivo analítico y nuevas verificaciones primarias. Las series usan fin de trabajo de campo; las fichas sin ventana de campo completa permanecen en Últimas encuestas. Las fechas no equivalen a «lo que se sabía ese día». Las posibles réplicas se excluyen por defecto.</p></div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-3 text-sm text-stone-600"><strong className="text-ink">Cada punto es una encuesta.</strong> La fecha es el fin del trabajo de campo, no la publicación.</div>
        <div className="rounded-lg border border-line bg-white p-3 text-sm text-stone-600"><strong className="text-ink">No se mezclan tipos.</strong> Estimación de voto e intención directa tienen bases distintas.</div>
        <div className="rounded-lg border border-line bg-white p-3 text-sm text-stone-600"><strong className="text-ink">La mediana no predice.</strong> Resume lo publicado; no estima el resultado del 29N.</div>
      </div>

      {status?.restricted && (
        <Notice title="Veda de publicación activa">
          {status.reason} Ventana: {fmtDate(status.restriction_start)} → {fmtDate(status.restriction_end)}.{" "}
          {status.legal_note}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
        <label className="text-sm">Ciclo:
          <select value={cycle} onChange={(e) => { setCycle(e.target.value as Cycle); setHouse("TODAS"); setSponsor("TODOS"); setFrom(""); setTo(""); setErr(null); }} className={`ml-1 ${selectClass}`} aria-label="Ciclo de encuestas">
            <option value="2026">2026 · mediciones</option>
            <option value="2023">2023 · evaluación vs resultado</option>
          </select>
        </label>
        <label className="text-sm">Tipo:
          <select value={ptype} onChange={(e) => setPtype(e.target.value as PType)} className={`ml-1 ${selectClass}`} aria-label="Tipo de medición">
            <option value="estimated_vote">Estimación de voto</option>
            <option value="direct_intention">Intención directa</option>
          </select>
        </label>
        <label className="text-sm">Partido:
          <select value={party} onChange={(e) => setParty(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Partido">
            {availableParties.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm">Casa:
          <select value={house} onChange={(e) => setHouse(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Encuestadora">
            <option value="TODAS">Todas ({houses.length})</option>
            {houses.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="text-sm">Medio:
          <select value={sponsor} onChange={e => setSponsor(e.target.value)} className={`ml-1 max-w-56 ${selectClass}`} aria-label="Medio o patrocinador">
            <option value="TODOS">Todos los medios</option>
            {sponsors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">Desde:
          <input type="date" value={from} min={bounds.min} max={bounds.max} onChange={(e) => setFrom(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Fecha inicial" />
        </label>
        <label className="text-sm">Hasta:
          <input type="date" value={to} min={bounds.min} max={bounds.max} onChange={(e) => setTo(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Fecha final" />
        </label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includeReplicas} onChange={e => setIncludeReplicas(e.target.checked)} />Incluir posibles réplicas</label>
        <button type="button" onClick={() => { setHouse("TODAS"); setSponsor("TODOS"); setPtype("estimated_vote"); setParty("PP"); setFrom(""); setTo(""); setIncludeReplicas(false); }}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sondeos filtrados" value={fmtInt(usable.length)} hint={`de ${fmtInt(polls.length)} en el ciclo`} />
        <StatCard label="Casas" value={new Set(usable.map((p) => p.pollster)).size} hint={`${houses.length} en todo el ciclo`} />
        <StatCard label="Último campo" value={bounds.max ? fmtDate(bounds.max) : "—"} hint={house === "TODAS" ? "Todas las casas" : house} />
        <StatCard label="Mediana actual" value={latestByHouse.length ? fmtPct(median(latestByHouse.map((d) => d.value)), 1) : "—"} hint={`${party} · última medición por casa`} />
      </section>

      <Card
        title={`${party} · ${ptype === "estimated_vote" ? "estimación de voto" : "intención directa"}`}
        subtitle={`${seriesPoints.length} observaciones · la línea oscura es una mediana móvil de 5 sondeos, no un pronóstico`}
        actions={<CsvButton filename={`sondeos_${cycle}_${party}_${ptype}.csv`} rows={tableRows} />}
      >
        <EChart option={seriesOption} height={420} ariaLabel={`Serie de ${ptype} para ${party}`} testId="encuestas-serie" />
        <Provenance items={[
          "Compilación Wikipedia CC BY-SA 4.0; no transfiere permisos de fuentes primarias",
          "Fecha usada: fin de trabajo de campo; la publicación es desconocida en el origen",
          `${seriesPoints.filter((p) => p.tracking).length} actualizaciones de tracking y ${seriesPoints.filter((p) => p.canonical).length} réplicas`,
        ]} />
      </Card>

      <Notice title="Lectura correcta de estas series" tone="info">
        Las encuestas no son un resultado ni un pronóstico. La mediana móvil describe el centro de las
        mediciones disponibles, no anticipa el 29N. No se mezclan <em>estimated_vote</em> con
        <em> direct_intention</em>: la segunda excluye indecisos y no es comparable con la cuota oficial.
      </Notice>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Diferencia PP − PSOE" subtitle="Solo sondeos que miden ambas formaciones; valores en puntos porcentuales">
          <EChart option={spreadOption} height={340} ariaLabel="Diferencia PP PSOE en encuestas" testId="encuestas-diferencia" />
          <Provenance items={["Compilación Wikipedia", "Positivo = PP por delante; negativo = PSOE por delante"]} />
        </Card>
        <Card
          title={`Dispersión entre casas · ${party}`}
          subtitle={`Última medición de cada casa en el filtro (${latestByHouse.length} casas). Media simple: ${Number.isNaN(meanLatest) ? "—" : `${meanLatest.toFixed(2)} %`}`}
        >
          {latestByHouse.length === 0
            ? <Empty what="mediciones para esta combinación" />
            : <EChart option={dispersionOption} height={Math.max(240, latestByHouse.length * 22 + 60)} ariaLabel={`Dispersión de estimaciones de ${party} entre encuestadoras`} testId="encuestas-dispersion" />}
          <Provenance items={["Compilación Wikipedia", "Cada barra es la última medición disponible de una casa, no un promedio histórico"]} />
        </Card>
      </div>

      <Card
        title={`Tabla de sondeos · ${party} (${cycle})`}
        subtitle={`Publicación verificada: ${polls.length - unknownPublication} de ${polls.length}. El resto usa fecha de campo.`}
        actions={<CsvButton filename={`tabla_sondeos_${cycle}_${party}.csv`} rows={tableRows} />}
      >
        {tableRows.length === 0 ? <Empty what="sondeos con estos filtros" /> : (
          <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Sondeos filtrados</caption>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th className="p-2">Fin de campo</th><th className="p-2">Publicación</th><th className="p-2">Casa</th><th className="p-2">Medio / patrocinador</th>
                  <th className="p-2 text-right">n</th><th className="p-2 text-right">{party}</th>
                  <th className="p-2">Tipo</th><th className="p-2">Marcas</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {tableRows.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                     <td className="p-2 whitespace-nowrap">{r.fin_campo ? fmtDate(String(r.fin_campo)) : "—"}</td>
                     <td className="p-2 whitespace-nowrap">{r.publicacion === "desconocida" ? "No verificada" : fmtDate(r.publicacion)}</td>
                    <td className="p-2">{r.casa}</td>
                     <td className="p-2 text-stone-500">{r.patrocinador || "—"}{/^https?:\/\//.test(r.fuente) && <a href={r.fuente} target="_blank" rel="noreferrer" className="ml-2 text-accent underline" aria-label={`Fuente de ${r.casa}`}>Fuente ↗</a>}</td>
                    <td className="p-2 text-right">{r.muestra ? fmtInt(Number(r.muestra)) : "—"}</td>
                    <td className="p-2 text-right font-medium">{r[`${party}_pct`] === "" ? "—" : `${r[`${party}_pct`]} %`}</td>
                    <td className="p-2 text-xs">{r.tipo === "estimated_vote" ? "estimación" : "intención"}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                         {r.tracking === "sí" && <Tag tone="warn">tracking</Tag>}
                         {r.replica && <Tag tone="warn">posible réplica</Tag>}
                        {r.publicacion === "desconocida" && <Tag>sin fecha de publicación</Tag>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance items={["Compilación Wikipedia CC BY-SA 4.0", "Muestra (n) tal como la reporta la fuente; puede faltar"]} />
      </Card>
    </div>
  );
}
