"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as echarts from "echarts/core";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Provenance, SectionTitle, StatCard, selectClass,
} from "@/components/ui";
import {
  loadColors, loadGeo, loadLabels, loadMeta, loadTerritories, loadTurnout,
  type ColorEntry, type LabelRow, type Meta, type Territory, type TurnoutRow,
} from "@/lib/data";
import { axisX, axisY, gridBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtInt, fmtPct, partyColor } from "@/lib/utils";

type Metric = "turnout" | "share" | "abstention";
const MAP = "spain-provinces";

function PageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [turnout, setTurnout] = useState<TurnoutRow[]>([]);
  const [election, setElection] = useState(sp.get("election") ?? "2023-07-23");
  const [metric, setMetric] = useState<Metric>((sp.get("metric") as Metric) ?? "turnout");
  const [party, setParty] = useState(sp.get("party") ?? "PP");
  const [prov, setProv] = useState<string | null>(sp.get("province"));
  const [rows, setRows] = useState<LabelRow[] | null>(null);
  const [rowsElection, setRowsElection] = useState<string | null>(null);
  const [history, setHistory] = useState<Map<string, LabelRow[]> | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadMeta(), loadTerritories(), loadColors(), loadGeo(), loadTurnout()])
      .then(([m, t, c, g, tr]) => {
        if (!alive) return;
        setMeta(m); setTerr(t); setColors(c); setGeo(g); setTurnout(tr);
        try {
          echarts.registerMap(MAP, g as unknown as Parameters<typeof echarts.registerMap>[1]);
          setMapReady(true);
        } catch (e) {
          setErr(`No se pudo registrar la geometría provincial: ${String(e)}`);
        }
      })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    loadLabels(election)
      .then((r) => { if (alive) { setRows(r); setRowsElection(election); } })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [election]);

  useEffect(() => {
    if (!prov || history) return;
    let alive = true;
    const targets = meta?.elections ?? [];
    Promise.all(targets.map(async (e) => [e, await loadLabels(e)] as const))
      .then((entries) => {
        if (!alive) return;
        const m = new Map<string, LabelRow[]>();
        for (const [e, list] of entries) m.set(e, list.filter((r) => r.p === prov));
        setHistory(m);
      })
      .catch(() => { /* la ficha sigue funcionando sin serie histórica */ });
    return () => { alive = false; };
  }, [prov, history, meta]);

  const nameOf = useMemo(() => {
    const m = new Map(terr.map((t) => [t.province_code, t.province_name_interior]));
    return (c: string) => m.get(c) ?? c;
  }, [terr]);

  const turnoutForElection = useMemo(
    () => turnout.filter((r) => r.election_date === election),
    [turnout, election],
  );

  const turnoutMap = useMemo(() => {
    const m = new Map<string, TurnoutRow>();
    for (const r of turnoutForElection) m.set(r.province_code, r);
    return m;
  }, [turnoutForElection]);

  const currentRows = rowsElection === election ? rows : null;

  const shareMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!currentRows) return m;
    const totals = new Map<string, number>();
    for (const r of currentRows) totals.set(r.p, (totals.get(r.p) ?? 0) + r.v);
    const partyVotes = new Map<string, number>();
    for (const r of currentRows) if (r.party === party) partyVotes.set(r.p, (partyVotes.get(r.p) ?? 0) + r.v);
    for (const [code, total] of totals) m.set(code, total ? ((partyVotes.get(code) ?? 0) / total) * 100 : NaN);
    return m;
  }, [currentRows, party]);

  const shown = useMemo(() => {
    if (metric === "turnout") {
      const m = new Map<string, number>();
      for (const [code, r] of turnoutMap) m.set(code, r.turnout_rate ?? NaN);
      return m;
    }
    if (metric === "abstention") {
      const m = new Map<string, number>();
      for (const [code, r] of turnoutMap) m.set(code, r.abstention_rate ?? NaN);
      return m;
    }
    return shareMap;
  }, [metric, turnoutMap, shareMap]);

  const parties = useMemo(() => {
    if (!currentRows) return ["PP", "PSOE", "VOX", "SUMAR"];
    const totals = new Map<string, number>();
    for (const r of currentRows) if (r.party) totals.set(r.party, (totals.get(r.party) ?? 0) + r.v);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).slice(0, 20);
  }, [currentRows]);

  const sync = (patch: Record<string, string | null>) => {
    const qs = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) qs.set(k, v); else qs.delete(k); }
    router.replace(`?${qs.toString()}`, { scroll: false });
  };

  const selectProvince = (code: string | null) => {
    setProv(code);
    sync({ province: code });
  };

  const provincesTable = useMemo(() => {
    const term = q.trim().toLowerCase();
    return terr
      .filter((t) => !term || t.province_name_interior.toLowerCase().includes(term) || t.province_code.includes(term))
      .map((t) => ({ ...t, value: shown.get(t.province_code) ?? NaN, detail: turnoutMap.get(t.province_code) }))
      .sort((a, b) => (Number.isNaN(a.value) ? 1 : Number.isNaN(b.value) ? -1 : b.value - a.value));
  }, [terr, shown, turnoutMap, q]);

  if (err) return <ErrorBox message={err} />;
  if (!meta || !geo || !mapReady) return <Loading what="mapa provincial" />;

  const values = [...shown.values()].filter((v) => Number.isFinite(v));
  const data = [...shown.entries()].map(([code, value]) => ({ name: code, value: Number.isFinite(value) ? +value.toFixed(2) : undefined }));

  const mapOption = {
    tooltip: {
      ...tooltipBase,
      trigger: "item",
      formatter: (p: { name?: string; value?: number }) => {
        const code = String(p.name ?? "");
        const v = p.value;
        return `<strong>${nameOf(code)}</strong> (${code})<br/>${
          metric === "turnout" ? "Participación" : metric === "abstention" ? "Abstención" : `Cuota ${party}`
        }: ${v == null || !Number.isFinite(v) ? "dato no disponible" : `${v.toFixed(2)} %`}`;
      },
    },
    visualMap: {
      min: values.length ? Math.floor(Math.min(...values)) : 0,
      max: values.length ? Math.ceil(Math.max(...values)) : 100,
      text: ["alto", "bajo"], realtime: false, calculable: true, orient: "horizontal",
      left: "center", bottom: 0, itemHeight: 90,
      inRange: { color: ["#f1efe9", "#99c7c1", "#0f766e"] },
      textStyle: { color: "#57534e", fontSize: 11 },
    },
    series: [{
      type: "map", map: MAP, roam: true, zoom: 1.05,
      nameProperty: "province_code",
      selectedMode: "single",
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 10, color: "#14213d" }, itemStyle: { areaColor: "#fbbf24" } },
      select: { itemStyle: { areaColor: "#f59e0b" }, label: { show: true, fontSize: 10 } },
      data: prov ? data.map((d) => ({ ...d, selected: d.name === prov })) : data,
      itemStyle: { borderColor: "#ffffff", borderWidth: 0.6 },
    }],
  };

  const detailRows = prov && currentRows ? currentRows.filter((r) => r.p === prov).sort((a, b) => b.v - a.v) : null;
  const detailTurnout = prov ? turnoutMap.get(prov) : undefined;

  const provHistory = prov && history ? meta.elections
    .map((e) => {
      const list = history.get(e) ?? [];
      const total = list.reduce((a, r) => a + r.v, 0);
      const pv = list.filter((r) => r.party === party).reduce((a, r) => a + r.v, 0);
      const t = turnout.find((x) => x.election_date === e && x.province_code === prov);
      return {
        election: e,
        share: total ? (pv / total) * 100 : null,
        seats: list.filter((r) => r.party === party).reduce((a, r) => a + r.s, 0),
        turnout: t?.turnout_rate ?? null,
      };
    }) : null;

  const provOption = provHistory ? {
    grid: { ...gridBase, top: 30 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number | null) => v == null ? "sin dato" : `${v.toFixed(2)} %` },
    legend: { bottom: 0, textStyle: { color: "#57534e", fontSize: 11 } },
    xAxis: { type: "category", data: provHistory.map((d) => d.election.slice(2, 4)), ...axisX },
    yAxis: { type: "value", ...axisY, name: "%" },
    series: [
      {
        name: `Cuota ${party}`, type: "line",
        data: provHistory.map((d) => (d.share == null ? null : +d.share.toFixed(2))),
        connectNulls: false, itemStyle: { color: partyColor(party, colors).hex }, lineStyle: { width: 2.4 },
      },
      {
        name: "Participación", type: "line",
        data: provHistory.map((d) => (d.turnout == null ? null : +d.turnout.toFixed(2))),
        connectNulls: false, itemStyle: { color: "#0f766e" }, lineStyle: { width: 1.8, type: "dashed" },
      },
    ],
  } : null;

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Archivo · Mapa provincial"
        title="Territorio: explora una provincia"
        desc="Mapa navegable por elección y métrica. Haz clic en una provincia para abrir su ficha completa, incluidas las candidaturas minoritarias. Las islas se representan agregadas en su provincia."
        updated={meta.generated_at?.slice(0, 10)}
        sources={["Interior", "Eurostat GISCO (geometría)", "INE"]}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
        <label className="text-sm">Elección:
          <select value={election} onChange={(e) => { setElection(e.target.value); sync({ election: e.target.value }); }} className={`ml-1 ${selectClass}`} aria-label="Elección">
            {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label className="text-sm">Métrica:
          <select value={metric} onChange={(e) => { setMetric(e.target.value as Metric); sync({ metric: e.target.value }); }} className={`ml-1 ${selectClass}`} aria-label="Métrica del mapa">
            <option value="turnout">Participación (%)</option>
            <option value="abstention">Abstención (%)</option>
            <option value="share">Cuota de partido (%)</option>
          </select>
        </label>
        {metric === "share" && (
          <label className="text-sm">Partido:
            <select value={party} onChange={(e) => { setParty(e.target.value); sync({ party: e.target.value }); }} className={`ml-1 ${selectClass}`} aria-label="Partido del mapa">
              {parties.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
        <button type="button" onClick={() => { setProv(null); sync({ province: null }); }} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">
          Quitar selección
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Mapa provincial" subtitle={metric === "share" ? `Cuota de ${party} sobre votos a candidaturas` : metric === "turnout" ? "Votantes sobre censo" : "Abstención sobre censo"} className="lg:col-span-2">
          <EChart option={mapOption} height={520} ariaLabel={`Mapa provincial de ${metric} en ${election}`} testId="mapa-provincias"
            onEvents={{ click: (params) => {
              const p = params as { name?: string };
              if (p.name && nameOf(p.name) !== p.name) selectProvince(p.name);
            } }} />
          <Provenance items={["Geometría: Eurostat GISCO NUTS 2021 ©EuroGeographics", "Interior (resultados y censo)", "Haz clic en el mapa o en la tabla para abrir la ficha"]} />
        </Card>

        <div className="space-y-3">
          <StatCard label="Provincias" value={terr.length} hint="Circunscripciones del Congreso" />
          <StatCard label="Media de la métrica" value={values.length ? fmtPct(values.reduce((a, b) => a + b, 0) / values.length, 1) : "—"}
            hint={`${values.length} provincias con dato`} />
          <StatCard label="Máximo" value={values.length ? `${fmtPct(Math.max(...values), 1)}` : "—"}
            hint={values.length ? nameOf([...shown.entries()].sort((a, b) => b[1] - a[1])[0][0]) : undefined} />
          <StatCard label="Mínimo" value={values.length ? `${fmtPct(Math.min(...values), 1)}` : "—"}
            hint={values.length ? nameOf([...shown.entries()].sort((a, b) => a[1] - b[1])[0][0]) : undefined} />
        </div>
      </div>

      <Card
        title={`Provincias · ${election}`}
        subtitle={`${provincesTable.length} de ${terr.length} provincias`}
        actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar provincia" className="rounded-md border border-line px-2 py-1.5 text-sm" aria-label="Buscar provincia" />}
      >
        <div className="max-h-[460px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Provincias y valor de la métrica seleccionada</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line text-left">
                <th className="p-2">Código</th><th className="p-2">Provincia</th><th className="p-2">CCAA</th>
                <th className="p-2 text-right">Censo</th>
                <th className="p-2 text-right">{metric === "turnout" ? "Participación" : metric === "abstention" ? "Abstención" : `Cuota ${party}`}</th>
                <th className="p-2 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {provincesTable.map((t) => (
                <tr key={t.province_code} className={`border-b border-line ${prov === t.province_code ? "bg-amber-50" : ""}`}>
                  <td className="p-2 text-stone-500">{t.province_code}</td>
                  <td className="p-2">{t.province_name_interior}</td>
                  <td className="p-2 text-xs text-stone-500">{t.ccaa_name ?? "—"}</td>
                  <td className="p-2 text-right">{t.detail ? fmtInt(t.detail.electores) : "—"}</td>
                  <td className="p-2 text-right">{Number.isNaN(t.value) ? "dato no disponible" : fmtPct(t.value)}</td>
                  <td className="p-2 text-right">
                    <button type="button" className="underline hover:text-accent" onClick={() => selectProvince(t.province_code)}
                      aria-label={`Ver ficha de ${t.province_name_interior}`}>ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Provenance items={["Interior", "Censo: electores inscritos", "Sin dato cuando la etiqueta no aparece en la circunscripción"]} />
      </Card>

      {prov && (
        <section aria-label={`Ficha de ${nameOf(prov)}`} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Ficha provincial</p>
              <h2 className="font-serif text-3xl text-ink">{nameOf(prov)} <span className="text-stone-400">({prov})</span></h2>
              <p className="text-sm text-stone-500">{fmtDate(election)} · {meta.elections.length} elecciones disponibles</p>
            </div>
            <button type="button" onClick={() => selectProvince(null)} className="text-sm underline hover:text-accent">cerrar ficha</button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Censo" value={detailTurnout ? fmtInt(detailTurnout.electores) : "—"} hint="Electores" />
            <StatCard label="Participación" value={detailTurnout?.turnout_rate != null ? fmtPct(detailTurnout.turnout_rate, 1) : "—"} hint={detailTurnout ? `${fmtInt(detailTurnout.votantes)} votantes` : undefined} />
            <StatCard label="Voto nulo" value={detailTurnout?.null_rate != null ? fmtPct(detailTurnout.null_rate, 2) : "—"} hint="Sobre votantes" />
            <StatCard label="Voto blanco" value={detailTurnout?.blank_on_valid_rate != null ? fmtPct(detailTurnout.blank_on_valid_rate, 2) : "—"} hint="Sobre válidos" />
          </div>

          {provOption && (
            <Card title={`Evolución en ${nameOf(prov)}`} subtitle={`Cuota de ${party} y participación, ${meta.elections[0].slice(0, 4)}–${meta.elections[meta.elections.length - 1].slice(0, 4)}`}>
              <EChart option={provOption} height={300} ariaLabel={`Evolución de ${party} y participación en ${nameOf(prov)}`} testId="provincia-historia" />
              <Provenance items={["Interior, agregado provincial", "Huecos: la formación no obtuvo votos mapeados en esa elección"]} />
            </Card>
          )}

          <Card
            title={`Resultados de ${nameOf(prov)} · ${election}`}
            subtitle={`${detailRows?.length ?? 0} candidaturas`}
            actions={detailRows && <CsvButton filename={`ficha_${prov}_${election}.csv`} rows={detailRows as unknown as Record<string, unknown>[]} />}
          >
            {!detailRows ? <Empty what="ficha provincial" /> : (
              <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <caption className="sr-only">Candidaturas y resultados de la provincia</caption>
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line text-left">
                      <th className="p-2">#</th><th className="p-2">Etiqueta</th><th className="p-2">Partido</th>
                      <th className="p-2 text-right">Votos</th><th className="p-2 text-right">Cuota</th><th className="p-2 text-right">Escaños</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {detailRows.map((r, i) => (
                      <tr key={r.label} className="border-b border-line">
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
          </Card>
        </section>
      )}
    </div>
  );
}

export default function Territorio() {
  return <Suspense fallback={<Loading what="mapa provincial" />}><PageInner /></Suspense>;
}
