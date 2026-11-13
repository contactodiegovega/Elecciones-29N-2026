"use client";
import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts/core";
import EChart from "@/components/EChart";
import { Card, CsvButton, ErrorBox, Loading, Provenance, SectionTitle, StatCard, Tag } from "@/components/ui";
import { loadGeo, loadTerritories, loadTurnout, type Territory, type TurnoutRow } from "@/lib/data";
import { axisX, axisY, gridBase, tooltipBase } from "@/lib/chart";
import { fmtDate, fmtInt, fmtPct, fmtPp } from "@/lib/utils";

const MAP = "spain-provinces-turnout";
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Participacion() {
  const [rows, setRows] = useState<TurnoutRow[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadTurnout(), loadTerritories(), loadGeo()])
      .then(([t, ts, g]) => {
        setRows(t); setTerritories(ts); setGeo(g);
        try {
          echarts.registerMap(MAP, g as unknown as Parameters<typeof echarts.registerMap>[1]);
          setMapReady(true);
        } catch {
          setMapReady(false);
        }
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const territoryOf = useMemo(() => {
    const map = new Map<string, Territory>();
    for (const t of territories) map.set(t.province_code, t);
    return map;
  }, [territories]);

  const national = useMemo(() => {
    const byElection = new Map<string, { electores: number; votantes: number }>();
    for (const r of rows) {
      const cur = byElection.get(r.election_date) ?? { electores: 0, votantes: 0 };
      cur.electores += r.electores; cur.votantes += r.votantes;
      byElection.set(r.election_date, cur);
    }
    return [...byElection.entries()]
      .map(([election, v]) => ({ election, ...v, turnout: v.electores ? (v.votantes / v.electores) * 100 : null }))
      .sort((a, b) => a.election.localeCompare(b.election));
  }, [rows]);

  const latest = national[national.length - 1];
  const previous = national[national.length - 2];

  const latestRows = useMemo(() => {
    if (!latest) return [];
    return rows
      .filter((r) => r.election_date === latest.election)
      .map((r) => {
        const before = rows.find((x) => x.province_code === r.province_code && x.election_date === previous?.election);
        return {
          ...r,
          name: territoryOf.get(r.province_code)?.province_name_interior ?? r.province_code,
          ccaa: territoryOf.get(r.province_code)?.ccaa_name ?? "—",
          delta: r.turnout_rate != null && before?.turnout_rate != null ? r.turnout_rate - before.turnout_rate : null,
        };
      })
      .sort((a, b) => (b.turnout_rate ?? 0) - (a.turnout_rate ?? 0));
  }, [rows, latest, previous, territoryOf]);

  const filtered = useMemo(
    () => latestRows.filter((r) => norm(`${r.name} ${r.ccaa} ${r.province_code}`).includes(norm(query))),
    [latestRows, query],
  );

  if (err) return <ErrorBox message={err} />;
  if (!latest || !latestRows.length) return <Loading what="la participación" />;

  const best = latestRows[0];
  const worst = latestRows[latestRows.length - 1];
  const detail = selected ? latestRows.find((r) => r.province_code === selected) : null;

  const lineOption = {
    grid: { ...gridBase, top: 48 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} %` },
    xAxis: { type: "category", data: national.map((r) => r.election.slice(0, 4)), ...axisX },
    yAxis: { type: "value", min: 55, max: 85, ...axisY, name: "% sobre censo", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: [{
      name: "Participación", type: "line", smooth: 0.15,
      data: national.map((r) => r.turnout == null ? null : +r.turnout.toFixed(2)),
      itemStyle: { color: "#0f766e" }, lineStyle: { width: 2.6 },
      areaStyle: { color: "rgba(15,118,110,0.10)" }, symbolSize: 5,
      markLine: {
        silent: true, symbol: "none", data: [{ type: "average", name: "media" }],
        lineStyle: { color: "#c2410c", type: "dashed" },
        label: { formatter: "media {c} %", fontSize: 10, color: "#c2410c" },
      },
    }],
  };

  const mapOption = mapReady ? {
    tooltip: {
      ...tooltipBase, trigger: "item",
      formatter: (params: { name?: string }) => {
        const r = latestRows.find((x) => x.province_code === params.name);
        if (!r) return String(params.name ?? "");
        return `<strong>${r.name}</strong><br/>${fmtPct(r.turnout_rate, 1)} de participación<br/>`
          + `${fmtInt(r.votantes)} votantes de ${fmtInt(r.electores)} electores`;
      },
    },
    visualMap: {
      min: 50, max: 85, text: ["más participación", "menos"], realtime: false, calculable: true,
      orient: "horizontal", left: "center", bottom: 0, itemHeight: 90,
      inRange: { color: ["#f5f5f4", "#c7ddd9", "#0f766e", "#134e4a"] },
      textStyle: { color: "#57534e", fontSize: 11 },
    },
    series: [{
      type: "map", map: MAP, roam: true, zoom: 1.05, nameProperty: "province_code",
      selectedMode: "single",
      data: latestRows.map((r) => ({ name: r.province_code, value: r.turnout_rate, selected: selected === r.province_code })),
      itemStyle: { borderColor: "#ffffff", borderWidth: 0.8 },
      emphasis: { label: { show: true, fontSize: 11 }, itemStyle: { areaColor: "#fbbf24" } },
      select: { label: { show: true, fontSize: 11 }, itemStyle: { areaColor: "#f59e0b" } },
    }],
  } : null;

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Participación · Serie histórica"
        title="Cuántos votan y dónde"
        desc="Participación sobre censo electoral en las 52 provincias. Es el dato más estable del sistema, pero también cambia entre elecciones y entre territorios. Aquí no se estima la participación del 29N."
        updated={fmtDate(latest.election)}
        sources={["Ministerio del Interior", "Censo electoral", "52 provincias"]}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Participación" value={fmtPct(latest.turnout, 1)} hint={`${fmtDate(latest.election, false)} · ${fmtInt(latest.votantes)} votantes`} />
        <StatCard label="Abstención" value={fmtPct(latest.turnout == null ? null : 100 - latest.turnout, 1)} hint={`${fmtInt(latest.electores - latest.votantes)} no votaron`} />
        <StatCard label="Máximo provincial" value={`${best.name}`} hint={`${fmtPct(best.turnout_rate, 1)} · ${best.ccaa}`} />
        <StatCard label="Mínimo provincial" value={`${worst.name}`} hint={`${fmtPct(worst.turnout_rate, 1)} · ${worst.ccaa}`} />
      </div>

      <Card title="Serie nacional" subtitle="Votantes sobre censo en cada elección general. La línea discontinua es la media simple.">
        <EChart option={lineOption} height={330} ariaLabel="Evolución de la participación nacional" testId="participacion-serie" />
        <Provenance items={["Interior; denominador = censo electoral, no población total", "La media es simple, no ponderada por provincia", "La serie termina en 2023: no incluye 2026"]} />
      </Card>

      <Card title={`Mapa provincial · ${fmtDate(latest.election)}`} subtitle="Participación sobre censo. Haz clic en una provincia para ver su ficha.">
        {mapOption ? (
          <EChart option={mapOption} height={470} ariaLabel="Mapa de participación por provincia" testId="participacion-mapa"
            onEvents={{ click: (params) => {
              const p = params as { name?: string };
              if (p.name) setSelected(p.name === selected ? null : p.name);
            } }} />
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-line text-sm text-stone-500">
            Mapa no disponible. La tabla sigue siendo completa.
          </div>
        )}
        <Provenance items={["Interior", "Geometría: Eurostat GISCO", "Escala fija 50–85 % para comparar provincias"]} />
      </Card>

      {detail && (
        <Card title={`${detail.name} · participación`} subtitle={detail.ccaa} actions={<button type="button" className="text-sm underline hover:text-accent" onClick={() => setSelected(null)}>cerrar ficha</button>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Participación" value={fmtPct(detail.turnout_rate, 1)} hint={fmtDate(detail.election_date, false)} />
            <StatCard label="Cambio vs 2019N" value={detail.delta == null ? "—" : fmtPp(detail.delta, 1)} hint="Puntos porcentuales" />
            <StatCard label="Votantes" value={fmtInt(detail.votantes)} hint="Sobre censo" />
            <StatCard label="Abstención" value={fmtPct(detail.abstention_rate, 1)} hint={`${fmtInt(detail.electores)} electores`} />
          </div>
        </Card>
      )}

      <Card
        title="Participación por provincia"
        subtitle={`Datos de ${fmtDate(latest.election)} y diferencia con ${previous ? fmtDate(previous.election) : "la anterior"}.`}
        actions={<CsvButton filename="participacion_por_provincia.csv" rows={filtered.map((r) => ({
          provincia: r.name, codigo: r.province_code, ccaa: r.ccaa,
          participacion_pct: r.turnout_rate, abstencion_pct: r.abstention_rate,
          votantes: r.votantes, electores: r.electores, delta_pp: r.delta,
        }))} />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar provincia o comunidad…"
            className="min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            aria-label="Buscar provincia"
          />
          <Tag>{filtered.length} provincias</Tag>
        </div>
        <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Participación por provincia en la última elección</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line text-left">
                <th className="p-2">Provincia</th><th className="p-2">Comunidad</th>
                <th className="p-2 text-right">Participación</th><th className="p-2 text-right">Δ pp</th>
                <th className="p-2 text-right">Votantes</th><th className="p-2 text-right">Electores</th>
                <th className="p-2 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {filtered.map((r) => (
                <tr key={r.province_code} className="border-b border-line">
                  <td className="p-2">{r.name} <span className="text-xs text-stone-400">({r.province_code})</span></td>
                  <td className="p-2 text-stone-600">{r.ccaa}</td>
                  <td className="p-2 text-right font-medium">{fmtPct(r.turnout_rate, 1)}</td>
                  <td className={`p-2 text-right ${(r.delta ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {r.delta == null ? "—" : fmtPp(r.delta, 1)}
                  </td>
                  <td className="p-2 text-right text-stone-600">{fmtInt(r.votantes)}</td>
                  <td className="p-2 text-right text-stone-500">{fmtInt(r.electores)}</td>
                  <td className="p-2 text-right"><button type="button" onClick={() => setSelected(r.province_code)} className="underline hover:text-accent">ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Provenance items={[
          "Interior; participación = votantes / censo electoral",
          "Cambios en puntos porcentuales, no en porcentaje relativo",
          "La abstención no distingue entre no votar y no poder votar",
        ]} />
      </Card>
    </div>
  );
}
