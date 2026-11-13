"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Notice, Provenance, SectionTitle,
  StatCard, Tag,
} from "@/components/ui";
import {
  loadCampaign, loadColors, loadPollSources, loadPolls, loadPublicationStatus,
  type Campaign, type ColorEntry, type Poll, type PollSources, type PublicationStatus,
} from "@/lib/data";
import { axisX, axisY, gridBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtInt, fmtPct, fmtPp, partyColor } from "@/lib/utils";

const TRACKED = ["PP", "PSOE", "VOX", "SUMAR"];

function daysBetween(a: string, b: string) {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

export default function Campana() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sources, setSources] = useState<PollSources | null>(null);
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [houseFilter, setHouseFilter] = useState("TODAS");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadCampaign(), loadPollSources(), loadPublicationStatus(), loadPolls("2026"), loadColors()])
      .then(([c, s, st, p, col]) => { setCampaign(c); setSources(s); setStatus(st); setPolls(p); setColors(col); })
      .catch((e) => setErr(String(e)));
  }, []);

  const primary = useMemo(
    () => (polls ?? []).filter((p) => p.type === "estimated_vote" && p.fw_end),
    [polls],
  );

  const filtered = useMemo(
    () => primary.filter((p) => houseFilter === "TODAS" || p.pollster === houseFilter),
    [primary, houseFilter],
  );

  const weekVolume = useMemo(() => {
    const byWeek = new Map<string, { polls: number; houses: Set<string>; types: Record<string, number> }>();
    for (const p of filtered) {
      const d = new Date(`${p.fw_end}T00:00:00Z`);
      const day = d.getUTCDay();
      const monday = new Date(d.getTime() - ((day + 6) % 7) * 86400000);
      const key = monday.toISOString().slice(0, 10);
      const cur = byWeek.get(key) ?? { polls: 0, houses: new Set<string>(), types: {} };
      cur.polls += 1;
      cur.houses.add(p.pollster);
      cur.types[p.type] = (cur.types[p.type] ?? 0) + 1;
      byWeek.set(key, cur);
    }
    return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, v]) => ({
      week, polls: v.polls, houses: v.houses.size,
    }));
  }, [filtered]);

  const latestByHouse = useMemo(() => {
    const m = new Map<string, Poll>();
    for (const p of filtered) {
      const cur = m.get(p.pollster);
      if (!cur || (p.fw_end ?? "") > (cur.fw_end ?? "")) m.set(p.pollster, p);
    }
    return [...m.entries()]
      .map(([house, poll]) => {
        const get = (pid: string) => poll.est.find((e) => e.p === pid)?.v ?? null;
        return {
          house, date: poll.fw_end, n: poll.n, sponsor: poll.sponsor,
          pp: get("PP"), psoe: get("PSOE"), vox: get("VOX"), sumar: get("SUMAR"),
          spread: get("PP") != null && get("PSOE") != null ? +(get("PP")! - get("PSOE")!).toFixed(2) : null,
          tracking: poll.is_tracking_update ?? false,
        };
      })
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [filtered]);

  const coverageByHouse = useMemo(() => {
    if (!sources) return [];
    const m = new Map<string, { measurements: number; polls: number; types: Set<string>; latest: string | null }>();
    for (const c of sources.coverage) {
      const cur = m.get(c.house) ?? { measurements: 0, polls: 0, types: new Set<string>(), latest: null };
      cur.measurements += c.n_measurements;
      cur.polls += c.n_polls;
      cur.types.add(c.poll_type);
      if (c.latest_fieldwork_end && (!cur.latest || c.latest_fieldwork_end > cur.latest)) cur.latest = c.latest_fieldwork_end;
      m.set(c.house, cur);
    }
    return [...m.entries()].map(([house, v]) => ({ house, ...v, types: [...v.types] }))
      .sort((a, b) => b.measurements - a.measurements);
  }, [sources]);

  if (err) return <ErrorBox message={err} />;
  if (!campaign || !sources || !status || !polls) return <Loading what="monitor de campaña" />;

  const today = status.today_madrid;
  const daysToElection = daysBetween(today, status.election_date);
  const daysToRestriction = daysBetween(today, status.restriction_start);

  const volumeOption = {
    grid: { ...gridBase, top: 30 },
    tooltip: {
      ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: { name?: string; value?: number; seriesName?: string }[]) => {
        const p = params[0];
        return `<strong>Semana del ${fmtDate(p?.name)}</strong><br/>${p?.value ?? 0} sondeos · ${filtered.length ? "" : ""}`;
      },
    },
    xAxis: { type: "category", data: weekVolume.map((w) => w.week), ...axisX, axisLabel: { color: "#57534e", fontSize: 10, formatter: (v: string) => v.slice(5) } },
    yAxis: { type: "value", ...axisY, name: "sondeos", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: [{
      type: "bar", name: "Sondeos por semana",
      data: weekVolume.map((w) => ({ value: w.polls, itemStyle: { color: "#0f766e", borderRadius: [3, 3, 0, 0] } })),
      barMaxWidth: 26,
    }],
  };

  const coverageOption = {
    grid: { ...gridBase, top: 16, bottom: 24, right: 40 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", ...axisY },
    yAxis: { type: "category", ...axisX, data: coverageByHouse.slice(0, 18).map((c) => c.house).reverse(), axisLabel: { color: "#57534e", fontSize: 10 } },
    series: [{
      type: "bar", barMaxWidth: 14,
      data: coverageByHouse.slice(0, 18).map((c) => ({ value: c.measurements, itemStyle: { color: "#14213d", borderRadius: [0, 3, 3, 0] } })).reverse(),
      label: { show: true, position: "right", fontSize: 10, color: "#57534e" },
    }],
  };

  const calendar = [
    { date: status.campaign_start, label: "Inicio de campaña", done: today >= status.campaign_start, tone: "info" as const },
    { date: status.restriction_start, label: "Inicio de veda de sondeos (LOREG 69.7)", done: today >= status.restriction_start, tone: "warn" as const },
    { date: status.restriction_end, label: "Fin de veda", done: today > status.restriction_end, tone: "warn" as const },
    { date: status.election_date, label: "Jornada electoral", done: today >= status.election_date, tone: "good" as const },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Monitor de campaña"
        title="Campaña y calendario electoral"
        desc="Cobertura real de sondeos y calendario documentado. El panel automático de snapshots diarios está desactivado porque ninguna fuente tiene fecha de publicación verificada: no se inventan series ni eventos."
        updated={campaign.as_of}
        sources={["Compilación Wikipedia CC BY-SA 4.0", "BOE (convocatoria y LOREG)", "Ministerio del Interior"]}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Días hasta la elección" value={daysToElection >= 0 ? daysToElection : "—"} hint={fmtDate(status.election_date, true)} />
        <StatCard label="Días hasta la veda" value={daysToRestriction >= 0 ? daysToRestriction : "en curso"} hint={`${fmtDate(status.restriction_start)} → ${fmtDate(status.restriction_end)}`} />
        <StatCard label="Sondeos de estimación" value={fmtInt(campaign.n_polls_primary ?? primary.length)} hint={`${campaign.n_polls_total ?? 0} en total, ambos ciclos`} />
        <StatCard label="Casas" value={fmtInt(campaign.n_houses ?? coverageByHouse.length)} hint={`${campaign.n_duplicates ?? 0} duplicados · ${campaign.n_tracking_updates ?? 0} trackings`} />
      </div>

      <Card title="Calendario documentado" subtitle={`Fase actual: ${status.phase}. Hoy: ${fmtDate(today)}.`}>
        <ol className="grid gap-3 md:grid-cols-4">
          {calendar.map((c) => (
            <li key={c.label} className={`rounded-lg border p-3 ${c.done ? "border-accent bg-accent/5" : "border-line bg-white"}`}>
              <Tag tone={c.done ? c.tone : "neutral"}>{c.done ? "cumplido" : "pendiente"}</Tag>
              <p className="mt-2 font-serif text-lg leading-tight">{c.label}</p>
              <p className="text-sm text-stone-500">{fmtDate(c.date, true)}</p>
            </li>
          ))}
        </ol>
        <Provenance items={["BOE: convocatoria y LOREG art. 69.7", "La veda afecta a publicación y difusión de sondeos, no a su campo"]} />
      </Card>

      {status.restricted ? (
        <Notice title="Veda de sondeos activa">
          {status.reason} {status.legal_note}
        </Notice>
      ) : (
        <Notice title="Por qué este panel no muestra snapshots diarios" tone="info">
          {campaign.warnings[0] ?? "No hay encuestas con fecha de publicación verificada."} Los sondeos tienen
          fecha de <strong>trabajo de campo</strong>, no de publicación; construir snapshots «a fecha de hoy»
          con esa fecha mezclaría cuándo se midió con cuándo se difundió. Por eso la cobertura se muestra por
          casa y por semana de campo, sin atribuirles una fecha de publicación que no consta.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Intensidad de campo" subtitle="Sondeos de estimación agrupados por semana de fin de campo" className="lg:col-span-2"
          actions={
            <select value={houseFilter} onChange={(e) => setHouseFilter(e.target.value)} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm" aria-label="Filtrar por casa">
              <option value="TODAS">Todas las casas</option>
              {[...new Set(primary.map((p) => p.pollster))].sort().map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          }>
          {weekVolume.length === 0 ? <Empty what="sondeos con fecha de campo" /> : (
            <EChart option={volumeOption} height={320} ariaLabel="Sondeos por semana de trabajo de campo" testId="campana-volumen" />
          )}
          <Provenance items={["Compilación Wikipedia", "Semana ISO lunes-domingo del fin de campo", "No implica que se publicaran esa semana"]} />
        </Card>
        <Card title="Cobertura por casa" subtitle="Mediciones registradas por encuestadora (todos los tipos)">
          {coverageByHouse.length === 0 ? <Empty what="cobertura de fuentes" /> : (
            <EChart option={coverageOption} height={320} ariaLabel="Cobertura de mediciones por encuestadora" testId="campana-cobertura" />
          )}
          <Provenance items={["poll_sources.json", `${sources.coverage.length} entradas casa × tipo`, `${sources.houses_pending_verification.length} casas pendientes de verificación`]} />
        </Card>
      </div>

      <Card
        title="Última medición por casa"
        subtitle={`${latestByHouse.length} casas · solo estimación de voto. La columna Δ es PP − PSOE en puntos.`}
        actions={<CsvButton filename="ultima_medicion_por_casa.csv" rows={latestByHouse.map((r) => ({
          casa: r.house, fin_campo: r.date, muestra: r.n, patrocinador: r.sponsor,
          PP: r.pp, PSOE: r.psoe, VOX: r.vox, SUMAR: r.sumar, diferencia_pp: r.spread, tracking: r.tracking,
        }))} />}
      >
        {latestByHouse.length === 0 ? <Empty what="mediciones por casa" /> : (
          <div className="max-h-[460px] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Última medición por encuestadora</caption>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th className="p-2">Casa</th><th className="p-2">Fin de campo</th><th className="p-2 text-right">n</th>
                  {TRACKED.map((p) => <th key={p} className="p-2 text-right" style={{ color: partyColor(p, colors).hex }}>{p}</th>)}
                  <th className="p-2 text-right">Δ PP−PSOE</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {latestByHouse.map((r) => (
                  <tr key={r.house} className="border-b border-line">
                    <td className="p-2">{r.house}{r.tracking && <span className="ml-1"><Tag tone="warn">tracking</Tag></span>}</td>
                    <td className="p-2 whitespace-nowrap">{r.date ? fmtDate(r.date) : "—"}</td>
                    <td className="p-2 text-right">{r.n ? fmtInt(r.n) : "—"}</td>
                    {TRACKED.map((p) => {
                      const v = p === "PP" ? r.pp : p === "PSOE" ? r.psoe : p === "VOX" ? r.vox : r.sumar;
                      return <td key={p} className="p-2 text-right">{v == null ? "—" : fmtPct(v, 1)}</td>;
                    })}
                    <td className={`p-2 text-right ${(r.spread ?? 0) >= 0 ? "text-sky-800" : "text-red-700"}`}>
                      {r.spread == null ? "—" : fmtPp(r.spread, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance items={["Compilación Wikipedia", "Una fila por casa: su sondeo más reciente en el filtro", "Δ positiva = PP por delante"]} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Fuentes oficiales y legales" subtitle="Documentadas en el registro de fuentes">
          <ul className="space-y-3">
            {sources.official.map((s) => {
              const row = s as Record<string, unknown>;
              return (
                <li key={String(row.source_id)} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{String(row.name)}</span>
                    <Tag tone="good">{String(row.status)}</Tag>
                  </div>
                  {row.notes ? <p className="mt-1 text-sm text-stone-600">{String(row.notes)}</p> : null}
                  {row.url ? <a className="mt-1 inline-block break-all text-xs text-accent underline" href={String(row.url)} target="_blank" rel="noreferrer">{String(row.url)}</a> : null}
                </li>
              );
            })}
          </ul>
          <Provenance items={["Registro de fuentes versionado", `${sources.secondary_aggregators.length} agregadores solo para contraste, no se copian artículos`]} />
        </Card>

        <Card title="Advertencias metodológicas" subtitle="Lo que este panel deliberadamente no hace">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
            {campaign.warnings.map((w) => <li key={w}>{w}</li>)}
            {[...sources.houses_pending_verification].slice(0, 6).map((h, i) => (
              <li key={`p${i}`}>
                Casa pendiente de verificación primaria: <strong>{String((h as Record<string, unknown>).house ?? (h as Record<string, unknown>).name ?? "sin identificar")}</strong>
              </li>
            ))}
          </ul>
          <Provenance items={["campaign.json", "poll_sources.json", "No se publican bandas como intervalos de probabilidad del resultado"]} />
        </Card>
      </div>
    </div>
  );
}
