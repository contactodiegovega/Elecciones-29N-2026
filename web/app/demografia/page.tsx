"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance, SectionTitle } from "@/components/ui";
import { loadDemography, loadMeta, loadTerritories, loadTurnout, type Meta, type Territory, type TurnoutRow } from "@/lib/data";

const INDICATORS: { key: string; label: string; unit: string }[] = [
  { key: "share_18_29", label: "% residentes 18–29", unit: "% residentes (padrón vintage)" },
  { key: "share_30_44", label: "% residentes 30–44", unit: "% residentes (padrón vintage)" },
  { key: "share_45_64", label: "% residentes 45–64", unit: "% residentes (padrón vintage)" },
  { key: "share_65plus", label: "% residentes 65+", unit: "% residentes (padrón vintage)" },
  { key: "share_foreign", label: "% residentes extranjeros", unit: "% residentes (padrón vintage)" },
  { key: "unemployment_rate", label: "Tasa de paro EPA", unit: "% (EPA, Ambos sexos)" },
  { key: "activity_rate", label: "Tasa de actividad EPA", unit: "% (EPA, Ambos sexos)" },
  { key: "employment_rate", label: "Tasa de empleo EPA", unit: "% (EPA, Ambos sexos)" },
  { key: "adrh_wages", label: "% renta salarial (ADRH)", unit: "% renta hogares" },
  { key: "adrh_pensions", label: "% renta pensiones (ADRH)", unit: "% renta hogares" },
  { key: "pop_growth_yoy", label: "Crec. padrón interanual", unit: "%" },
];

type DemoRow = Record<string, number | string | null>;

export default function Demografia() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [turnout, setTurnout] = useState<TurnoutRow[]>([]);
  const [election, setElection] = useState("2023-07-23");
  const [ind, setInd] = useState("unemployment_rate");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadDemography(), loadTerritories(), loadTurnout()])
      .then(([m, d, t, to]) => {
        setMeta(m);
        setRows(d as DemoRow[]);
        setTerr(t); setTurnout(to);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const nameOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_name_interior]));
    return (c: string) => m.get(c) ?? c;
  }, [terr]);

  const sub = useMemo(() => rows.filter((r) => r.target_election_date === election), [rows, election]);
  const vintage = sub[0]?.vintage_ref as string | undefined;
  const indMeta = INDICATORS.find((i) => i.key === ind)!;

  const corr = useMemo(() => {
    const t = new Map(turnout.filter((x) => x.election_date === election).map((x) => [x.province_code, x.turnout_rate]));
    const pts = sub.map((r) => [r[ind], t.get(r.province_code as string)])
      .filter(([x, y]) => x != null && y != null) as [number, number][];
    if (pts.length < 3) return null;
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const cov = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
    const sx = Math.sqrt(pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0));
    const sy = Math.sqrt(pts.reduce((a, p) => a + (p[1] - my) ** 2, 0));
    return { r: sx && sy ? cov / (sx * sy) : NaN, n: pts.length, pts };
  }, [sub, turnout, election, ind]);

  if (err) return <Empty what={err} />;
  if (!meta) return <p role="status">Cargando demografía…</p>;

  const bars = [...sub].sort((a, b) => ((b[ind] as number) ?? -1) - ((a[ind] as number) ?? -1));
  const barOpt = {
    tooltip: { trigger: "item" as const },
    xAxis: { type: "value" as const, name: indMeta.unit },
    yAxis: { type: "category" as const, data: bars.map((r) => nameOf(r.province_code as string)), inverse: true },
    series: [{
      type: "bar" as const,
      data: bars.map((r) => (r[ind] == null ? null : { value: r[ind], itemStyle: { color: "#0f766e" } })),
    }],
  };
  const scatOpt = corr ? {
    tooltip: { trigger: "item" as const },
    xAxis: { type: "value" as const, name: indMeta.unit },
    yAxis: { type: "value" as const, name: "Participación (%)" },
    series: [{
      type: "scatter" as const,
      data: corr.pts.map(([x, y], i) => ({ value: [x, y], name: nameOf(sub[i]?.province_code as string ?? "") })),
    }],
  } : null;

  const valid = sub.filter((r) => r[ind] != null);

  return (
    <div>
      <SectionTitle kicker="Contexto" title="Demografía y economía provincial"
        desc="Edad × provincia × elección con vintage visible. Residente no implica derecho a voto; renta ADRH es % por fuente (no per cápita); EPA es encuesta (no paro registrado)." />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">Elección (vintage): <select value={election} onChange={(e) => setElection(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Elección">
          {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
        <label className="text-sm">Indicador: <select value={ind} onChange={(e) => setInd(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Indicador">
          {INDICATORS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select></label>
        <button type="button" onClick={() => { setElection("2023-07-23"); setInd("unemployment_rate"); }}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
        <CsvButton filename={`demografia_${election}_${ind}.csv`} rows={valid} />
      </div>
      <p className="mb-3 text-sm text-stone-600" role="status">
        Vintage aplicado: <strong>{vintage ?? "—"}</strong> · {valid.length}/52 provincias con dato
        {valid.length < 52 && " (nulos justificados, sin forward-fill)"}.
      </p>
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-serif text-xl">{indMeta.label} por provincia ({election})</h2>
        <EChart option={barOpt} height={560} ariaLabel={`${indMeta.label} por provincia`} />
      </div>
      <div className="mt-4 rounded-lg border border-line bg-white p-4">
        <h2 className="font-serif text-xl">Dispersión vs participación ({election})</h2>
        {scatOpt && corr ? (
          <>
            <EChart option={scatOpt} height={380}
              ariaLabel={`Dispersión con r igual a ${corr.r.toFixed(2)} en ${corr.n} provincias`} />
            <p className="mt-2 text-sm text-stone-600">
              r = {corr.r.toFixed(2)} (n = {corr.n}). <strong>Correlación ecológica: no implica
                causalidad</strong> ni dice cómo vota ningún individuo.
            </p>
          </>
        ) : <Empty what="dispersión (sin cobertura suficiente en esta elección)" />}
        <Provenance items={["INE 36780/72989/53687 (CC BY, citar INE) + Interior",
          "Vintage por fila en vintage_ref/vintage_status; nulos justificados"]} />
      </div>
    </div>
  );
}
