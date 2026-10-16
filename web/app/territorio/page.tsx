"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as echarts from "echarts/core";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance, SectionTitle } from "@/components/ui";
import { loadColors, loadGeo, loadLabels, loadMeta, loadNational, loadTerritories,
  type ColorEntry, type ElectionNat, type LabelRow, type Meta, type Territory } from "@/lib/data";
import { fmtInt, fmtPct, partyColor } from "@/lib/utils";

type Metric = "turnout" | "share";

function PageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [election, setElection] = useState(sp.get("election") ?? "2023-07-23");
  const [metric, setMetric] = useState<Metric>((sp.get("metric") as Metric) ?? "turnout");
  const [party, setParty] = useState(sp.get("party") ?? "PP");
  const [prov, setProv] = useState<string | null>(sp.get("province"));
  const [rows, setRows] = useState<LabelRow[] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    Promise.all([loadMeta(), loadNational(), loadTerritories(), loadColors(), loadGeo()]).then(
      ([m, n, t, c, g]) => {
        setMeta(m); setNat(n); setTerr(t); setColors(c); setGeo(g);
        try { echarts.registerMap("es", g as unknown as Parameters<typeof echarts.registerMap>[1]); } catch { /* ya registrado */ }
        setMapReady(true);
      });
  }, []);
  useEffect(() => { loadLabels(election).then(setRows).catch(() => setRows([])); }, [election]);

  const nameOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_name_interior]));
    return (c: string) => m.get(c) ?? c;
  }, [terr]);

  // turnout provincial se calcula desde el JSON de turnout para exactitud
  const [turnoutMap, setTurnoutMap] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    import("@/lib/data").then(async ({ loadTurnout }) => {
      const t = await loadTurnout();
      const m = new Map<string, number>();
      for (const r of t.filter((x) => x.election_date === election)) m.set(r.province_code, r.turnout_rate ?? NaN);
      setTurnoutMap(m);
    });
  }, [election]);

  const shareMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!rows) return m;
    const tot = new Map<string, number>();
    for (const r of rows) tot.set(r.p, (tot.get(r.p) ?? 0) + r.v);
    const pv = new Map<string, number>();
    for (const r of rows) if (r.party === party) pv.set(r.p, (pv.get(r.p) ?? 0) + r.v);
    for (const [p, t] of tot) m.set(p, t ? +((pv.get(p) ?? 0) / t * 100).toFixed(2) : 0);
    for (const [p, v] of pv) if (!tot.get(p)) m.set(p, 0);
    return m;
  }, [rows, party]);

  const shown = metric === "turnout" ? turnoutMap : shareMap;

  const sync = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k); }
    router.replace(`?${q.toString()}`);
  };

  if (!meta || !nat || !geo || !mapReady) return <p role="status">Cargando mapa…</p>;
  const data = [...shown.entries()].map(([code, value]) => ({ name: code, value }));
  const vals = [...shown.values()].filter((v) => !Number.isNaN(v));
  const option = {
    tooltip: {
      trigger: "item" as const,
      formatter: (p: { name?: string; value?: number }) =>
        `${nameOf(String(p.name))} (${p.name}): ${p.value == null || Number.isNaN(p.value) ? "Dato no disponible" : `${(+p.value).toFixed(2)}${metric === "turnout" ? " %" : " %"}`}`,
    },
    visualMap: {
      min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 100,
      text: ["alto", "bajo"], realtime: false, calculable: true, inRange: { color: ["#f1efe9", "#0f766e"] },
    },
    series: [{
      type: "map" as const, map: "es", roam: true,
      nameProperty: "province_code",
      label: { show: false },
      emphasis: { label: { show: true } },
      data,
    }],
  };

  const detail = prov && rows ? rows.filter((r) => r.p === prov).sort((a, b) => b.v - a.v) : null;

  return (
    <div>
      <SectionTitle kicker="Atlas" title="Territorio: 52 circunscripciones"
        desc="Mapa navegable por elección y métrica. La ficha provincial incluye todas las candidaturas, minoritarias incluidas." />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">Elección: <select value={election} onChange={(e) => { setElection(e.target.value); sync({ election: e.target.value }); }}
          className="rounded border border-line px-2 py-1" aria-label="Elección">
          {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
        <label className="text-sm">Métrica: <select value={metric} onChange={(e) => { setMetric(e.target.value as Metric); sync({ metric: e.target.value }); }}
          className="rounded border border-line px-2 py-1" aria-label="Métrica del mapa">
          <option value="turnout">Participación (%)</option><option value="share">Cuota de partido (%)</option></select></label>
        {metric === "share" && (
          <label className="text-sm">Partido: <select value={party} onChange={(e) => { setParty(e.target.value); sync({ party: e.target.value }); }}
            className="rounded border border-line px-2 py-1" aria-label="Partido del mapa">
            {["PP", "PSOE", "VOX", "SUMAR", "ERC", "JUNTS", "PNV", "BILDU", "BNG", "CC", "UPN", "PACMA", "CS", "CUP"].map((p) => (
              <option key={p} value={p}>{p}</option>))}</select></label>)}
        <button type="button" onClick={() => { setElection("2023-07-23"); setMetric("turnout"); setProv(null); router.replace("?"); }}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <EChart option={option} height={520} ariaLabel={`Mapa de ${metric === "turnout" ? "participación" : `cuota de ${party}`} por provincia en ${election}`} />
        <Provenance items={["Geometría: Eurostat GISCO NUTS 2021 ©EuroGeographics (islas agregadas)",
          metric === "turnout" ? "Interior (votantes/electores)" : `Interior; cuota ${party} sobre votos a candidaturas (color ${partyColor(party, colors).hex})`,
          "Haz clic en una provincia en la tabla inferior para ver su ficha"]} />
      </div>
      <h2 className="mb-2 mt-6 font-serif text-2xl">Provincias ({election})</h2>
      <div className="overflow-auto rounded-lg border border-line bg-white" style={{ maxHeight: 420 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white"><tr className="border-b border-line text-left">
            <th className="p-2">Código</th><th className="p-2">Provincia</th>
            <th className="p-2">{metric === "turnout" ? "Participación %" : `Cuota ${party} %`}</th><th className="p-2">Ficha</th>
          </tr></thead>
          <tbody>
            {terr.map((t) => {
              const v = shown.get(t.province_code);
              return (
                <tr key={t.province_code} className="border-b border-line">
                  <td className="p-2">{t.province_code}</td><td className="p-2">{t.province_name_interior}</td>
                  <td className="p-2">{v == null || Number.isNaN(v) ? "Dato no disponible" : fmtPct(v)}</td>
                  <td className="p-2"><button type="button" className="underline hover:text-accent"
                    onClick={() => { setProv(t.province_code); sync({ province: t.province_code }); }}
                    aria-label={`Ver ficha de ${t.province_name_interior}`}>ver</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {prov && (
        <section aria-label={`Ficha de ${nameOf(prov)}`} className="mt-6 rounded-lg border border-line bg-white p-4">
          <h3 className="font-serif text-xl">{nameOf(prov)} ({prov}) — {election}</h3>
          {detail && <CsvButton filename={`ficha_${prov}_${election}.csv`} rows={detail as unknown as Record<string, unknown>[]} />}
          <div className="mt-2 overflow-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-line text-left">
                <th className="p-2">#</th><th className="p-2">Etiqueta</th><th className="p-2">Partido</th>
                <th className="p-2">Votos</th><th className="p-2">Cuota %</th><th className="p-2">Escaños</th>
              </tr></thead>
              <tbody>
                {detail!.map((r, i) => (
                  <tr key={r.label} className="border-b border-line">
                    <td className="p-2">{i + 1}</td><td className="p-2">{r.label}</td>
                    <td className="p-2">{r.party ?? <em className="text-stone-500">sin mapear</em>}</td>
                    <td className="p-2">{fmtInt(r.v)}</td><td className="p-2">{fmtPct(r.share)}</td><td className="p-2">{r.s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function Territorio() {
  return <Suspense fallback={<p role="status">Cargando…</p>}><PageInner /></Suspense>;
}
