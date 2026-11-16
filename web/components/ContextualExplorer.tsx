"use client";
import { useEffect, useState } from "react";
import { ProvinceDataSchema, type ProvinceData, type ProvinceIndex } from "@/lib/province";
import { HistorySchema, officialSnapshot, type ContextScenario, type History } from "@/lib/contextual-scenarios";
import { useProvinceUrl } from "@/lib/use-province-url";
import ProvincePicker from "./ProvincePicker";
import ScenarioCards from "./ScenarioCards";
import ContextualCalculator from "./ContextualCalculator";
import { Loading } from "./ui";

export default function ContextualExplorer({ initial, initialHistory, provinces }: { initial: ProvinceData; initialHistory: History; provinces: ProvinceIndex[] }) {
  const { code, requested, select } = useProvinceUrl(provinces.map(p => p.code));
  const [loaded, setLoaded] = useState<{ data: ProvinceData; history: History | null }>({ data: initial, history: initialHistory });
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selection, setSelection] = useState<ContextScenario | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (code === initial.code) return () => controller.abort();
    const get = async (url: string) => { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error("No se pudieron cargar los datos oficiales o su contexto histórico."); return response.json(); };
    Promise.all([get(`/data/provinces/${code}.json`).then(json => ProvinceDataSchema.parse(json)), get(`/data/scenario_history/${code}.json`).then(json => HistorySchema.parse(json))]).then(([data, history]) => {
      if (data.code !== code || history.code !== code) throw new Error("Los datos no corresponden a esta provincia.");
      if (!controller.signal.aborted) { setLoaded({ data, history }); setError(""); }
    }).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [code, initial.code, retry]);
  const current = code === initial.code ? { data: initial, history: initialHistory } : loaded.data.code === code ? loaded : null;
  const selectProvince = (next: string) => { setSelection(null); setRevision(n => n + 1); setError(""); select(next); };
  const open = (scenario: ContextScenario) => {
    setSelection(scenario); setRevision(n => n + 1);
    requestAnimationFrame(() => { document.getElementById("calculadora")?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("scenario-title")?.focus({ preventScroll: true }); });
  };
  return <div className="space-y-7">
    <ProvincePicker provinces={provinces} selected={code} onSelect={selectProvince} />
    {requested && requested !== code && <p role="status" className="text-sm text-stone-600">Provincia no reconocida. Mostramos León.</p>}
    {error ? <div role="alert" className="editorial-panel p-5"><p>{error}</p><button className="button-secondary mt-3" onClick={() => { setError(""); setRetry(n => n + 1); }}>Reintentar contexto</button></div> : current ? <div data-testid="contextual-analysis" data-province={current.data.code} className="space-y-9">
      <ScenarioCards key={code} data={current.data} history={current.history} onSelect={open} />
      <ContextualCalculator key={`${code}:${revision}`} reference={officialSnapshot(current.data)} selection={selection?.reference.turnout.province_code === code ? selection : null} />
      <details className="advanced-fold"><summary>Qué podemos comparar y qué contexto de encuestas usamos</summary><p className="mt-3 text-sm leading-relaxed text-stone-600">Los repartos históricos incluyen todas las candidaturas originales. Solo se enlazan variaciones individuales cuando coincide la etiqueta completa de un partido registrado y la política de identidad no excluye su composición. SUMAR, las confluencias de 2019 y otras coaliciones no se fusionan. La ausencia de enlace no significa ausencia de votos.</p><p className="mt-3 text-sm leading-relaxed text-stone-600">No se ha incorporado a estas tarjetas ninguna medición con representatividad provincial validada. Esto no demuestra que no existan sondeos: la infraestructura y las fuentes primarias se conservan en el archivo científico. Las encuestas nacionales no se convierten en votos provinciales; los resultados de terceros no son un modelo propio. Se mantienen los controles de publicación y las restricciones legales existentes.</p><p className="mt-3 text-xs text-stone-500">La consulta de fuentes primarias y sus fechas se documenta en docs/CONTEXTUAL_SCENARIOS.md. No se difunden aquí cifras de sondeos.</p><a className="mt-3 inline-block text-xs text-accent underline" href="https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672#a163">LOREG · reglas de adjudicación ↗</a></details>
    </div> : <Loading what="los resultados y su contexto provincial" />}
  </div>;
}
