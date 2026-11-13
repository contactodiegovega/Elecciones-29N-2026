"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Provenance, SectionTitle,
  StatCard, Tag, selectClass,
} from "@/components/ui";
import {
  loadDemography, loadLabels, loadMeta, loadTerritories, loadTurnout,
  type Demography, type LabelRow, type Meta, type Territory, type TurnoutRow,
} from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtInt, fmtPct, fmtDec, pearson } from "@/lib/utils";

type Row = Demography["rows"][number];

const INDICATORS = [
  { key: "share_18_29", label: "% residentes 18–29", unit: "% del padrón", kind: "share" },
  { key: "share_30_44", label: "% residentes 30–44", unit: "% del padrón", kind: "share" },
  { key: "share_45_64", label: "% residentes 45–64", unit: "% del padrón", kind: "share" },
  { key: "share_65plus", label: "% residentes 65+", unit: "% del padrón", kind: "share" },
  { key: "share_foreign", label: "% residentes extranjeros", unit: "% del padrón", kind: "share" },
  { key: "pop_total_2852", label: "Población total", unit: "personas", kind: "count" },
  { key: "pop_growth_yoy", label: "Crecimiento del padrón interanual", unit: "%", kind: "rate" },
  { key: "unemployment_rate", label: "Tasa de paro (EPA)", unit: "%", kind: "rate" },
  { key: "activity_rate", label: "Tasa de actividad (EPA)", unit: "%", kind: "rate" },
  { key: "employment_rate", label: "Tasa de empleo (EPA)", unit: "%", kind: "rate" },
  { key: "adrh_wages", label: "Peso de la renta salarial (ADRH)", unit: "% de la renta de los hogares", kind: "share" },
  { key: "adrh_pensions", label: "Peso de las pensiones (ADRH)", unit: "% de la renta de los hogares", kind: "share" },
  { key: "prev_turnout", label: "Participación en la elección anterior", unit: "%", kind: "rate" },
  { key: "mean_last3", label: "Participación media de las 3 últimas elecciones", unit: "%", kind: "rate" },
] as const;

type IndicatorKey = typeof INDICATORS[number]["key"];

