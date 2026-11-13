"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Provenance, SectionTitle,
  StatCard, selectClass,
} from "@/components/ui";
import {
  loadColors, loadLabels, loadMeta, loadNational, loadTurnout,
  type ColorEntry, type ElectionNat, type LabelRow, type Meta, type TurnoutRow,
} from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtInt, fmtPct, fmtPp, partyColor } from "@/lib/utils";

type Metric = "cuota" | "escanos" | "votos";
const DEFAULT = ["PP", "PSOE", "VOX", "SUMAR"];

export default function Historico() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [turnout, setTurnout] = useState<TurnoutRow[]>([]);
  const [metric, setMetric] = useState<Metric>("cuota");
  const [sel, setSel] = useState<string[]>(DEFAULT);
  const [eA, setEA] = useState("2019-11-10");
  const [eB, setEB] = useState("2023-07-23");
  const [rowsA, setRowsA] = useState<LabelRow[] | null>(null);
  const [rowsB, setRowsB] = useState<LabelRow[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadNational(), loadColors(), loadTurnout()])
      .then(([m, n, c, t]) => { setMeta(m); setNat(n); setColors(c); setTurnout(t); })
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadLabels(eA), loadLabels(eB)])
      .then(([a, b]) => { if (alive) { setRowsA(a); setRowsB(b); } })
      .catch((e) => { if (alive) { setErr(String(e)); } });
    return () => { alive = false; };
  }, [eA, eB]);

  const parties = useMemo(() => {
    if (!nat) return [];
    const total = new Map<string, number>();
    for (const e of nat) for (const p of e.parties) total.set(p.party_id, (total.get(p.party_id) ?? 0) + p.votes);
    return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [nat]);

  const nationalTurnout = useMemo(() => {
    const by = new Map<string, { el: number; vo: number; nu: number; bl: number; va: number }>();
    for (const r of turnout) {
      const cur = by.get(r.election_date) ?? { el: 0, vo: 0, nu: 0, bl: 0, va: 0 };
      cur.el += r.electores; cur.vo += r.votantes; cur.nu += r.votos_nulos;
      cur.bl += r.votos_blancos; cur.va += r.votos_validos;
      by.set(r.election_date, cur);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([election, r]) => ({
      election,
      turnout: r.el ? (r.vo / r.el) * 100 : NaN,
      nullRate: r.vo ? (r.nu / r.vo) * 100 : NaN,
      blankRate: r.va ? (r.bl / r.va) * 100 : NaN,
    }));
  }, [turnout]);

  const changes = useMemo(() => {
    if (!rowsA || !rowsB) return null;
    const agg = (rows: LabelRow[]) => {
      const m = new Map<string, { v: number; s: number }>();
      for (const r of rows) {
        const k = r.party ?? `SIN MAPEAR: ${r.label}`;
        const cur = m.get(k) ?? { v: 0, s: 0 };
        m.set(k, { v: cur.v + r.v, s: cur.s + r.s });
      }
      return m;
    };
    const A = agg(rowsA); const B = agg(rowsB);
    const denA = rowsA.reduce((a, r) => a + r.v, 0);
    const denB = rowsB.reduce((a, r) => a + r.v, 0);
    return [...new Set([...A.keys(), ...B.keys()])].map((k) => {
      const a = A.get(k); const b = B.get(k);
      return {
        party: k,
        votesA: a?.v ?? 0, votesB: b?.v ?? 0,
        seatsA: a?.s ?? 0, seatsB: b?.s ?? 0,
        shareA: a ? (a.v / denA) * 100 : 0,
        shareB: b ? (b.v / denB) * 100 : 0,
        dv: (b?.v ?? 0) - (a?.v ?? 0),
        dpp: (b ? (b.v / denB) * 100 : 0) - (a ? (a.v / denA) * 100 : 0),
        dSeats: (b?.s ?? 0) - (a?.s ?? 0),
        comparable: Boolean(a && b) && !k.startsWith("SIN MAPEAR"),
      };
    }).sort((x, y) => y.shareB - x.shareB);
  }, [rowsA, rowsB]);

  const tableB = useMemo(() => {
    if (!rowsB) return [];
    const term = q.trim().toLowerCase();
    return [...rowsB]
      .filter((r) => !term || r.label.toLowerCase().includes(term) || (r.party ?? "").toLowerCase().includes(term))
      .sort((a, b) => b.v - a.v);
  }, [rowsB, q]);

  if (err) return <ErrorBox message={err} />;
  if (!meta || !nat) return <Loading what="series históricas" />;

  const valOf = (e: ElectionNat, p: string): number | null => {
    if (p === "PP" && e.election < "1989-01-01") return null;
    const f = e.parties.find((x) => x.party_id === p);
    if (!f) return null;
    return metric === "votos" ? +(f.votes / 1e6).toFixed(3) : metric === "cuota" ? +f.share.toFixed(2) : f.seats;
  };

  const last = nat[nat.length - 1];
  const first = nat[0];
  const avgTurnout = nationalTurnout.reduce((a, r) => a + r.turnout, 0) / nationalTurnout.length;

  const mainOption = {
    grid: { ...gridBase, top: 40 },
    tooltip: {
      ...tooltipBase, trigger: "axis",
      valueFormatter: (v: number | null) => v == null ? "sin dato"
        : metric === "votos" ? `${v.toFixed(2)} M votos` : metric === "cuota" ? `${v.toFixed(2)} %` : `${v} escaños`,
    },
    legend: { ...legendBase },
    xAxis: { type: "category", data: nat.map((e) => e.election.slice(2, 4)), ...axisX },
    yAxis: {
      type: "value", ...axisY,
      name: metric === "votos" ? "millones" : metric === "cuota" ? "%" : "escaños",
      nameTextStyle: { color: "#78716c", fontSize: 11 },
    },
    series: sel.filter((p) => parties.includes(p)).map((p) => ({
      name: p, type: "line", data: nat.map((e) => valOf(e, p)),
      connectNulls: false, symbolSize: 5, itemStyle: { color: partyColor(p, colors).hex },
      lineStyle: { width: 2.4 },
    })),
  };

  const turnoutOption = {
    grid: { ...gridBase, top: 40 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} %` },
    legend: { ...legendBase },
    xAxis: { type: "category", data: nationalTurnout.map((r) => r.election.slice(2, 4)), ...axisX },
    yAxis: { type: "value", ...axisY, name: "%", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: [
      {
        name: "Participación", type: "line", smooth: 0.15,
        data: nationalTurnout.map((r) => +r.turnout.toFixed(2)),
        itemStyle: { color: "#0f766e" }, lineStyle: { width: 2.6 },
        areaStyle: { color: "rgba(15,118,110,0.10)" },
        markLine: {
          silent: true, symbol: "none", data: [{ yAxis: +avgTurnout.toFixed(2) }],
          lineStyle: { color: "#78716c", type: "dashed" }, label: { formatter: "media", fontSize: 10 },
        },
      },
      {
        name: "Nulos (% votantes)", type: "line",
        data: nationalTurnout.map((r) => +r.nullRate.toFixed(2)),
        itemStyle: { color: "#c2410c" }, lineStyle: { width: 1.6, type: "dashed" }, symbolSize: 4,
      },
      {
        name: "Blancos (% válidos)", type: "line",
        data: nationalTurnout.map((r) => +r.blankRate.toFixed(2)),
        itemStyle: { color: "#7c3aed" }, lineStyle: { width: 1.6, type: "dashed" }, symbolSize: 4,
      },
    ],
  };

  const seatOption = {
    grid: { ...gridBase, top: 20, bottom: 24, right: 32 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", ...axisY },
    yAxis: { type: "category", ...axisX, data: [...last.parties].filter((p) => p.seats > 0).sort((a, b) => a.seats - b.seats).map((p) => p.party_id) },
    series: [{
      type: "bar", barMaxWidth: 20,
      data: [...last.parties].filter((p) => p.seats > 0).sort((a, b) => a.seats - b.seats).map((p) => ({
        value: p.seats, itemStyle: { color: partyColor(p.party_id, colors).hex, borderRadius: [0, 3, 3, 0] },
      })),
      label: { show: true, position: "right", fontSize: 11, color: "#57534e" },
    }],
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Serie temporal · 1977–2023"
        title="Histórico electoral"
        desc="Voto absoluto, cuota, escaños y participación por elección. Las series por partido usan el mapeo versionado; la tabla conserva todas las etiquetas originales. Alianza Popular no se cuenta como PP."
        updated={meta.generated_at?.slice(0, 10)}
        sources={["Ministerio del Interior", "INE (censo)", "Mapeo versionado de etiquetas"]}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Elecciones" value={nat.length} hint={`${first.election.slice(0, 4)} → ${last.election.slice(0, 4)}`} />
        <StatCard label="Candidaturas totales" value={fmtInt(meta.counts.labels)} hint={`${fmtInt(meta.counts.mapped_labels)} mapeadas a partido`} />
        <StatCard label="Participación media" value={fmtPct(avgTurnout, 1)} hint="Media simple de elecciones" />
        <StatCard label="Última participación" value={fmtPct(last.turnout, 1)} hint={fmtDate(last.election)} />
      </section>

      <Card
        title="Resultado nacional por partido"
        subtitle={`Métrica activa: ${metric}. Los huecos significan que la formación no se presentó o no se mapeó.`}
        actions={
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className={selectClass} aria-label="Métrica">
            <option value="cuota">Cuota (%)</option>
            <option value="escanos">Escaños</option>
            <option value="votos">Votos (millones)</option>
          </select>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Partidos visibles">
          {parties.slice(0, 16).map((p) => {
            const active = sel.includes(p);
            return (
              <button key={p} type="button" onClick={() => setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: partyColor(p, colors).hex }} aria-hidden="true" />
                {p}
              </button>
            );
          })}
          <button type="button" onClick={() => setSel(DEFAULT)} className="rounded-full border border-line px-2.5 py-1 text-xs text-stone-600">
            Restablecer
          </button>
        </div>
        <EChart option={mainOption} height={430} ariaLabel="Evolución histórica por partido" testId="historico-series" />
        <Provenance items={["Interior", "Cuota sobre votos a candidaturas", "PP desde 1989; AP se mantiene separada", "Huecos ≠ 0"]} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Participación y calidad del voto" subtitle="Porcentajes sobre votantes (nulos) o válidos (blancos)" className="lg:col-span-2">
          <EChart option={turnoutOption} height={320} ariaLabel="Participación, voto nulo y voto blanco" testId="historico-turnout" />
          <Provenance items={["Interior", "Agregado de las 52 provincias", "Las series de nulos y blancos usan escalas propias: se leen por separado"]} />
        </Card>
        <Card title={`Escaños ${last.election.slice(0, 4)}`} subtitle="Composición del Congreso">
          <EChart option={seatOption} height={320} ariaLabel="Escaños en la última elección" testId="historico-seats" />
          <Provenance items={["Interior", "350 escaños"]} />
        </Card>
      </div>

      <Card title="Cambios entre dos elecciones" subtitle="Selecciona el par y compara votos, cuota y escaños. Δ pp es diferencia de puntos porcentuales.">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm">De:
            <select value={eA} onChange={(e) => setEA(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Elección base">
              {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="text-sm">A:
            <select value={eB} onChange={(e) => setEB(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Elección comparada">
              {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          {changes && (
            <CsvButton filename={`cambios_${eA}_${eB}.csv`} rows={changes.map((c) => ({
              partido: c.party, votos_de: c.votesA, votos_a: c.votesB, cuota_de: +c.shareA.toFixed(2),
              cuota_a: +c.shareB.toFixed(2), delta_pp: +c.dpp.toFixed(2), escanos_de: c.seatsA,
              escanos_a: c.seatsB, delta_escanos: c.dSeats, comparable: c.comparable,
            }))} />
          )}
        </div>
        {!changes ? <Empty what="detalle por elección" /> : (
          <div className="overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Cambios por partido entre las elecciones seleccionadas</caption>
              <thead className="bg-stone-50">
                <tr className="border-b border-line text-left">
                  <th className="p-2">Partido</th>
                  <th className="p-2 text-right">{eA.slice(0, 4)}</th>
                  <th className="p-2 text-right">{eB.slice(0, 4)}</th>
                  <th className="p-2 text-right">Δ pp</th>
                  <th className="p-2 text-right">Δ votos</th>
                  <th className="p-2 text-right">Δ escaños</th>
                  <th className="p-2">Comparable</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {changes.slice(0, 22).map((c) => (
                  <tr key={c.party} className="border-b border-line">
                    <td className="p-2">{c.party}</td>
                    <td className="p-2 text-right">{fmtPct(c.shareA)}</td>
                    <td className="p-2 text-right">{fmtPct(c.shareB)}</td>
                    <td className={`p-2 text-right ${c.dpp >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtPp(c.dpp)}</td>
                    <td className="p-2 text-right">{fmtInt(c.dv)}</td>
                    <td className="p-2 text-right">{c.dSeats > 0 ? `+${c.dSeats}` : c.dSeats}</td>
                    <td className="p-2 text-xs text-stone-500">{c.comparable ? "sí" : "perímetro distinto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance items={["Interior, agregado por etiqueta", "«Perímetro distinto»: la etiqueta no existe en una de las dos elecciones"]} />
      </Card>

      <Card
        title={`Todas las candidaturas · ${eB}`}
        subtitle={`${tableB.length} etiquetas visibles de ${rowsB?.length ?? 0}`}
        actions={
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar etiqueta o partido"
              className="rounded-md border border-line px-2 py-1.5 text-sm" aria-label="Buscar candidatura" />
            {rowsB && <CsvButton filename={`candidaturas_${eB}.csv`} rows={rowsB as unknown as Record<string, unknown>[]} />}
          </>
        }
      >
        {!rowsB ? <Empty what="detalle por etiqueta" /> : (
          <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Todas las candidaturas de la elección seleccionada</caption>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th className="p-2">#</th><th className="p-2">Etiqueta original</th><th className="p-2">Partido</th>
                  <th className="p-2 text-right">Votos</th><th className="p-2 text-right">Cuota</th><th className="p-2 text-right">Escaños</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {tableB.map((r, i) => (
                  <tr key={`${r.p}-${r.label}`} className="border-b border-line">
                    <td className="p-2 text-stone-400">{i + 1}</td>
                    <td className="p-2">{r.label}</td>
                    <td className="p-2">{r.party ?? <em className="text-stone-500">sin mapear</em>}</td>
                    <td className="p-2 text-right">{fmtInt(r.v)}</td>
                    <td className="p-2 text-right">{fmtPct(r.share)}</td>
                    <td className="p-2 text-right">{r.s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance items={[`Interior (${rowsB?.length ?? "?"} filas provinciales agregadas por etiqueta)`, "Denominador: votos a candidaturas"]} />
      </Card>
    </div>
  );
}
