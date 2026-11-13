"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { Card, CsvButton, ErrorBox, LinkCard, Loading, Notice, Provenance, SectionTitle, StatCard, Tag, selectClass } from "@/components/ui";
import {
  loadColors, loadMeta, loadNational, loadPollSources, loadPublicationStatus, loadTurnout,
  type ColorEntry, type ElectionNat, type Meta, type PollSources, type PublicationStatus, type TurnoutRow,
} from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtInt, fmtPct, fmtPp, partyColor } from "@/lib/utils";

type Metric = "cuota" | "escanos" | "votos";
const PRESET = ["PP", "PSOE", "VOX", "SUMAR"];
const PARTY_ORDER = ["PP", "PSOE", "VOX", "SUMAR", "ERC", "JUNTS", "PNC", "PNV", "BILDU", "CC", "BNG", "UPN", "PACMA"];

export default function Home() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [turnout, setTurnout] = useState<TurnoutRow[]>([]);
  const [sources, setSources] = useState<PollSources | null>(null);
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [sel, setSel] = useState<string[]>(PRESET);
  const [metric, setMetric] = useState<Metric>("cuota");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadNational(), loadColors(), loadTurnout(), loadPollSources(), loadPublicationStatus()])
      .then(([m, n, c, t, s, p]) => { setMeta(m); setNat(n); setColors(c); setTurnout(t); setSources(s); setStatus(p); })
      .catch((e) => setErr(String(e)));
  }, []);

  const parties = useMemo(() => {
    if (!nat) return [];
    const seen = new Map<string, number>();
    for (const e of nat) for (const p of e.parties) seen.set(p.party_id, (seen.get(p.party_id) ?? 0) + p.votes);
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .sort((a, b) => {
        const ia = PARTY_ORDER.indexOf(a); const ib = PARTY_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
      });
  }, [nat]);

  const nationalTurnout = useMemo(() => {
    if (turnout.length === 0) return [];
    const byElection = new Map<string, TurnoutRow[]>();
    for (const r of turnout) {
      const list = byElection.get(r.election_date) ?? [];
      list.push(r); byElection.set(r.election_date, list);
    }
    return [...byElection.entries()].map(([election, rows]) => ({
      election,
      electores: rows.reduce((a, r) => a + r.electores, 0),
      votantes: rows.reduce((a, r) => a + r.votantes, 0),
    })).sort((a, b) => a.election.localeCompare(b.election)).map((r) => ({
      ...r,
      turnout: r.electores ? (r.votantes / r.electores) * 100 : NaN,
    }));
  }, [turnout]);

  if (err) return <ErrorBox message={err} />;
  if (!meta || !nat) return <Loading what="resultados históricos" />;

  const last = nat[nat.length - 1];
  const prev = nat[nat.length - 2];
  const visible = parties.filter((p) => sel.includes(p));
  const metaCounts = meta.counts;
  const nEstimates = metaCounts.poll_estimates ?? metaCounts.estimates ?? 0;

  const valueOf = (e: ElectionNat, p: string): number | null => {
    if (p === "PP" && e.election < "1989-01-01") return null;
    const f = e.parties.find((x) => x.party_id === p);
    if (!f) return null;
    return metric === "votos" ? +(f.votes / 1e6).toFixed(3) : metric === "cuota" ? +f.share.toFixed(2) : f.seats;
  };

  const seriesOption = {
    grid: { ...gridBase, top: 48 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      valueFormatter: (v: number | null) =>
        v == null ? "sin dato" : metric === "votos" ? `${v.toFixed(2)} M votos` : metric === "cuota" ? `${v.toFixed(2)} %` : `${v} escaños`,
    },
    legend: { ...legendBase, data: visible },
    xAxis: { type: "category", data: nat.map((e) => e.election.slice(2, 4) + "·" + e.election.slice(5, 7)), ...axisX },
    yAxis: {
      type: "value", ...axisY,
      name: metric === "votos" ? "millones" : metric === "cuota" ? "% de voto" : "escaños",
      nameTextStyle: { color: "#78716c", fontSize: 11 },
    },
    series: visible.map((p) => ({
      name: p, type: "line", data: nat.map((e) => valueOf(e, p)),
      connectNulls: false, symbolSize: 5,
      itemStyle: { color: partyColor(p, colors).hex },
      lineStyle: { width: 2.4 },
      emphasis: { focus: "series" },
    })),
  };

  const turnoutOption = {
    grid: { ...gridBase, top: 48 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} %` },
    xAxis: { type: "category", data: nationalTurnout.map((r) => r.election.slice(2, 4)), ...axisX },
    yAxis: { type: "value", min: 55, max: 85, ...axisY, name: "%", nameTextStyle: { color: "#78716c" } },
    series: [{
      name: "Participación", type: "line", smooth: 0.2,
      data: nationalTurnout.map((r) => +r.turnout.toFixed(2)),
      itemStyle: { color: "#0f766e" }, lineStyle: { width: 2.6 },
      areaStyle: { color: "rgba(15,118,110,0.10)" }, symbolSize: 5,
      markLine: {
        silent: true, symbol: "none",
        data: [{ type: "average", name: "media" }],
        lineStyle: { color: "#c2410c", type: "dashed" },
        label: { formatter: "media {c} %", fontSize: 10, color: "#c2410c" },
      },
    }],
  };

  const seatOption = {
    grid: { ...gridBase, top: 20, bottom: 24 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v} escaños` },
    xAxis: { type: "value", ...axisY, max: 140 },
    yAxis: {
      type: "category", ...axisX,
      data: [...last.parties].filter((p) => p.seats > 0).sort((a, b) => a.seats - b.seats).map((p) => p.party_id),
    },
    series: [{
      type: "bar", barMaxWidth: 22,
      data: [...last.parties].filter((p) => p.seats > 0).sort((a, b) => a.seats - b.seats).map((p) => ({
        value: p.seats, itemStyle: { color: partyColor(p.party_id, colors).hex, borderRadius: [0, 3, 3, 0] },
      })),
      label: { show: true, position: "right", fontSize: 11, color: "#57534e" },
    }],
  };

  const deltas = [...last.parties]
    .map((p) => {
      const before = prev?.parties.find((x) => x.party_id === p.party_id);
      return { party: p.party_id, now: p.share, before: before?.share ?? null, dpp: before ? p.share - before.share : null, seats: p.seats, dSeats: before ? p.seats - before.seats : null };
    })
    .filter((d) => d.seats > 0 || Math.abs(d.dpp ?? 0) > 1)
    .sort((a, b) => b.now - a.now);

  const coverageCount = sources?.coverage.length ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Observatorio electoral · Congreso</p>
          {status && <Tag tone={status.restricted ? "warn" : "info"}>{status.phase}</Tag>}
        </div>
        <h1 className="mt-2 font-serif text-4xl leading-[1.05] text-ink md:text-6xl">España en las urnas</h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-stone-600 md:text-base">
          Dieciséis elecciones generales, 52 circunscripciones, {fmtInt(metaCounts.labels)} candidaturas
          originales y {fmtInt(metaCounts.polls)} sondeos. Historia descriptiva, demografía y un laboratorio
          de evaluación retrospectiva. <strong className="text-ink">Sin pronósticos del 29N de 2026.</strong>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <Tag>{`Corte: ${fmtDate(status?.today_madrid ?? meta.generated_at?.slice(0, 10) ?? meta.last_election)}`}</Tag>
          <Tag>{meta.elections.length} elecciones</Tag>
          <Tag>{metaCounts.provinces} provincias</Tag>
          <Tag>{fmtInt(nEstimates)} estimaciones</Tag>
          <Tag>{metaCounts.poll_houses ?? coverageCount} casas de encuestas</Tag>
        </div>
      </header>

      {status && (
        <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-stone-600">
          <span className="font-medium text-ink">Estado de publicación: </span>
          {status.reason} · {status.legal_note}
        </div>
      )}

      <section aria-label="Indicadores clave" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Última elección" value={fmtDate(last.election, false)} hint={`${last.n_labels} candidaturas`} />
        <StatCard label="Participación" value={fmtPct(last.turnout, 1)} hint={`${fmtInt(last.votantes)} votantes`} />
        <StatCard label="Electores" value={fmtInt(last.electores)} hint="Censo de la última elección" />
        <StatCard label="Escaños" value="350" hint="Congreso de los Diputados" />
        <StatCard label="Encuestas" value={fmtInt(metaCounts.polls)} hint={`${fmtInt(metaCounts.poll_houses ?? 0)} casas`} />
        <StatCard label="Candidaturas" value={fmtInt(metaCounts.labels)} hint={`${fmtInt(metaCounts.mapped_labels)} mapeadas`} />
      </section>

      <Card
        title={`Series históricas · ${metric === "cuota" ? "cuota de voto" : metric === "escanos" ? "escaños" : "votos"}`}
        subtitle="Cada punto es una elección. Los huecos son ausencia de la formación, no cero."
        actions={
          <>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className={selectClass} aria-label="Métrica de la serie">
              <option value="cuota">Cuota (%)</option>
              <option value="escanos">Escaños</option>
              <option value="votos">Votos (millones)</option>
            </select>
            <CsvButton
              filename={`serie_nacional_${metric}.csv`}
              rows={nat.flatMap((e) => visible.map((p) => {
                const f = e.parties.find((x) => x.party_id === p);
                return { eleccion: e.election, partido: p, votos: f?.votes ?? "", cuota_pct: f?.share ?? "", escanos: f?.seats ?? "" };
              }))}
            />
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Partidos visibles">
          {parties.map((p) => {
            const active = sel.includes(p);
            const color = partyColor(p, colors).hex;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  active ? "border-transparent text-white" : "border-line bg-white text-stone-600 hover:border-stone-400"
                }`}
                style={active ? { backgroundColor: color } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "#fff" : color }} aria-hidden="true" />
                {p}
              </button>
            );
          })}
          <button type="button" onClick={() => setSel(PRESET)}
            className="rounded-full border border-line px-2.5 py-1 text-xs text-stone-600 hover:border-accent">
            Restablecer
          </button>
        </div>
        <EChart option={seriesOption} height={440} ariaLabel="Serie histórica de resultados nacionales por partido" testId="home-series" />
        <Provenance items={[
          "Ministerio del Interior; cuota sobre votos a candidaturas",
          "PP empieza en 1989: Alianza Popular no se codifica como PP",
          "Etiquetas sin mapear excluidas de las series por partido y conservadas en las tablas",
        ]} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Participación" subtitle="Votantes sobre censo electoral, agregado provincial" className="lg:col-span-2">
          <EChart option={turnoutOption} height={300} ariaLabel="Evolución de la participación electoral" testId="home-turnout" />
          <Provenance items={["Interior (votantes/censo)", "La media es simple, no ponderada por tamaño provincial"]} />
        </Card>
        <Card title={`Composición ${last.election.slice(0, 4)}`} subtitle="Escaños por formación">
          <EChart option={seatOption} height={300} ariaLabel={`Escaños por partido en ${last.election}`} testId="home-seats" />
          <Provenance items={["Interior", "Solo formaciones con escaño"]} />
        </Card>
      </div>

      <Card title={`Último cambio · ${prev?.election.slice(0, 4)} → ${last.election.slice(0, 4)}`}
        subtitle="Diferencia de cuota y escaños. Cambios en puntos porcentuales, no en porcentaje relativo.">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Cambios entre las dos últimas elecciones</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th className="p-2">Partido</th><th className="p-2 text-right">Cuota 2023</th>
                <th className="p-2 text-right">Cuota ahora</th><th className="p-2 text-right">Δ pp</th>
                <th className="p-2 text-right">Escaños</th><th className="p-2 text-right">Δ escaños</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {deltas.map((d) => (
                <tr key={d.party} className="border-b border-line">
                  <td className="p-2">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: partyColor(d.party, colors).hex }} aria-hidden="true" />
                    {d.party}
                  </td>
                  <td className="p-2 text-right">{d.before == null ? "—" : fmtPct(d.before)}</td>
                  <td className="p-2 text-right">{fmtPct(d.now)}</td>
                  <td className={`p-2 text-right ${(d.dpp ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {d.dpp == null ? "—" : fmtPp(d.dpp, 1)}
                  </td>
                  <td className="p-2 text-right">{d.seats}</td>
                  <td className={`p-2 text-right ${(d.dSeats ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {d.dSeats == null ? "—" : `${d.dSeats > 0 ? "+" : ""}${d.dSeats}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Provenance items={["Interior", "Solo partidos con escaño o variación > 1 pp"]} />
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <LinkCard href="/historico" title="Histórico" desc="Voto, cuota, escaños y participación elección a elección." meta="1977–2023" />
        <LinkCard href="/territorio" title="Territorio" desc="Mapa provincial interactivo con ficha de cada circunscripción." meta="52 provincias" />
        <LinkCard href="/encuestas" title="Encuestas" desc="Sondeos por casa, tipo y fecha, con dispersión entre encuestadoras." meta={`${fmtInt(metaCounts.polls)} sondeos`} />
        <LinkCard href="/simulador" title="Simulador" desc="Reparto D'Hondt hipotético con escenarios de voto y participación." meta="Herramienta, no pronóstico" />
      </div>

      {status?.restricted && (
        <Notice title="Restricción de publicación activa">
          {status.reason} Ventana: {fmtDate(status.restriction_start)} → {fmtDate(status.restriction_end)}.
          {status.legal_note}
        </Notice>
      )}
    </div>
  );
}