export default function Demografia() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [demo, setDemo] = useState<Demography | null>(null);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [turnout, setTurnout] = useState<TurnoutRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[] | null>(null);
  const [labelsElection, setLabelsElection] = useState<string | null>(null);
  const [election, setElection] = useState("2023-07-23");
  const [ind, setInd] = useState<IndicatorKey>("share_65plus");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadDemography(), loadTerritories(), loadTurnout()])
      .then(([m, d, t, to]) => { setMeta(m); setDemo(d); setTerr(t); setTurnout(to); })
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    let alive = true;
    loadLabels(election)
      .then((l) => { if (alive) { setLabels(l); setLabelsElection(election); } })
      .catch(() => { if (alive) { setLabels([]); setLabelsElection(election); } });
    return () => { alive = false; };
  }, [election]);

  const nameOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_name_interior]));
    return (c: string) => m.get(c) ?? c;
  }, [terr]);

  const rows = useMemo(() => (demo?.rows ?? []).filter((r) => r.target_election_date === election), [demo, election]);
  const coverage = useMemo(
    () => demo?.coverage?.find((c) => c.target_election_date === election),
    [demo, election],
  );
  const indMeta = INDICATORS.find((i) => i.key === ind)!;
  const vintage = rows[0]?.vintage_ref as string | undefined;
  const vintageStatus = rows[0]?.vintage_status as string | undefined;

  const turnoutMap = useMemo(() => {
    const m = new Map<string, TurnoutRow>();
    for (const r of turnout) if (r.election_date === election) m.set(r.province_code, r);
    return m;
  }, [turnout, election]);

  const currentLabels = labelsElection === election ? labels : null;

  const partyShares = useMemo(() => {
    const m = new Map<string, { total: number; pp: number; psoe: number; vox: number }>();
    for (const r of currentLabels ?? []) {
      const cur = m.get(r.p) ?? { total: 0, pp: 0, psoe: 0, vox: 0 };
      cur.total += r.v;
      if (r.party === "PP") cur.pp += r.v;
      if (r.party === "PSOE") cur.psoe += r.v;
      if (r.party === "VOX") cur.vox += r.v;
      m.set(r.p, cur);
    }
    return m;
  }, [currentLabels]);

  const points = useMemo(() => rows
    .map((r) => ({
      code: r.province_code as string,
      x: r[ind] as number | null,
      turnout: turnoutMap.get(r.province_code as string)?.turnout_rate ?? null,
      pp: (() => { const p = partyShares.get(r.province_code as string); return p && p.total ? (p.pp / p.total) * 100 : null; })(),
      psoe: (() => { const p = partyShares.get(r.province_code as string); return p && p.total ? (p.psoe / p.total) * 100 : null; })(),
    }))
    .filter((p) => p.x != null), [rows, ind, turnoutMap, partyShares]);

  const corrTurnout = useMemo(() => {
    const valid = points.filter((p) => p.turnout != null);
    const pts = valid.map((p) => [p.x as number, p.turnout as number] as [number, number]);
    return { r: pearson(pts), n: pts.length, pts, names: valid.map((p) => p.code) };
  }, [points]);

  const corrPP = useMemo(() => {
    const valid = points.filter((p) => p.pp != null);
    const pts = valid.map((p) => [p.x as number, p.pp as number] as [number, number]);
    return { r: pearson(pts), n: pts.length, pts, names: valid.map((p) => p.code) };
  }, [points]);

  const corrPSOE = useMemo(() => {
    const valid = points.filter((p) => p.psoe != null);
    const pts = valid.map((p) => [p.x as number, p.psoe as number] as [number, number]);
    return { r: pearson(pts), n: pts.length, pts, names: valid.map((p) => p.code) };
  }, [points]);

  const sorted = useMemo(() => [...points].sort((a, b) => (b.x ?? -Infinity) - (a.x ?? -Infinity)), [points]);

  const ageYears = useMemo(() => (demo?.age_national ?? []).slice().sort((a, b) => Number(a.year) - Number(b.year)), [demo]);
  const ageRows = useMemo(() => {
    const totals = ageYears.map((r) => ["00-17", "18-29", "30-44", "45-64", "65+"].reduce((a, k) => a + Number(r[k] ?? 0), 0));
    return ageYears.map((r, i) => ({
      year: String(r.year),
      young: totals[i] ? ((Number(r["18-29"]) + Number(r["30-44"])) / totals[i]) * 100 : null,
      senior: totals[i] ? (Number(r["65+"]) / totals[i]) * 100 : null,
    }));
  }, [ageYears]);

  if (err) return <ErrorBox message={err} />;
  if (!meta || !demo) return <Loading what="demografía provincial" />;

  const latestVintageNote = vintageStatus
    ? `Estados de vintage: ${vintageStatus.split("|").map((s, i) => `${["padrón", "EPA", "ADRH"][i] ?? i}: ${s}`).join(" · ")}`
    : "Vintage documentado por fila";

  const barOption = {
    grid: { ...gridBase, top: 24, bottom: 24, right: 56 },
    tooltip: {
      ...tooltipBase, trigger: "item",
      formatter: (p: { name?: string; value?: number }) =>
        `${p.name}<br/>${indMeta.label}: ${p.value == null ? "dato no disponible" : indMeta.kind === "count" ? fmtInt(p.value) : `${p.value.toFixed(2)} ${indMeta.unit}`}`,
    },
    xAxis: { type: "value", ...axisY, name: indMeta.unit, nameTextStyle: { color: "#78716c", fontSize: 10 } },
    yAxis: { type: "category", ...axisX, data: sorted.map((r) => nameOf(r.code)).reverse(), axisLabel: { color: "#57534e", fontSize: 10 } },
    series: [{
      type: "bar", barMaxWidth: 12,
      data: sorted.map((r) => ({ value: r.x, itemStyle: { color: "#0f766e", borderRadius: [0, 3, 3, 0] } })).reverse(),
    }],
  };

  const scatterOption = (corr: { r: number; n: number; pts: [number, number][]; names: string[] }, yName: string, color: string) => ({
    grid: { ...gridBase, top: 30 },
    tooltip: { ...tooltipBase, trigger: "item", formatter: (p: { name?: string; value?: [number, number] }) => `${nameOf(p.name ?? "")}<br/>${indMeta.label}: ${p.value?.[0]?.toFixed(2) ?? "—"}<br/>${yName}: ${p.value?.[1]?.toFixed(2) ?? "—"}` },
    xAxis: { type: "value", ...axisY, name: indMeta.label, nameTextStyle: { color: "#78716c", fontSize: 10 }, scale: true },
    yAxis: { type: "value", ...axisY, name: yName, nameTextStyle: { color: "#78716c", fontSize: 10 }, scale: true },
    series: [{
      type: "scatter", symbolSize: 9,
      data: corr.pts.map(([x, y], i) => ({ value: [x, y], name: corr.names[i] })),
      itemStyle: { color, opacity: 0.7 },
    }],
  });

  const ageOption = {
    grid: { ...gridBase, top: 30 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} %` },
    legend: { ...legendBase },
    xAxis: { type: "category", data: ageRows.map((r) => r.year), ...axisX },
    yAxis: { type: "value", ...axisY, name: "% de la población", nameTextStyle: { color: "#78716c", fontSize: 10 } },
    series: [
      { name: "18–44 años", type: "line", data: ageRows.map((r) => (r.young == null ? null : +r.young.toFixed(2))), itemStyle: { color: "#0f766e" }, lineStyle: { width: 2.4 }, areaStyle: { color: "rgba(15,118,110,0.08)" } },
      { name: "65+ años", type: "line", data: ageRows.map((r) => (r.senior == null ? null : +r.senior.toFixed(2))), itemStyle: { color: "#c2410c" }, lineStyle: { width: 2.4 } },
    ],
  };

  const valid = rows.filter((r) => r[ind] != null);
  const corrMatrix = [
    { pair: `Participación ${election.slice(0, 4)}`, value: corrTurnout.r, n: corrTurnout.n },
    { pair: "Cuota PP", value: corrPP.r, n: corrPP.n },
    { pair: "Cuota PSOE", value: corrPSOE.r, n: corrPSOE.n },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Contexto socioeconómico"
        title="Demografía y economía provincial"
        desc="Edad, población, mercado laboral y rentas por provincia, con el vintage de cada fuente visible. Residir no implica poder votar; la renta ADRH es un peso sobre la renta de los hogares, no una renta per cápita; la EPA es una encuesta, no el paro registrado."
        updated={meta.generated_at?.slice(0, 10)}
        sources={["INE (CC BY 4.0): padrón, EPA", "ADRH", "Ministerio del Interior"]}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
        <label className="text-sm">Elección:
          <select value={election} onChange={(e) => setElection(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Elección">
            {(demo.coverage ?? []).map((c) => <option key={String(c.target_election_date)} value={String(c.target_election_date)}>{String(c.target_election_date)}</option>)}
          </select>
        </label>
        <label className="text-sm">Indicador:
          <select value={ind} onChange={(e) => setInd(e.target.value as IndicatorKey)} className={`ml-1 ${selectClass}`} aria-label="Indicador">
            {INDICATORS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
          </select>
        </label>
        <Tag tone="info">Vintage: {vintage ?? "—"}</Tag>
        <CsvButton filename={`demografia_${election}_${ind}.csv`} rows={valid.map((r) => ({
          provincia: nameOf(r.province_code as string),
          codigo: r.province_code,
          indicador: ind,
          valor: r[ind],
          participacion: turnoutMap.get(r.province_code as string)?.turnout_rate ?? "",
          vintage_ref: r.vintage_ref,
        }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Provincias con dato" value={`${valid.length}/${rows.length}`} hint="Sin relleno hacia delante" />
        <StatCard label="Vintage aplicado" value={vintage ?? "—"} hint={latestVintageNote} />
        <StatCard label="Cobertura del indicador" value={coverage ? `${coverage[ind] ?? 0}/${coverage.n}` : "—"} hint={`Elección ${election}`} />
        <StatCard label="Elecciones con contexto" value={(demo.coverage ?? []).length} hint="1979–2023; 1977 no tiene covariables" />
      </div>

      <Card
        title={`${indMeta.label} por provincia`}
        subtitle={`${election} · ${valid.length} provincias con dato; los huecos no se imputan`}
      >
        <EChart option={barOption} height={560} ariaLabel={`${indMeta.label} por provincia`} testId="demografia-barras" />
        <Provenance items={["INE: padrón (36780), EPA, ADRH", latestVintageNote, "Nulos justificados: la fuente no publica ese año/ámbito"]} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Indicador vs participación" subtitle={`r = ${Number.isFinite(corrTurnout.r) ? corrTurnout.r.toFixed(2) : "—"} · n = ${corrTurnout.n}`} className="lg:col-span-1">
          {corrTurnout.n < 3 ? <Empty what="cobertura suficiente" /> : (
            <EChart option={scatterOption(corrTurnout, "Participación (%)", "#0f766e")} height={300} ariaLabel="Dispersión indicador y participación" testId="demografia-dispersion" />
          )}
          <Provenance items={["Interior (participación)", "Correlación ecológica: no implica causalidad ni describe individuos"]} />
        </Card>
        <Card title="Indicador vs cuota del PP" subtitle={`r = ${Number.isFinite(corrPP.r) ? corrPP.r.toFixed(2) : "—"} · n = ${corrPP.n}`} className="lg:col-span-1">
          {corrPP.n < 3 ? <Empty what="cobertura suficiente" /> : (
            <EChart option={scatterOption(corrPP, "Cuota PP (%)", "#1B5FCC")} height={300} ariaLabel="Dispersión indicador y cuota del PP" testId="demografia-pp" />
          )}
          <Provenance items={["Interior", "Cuota sobre votos a candidaturas provinciales"]} />
        </Card>
        <Card title="Indicador vs cuota del PSOE" subtitle={`r = ${Number.isFinite(corrPSOE.r) ? corrPSOE.r.toFixed(2) : "—"} · n = ${corrPSOE.n}`} className="lg:col-span-1">
          {corrPSOE.n < 3 ? <Empty what="cobertura suficiente" /> : (
            <EChart option={scatterOption(corrPSOE, "Cuota PSOE (%)", "#E30613")} height={300} ariaLabel="Dispersión indicador y cuota del PSOE" testId="demografia-psoe" />
          )}
          <Provenance items={["Interior", "Correlación ecológica, no individual"]} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Resumen de correlaciones" subtitle={`Indicador: ${indMeta.label}. Coeficiente de Pearson sobre provincias.`}>
          <table className="w-full text-sm">
            <caption className="sr-only">Correlaciones del indicador con participación y cuotas</caption>
            <thead>
              <tr className="border-b border-line text-left"><th className="p-2">Par</th><th className="p-2 text-right">r</th><th className="p-2 text-right">n</th><th className="p-2">Lectura</th></tr>
            </thead>
            <tbody className="tabular">
              {corrMatrix.map((c) => (
                <tr key={c.pair} className="border-b border-line">
                  <td className="p-2">{c.pair}</td>
                  <td className="p-2 text-right">{Number.isFinite(c.value) ? fmtDec(c.value, 2) : "—"}</td>
                  <td className="p-2 text-right">{c.n}</td>
                  <td className="p-2 text-xs text-stone-500">
                    {!Number.isFinite(c.value) ? "sin cobertura" : Math.abs(c.value) < 0.2 ? "muy débil" : Math.abs(c.value) < 0.4 ? "débil" : Math.abs(c.value) < 0.6 ? "moderada" : "fuerte"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Provenance items={["Cálculo propio sobre INE + Interior", "r describe asociación lineal entre provincias, no comportamiento individual"]} />
        </Card>

        <Card title="Estructura de edad nacional" subtitle="Peso de los grandes grupos de edad en la población">
          {ageRows.length === 0 ? <Empty what="estructura de edad" /> : (
            <EChart option={ageOption} height={300} ariaLabel="Evolución del peso de los grupos de edad" testId="demografia-edad" />
          )}
          <Provenance items={["INE, proyecciones/estimaciones de población", "Serie nacional, no provincial"]} />
        </Card>
      </div>

      <Card title={`Provincias ordenadas · ${indMeta.label}`} subtitle={`Elección ${election} · orden descendente`}>
        <div className="max-h-[440px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Provincias y valor del indicador</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line text-left">
                <th className="p-2">#</th><th className="p-2">Provincia</th>
                <th className="p-2 text-right">{indMeta.label}</th>
                <th className="p-2 text-right">Participación</th>
                <th className="p-2 text-right">Cuota PP</th><th className="p-2 text-right">Cuota PSOE</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {sorted.map((r, i) => (
                <tr key={r.code} className="border-b border-line">
                  <td className="p-2 text-stone-400">{i + 1}</td>
                  <td className="p-2">{nameOf(r.code)}</td>
                  <td className="p-2 text-right">{r.x == null ? "—" : indMeta.kind === "count" ? fmtInt(r.x) : fmtDec(r.x, 2)}</td>
                  <td className="p-2 text-right">{r.turnout == null ? "—" : fmtPct(r.turnout, 1)}</td>
                  <td className="p-2 text-right">{r.pp == null ? "—" : fmtPct(r.pp, 1)}</td>
                  <td className="p-2 text-right">{r.psoe == null ? "—" : fmtPct(r.psoe, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Provenance items={["INE + Interior", "Cada fila es una provincia; no hay datos individuales"]} />
      </Card>
    </div>
  );
}
