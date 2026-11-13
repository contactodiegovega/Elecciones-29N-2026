"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Notice, Provenance, SectionTitle,
  StatCard, Tag, selectClass,
} from "@/components/ui";
import { loadML, loadMLGate, loadOOS, loadTerritories, type ML, type OOSPoint, type Territory } from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtDec, fmtPp } from "@/lib/utils";

const PHASE3 = ["last_election", "mean3", "trend1", "ridge", "elasticnet", "hgbr"];
const PHASE4 = ["ridge_full", "hgbr_full"];
const MODEL_COLORS: Record<string, string> = {
  last_election: "#a8a29e", mean3: "#14213d", trend1: "#c2410c",
  ridge: "#7c3aed", elasticnet: "#0f766e", hgbr: "#b45309",
  ridge_full: "#3b82f6", hgbr_full: "#be123c",
};

type Gate = Awaited<ReturnType<typeof loadMLGate>>;

export default function Laboratorio() {
  const [ml, setML] = useState<ML | null>(null);
  const [oos, setOOS] = useState<OOSPoint[]>([]);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [gate, setGate] = useState<Gate | null>(null);
  const [election, setElection] = useState("2023-07-23");
  const [model, setModel] = useState("mean3");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadML(), loadOOS(), loadTerritories(), loadMLGate()])
      .then(([m, o, t, g]) => { setML(m); setOOS(o); setTerr(t); setGate(g); })
      .catch((e) => setErr(String(e)));
  }, []);

  const nameOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_name_interior]));
    return (c: string) => m.get(c) ?? c;
  }, [terr]);

  const codeOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_code]));
    return (v: string | number) => {
      const s = String(v).padStart(2, "0");
      return m.has(s) ? s : s;
    };
  }, [terr]);

  const macroRows = useMemo(() => {
    if (!ml) return [];
    return [
      ...Object.entries(ml.phase3_macro).map(([m, v]) => ({ model: m, phase: "Fase 3", mae: v })),
      ...Object.entries(ml.phase4_macro).map(([m, v]) => ({ model: m, phase: "Fase 4", mae: v })),
    ].sort((a, b) => a.mae - b.mae);
  }, [ml]);

  const macroOption = macroRows.length ? {
    grid: { ...gridBase, top: 20, bottom: 24, right: 48 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v.toFixed(3)} pp` },
    xAxis: { type: "value", ...axisY, name: "MAE macro (pp)" },
    yAxis: { type: "category", ...axisX, data: macroRows.map((r) => r.model).reverse() },
    series: [{
      type: "bar", barMaxWidth: 16,
      data: [...macroRows].reverse().map((r) => ({
        value: r.mae, itemStyle: { color: MODEL_COLORS[r.model] ?? "#57534e", borderRadius: [0, 3, 3, 0] },
      })),
      label: { show: true, position: "right", formatter: (p: { value?: number }) => (p.value ?? 0).toFixed(2), fontSize: 11, color: "#57534e" },
      markLine: {
        silent: true, symbol: "none",
        data: [{ xAxis: ml?.phase3_macro["mean3"] ?? 3.563 }],
        lineStyle: { color: "#c2410c", type: "dashed" },
        label: { formatter: "baseline mean3", fontSize: 10, color: "#c2410c" },
      },
    }],
  } : null;

  const foldOption = ml ? {
    grid: { ...gridBase, top: 30 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} pp MAE` },
    legend: { ...legendBase },
    xAxis: { type: "category", data: ml.folds.map((f) => f.slice(0, 4)), ...axisX },
    yAxis: { type: "value", ...axisY, name: "MAE (pp)", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: [
      ...PHASE3.map((m) => ({
        name: m, type: "line", connectNulls: false, symbolSize: 4,
        data: ml.folds.map((f) => ml.phase3_by_election.find((r) => r.test_election === f && r.model === m)?.MAE_pp ?? null),
        itemStyle: { color: MODEL_COLORS[m] }, lineStyle: { width: 1.7 },
      })),
      ...PHASE4.map((m) => ({
        name: m, type: "line", connectNulls: false, symbolSize: 5,
        data: ml.folds.map((f) => ml.phase4_by_election.find((r) => r.test_election === f && r.model === m)?.MAE_pp ?? null),
        itemStyle: { color: MODEL_COLORS[m] }, lineStyle: { width: 2.6, type: "dashed" as const },
      })),
    ],
  } : null;

  const errs = useMemo(
    () => oos.filter((r) => r.test_election === election && r.model === model).sort((a, b) => a.error_pp - b.error_pp),
    [oos, election, model],
  );

  const barOption = errs.length ? {
    grid: { ...gridBase, top: 20, bottom: 64 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v.toFixed(2)} pp` },
    xAxis: { type: "category", data: errs.map((r) => nameOf(codeOf(r.province))), ...axisX, axisLabel: { rotate: 60, fontSize: 9, color: "#57534e" } },
    yAxis: { type: "value", ...axisY, name: "error OOS (pp)", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: [{
      type: "bar",
      data: errs.map((r) => ({ value: +r.error_pp.toFixed(2), itemStyle: { color: r.error_pp >= 0 ? "#b45309" : "#0f766e" } })),
      markLine: { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: "#a8a29e" }, label: { show: false } },
    }],
  } : null;

  const heatOption = useMemo(() => {
    if (!ml) return null;
    const provinces = [...new Set(oos.filter((r) => r.model === model).map((r) => codeOf(r.province)))].sort();
    const data: [number, number, number][] = [];
    ml.folds.forEach((f, xi) => {
      provinces.forEach((p, yi) => {
        const row = oos.find((r) => r.test_election === f && r.model === model && codeOf(r.province) === p);
        if (row) data.push([xi, yi, +row.error_pp.toFixed(2)]);
      });
    });
    const absMax = Math.max(1, ...data.map((d) => Math.abs(d[2])));
    return {
      grid: { ...gridBase, top: 16, bottom: 40, left: 40, right: 24 },
      tooltip: {
        ...tooltipBase, trigger: "item",
        formatter: (p: { value?: [number, number, number] }) =>
          `${nameOf(provinces[p.value?.[1] ?? 0])} · ${ml.folds[p.value?.[0] ?? 0]}<br/>error: ${p.value?.[2]} pp`,
      },
      xAxis: { type: "category", data: ml.folds.map((f) => f.slice(0, 4)), ...axisX, splitArea: { show: false } },
      yAxis: { type: "category", data: provinces.map((p) => nameOf(p)), ...axisX, axisLabel: { fontSize: 8, color: "#57534e" } },
      visualMap: {
        min: -absMax, max: absMax, calculable: true, orient: "horizontal", left: "center", bottom: 0,
        inRange: { color: ["#0f766e", "#f5f5f4", "#b45309"] },
        textStyle: { color: "#57534e", fontSize: 10 },
      },
      series: [{
        type: "heatmap", data,
        emphasis: { itemStyle: { borderColor: "#14213d", borderWidth: 1 } },
        progressive: 200,
      }],
    };
  }, [ml, oos, model, nameOf, codeOf]);

  if (err) return <ErrorBox message={err} />;
  if (!ml) return <Loading what="resultados del laboratorio" />;

  const best = macroRows[0];
  const phase3Best = macroRows.filter((r) => r.phase === "Fase 3")[0];

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Ciencia · evaluación retrospectiva"
        title="Laboratorio ML: backtesting honesto"
        desc="¿Qué error habría tenido cada método antes de cada elección ya celebrada? Ventana expansiva, preproceso ajustado solo en entrenamiento y ninguna predicción del 29N. Las 52 provincias de un mismo ciclo no son 52 experimentos independientes: el n real es de 6 elecciones retenidas."
        updated={gate?.generated_at.slice(0, 10)}
        sources={["Interior", "INE", "ADRH", "Resultados propios del pipeline"]}
      />

      <Notice title={`Veredicto: ${ml.verdict}`}>
        Ningún modelo complejo demuestra superioridad consistente fuera de muestra. Mejor MAE macro global:{" "}
        <strong>{best?.model}</strong> con {fmtDec(best?.mae, 2)} pp. Productos de pronóstico:{" "}
        <strong>no permitidos</strong> por la compuerta de calidad.
      </Notice>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Mejor MAE macro" value={best ? `${fmtDec(best.mae, 2)} pp` : "—"} hint={best?.model} />
        <StatCard label="Baseline mean3" value={`${fmtDec(ml.phase3_macro["mean3"], 2)} pp`} hint="Referencia a batir" />
        <StatCard label="Folds retenidos" value={ml.folds.length} hint={`${ml.folds[0]} → ${ml.folds[ml.folds.length - 1]}`} />
        <StatCard label="Errores OOS" value={fmtDec(oos.length, 0)} hint={`${new Set(oos.map((o) => o.model)).size} modelos provinciales`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="MAE macro por modelo" subtitle="Cada elección pesa una vez; menor es mejor">
          {!macroOption ? <Empty what="métricas macro" /> : (
            <EChart option={macroOption} height={380} ariaLabel="MAE macro por modelo" testId="ml-macro" />
          )}
          <Provenance items={["phase3_macro y phase4_macro de ml.json", "Fase 3: 6 modelos; fase 4: 2 modelos enriquecidos", "Macro ≠ media de provincias: media de elecciones"]} />
        </Card>
        <Card title="MAE por elección retenida" subtitle="Un punto por fold. Línea discontinua = fase 4">
          {!foldOption ? <Empty what="folds" /> : (
            <EChart option={foldOption} height={380} ariaLabel="MAE por fold y modelo" testId="ml-folds" />
          )}
          <Provenance items={["phase3_by_election / phase4_by_election", "Huecos: modelo no evaluado en ese fold", "Semilla y preproceso documentados en metodología"]} />
        </Card>
      </div>

      {gate && (
        <Card title="Compuerta de calidad (gate)" subtitle="Decisión explícita sobre qué se puede publicar">
          <div className="grid gap-3 md:grid-cols-3">
            {[gate.poll_correction, gate.turnout_projection].map((g, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{i === 0 ? "Corrector de encuestas" : "Proyección de participación"}</p>
                  <Tag tone={g.verdict === "GO" ? "good" : "warn"}>{g.verdict}</Tag>
                </div>
                <p className="mt-1 text-sm text-stone-600">{g.reason}</p>
              </div>
            ))}
            <div className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Proyección por partido 2026</p>
                <Tag tone="warn">{gate.party_projection_2026.verdict}</Tag>
              </div>
              <p className="mt-1 text-sm text-stone-600">{gate.party_projection_2026.reason}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">Permitido</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-emerald-900">{gate.allowed_products.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-900">Prohibido</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-900">{gate.forbidden_products.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          </div>
          <Provenance items={[`Gate generado: ${fmtDate(gate.generated_at.slice(0, 10))}`, `Proyección pública permitida: ${gate.public_projection_allowed ? "sí" : "no"}`]} />
        </Card>
      )}

      <Card title="Error fuera de muestra por provincia" subtitle="Provincia × elección retenida. Marrón sobrestima; verde azulado infraestima.">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm">Modelo:
            <select value={model} onChange={(e) => setModel(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Modelo">
              {["mean3", "ridge"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-sm">Elección:
            <select value={election} onChange={(e) => setElection(e.target.value)} className={`ml-1 ${selectClass}`} aria-label="Elección de test">
              {ml.folds.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <CsvButton filename={`oos_${election}_${model}.csv`} rows={errs.map((r) => ({
            eleccion: r.test_election, provincia: nameOf(codeOf(r.province)), codigo: codeOf(r.province),
            modelo: r.model, error_pp: r.error_pp,
          }))} />
        </div>
        {heatOption && <EChart option={heatOption} height={Math.max(420, new Set(oos.map((o) => o.province)).size * 11)} ariaLabel="Mapa de calor de errores fuera de muestra" testId="ml-heatmap" />}
        <div className="mt-4">
          {!barOption ? <Empty what="errores de esta elección" /> : (
            <EChart option={barOption} height={300} ariaLabel={`Errores fuera de muestra por provincia en ${election}`} testId="ml-provincias" />
          )}
        </div>
        <Provenance items={["Predicciones fuera de muestra: nunca se entrena con el año de test", "El error es en puntos porcentuales de participación", "Provincias ordenadas de menor a mayor error"]} />
      </Card>

      <Card title="Comparación detallada de folds" subtitle="MAE, RMSE y sesgo por modelo y elección retenida">
        <div className="max-h-[440px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Métricas por fold y modelo</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line text-left">
                <th className="p-2">Elección</th><th className="p-2">Fase</th><th className="p-2">Modelo</th>
                <th className="p-2 text-right">MAE</th><th className="p-2 text-right">RMSE</th><th className="p-2 text-right">Sesgo</th>
                <th className="p-2 text-right">n train</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...ml.phase3_by_election.map((r) => ({ ...r, phase: "3" })), ...ml.phase4_by_election.map((r) => ({ ...r, phase: "4" }))]
                .sort((a, b) => a.test_election.localeCompare(b.test_election) || a.MAE_pp - b.MAE_pp)
                .map((r, i) => (
                  <tr key={`${r.test_election}-${r.model}-${i}`} className="border-b border-line">
                    <td className="p-2">{r.test_election}</td>
                    <td className="p-2 text-stone-500">{r.phase}</td>
                    <td className="p-2">{r.model}</td>
                    <td className="p-2 text-right font-medium">{fmtDec(r.MAE_pp, 2)}</td>
                    <td className="p-2 text-right">{fmtDec(r.RMSE_pp, 2)}</td>
                    <td className={`p-2 text-right ${r.bias_pp >= 0 ? "text-amber-700" : "text-teal-700"}`}>{fmtPp(r.bias_pp, 2)}</td>
                    <td className="p-2 text-right">{r.n_train_rows ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Provenance items={["ml.json (importado de reports/tables)", "Bias positivo = sobrestima la participación", "n train son filas provinciales, no elecciones independientes"]} />
      </Card>

      <Card title="Vintage, fuga y límites" subtitle="Lo que el laboratorio corrige y lo que no puede afirmar">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li><strong>Regla temporal:</strong> solo datos publicados antes del corte; padrón año −1, EPA fin +45 días, ADRH año −2 asumido.</li>
          <li><strong>Fuga corregida en fase 4:</strong> tres columnas usaban información del objetivo; se desplazaron a pasado estricto y se verificaron.</li>
          <li><strong>Corrector de encuestas no validado:</strong> solo hay una elección etiquetada (2023); se requieren tres para un GO.</li>
          <li><strong>Voto por partido:</strong> piloto PSOE sin ventaja demostrada (3,48 vs 4,88 pp); el resto es descriptivo.</li>
          <li><strong>MAE y RMSE en puntos porcentuales;</strong> el macro cuenta cada elección una vez, no cada provincia.</li>
          <li><strong>n = 6 folds:</strong> con seis observaciones no se puede declarar superioridad estadística robusta.</li>
        </ul>
        <Provenance items={["ml_gate.json", "Documentación de fases 3 y 4", "Ninguna cifra de esta página es un pronóstico del 29N"]} />
      </Card>
    </div>
  );
}
