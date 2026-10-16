"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance, SectionTitle } from "@/components/ui";
import { loadColors, loadNational, loadTaxonomy, type ColorEntry, type ElectionNat, type MappingRow } from "@/lib/data";
import { fmtInt, fmtPct, partyColor } from "@/lib/utils";

export default function Partidos() {
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"party" | "label">("party");
  const [sel, setSel] = useState<string[]>(["PP", "PSOE", "VOX"]);
  const [showAll, setShowAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadNational(), loadColors(), loadTaxonomy()])
      .then(([n, c, t]) => { setNat(n); setColors(c); setMapping(t.mapping); })
      .catch((e) => setErr(String(e)));
  }, []);

  const parties = useMemo(() => {
    if (!nat) return [];
    const s = new Map<string, number>();
    for (const e of nat) for (const p of e.parties) s.set(p.party_id, (s.get(p.party_id) ?? 0) + p.votes);
    return [...s.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [nat]);

  const labels = useMemo(() => [...new Set(mapping.map((m) => m.candidacy_raw))].sort(), [mapping]);
  const unmapped = useMemo(() => mapping.filter((m) => !m.party_id).length, [mapping]);

  const visible = useMemo(() => {
    const pool = mode === "party" ? parties : labels;
    if (showAll) return pool.slice(0, mode === "party" ? pool.length : 200);
    const base = sel.filter((p) => pool.includes(p));
    if (q.trim()) {
      const hit = pool.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()));
      return [...new Set([...base, ...hit])].slice(0, mode === "party" ? 12 : 30);
    }
    return base.slice(0, 5);
  }, [sel, showAll, parties, labels, mode, q]);

  if (err) return <Empty what={err} />;
  if (!nat) return <p role="status">Cargando catálogo…</p>;

  const seriesFor = (key: string) => {
    if (mode === "party") {
      return nat.map((e) => {
        const f = e.parties.find((x) => x.party_id === key);
        return f ? +f.share.toFixed(2) : null;
      });
    }
    return null; // etiquetas: serie nacional no agregada (ver tabla Todos por elección)
  };

  const option = {
    tooltip: { trigger: "axis" as const, valueFormatter: (v: number) => `${v} %` },
    legend: { type: "scroll" as const, bottom: 0 },
    xAxis: { type: "category" as const, data: nat.map((e) => e.election.slice(0, 4)) },
    yAxis: { type: "value" as const, name: "Cuota nacional (%)" },
    series: visible.filter((v) => mode === "party").map((p, i) => ({
      name: p, type: "line" as const, data: seriesFor(p),
      itemStyle: { color: partyColor(p, colors).hex },
      symbol: ["circle", "rect", "triangle", "diamond", "pin"][i % 5],
    })),
  };

  const detail = q.trim()
    ? mapping.filter((m) => m.candidacy_raw.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 100)
    : [];

  return (
    <div>
      <SectionTitle kicker="Catálogo" title="Partidos y candidaturas"
        desc={`36 partidos normalizados y 1.778 etiquetas originales (${unmapped} sin mapear, preservadas). Comparador de hasta 5 series; tabla y búsqueda siempre completas.`} />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">Vista: <select value={mode} onChange={(e) => { setMode(e.target.value as "party" | "label"); setShowAll(false); }}
          className="rounded border border-line px-2 py-1" aria-label="Vista original o normalizada">
          <option value="party">Partidos normalizados</option><option value="label">Etiquetas originales</option></select></label>
        <label className="text-sm">Buscar: <input value={q} onChange={(e) => setQ(e.target.value)}
          className="rounded border border-line px-2 py-1 text-sm" placeholder="1.778 etiquetas…" aria-label="Buscar entre todas las etiquetas" /></label>
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">
          {showAll ? "Ver selección" : mode === "party" ? `Ver Todos (${parties.length})` : "Ver muestra amplia"}</button>
        <button type="button" onClick={() => { setSel(["PP", "PSOE", "VOX"]); setQ(""); setShowAll(false); }}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
      </div>
      {mode === "party" && !showAll && (
        <div className="mb-3 flex max-h-28 flex-wrap gap-2 overflow-auto" role="group" aria-label="Comparador (máx. 5)">
          {parties.map((p) => (
            <label key={p} className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs">
              <input type="checkbox" checked={sel.includes(p)} disabled={!sel.includes(p) && sel.length >= 5}
                onChange={() => setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))} />
              <span aria-hidden="true" style={{ color: partyColor(p, colors).hex }}>●</span> {p}
            </label>
          ))}
        </div>
      )}
      {mode === "party" ? (
        <div className="rounded-lg border border-line bg-white p-4">
          <EChart option={option} height={420} ariaLabel="Comparador de cuota por partido" />
          <Provenance items={["Interior + taxonomía versionada", "Denominador: votos a candidaturas del ciclo", "Huecos = sin presencia (no ceros)"]} />
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-white p-4 text-sm text-stone-600">
          Las etiquetas originales se exploran por búsqueda o en la tabla de
          <a href="/historico" className="underline hover:text-accent"> Histórico</a> (81/81 en 2023,
          todas las elecciones con detalle íntegro y export CSV).
        </div>
      )}
      <h2 className="mb-2 mt-8 font-serif text-2xl">
        {q.trim() ? `Resultados de búsqueda (${detail.length}${detail.length >= 100 ? "+" : ""})` : "Verificación original → normalizado"}
      </h2>
      <div className="overflow-auto rounded-lg border border-line bg-white" style={{ maxHeight: 420 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white"><tr className="border-b border-line text-left">
            <th className="p-2">Elección</th><th className="p-2">Etiqueta original</th>
            <th className="p-2">Partido</th><th className="p-2">Confianza</th><th className="p-2">Color</th>
          </tr></thead>
          <tbody>
            {(detail.length ? detail : mapping.slice(0, 60)).map((m) => {
              const c = partyColor(m.party_id, colors);
              return (
                <tr key={m.candidacy_id} className="border-b border-line">
                  <td className="p-2">{m.election_date}</td><td className="p-2">{m.candidacy_raw}</td>
                  <td className="p-2">{m.party_id ?? <em className="text-stone-500">sin mapear</em>}</td>
                  <td className="p-2">{m.confidence}</td>
                  <td className="p-2"><span aria-hidden="true" style={{ color: c.hex }}>●</span>
                    <span className="sr-only">{c.origin}</span> {m.party_id ? c.hex : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {detail.length > 0 && <div className="mt-2"><CsvButton filename="catalogo_busqueda.csv"
        rows={detail as unknown as Record<string, unknown>[]} /></div>}
      <p className="mt-3 text-sm text-stone-600">
        Cobertura nacional 2023: 98,56 % del voto mapeado (mínimo 2016: 77,37 % por confluencias
        no fusionables). Ver metodología en <a href="/metodologia" className="underline hover:text-accent">Metodología</a>.
        Ejemplos minoritarios/territoriales: busca «PUM», «BILDU», «HB» o «PAR».
      </p>
    </div>
  );
}
