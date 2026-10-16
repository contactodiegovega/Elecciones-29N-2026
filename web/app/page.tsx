"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance } from "@/components/ui";
import { loadColors, loadMeta, loadNational, type ColorEntry, type ElectionNat, type Meta } from "@/lib/data";
import { downloadCSV, fmtInt, fmtPct, partyColor } from "@/lib/utils";

const PRESET = ["PP", "PSOE", "VOX", "SUMAR"];

export default function Home() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [sel, setSel] = useState<string[]>(PRESET);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadNational(), loadColors()])
      .then(([m, n, c]) => { setMeta(m); setNat(n); setColors(c); })
      .catch((e) => setErr(String(e)));
  }, []);

  const parties = useMemo(() => {
    if (!nat) return [];
    const s = new Map<string, number>();
    for (const e of nat) for (const p of e.parties) s.set(p.party_id, (s.get(p.party_id) ?? 0) + p.votes);
    return [...s.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [nat]);

  const visible = useMemo(() => {
    if (showAll) return parties;
    const base = sel.filter((p) => parties.includes(p));
    if (q.trim()) {
      const hit = parties.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()));
      return [...new Set([...base, ...hit])].slice(0, 12);
    }
    return base;
  }, [sel, showAll, parties, q]);

  if (err) return <Empty what={err} />;
  if (!meta || !nat) return <p role="status">Cargando datos reales…</p>;
  const last = nat[nat.length - 1];

  const option = {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${(v / 1e6).toFixed(2)} M votos` },
    legend: { type: "scroll" as const, bottom: 0 },
    xAxis: { type: "category" as const, data: nat.map((e) => e.election.slice(0, 4)) },
    yAxis: { type: "value" as const, name: "Millones de votos" },
    series: visible.map((p, i) => ({
      name: p, type: "line" as const,
      data: nat.map((e) => {
        const f = e.parties.find((x) => x.party_id === p);
        return f ? +(f.votes / 1e6).toFixed(3) : null;
      }),
      itemStyle: { color: partyColor(p, colors).hex },
      lineStyle: { width: 2 },
      symbol: ["circle", "rect", "triangle", "diamond", "pin", "roundRect"][i % 6],
      connectNulls: false,
    })),
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Observatorio electoral · 1977–2023</p>
      <h1 className="font-serif text-4xl md:text-5xl">España en las urnas</h1>
      <p className="mt-3 max-w-3xl text-stone-600">
        Dieciséis elecciones generales al Congreso, 52 circunscripciones, 1.778 candidaturas
        originales y 1.232 sondeos: historia descriptiva y laboratorio de evaluación
        retrospectiva. Sin pronósticos del 29N-2026.
      </p>

      <section aria-label="Indicadores de la última elección" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Última elección", last.election],
          ["Electores", fmtInt(last.electores)],
          ["Participación", fmtPct(last.turnout)],
          ["Escaños", "350"],
          ["Candidaturas", fmtInt(last.n_labels)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-white p-3">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="font-serif text-xl">{v}</p>
          </div>
        ))}
      </section>

      <section aria-label="Serie histórica" className="mt-8 rounded-lg border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-sm">Buscar partido: <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="p. ej. BNG" className="rounded border border-line px-2 py-1 text-sm" aria-label="Buscar partido" /></label>
          <button type="button" onClick={() => setShowAll((v) => !v)}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent"
            aria-pressed={showAll}>
            {showAll ? "Ver selección" : `Ver Todos (${parties.length})`}
          </button>
          <button type="button" onClick={() => { setSel(PRESET); setShowAll(false); setQ(""); }}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
          <CsvButton filename="serie_nacional.csv" label="Exportar CSV"
            rows={nat.flatMap((e) => visible.map((p) => {
              const f = e.parties.find((x) => x.party_id === p);
              return { eleccion: e.election, partido: p, votos: f?.votes ?? "", cuota_pct: f?.share ?? "", escanos: f?.seats ?? "" };
            }))} />
        </div>
        {!showAll && (
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Partidos visibles">
            {parties.slice(0, 14).map((p) => (
              <label key={p} className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs">
                <input type="checkbox" checked={sel.includes(p)}
                  onChange={() => setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))} />
                <span aria-hidden="true" style={{ color: partyColor(p, colors).hex }}>●</span> {p}
              </label>
            ))}
          </div>
        )}
        <EChart option={option} height={440} ariaLabel="Serie histórica de votos por partido 1977 a 2023" />
        <Provenance items={["Ministerio del Interior (Elecciones-Congreso.xlsx, consulta 2026-10-16)",
          "Mapeo party_id versionado (477/1.778 etiquetas); no mapeados excluidos de series por partido, incluidos en tablas Todos"]} />
      </section>

      <section aria-label="Puertas de exploración" className="mt-8 grid gap-3 md:grid-cols-3">
        {[
          ["/historico", "Historia", "Voto, cuota, escaños y participación por elección y candidatura."],
          ["/territorio", "Territorio", "Atlas provincial con 52 circunscripciones."],
          ["/laboratorio-ml", "Laboratorio ML", "Backtesting retrospectivo honesto: el baseline mean3 (3,56 pp) sigue ganando."],
        ].map(([h, t, d]) => (
          <Link key={h} href={h} className="rounded-lg border border-line bg-white p-4 hover:border-accent">
            <p className="font-serif text-xl">{t}</p>
            <p className="mt-1 text-sm text-stone-600">{d}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
