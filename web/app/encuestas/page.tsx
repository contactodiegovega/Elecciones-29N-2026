"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance, SectionTitle } from "@/components/ui";
import { loadColors, loadPolls, type ColorEntry, type Poll } from "@/lib/data";
import { partyColor } from "@/lib/utils";

const PARTIES = ["PP", "PSOE", "VOX", "SUMAR"];

export default function Encuestas() {
  const [cycle, setCycle] = useState<"2023" | "2026">("2026");
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [house, setHouse] = useState<string>("TODAS");
  const [ptype, setPtype] = useState<string>("estimated_vote");
  const [party, setParty] = useState("PP");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadPolls(cycle), loadColors()])
      .then(([p, c]) => { setPolls(p); setColors(c); })
      .catch((e) => setErr(String(e)));
  }, [cycle]);

  const houses = useMemo(() => [...new Set((polls ?? []).map((p) => p.pollster))].sort(), [polls]);
  const types = useMemo(() => [...new Set((polls ?? []).map((p) => p.type))], [polls]);

  const points = useMemo(() => {
    if (!polls) return [];
    return polls
      .filter((p) => (house === "TODAS" || p.pollster === house) && p.type === ptype && p.fw_end)
      .flatMap((p) => (p.est.find((e) => e.p === party)?.v != null
        ? [{ x: p.fw_end as string, y: p.est.find((e) => e.p === party)!.v, house: p.pollster, n: p.n, id: p.id,
             replica: p.canonical !== p.id }]
        : []))
      .sort((a, b) => a.x.localeCompare(b.x));
  }, [polls, house, ptype, party]);

  const official = cycle === "2023" ? { PP: 33.33, PSOE: 31.94, VOX: 12.48 }[party] : null;

  if (err) return <Empty what={err} />;
  if (!polls) return <p role="status">Cargando sondeos…</p>;

  const option = {
    tooltip: {
      trigger: "item" as const,
      formatter: (p: { data?: { house?: string; n?: number | null; id?: string; replica?: boolean } }) =>
        `${p.data?.house ?? ""} · n=${p.data?.n ?? "n.d."}${p.data?.replica ? " (réplica: no independiente)" : ""}<br/>${p.data?.id ?? ""}`,
    },
    xAxis: { type: "time" as const, name: "Fin de trabajo de campo" },
    yAxis: { type: "value" as const, name: "% estimado" },
    series: [{
      name: party, type: "scatter" as const,
      data: points.map((pt) => ({ value: [pt.x, pt.y], ...pt })),
      itemStyle: { color: partyColor(party, colors).hex },
      markLine: official != null ? {
        silent: true, data: [{ yAxis: official }],
        label: { formatter: `Oficial 2023: ${official} %` }, lineStyle: { type: "dashed" as const },
      } : undefined,
    }],
  };

  return (
    <div>
      <SectionTitle kicker="Sondeos" title="Observatorio de encuestas"
        desc="Mediciones publicadas por encuestadora, fechadas y con tipo separado. Estimación de voto e intención directa jamás se mezclan. Las réplicas no cuentan como independientes." />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">Ciclo: <select value={cycle} onChange={(e) => setCycle(e.target.value as "2023" | "2026")}
          className="rounded border border-line px-2 py-1" aria-label="Ciclo de encuestas">
          <option value="2023">2023 (evaluación vs resultado oficial)</option>
          <option value="2026">2026 (mediciones, sin resultado aún)</option></select></label>
        <label className="text-sm">Tipo: <select value={ptype} onChange={(e) => setPtype(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Tipo de medición">
          {types.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label className="text-sm">Partido: <select value={party} onChange={(e) => setParty(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Partido">
          {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        <label className="text-sm">Casa: <select value={house} onChange={(e) => setHouse(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Encuestadora">
          <option value="TODAS">TODAS ({houses.length})</option>
          {houses.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
        <button type="button" onClick={() => { setHouse("TODAS"); setPtype("estimated_vote"); setParty("PP"); }}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
        <CsvButton filename={`sondeos_${cycle}_${party}_${ptype}.csv`} label="Exportar CSV"
          rows={points as unknown as Record<string, unknown>[]} />
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <EChart option={option} height={440}
          ariaLabel={`Serie de ${ptype} para ${party} en el ciclo ${cycle}. ${points.length} observaciones.`} />
        <Provenance items={[
          "Compilación Wikipedia CC BY-SA 4.0 (revs 1380368158/1375363334); no transfiere permisos de fuentes primarias",
          `${points.length} observaciones (${points.filter((p) => p.replica).length} réplicas marcadas, no independientes)`,
          cycle === "2023" ? "Línea discontinua: resultado oficial Interior (entidad comparable)" : "Sin resultado oficial: prohibido leer tendencia como pronóstico",
          "Fecha usada: fin de trabajo de campo (publicación desconocida en origen)"]} />
      </div>
      <p className="mt-3 text-sm text-stone-600">
        Ficha de procedencia: cada punto conserva encuestadora, patrocinador, muestra, fechas,
        tipo y revisión wiki. Licencias y pendientes en la documentación de fase 2.
      </p>
    </div>
  );
}
