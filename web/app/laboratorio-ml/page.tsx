"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance, SectionTitle } from "@/components/ui";
import { loadML, loadOOS, loadTerritories, type Territory } from "@/lib/data";
import { fmtPp } from "@/lib/utils";

type ML = {
  folds: string[]; phase3_macro: Record<string, number>;
  phase3_by_election: { test_election: string; model: string; MAE_pp: number; RMSE_pp: number; bias_pp: number; n_train_rows: number }[];
  phase4_macro: Record<string, number>;
  phase4_by_election: { test_election: string; model: string; MAE_pp: number; RMSE_pp: number; bias_pp: number }[];
  verdict: string;
};
type OOS = { test_election: string; province: string; model: string; error_pp: number };

export default function Laboratorio() {
  const [ml, setML] = useState<ML | null>(null);
  const [oos, setOOS] = useState<OOS[]>([]);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [election, setElection] = useState("2023-07-23");
  const [model, setModel] = useState("mean3");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadML(), loadOOS(), loadTerritories()])
      .then(([m, o, t]) => { setML(m as unknown as ML); setOOS(o); setTerr(t); })
      .catch((e) => setErr(String(e)));
  }, []);

  const nameOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_name_interior]));
    return (c: string) => m.get(c) ?? c;
  }, [terr]);

  if (err) return <Empty what={err} />;
  if (!ml) return <p role="status">Cargando laboratorio…</p>;

  const models3 = ["last_election", "mean3", "trend1", "ridge", "elasticnet", "hgbr"];
  const opt = {
    tooltip: { trigger: "axis" as const, valueFormatter: (v: number) => `${v} pp` },
    legend: { type: "scroll" as const, bottom: 0 },
    xAxis: { type: "category" as const, data: ml.folds.map((f) => f.slice(0, 7)) },
    yAxis: { type: "value" as const, name: "MAE (pp)" },
    series: [
      ...models3.filter((m) => ml.phase3_by_election.some((r) => r.model === m)).map((m) => ({
        name: `${m} (f3)`, type: "line" as const,
        data: ml.folds.map((f) => ml.phase3_by_election.find((r) => r.test_election === f && r.model === m)?.MAE_pp ?? null),
        lineStyle: { type: "dashed" as const },
      })),
      ...["ridge_full", "hgbr_full"].map((m) => ({
        name: `${m} (f4)`, type: "line" as const, linewidth: 2.5,
        data: ml.folds.map((f) => ml.phase4_by_election.find((r) => r.test_election === f && r.model === m)?.MAE_pp ?? null),
      })),
    ],
  };

  const errs = oos.filter((r) => r.test_election === election && r.model === model)
    .sort((a, b) => a.error_pp - b.error_pp);
  const mapOpt = {
    tooltip: { trigger: "item" as const },
    xAxis: { type: "category" as const, data: errs.map((r) => nameOf(r.province)) },
    yAxis: { type: "value" as const, name: "Error OOS (pp)" },
    series: [{
      type: "bar" as const,
      data: errs.map((r) => ({ value: +r.error_pp.toFixed(2), itemStyle: { color: r.error_pp >= 0 ? "#b45309" : "#0f766e" } })),
    }],
  };

  return (
    <div>
      <SectionTitle kicker="Ciencia" title="Laboratorio ML: backtesting retrospectivo"
        desc="¿Qué error habría tenido cada método antes de cada elección ya celebrada? 52 provincias de un mismo ciclo no son 52 experimentos independientes (n=6 elecciones de test)." />
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm" role="note">
        <strong>Veredicto real: {ml.verdict}</strong> Macro fase 3: mean3 {ml.phase3_macro["mean3"]?.toFixed(2)} pp ·
        fase 4: ridge_full {ml.phase4_macro["ridge_full"]?.toFixed(2)}, hgbr_full {ml.phase4_macro["hgbr_full"]?.toFixed(2)} pp.
        Ningún pronóstico del 29N-2026.
      </div>
      <div className="mt-4 rounded-lg border border-line bg-white p-4">
        <h2 className="font-serif text-xl">MAE por fold: fase 3 vs fase 4</h2>
        <EChart option={opt} height={400} ariaLabel="MAE por elección retenida, modelos fase 3 y 4" />
        <Provenance items={["reports/tables/phase3/turnout_backtest.csv y phase4/ml_revalidation.csv (valores importados, no literales)",
          "Expanding window; preproceso ajustado solo en train; semilla 42"]} />
      </div>
      <h2 className="mb-2 mt-8 font-serif text-2xl">Mapa del error OOS por provincia</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">Elección: <select value={election} onChange={(e) => setElection(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Elección de test">
          {ml.folds.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
        <label className="text-sm">Modelo: <select value={model} onChange={(e) => setModel(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Modelo">
          {["mean3", "ridge"].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <CsvButton filename={`oos_${election}_${model}.csv`} rows={errs as unknown as Record<string, unknown>[]} />
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <EChart option={mapOpt} height={480} ariaLabel={`Errores fuera de muestra por provincia en ${election}`} />
        <Provenance items={["Predicciones fuera de muestra (nunca datos entrenados como test)", "Marrón = sobrestima participación; verde azulado = infraestima"]} />
      </div>
      <section aria-label="Vintage y límites" className="mt-6 rounded-lg border border-line bg-white p-4 text-sm text-stone-700">
        <h2 className="font-serif text-xl text-ink">Vintage, leakage y límites</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Regla temporal:</strong> solo datos publicados antes del corte (<code>as_of_date</code>); padrón año−1, EPA fin+45d, ADRH año−2 (asumido).</li>
          <li><strong>Fuga corregida en fase 4:</strong> tres columnas usaban el target; desplazadas a pasado estricto y verificadas.</li>
          <li><strong>Corrector de encuestas NO validado:</strong> una sola elección etiquetada (2023).</li>
          <li><strong>Voto por partido:</strong> piloto PSOE sin valor demostrado (3,48 vs 4,88 pp); resto descriptivo.</li>
          <li><strong>MAE, RMSE en puntos porcentuales</strong>; macro = cada elección cuenta una vez.</li>
        </ul>
      </section>
    </div>
  );
}
