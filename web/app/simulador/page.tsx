"use client";
import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts/core";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Notice, Provenance, SectionTitle,
  StatCard, Tag,
} from "@/components/ui";
import {
  loadGeo, loadPolls, loadPublicationStatus, loadSimulator,
  type Poll, type PublicationStatus, type Simulator,
} from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { allocateDHondt, fmtInt, fmtPct, fmtPp, median, partyColor } from "@/lib/utils";

const MAP = "spain-provinces-sim";
const MAJOR = ["PP", "PSOE", "VOX", "SUMAR", "ERC", "COMPROMIS", "JUNTS", "BILDU", "PNV", "CC", "BNG", "UPN", "OTROS", "PACMA", "CIU", "PAR"];

export default function Simulador() {
  const [sim, setSim] = useState<Simulator | null>(null);
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [shares, setShares] = useState<Record<string, number>>({});
  const [turnoutDelta, setTurnoutDelta] = useState(0);
  const [sensitivity, setSensitivity] = useState(0);
  const [scenario, setScenario] = useState("Base 2023");
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSimulator(), loadPublicationStatus(), loadPolls("2026"), loadGeo()])
      .then(([s, st, p, g]) => {
        setSim(s); setStatus(st); setPolls(p); setGeo(g);
        setShares(Object.fromEntries(s.parties.map((x) => [x.party_id, x.national_share])));
        try { echarts.registerMap(MAP, g as unknown as Parameters<typeof echarts.registerMap>[1]); } catch { /* ya registrado */ }
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const pollMedian = useMemo(() => {
    if (polls.length === 0) return null;
    const latest = new Map<string, Poll>();
    for (const p of polls) {
      if (p.type !== "estimated_vote" || !p.fw_end) continue;
      const cur = latest.get(p.pollster);
      if (!cur || (p.fw_end ?? "") > (cur.fw_end ?? "")) latest.set(p.pollster, p);
    }
    const perParty: Record<string, number[]> = {};
    for (const p of latest.values()) {
      for (const e of p.est) {
        if (!e.p || e.p.startsWith("poll_")) continue;
        (perParty[e.p] ??= []).push(e.v);
      }
    }
    const med = Object.fromEntries(Object.entries(perParty).map(([k, v]) => [k, median(v)]));
    const total = Object.values(med).reduce((a, b) => a + b, 0);
    const normalized = Object.fromEntries(Object.entries(med).map(([k, v]) => [k, +((v / total) * 100).toFixed(2)]));
    return { values: normalized, houses: latest.size };
  }, [polls]);

  const baseShares = useMemo(
    () => (sim ? Object.fromEntries(sim.parties.map((p) => [p.party_id, p.national_share])) : {}),
    [sim],
  );

  const result = useMemo(() => {
    if (!sim) return null;
    const parties = sim.parties.map((p) => p.party_id);
    const total = parties.reduce((a, p) => a + Math.max(0, shares[p] ?? 0), 0);
    const norm = Object.fromEntries(parties.map((p) => [p, total > 0 ? ((shares[p] ?? 0) / total) * 100 : 0]));

    const provinces = sim.provinces.map((prov) => {
      const raw: Record<string, number> = {};
      for (const p of parties) {
        const base = prov.baseline_shares[p] ?? 0;
        const delta = (norm[p] ?? 0) - (baseShares[p] ?? 0);
        let value = base + delta;
        if (value < 0) value = 0;
        if (turnoutDelta !== 0 && sensitivity !== 0) {
          const mult = 1 + (turnoutDelta / 100) * sensitivity * ((norm[p] ?? 0) / 25);
          value *= Math.max(0.2, mult);
        }
        raw[p] = value;
      }
      const valid = prov.valid_votes * (1 + turnoutDelta / 100);
      const sum = parties.reduce((a, p) => a + raw[p], 0);
      const votes = Object.fromEntries(parties.map((p) => [p, sum > 0 ? (raw[p] / sum) * valid : 0]));
      return {
        code: prov.province_code,
        name: prov.province_name,
        seats: prov.seats,
        votes,
        turnout: prov.turnout_rate,
      };
    });

    const allocation = allocateDHondt({ provinces, parties, thresholdPct: sim.threshold_pct });
    const totalSeats = Object.values(allocation.national).reduce((a, b) => a + b, 0);
    return { allocation, totalSeats, norm, totalRaw: total, provinces };
  }, [sim, shares, baseShares, turnoutDelta, sensitivity]);

  const official = useMemo(
    () => Object.fromEntries((sim?.parties ?? []).map((p) => [p.party_id, p.seats_2023_official])),
    [sim],
  );

  const seatDiff = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.allocation.national)
      .map(([party, seats]) => ({ party, seats, before: official[party] ?? 0, diff: seats - (official[party] ?? 0) }))
      .sort((a, b) => b.seats - a.seats);
  }, [result, official]);

  const validates = useMemo(() => {
    if (!result || !sim) return false;
    const sameShares = sim.parties.every((p) => Math.abs((shares[p.party_id] ?? 0) - p.national_share) < 0.001);
    const sameSeats = sim.parties.every((p) => result.allocation.national[p.party_id] === p.seats_2023_official);
    return sameShares && turnoutDelta === 0 && sameSeats && result.totalSeats === sim.total_seats;
  }, [result, sim, shares, turnoutDelta]);

  const applyPreset = (preset: "base" | "polls") => {
    if (!sim) return;
    if (preset === "base") {
      setShares(baseShares); setTurnoutDelta(0); setSensitivity(0); setScenario("Base 2023"); return;
    }
    if (!pollMedian) return;
    const next = Object.fromEntries(sim.parties.map((p) => [p.party_id, pollMedian.values[p.party_id] ?? 0]));
    setShares(next); setScenario(`Mediana de encuestas recientes (${pollMedian.houses} casas)`);
  };

  const setAll = (value: number) => {
    if (!sim) return;
    setShares(Object.fromEntries(sim.parties.map((p) => [p.party_id, value])));
    setScenario("Personalizado");
  };

  if (err) return <ErrorBox message={err} />;
  if (!sim || !result) return <Loading what="simulador" />;

  const winner = seatDiff[0];
  const majority = Math.floor(sim.total_seats / 2) + 1;
  const colors = Object.fromEntries(sim.parties.map((p) => [p.party_id, p.hex_color]));
  const partyList = [...sim.parties].sort((a, b) => (shares[b.party_id] ?? 0) - (shares[a.party_id] ?? 0));

  const seatOption = {
    grid: { ...gridBase, top: 20, bottom: 24, right: 44 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v} escaños` },
    xAxis: { type: "value", ...axisY, max: Math.max(160, winner?.seats ?? 160) + 10 },
    yAxis: { type: "category", ...axisX, data: seatDiff.filter((d) => d.seats > 0).map((d) => d.party).reverse() },
    series: [{
      type: "bar", barMaxWidth: 20,
      data: seatDiff.filter((d) => d.seats > 0).map((d) => ({
        value: d.seats, itemStyle: { color: colors[d.party] ?? "#57534e", borderRadius: [0, 3, 3, 0] },
      })).reverse(),
      label: { show: true, position: "right", fontSize: 11, color: "#57534e" },
      markLine: {
        silent: true, symbol: "none", data: [{ xAxis: majority }],
        lineStyle: { color: "#c2410c", type: "dashed" },
        label: { formatter: `mayoría ${majority}`, fontSize: 10, color: "#c2410c" },
      },
    }],
  };

  const diffOption = {
    grid: { ...gridBase, top: 20, bottom: 24, right: 44 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", ...axisY },
    yAxis: { type: "category", ...axisX, data: seatDiff.filter((d) => d.before > 0 || d.seats > 0).map((d) => d.party).reverse() },
    series: [{
      type: "bar", barMaxWidth: 18,
      data: seatDiff.filter((d) => d.before > 0 || d.seats > 0).map((d) => ({
        value: d.diff, itemStyle: { color: d.diff >= 0 ? "#0f766e" : "#b91c1c", borderRadius: 3 },
      })).reverse(),
      label: { show: true, position: "right", fontSize: 10, formatter: (p: { value?: number }) => `${(p.value ?? 0) > 0 ? "+" : ""}${p.value ?? 0}` },
    }],
  };

  const winnerByProvince = result.allocation.byProvince.map((p) => {
    const top = Object.entries(p.allocation).sort((a, b) => b[1] - a[1])[0];
    return { code: p.code, name: p.name, winner: top?.[0] ?? null, seats: p.seats, allocation: p.allocation, share: p.share };
  });

  const mapOption = geo ? {
    tooltip: {
      ...tooltipBase, trigger: "item",
      formatter: (p: { name?: string; value?: number }) => {
        const row = winnerByProvince.find((w) => w.code === p.name);
        if (!row) return String(p.name ?? "");
        const alloc = Object.entries(row.allocation).filter(([, s]) => s > 0).map(([k, s]) => `${k} ${s}`).join(" · ");
        return `<strong>${row.name}</strong><br/>${row.seats} escaños<br/>${alloc}`;
      },
    },
    visualMap: { show: false, min: 0, max: 1, inRange: { color: ["#f5f5f4", "#f5f5f4"] } },
    series: [{
      type: "map", map: MAP, roam: true, nameProperty: "province_code",
      selectedMode: "single",
      data: winnerByProvince.map((w) => ({
        name: w.code,
        value: 1,
        itemStyle: { areaColor: w.winner ? colors[w.winner] ?? "#a8a29e" : "#e7e5e4", opacity: 0.85 },
        selected: selected === w.code,
      })),
      itemStyle: { borderColor: "#ffffff", borderWidth: 0.7 },
      emphasis: { itemStyle: { areaColor: "#fbbf24" }, label: { show: true, fontSize: 10 } },
      select: { itemStyle: { areaColor: "#f59e0b" }, label: { show: true, fontSize: 10 } },
    }],
  } : null;

  const detail = selected ? result.allocation.byProvince.find((p) => p.code === selected) : null;

  const csvRows = seatDiff.map((d) => ({
    escenario: scenario,
    partido: d.party,
    escanos: d.seats,
    escanos_2023: d.before,
    diferencia: d.diff,
    cuota_entrada_pct: +(result.norm[d.party] ?? 0).toFixed(2),
    participacion_delta: turnoutDelta,
    sensibilidad: sensitivity,
  }));

  const thresholdLosers = partyList.filter((p) => (result.norm[p.party_id] ?? 0) < sim.threshold_pct && (result.norm[p.party_id] ?? 0) > 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Herramienta hipotética"
        title="Simulador D'Hondt"
        desc="Reparte los 350 escaños con las reglas reales: D'Hondt por circunscripción y umbral del 3 % de votos válidos. Cambia los porcentajes y la participación para explorar escenarios. No es un pronóstico ni una probabilidad."
        updated={sim.generated_at?.slice(0, 10)}
        sources={["Interior 2023 (base provincial)", "Reglas D'Hondt y umbral legal", "Encuestas 2026 (solo como preset descriptivo)"]}
      />

      <Notice title="Esto no predice el 29N">
        El escenario es una aritmética condicional: «si estos porcentajes fueran los votos, el reparto sería este».
        No incorpora pactos, investidura, coaliciones, voto útil estratégico ni incertidumbre muestral.
        {status?.restricted ? " Veda de sondeos activa: no se publican escenarios derivados de encuestas." : ""}
      </Notice>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Escaños repartidos" value={result.totalSeats} hint={`${sim.provinces.length} circunscripciones`} />
        <StatCard label="Mayoría absoluta" value={majority} hint="Mitad del Congreso + 1" />
        <StatCard label="Primera fuerza" value={winner ? `${winner.party} · ${winner.seats}` : "—"} hint={winner ? `${fmtPct(result.norm[winner.party] ?? 0)} de voto` : undefined} accent={winner ? colors[winner.party] : undefined} />
        <StatCard label="Suma de entrada" value={fmtPct(result.totalRaw, 1)} hint="Se normaliza a 100 para el reparto" />
      </div>

      <Card title="Escenario de voto" subtitle="Ajusta cada partido. La suma se normaliza automáticamente, así que el reparto siempre es coherente.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => applyPreset("base")} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">
            Base 2023
          </button>
          <button type="button" onClick={() => applyPreset("polls")} disabled={!pollMedian}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-40">
            Media de encuestas recientes{pollMedian ? ` (${pollMedian.houses} casas)` : ""}
          </button>
          <button type="button" onClick={() => setAll(0)} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">
            Poner a cero
          </button>
          <Tag tone="info">{scenario}</Tag>
          <CsvButton filename="simulador_escenario.csv" rows={csvRows} label="Exportar reparto" />
        </div>

        <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {partyList.map((p) => {
            const v = shares[p.party_id] ?? 0;
            return (
              <label key={p.party_id} className="grid grid-cols-[92px_1fr_64px] items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 truncate" title={p.display_name}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.hex_color }} aria-hidden="true" />
                  {p.party_id}
                </span>
                <input
                  type="range" min={0} max={50} step={0.1} value={v}
                  onChange={(e) => { setShares((s) => ({ ...s, [p.party_id]: +e.target.value })); setScenario("Personalizado"); }}
                  aria-label={`Porcentaje de ${p.display_name}`}
                />
                <span className="tabular text-right text-xs text-stone-600">{v.toFixed(1)} %</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="flex items-center justify-between">
              <span>Cambio de participación</span>
              <strong className="tabular">{fmtPp(turnoutDelta, 1)}</strong>
            </span>
            <input type="range" min={-15} max={15} step={0.5} value={turnoutDelta}
              onChange={(e) => { setTurnoutDelta(+e.target.value); setScenario("Personalizado"); }}
              className="mt-1 w-full" aria-label="Cambio de participación" />
            <span className="text-xs text-stone-500">Ajusta los votos válidos de cada provincia. Con sensibilidad 0 no altera el reparto.</span>
          </label>
          <label className="text-sm">
            <span className="flex items-center justify-between">
              <span>Sensibilidad diferencial</span>
              <strong className="tabular">{sensitivity.toFixed(2)}</strong>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={sensitivity}
              onChange={(e) => { setSensitivity(+e.target.value); setScenario("Personalizado"); }}
              className="mt-1 w-full" aria-label="Sensibilidad de la participación por tamaño de partido" />
            <span className="text-xs text-stone-500">0 = neutro. Valores &gt; 0 hacen que la participación favorezca algo más a los partidos grandes. Es un supuesto, no una estimación.</span>
          </label>
        </div>

        <Provenance items={[
          "Base: porcentajes nacionales de 2023 y patrón provincial de Interior",
          "Swing aditivo uniforme por partido; formaciones sin base se reparten con el swing",
          "La suma de entrada no llega a 100 porque excluye etiquetas sin mapear y voto nulo/blanco",
          validates ? "Validación: candidaturas originales de 2023 → 350/350 y 0 discrepancias; la base agregada suma 350 pero puede diferir en 1 escaño" : "Validación disponible al restablecer «Base 2023»",
        ]} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Reparto de escaños" subtitle={`Umbral legal del ${sim.threshold_pct} % por circunscripción`}>
          <EChart option={seatOption} height={380} ariaLabel="Escaños por partido en el escenario" testId="sim-escanos" />
          {validates && <p className="mt-2 text-xs font-medium text-emerald-700">✓ El motor reparte los 350 escaños. En Las Palmas la agregación NC-bc + CCa → CC da PP 136 / CC 2; con candidaturas originales el oficial es PP 137 / CC 1.</p>}
          <Provenance items={["Cálculo propio con reglas D'Hondt", "Los escaños son hipotéticos"]} />
        </Card>
        <Card title="Diferencia vs 2023" subtitle="Escaños ganados o perdidos respecto al resultado oficial">
          <EChart option={diffOption} height={380} ariaLabel="Diferencia de escaños respecto a 2023" testId="sim-diferencia" />
          <Provenance items={["Interior 2023", "Verde gana, rojo pierde"]} />
        </Card>
      </div>

      {mapOption && (
        <Card title="Ganador por provincia" subtitle="Color = partido con más escaños en la circunscripción. Haz clic para ver el detalle.">
          <EChart option={mapOption} height={460} ariaLabel="Mapa del partido ganador por provincia" testId="sim-mapa"
            onEvents={{ click: (params) => {
              const p = params as { name?: string };
              if (p.name) setSelected(p.name === selected ? null : p.name);
            } }} />
          <Provenance items={["Geometría: Eurostat GISCO", "Empates resueltos por orden de escaños; el mapa no representa pactos"]} />
        </Card>
      )}

      <Card title="Desglose provincial" subtitle={detail ? `Ficha de ${detail.name}` : "Todas las circunscripciones del escenario"}>
        {detail ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 className="font-serif text-xl">{detail.name} · {detail.seats} escaños</h3>
              <button type="button" className="text-sm underline hover:text-accent" onClick={() => setSelected(null)}>ver todas</button>
            </div>
            <table className="w-full text-sm">
              <caption className="sr-only">Reparto del escenario en la provincia seleccionada</caption>
              <thead><tr className="border-b border-line text-left">
                <th className="p-2">Partido</th><th className="p-2 text-right">Votos</th><th className="p-2 text-right">Cuota</th><th className="p-2 text-right">Escaños</th>
              </tr></thead>
              <tbody className="tabular">
                {Object.entries(detail.allocation).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([p, s]) => (
                  <tr key={p} className="border-b border-line">
                    <td className="p-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[p] }} aria-hidden="true" />{p}</td>
                    <td className="p-2 text-right">{fmtInt(detail.votes[p])}</td>
                    <td className="p-2 text-right">{fmtPct(detail.share[p], 1)}</td>
                    <td className="p-2 text-right font-medium">{s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Escaños por provincia y partido</caption>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th className="p-2">Provincia</th><th className="p-2 text-right">Escaños</th>
                  <th className="p-2">Reparto</th><th className="p-2 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {winnerByProvince.map((p) => (
                  <tr key={p.code} className="border-b border-line">
                    <td className="p-2">{p.name} <span className="text-xs text-stone-400">({p.code})</span></td>
                    <td className="p-2 text-right tabular">{p.seats}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(p.allocation).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([k, s]) => (
                          <span key={k} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: colors[k] }}>
                            {k} {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <button type="button" className="underline hover:text-accent" onClick={() => setSelected(p.code)}>ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance items={["Cálculo D'Hondt del escenario activo", "No se modelan pactos ni investidura"]} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Supuestos del motor" subtitle="Documentados en simulator.json">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
            {sim.assumptions.map((a) => <li key={a}>{a}</li>)}
          </ol>
          <Provenance items={["simulator.json", "Umbral y circunscripciones verificados contra 2023"]} />
        </Card>
        <Card title="Límites y advertencias" subtitle="Lo que el simulador no puede decir">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
            {sim.caveats.map((c) => <li key={c}>{c}</li>)}
            <li>Partidos por debajo del {sim.threshold_pct} % nacional pueden aun así obtener escaño en provincias pequeñas si superan el umbral provincial: el umbral se aplica por circunscripción.</li>
            {thresholdLosers.length > 0 && (
              <li>{thresholdLosers.map((p) => p.party_id).join(", ")} quedan por debajo del {sim.threshold_pct} % en el escenario.</li>
            )}
          </ul>
          <Provenance items={["Validación: " + (sim.validation.ok ? "OK" : "revisar") + ` (${sim.validation.seats_allocated}/${sim.validation.seats_expected} escaños con candidaturas originales)`,
            `${sim.validation.mismatches.length} discrepancias en la validación 2023 con siglas originales`]} />
        </Card>
      </div>
    </div>
  );
}
