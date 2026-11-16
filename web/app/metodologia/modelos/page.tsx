"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { Card, ErrorBox, LinkCard, Loading, Notice, Provenance, SectionTitle, StatCard, Tag } from "@/components/ui";
import { loadModelRegistry, type ModelRegistry, type ModelVersion } from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtDate } from "@/lib/utils";

export default function RegistroModelos() {
  const [reg, setReg] = useState<ModelRegistry | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("f3-mean3");

  useEffect(() => {
    loadModelRegistry().then(setReg).catch((e) => setErr(String(e)));
  }, []);

  const byElection = useMemo(() => {
    if (!reg) return [];
    const baseline = reg.versions.find((v) => v.version_id === "f3-mean3");
    const ml = reg.versions.find((v) => v.version_id === "f4-hgbr_full");
    if (!baseline || !ml) return [];
    return baseline.metrics.by_election.map((row) => ({
      election: row.test_election,
      baseline: row.MAE_pp,
      ml: ml.metrics.by_election.find((m) => m.test_election === row.test_election)?.MAE_pp ?? null,
    }));
  }, [reg]);

  if (err) return <ErrorBox message={err} />;
  if (!reg) return <Loading what="el registro de modelos" />;

  const detail = reg.versions.find((v) => v.version_id === selected) ?? reg.versions[0];
  const experimentalCount = reg.versions.filter((v) => v.status === "experimental").length;

  const option = {
    grid: { ...gridBase, top: 48 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} pp` },
    legend: { ...legendBase, data: ["Media de las 3 últimas", "Mejor ML (fase 4)"] },
    xAxis: { type: "category", data: byElection.map((r) => r.election.slice(0, 4)), ...axisX },
    yAxis: { type: "value", ...axisY, name: "error MAE (pp)", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: [
      {
        name: "Media de las 3 últimas", type: "bar", barMaxWidth: 22,
        data: byElection.map((r) => r.baseline), itemStyle: { color: "#0f766e", borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: "top", fontSize: 10, color: "#57534e" },
      },
      {
        name: "Mejor ML (fase 4)", type: "bar", barMaxWidth: 22,
        data: byElection.map((r) => r.ml), itemStyle: { color: "#94a3b8", borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: "top", fontSize: 10, color: "#57534e" },
      },
    ],
  };

  return (
    <div className="space-y-7">
      <SectionTitle
        kicker="Metodología · Laboratorio histórico"
        title="Registro de experimentos de participación"
        desc="Archivo de modelos de participación provincial: versiones, cortes temporales y errores en elecciones históricas. El backtest compara cada experimento con una media simple de elecciones anteriores."
        updated={fmtDate(reg.as_of)}
        sources={["Backtest rolling-origin 2011–2023", "6 elecciones retenidas", "Registro de 8 versiones"]}
      />

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="warn">Gate {reg.status.toUpperCase()}</Tag>
          <Tag tone="warn">Proyección 2026: no permitida</Tag>
        </div>
        <h2 className="mt-3 font-serif text-2xl text-ink md:text-3xl">{reg.headline}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-stone-700">{reg.reason}</p>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-stone-700">{reg.scope_note}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Baseline</p>
            <p className="mt-1 font-serif text-2xl text-ink">{reg.best_baseline.mae_macro_pp.toFixed(2)} pp</p>
            <p className="text-xs text-stone-500">Error macro de la media de 3 elecciones</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Mejor experimento</p>
            <p className="mt-1 font-serif text-2xl text-ink">{reg.best_experimental.mae_macro_pp.toFixed(2)} pp</p>
            <p className="text-xs text-stone-500">{reg.versions.find((v) => v.version_id === reg.best_experimental.version_id)?.label}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Elecciones de test</p>
            <p className="mt-1 font-serif text-2xl text-ink">6</p>
            <p className="text-xs text-stone-500">Suficiente para auditar, no para calibrar probabilidades</p>
          </div>
        </div>
      </section>

      <Notice title="Qué estudian estos experimentos" tone="info">
        Las versiones registradas estiman <strong>participación provincial</strong>, no escaños por partido. No existe
        un modelo validado de voto por formación para 2026: solo hay una elección histórica con encuestas etiquetadas
        y ninguna con resultados de 2026. Publicar escaños sería inventar precisión.
      </Notice>

      <Card title="Error de cada versión" subtitle="MAE medio en puntos porcentuales sobre participación. Menos es mejor.">
        <EChart option={option} height={340} ariaLabel="Error por elección de la media de 3 elecciones frente al mejor modelo" testId="prediccion-error" />
        <Provenance items={[
          "Cada barra es una elección retenida del backtest; no son resultados de 2026",
          "MAE = error absoluto medio en puntos porcentuales",
          "El gráfico compara una referencia simple con el mejor ML de fase 4",
        ]} />
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-serif text-2xl text-ink">Registro de versiones</h2>
            <p className="mt-1 text-sm text-stone-500">Cada fila es una versión ya ejecutada. Selecciona una para ver su configuración y resultados.</p>
          </div>
          <Tag>{reg.versions.length} versiones · {experimentalCount} experimentales</Tag>
        </div>
        <div className="overflow-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Versiones del modelo con su error y estado</caption>
            <thead className="bg-stone-50">
              <tr className="border-b border-line text-left">
                <th className="p-3">Versión</th>
                <th className="p-3">Fase</th>
                <th className="p-3">Objetivo</th>
                <th className="p-3 text-right">MAE macro</th>
                <th className="p-3 text-right">Folds</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {reg.versions.map((v) => (
                <tr key={v.version_id} className={`border-b border-line ${selected === v.version_id ? "bg-amber-50/60" : ""}`}>
                  <td className="p-3">
                    <span className="font-medium text-ink">{v.label}</span>
                    <span className="block text-xs text-stone-400">{v.version_id}</span>
                  </td>
                  <td className="p-3 text-stone-600">{v.phase}</td>
                  <td className="p-3 text-stone-600">Participación</td>
                  <td className="p-3 text-right tabular font-medium">{v.metrics.mae_macro_pp.toFixed(3)}</td>
                  <td className="p-3 text-right tabular text-stone-600">{v.metrics.n_folds}</td>
                  <td className="p-3"><Tag tone={v.status === "baseline" ? "good" : "info"}>{v.status}</Tag></td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => setSelected(v.version_id)} className="text-sm underline underline-offset-2 hover:text-accent">
                      ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <VersionDetail version={detail} />

      <section className="grid gap-5 lg:grid-cols-2">
        <Card title="Cómo se evalúa" subtitle="Sin fuga temporal y con elecciones retenidas">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
            <li>Se elige una elección como test y se entrena solo con las anteriores.</li>
            <li>Se repite para 2011, 2015, 2016, 2019A, 2019N y 2023.</li>
            <li>Se mide el error absoluto medio en puntos porcentuales por provincia.</li>
            <li>Se compara con referencias simples: repetir la elección anterior o promediar las tres últimas.</li>
            <li>Ningún ajuste usa los resultados del 29N: no existen todavía.</li>
          </ol>
          <Provenance items={["Configuración congelada en config/ml_phase3.json y ml_phase4.json", "Semilla 42", "n=6 elecciones: sin intervalos por bloques"]} />
        </Card>
        <Card title="Qué haría falta para publicar" subtitle="Condiciones explícitas, no una promesa">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
            {reg.required_to_reopen.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <Provenance items={["El gate se revisa antes de cualquier cambio editorial", "Una proyección no es un titular: exige validación y revisión jurídica"]} />
        </Card>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <LinkCard href="/simulador" title="Probar un escenario" desc="Tú pones los porcentajes; el motor reparte los 350 escaños con D'Hondt." meta="Hipotético" />
        <LinkCard href="/que-pasaria-si" title="Explorar escenarios" desc="Compara cambios hipotéticos con los resultados oficiales de 2023." meta="Cálculos, no pronósticos" />
        <LinkCard href="/laboratorio-ml" title="Laboratorio técnico" desc="Tablas completas de error, ablaciones y auditoría temporal." meta="Investigación" />
      </div>
    </div>
  );
}

function VersionDetail({ version }: { version: ModelVersion }) {
  return (
    <Card title={`Detalle · ${version.label}`} subtitle={`${version.phase} · creada el ${fmtDate(version.created_at)} · objetivo: ${version.target === "turnout_pct" ? "participación" : version.target}`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-sm leading-relaxed text-stone-600">{version.note}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-stone-500">Corte</dt><dd className="mt-0.5 text-stone-700">{version.data_cutoff}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-stone-500">MAE macro</dt><dd className="mt-0.5 tabular font-medium">{version.metrics.mae_macro_pp.toFixed(3)} pp</dd></div>
          </dl>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">Entradas ({version.inputs.length})</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {version.inputs.map((i) => <span key={i} className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">{i}</span>)}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">Configuración</p>
          <pre className="mt-1 overflow-auto rounded-lg bg-stone-50 p-2 text-[11px] text-stone-600">{JSON.stringify(version.config, null, 2)}</pre>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Error por elección retenida</p>
          <table className="mt-1 w-full text-sm">
            <caption className="sr-only">Métricas por elección de {version.label}</caption>
            <thead><tr className="border-b border-line text-left"><th className="p-2">Elección</th><th className="p-2 text-right">MAE</th><th className="p-2 text-right">RMSE</th><th className="p-2 text-right">Sesgo</th></tr></thead>
            <tbody className="tabular">
              {version.metrics.by_election.map((r) => (
                <tr key={r.test_election} className="border-b border-line">
                  <td className="p-2">{fmtDate(r.test_election)}</td>
                  <td className="p-2 text-right">{r.MAE_pp.toFixed(2)}</td>
                  <td className="p-2 text-right">{r.RMSE_pp.toFixed(2)}</td>
                  <td className="p-2 text-right">{r.bias_pp.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
