"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts/core";
import EChart from "@/components/EChart";
import { Card, CsvButton, ErrorBox, Loading, Provenance, SectionTitle, StatCard, Tag, selectClass } from "@/components/ui";
import { loadGeo, loadSimulator, loadTerritories, type Simulator, type Territory } from "@/lib/data";
import { axisX, axisY, gridBase, tooltipBase } from "@/lib/chart";
import { fmtInt, fmtPct } from "@/lib/utils";

const MAP = "spain-provinces-seats";
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Diputados() {
  const [sim, setSim] = useState<Simulator | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ccaa, setCcaa] = useState("todas");
  const [sort, setSort] = useState<"seats" | "name" | "change">("seats");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSimulator(), loadTerritories(), loadGeo()])
      .then(([s, t, g]) => {
        setSim(s); setTerritories(t); setGeo(g);
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

  const rows = useMemo(() => {
    if (!sim) return [];
    return sim.provinces
      .map((p) => {
        const set = p.seats_2023_official ?? {};
        const winner = Object.entries(set).sort((a, b) => b[1] - a[1])[0];
        return {
          ...p,
          ccaa: territoryOf.get(p.province_code)?.ccaa_name ?? "—",
          winner: winner?.[0] ?? null,
          winnerSeats: winner?.[1] ?? 0,
        };
      })
      .filter((p) => {
        const hay = norm(`${p.province_name} ${p.ccaa} ${p.province_code}`);
        return (ccaa === "todas" || p.ccaa === ccaa) && (query.trim() === "" || hay.includes(norm(query)));
      })
      .sort((a, b) => {
        if (sort === "name") return a.province_name.localeCompare(b.province_name, "es");
        if (sort === "change") return (b.seats_change ?? 0) - (a.seats_change ?? 0) || (b.seats_2026 ?? b.seats) - (a.seats_2026 ?? a.seats);
        return (b.seats_2026 ?? b.seats) - (a.seats_2026 ?? a.seats) || a.province_name.localeCompare(b.province_name, "es");
      });
  }, [sim, territoryOf, ccaa, query, sort]);

  const ccaas = useMemo(() => [...new Set(territories.map((t) => t.ccaa_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es")), [territories]);

  if (err) return <ErrorBox message={err} />;
  if (!sim) return <Loading what="la distribución de escaños" />;

  const colors = Object.fromEntries(sim.parties.map((p) => [p.party_id, p.hex_color]));
  const display = Object.fromEntries(sim.parties.map((p) => [p.party_id, p.display_name]));
  const total = sim.provinces.reduce((a, p) => a + (p.seats_2026 ?? p.seats), 0);
  const madrid = sim.provinces.find((p) => p.province_code === "28");
  const cadiz = sim.provinces.find((p) => p.province_code === "11");
  const detail = selected ? sim.provinces.find((p) => p.province_code === selected) : null;
  const detailTerritory = selected ? territoryOf.get(selected) : null;

  const mapOption = mapReady ? {
    tooltip: {
      ...tooltipBase, trigger: "item",
      formatter: (params: { name?: string; value?: number }) => {
        const p = sim.provinces.find((x) => x.province_code === params.name);
        if (!p) return String(params.name ?? "");
        const change = p.seats_change ?? 0;
        return `<strong>${p.province_name}</strong><br/>${p.seats_2026 ?? p.seats} escaños en 2026<br/>`
          + `${p.seats_2023} en 2023 ${change === 0 ? "(sin cambio)" : change > 0 ? `(+${change})` : `(${change})`}`;
      },
    },
    visualMap: {
      min: 1, max: 38, text: ["38 escaños", "1 escaño"], realtime: false, calculable: true,
      orient: "horizontal", left: "center", bottom: 0, itemHeight: 90,
      inRange: { color: ["#f1efe9", "#b9d8d3", "#0f766e", "#14213d"] },
      textStyle: { color: "#57534e", fontSize: 11 },
    },
    series: [{
      type: "map", map: MAP, roam: true, zoom: 1.05, nameProperty: "province_code",
      selectedMode: "single",
      data: sim.provinces.map((p) => ({ name: p.province_code, value: p.seats_2026 ?? p.seats, selected: selected === p.province_code })),
      itemStyle: { borderColor: "#ffffff", borderWidth: 0.8 },
      emphasis: { label: { show: true, fontSize: 11, formatter: (params: { name?: string }) => sim.provinces.find((p) => p.province_code === params.name)?.province_name ?? "" }, itemStyle: { areaColor: "#fbbf24" } },
      select: { label: { show: true, fontSize: 11 }, itemStyle: { areaColor: "#f59e0b" } },
    }],
  } : null;

  const rankingOption = {
    grid: { ...gridBase, top: 12, bottom: 24, right: 40 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v} escaños` },
    xAxis: { type: "value", ...axisY },
    yAxis: { type: "category", ...axisX, data: [...rows].sort((a, b) => (a.seats_2026 ?? a.seats) - (b.seats_2026 ?? b.seats)).map((p) => p.province_name) },
    series: [{
      type: "bar", barMaxWidth: 14,
      data: [...rows].sort((a, b) => (a.seats_2026 ?? a.seats) - (b.seats_2026 ?? b.seats)).map((p) => ({
        value: p.seats_2026 ?? p.seats,
        itemStyle: { color: (p.seats_change ?? 0) > 0 ? "#0f766e" : (p.seats_change ?? 0) < 0 ? "#b45309" : "#94a3b8", borderRadius: [0, 3, 3, 0] },
      })),
      label: { show: false },
    }],
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Oficial · RD 806/2026"
        title="Diputados por provincia"
        desc="El 29N se eligen 350 diputados. Cada provincia es una circunscripción y reparte un número fijo de escaños según su población. La distribución vigente la fija el Real Decreto 806/2026."
        updated={sim.seat_distribution?.verified_at ?? sim.generated_at?.slice(0, 10)}
        sources={["BOE · RD 806/2026", "Ministerio del Interior 2023", "Geometría: Eurostat GISCO"]}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={total} hint="Escaños del Congreso" />
        <StatCard label="Madrid" value={madrid?.seats_2026 ?? "—"} hint={`2023: ${madrid?.seats_2023 ?? "—"} · +1`} />
        <StatCard label="Cádiz" value={cadiz?.seats_2026 ?? "—"} hint={`2023: ${cadiz?.seats_2023 ?? "—"} · −1`} />
        <StatCard label="Media por provincia" value={(total / sim.provinces.length).toFixed(1)} hint={`${sim.provinces.length} circunscripciones`} />
      </div>

      <section className="rounded-xl border border-line bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl text-ink">Qué cambia respecto a 2023</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-600">
              Solo dos provincias cambian. El resto mantiene sus escaños. Este reparto no depende de encuestas ni de
              intención de voto: se fija por población y se aplica a la circunscripción.
            </p>
          </div>
          <a
            href={sim.seat_distribution?.source_url ?? "https://www.boe.es/buscar/doc.php?id=BOE-A-2026-20742"}
            target="_blank" rel="noreferrer"
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:border-accent hover:text-accent"
          >
            Ver el BOE
          </a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sim.provinces.filter((p) => (p.seats_change ?? 0) !== 0).map((p) => (
            <div key={p.province_code} className="flex items-center justify-between rounded-lg border border-line bg-stone-50 px-3 py-2 text-sm">
              <span className="font-medium text-ink">{p.province_name}</span>
              <span className="tabular">
                {p.seats_2023} → <strong>{p.seats_2026 ?? p.seats}</strong>{" "}
                <span className={(p.seats_change ?? 0) > 0 ? "text-emerald-700" : "text-red-700"}>
                  ({(p.seats_change ?? 0) > 0 ? "+" : ""}{p.seats_change})
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Fuente: {sim.seat_distribution?.source ?? "RD 806/2026"}. Verificado el {sim.seat_distribution?.verified_at ?? "2026-11-13"}.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Card title="Mapa de escaños" subtitle="Cuántos diputados elige cada provincia. Haz clic para ver su ficha.">
          {mapOption ? (
            <EChart
              option={mapOption}
              height={470}
              ariaLabel="Mapa de España con los escaños por provincia"
              testId="mapa-diputados"
              onEvents={{ click: (params) => {
                const p = params as { name?: string };
                if (p.name) setSelected(p.name === selected ? null : p.name);
              } }}
            />
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-line text-sm text-stone-500">
              Mapa no disponible. La tabla sigue siendo completa.
            </div>
          )}
          <Provenance items={["RD 806/2026 (BOE)", "Cada provincia es una circunscripción", "El color indica escaños, no partido ganador"]} />
        </Card>

        <Card title="Ranking" subtitle="Provincias con más escaños">
          <EChart option={rankingOption} height={470} ariaLabel="Ranking de provincias por número de escaños" testId="ranking-diputados" />
          <Provenance items={["Verde: gana un escaño en 2026 · naranja: lo pierde", "Solo cambian Madrid y Cádiz"]} />
        </Card>
      </div>

      {detail && (
        <Card title={`${detail.province_name} · ${detail.seats_2026 ?? detail.seats} escaños`} subtitle={`${detailTerritory?.ccaa_name ?? ""} · ${detail.valid_votes ? `${fmtInt(detail.valid_votes)} votos válidos en 2023` : "sin datos de votos"}`}
          actions={<button type="button" className="text-sm underline hover:text-accent" onClick={() => setSelected(null)}>cerrar ficha</button>}>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Reparto oficial en 2023</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(detail.seats_2023_official ?? {}).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([party, seats]) => (
                  <span key={party} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white" style={{ backgroundColor: colors[party] ?? "#57534e" }} title={display[party] ?? party}>
                    {party} · {seats}
                  </span>
                ))}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs uppercase tracking-wide text-stone-500">Escaños 2026</dt><dd className="mt-0.5 font-serif text-2xl">{detail.seats_2026 ?? detail.seats}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-stone-500">Escaños 2023</dt><dd className="mt-0.5 font-serif text-2xl">{detail.seats_2023}</dd></div>
              </dl>
              <p className="mt-3 text-sm text-stone-600">
                Participación 2023: <strong>{fmtPct(detail.turnout_rate, 1)}</strong>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Cuota de voto en 2023 (base provincial)</p>
              <table className="mt-1 w-full text-sm">
                <caption className="sr-only">Cuotas de voto de 2023 en {detail.province_name}</caption>
                <thead><tr className="border-b border-line text-left"><th className="p-1.5">Partido</th><th className="p-1.5 text-right">Cuota</th><th className="p-1.5 text-right">Escaños 2023</th></tr></thead>
                <tbody className="tabular">
                  {Object.entries(detail.baseline_shares ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([party, share]) => (
                    <tr key={party} className="border-b border-line">
                      <td className="p-1.5"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[party] ?? "#a8a29e" }} aria-hidden="true" />{party}</td>
                      <td className="p-1.5 text-right">{fmtPct(share, 1)}</td>
                      <td className="p-1.5 text-right">{detail.seats_2023_official?.[party] ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Provenance items={["Interior 2023 para el reparto provincial", "RD 806/2026 para el número de escaños de 2026", "La ficha no proyecta el voto de 2026"]} />
        </Card>
      )}

      <Card
        title="Las 52 provincias"
        subtitle="Busca, filtra por comunidad autónoma o cambia el orden. La columna 2026 es el número fijo que se elige."
        actions={<CsvButton filename="diputados_por_provincia_2026.csv" rows={rows.map((p) => ({
          provincia: p.province_name, codigo: p.province_code, ccaa: p.ccaa,
          escanos_2026: p.seats_2026 ?? p.seats, escanos_2023: p.seats_2023,
          cambio: p.seats_change ?? 0, ganador_2023: p.winner, escanos_ganador_2023: p.winnerSeats,
        }))} />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar provincia o comunidad…"
            className="min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            aria-label="Buscar provincia"
          />
          <select value={ccaa} onChange={(e) => setCcaa(e.target.value)} className={selectClass} aria-label="Filtrar por comunidad autónoma">
            <option value="todas">Todas las comunidades</option>
            {ccaas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selectClass} aria-label="Ordenar provincias">
            <option value="seats">Más escaños</option>
            <option value="name">Nombre</option>
            <option value="change">Cambio 2026</option>
          </select>
          <Tag>{rows.length} provincias</Tag>
        </div>
        <div className="overflow-auto rounded-lg border border-line">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Escaños por provincia en 2026 y comparación con 2023</caption>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th className="p-2">Provincia</th><th className="p-2">Comunidad</th>
                  <th className="p-2 text-right">2026</th><th className="p-2 text-right">2023</th>
                  <th className="p-2 text-right">Cambio</th><th className="p-2">Ganador 2023</th>
                  <th className="p-2 text-right">Ficha</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((p) => (
                  <tr key={p.province_code} className="border-b border-line">
                    <td className="p-2">{p.province_name} <span className="text-xs text-stone-400">({p.province_code})</span></td>
                    <td className="p-2 text-stone-600">{p.ccaa}</td>
                    <td className="p-2 text-right font-medium">{p.seats_2026 ?? p.seats}</td>
                    <td className="p-2 text-right text-stone-500">{p.seats_2023}</td>
                    <td className={`p-2 text-right ${(p.seats_change ?? 0) > 0 ? "text-emerald-700" : (p.seats_change ?? 0) < 0 ? "text-red-700" : "text-stone-400"}`}>
                      {(p.seats_change ?? 0) === 0 ? "—" : `${(p.seats_change ?? 0) > 0 ? "+" : ""}${p.seats_change}`}
                    </td>
                    <td className="p-2">
                      {p.winner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[p.winner] ?? "#a8a29e" }} aria-hidden="true" />
                          {p.winner} <span className="text-xs text-stone-400">({p.winnerSeats})</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <button type="button" onClick={() => setSelected(p.province_code)} className="underline hover:text-accent">ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Provenance items={[
          "Escaños 2026: RD 806/2026; escaños 2023: RD 1032/2023",
          "Ganador 2023: partido con más escaños en la provincia, no más votos",
          "Los datos de voto son de 2023; no hay proyección de 2026",
        ]} />
      </Card>

      <p className="text-sm text-stone-600">
        ¿Quieres explorar un reparto hipotético con estos escaños?{" "}
        <Link href="/simulador" className="font-medium text-accent underline underline-offset-2">Abre el simulador D&apos;Hondt</Link>.
      </p>
    </div>
  );
}
