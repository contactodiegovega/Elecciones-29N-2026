"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import { CsvButton, Empty, Provenance, SectionTitle } from "@/components/ui";
import { loadColors, loadLabels, loadMeta, loadNational, type ColorEntry, type ElectionNat, type LabelRow, type Meta } from "@/lib/data";
import { fmtInt, fmtPct, fmtPp, partyColor } from "@/lib/utils";

type Metric = "votos" | "cuota" | "escanos";

export default function Historico() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [metric, setMetric] = useState<Metric>("cuota");
  const [sel, setSel] = useState<string[]>(["PP", "PSOE", "VOX"]);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [eA, setEA] = useState("2019-11-10");
  const [eB, setEB] = useState("2023-07-23");
  const [rowsA, setRowsA] = useState<LabelRow[] | null>(null);
  const [rowsB, setRowsB] = useState<LabelRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadNational(), loadColors()])
      .then(([m, n, c]) => { setMeta(m); setNat(n); setColors(c); })
      .catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => {
    Promise.all([loadLabels(eA), loadLabels(eB)]).then(([a, b]) => { setRowsA(a); setRowsB(b); }).catch(() => setRowsA([]));
  }, [eA, eB]);

  const parties = useMemo(() => {
    if (!nat) return [];
    const s = new Map<string, number>();
    for (const e of nat) for (const p of e.parties) s.set(p.party_id, (s.get(p.party_id) ?? 0) + p.votes);
    return [...s.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [nat]);

  const visible = useMemo(() => {
    if (showAll) return parties;
    const base = sel.filter((p) => parties.includes(p));
    if (q.trim()) return [...new Set([...base, ...parties.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()))])].slice(0, 12);
    return base;
  }, [sel, showAll, parties, q]);

  const changes = useMemo(() => {
    if (!rowsA || !rowsB) return null;
    const agg = (rows: LabelRow[]) => {
      const m = new Map<string, { v: number; s: number }>();
      for (const r of rows) {
        const k = r.party ?? `UNMAPPED:${r.label}`;
        m.set(k, { v: (m.get(k)?.v ?? 0) + r.v, s: (m.get(k)?.s ?? 0) + r.s });
      }
      return m;
    };
    const A = agg(rowsA); const B = agg(rowsB);
    const denA = rowsA.reduce((a, r) => a + r.v, 0); const denB = rowsB.reduce((a, r) => a + r.v, 0);
    return [...new Set([...A.keys(), ...B.keys()])].map((k) => {
      const a = A.get(k); const b = B.get(k);
      return {
        party: k,
        dv: (b?.v ?? 0) - (a?.v ?? 0),
        dpp: (b ? b.v / denB * 100 : 0) - (a ? a.v / denA * 100 : 0),
        comparable: Boolean(a && b),
      };
    }).sort((x, y) => y.dpp - x.dpp);
  }, [rowsA, rowsB]);

  if (err) return <Empty what={err} />;
  if (!meta || !nat) return <p role="status">Cargando…</p>;

  const val = (e: ElectionNat, p: string) => {
    const f = e.parties.find((x) => x.party_id === p);
    if (!f) return null;
    return metric === "votos" ? f.votes / 1e6 : metric === "cuota" ? +f.share.toFixed(2) : f.seats;
  };
  const option = {
    tooltip: { trigger: "axis" as const },
    legend: { type: "scroll" as const, bottom: 0 },
    xAxis: { type: "category" as const, data: nat.map((e) => e.election.slice(0, 4)) },
    yAxis: { type: "value" as const, name: metric === "votos" ? "Millones" : metric === "cuota" ? "% voto" : "Escaños" },
    series: visible.map((p, i) => ({
      name: p, type: "line" as const,
      data: nat.map((e) => val(e, p)),
      itemStyle: { color: partyColor(p.startsWith("UNMAPPED") ? null : p, colors).hex },
      symbol: ["circle", "rect", "triangle", "diamond", "pin", "roundRect"][i % 6],
    })),
  };

  return (
    <div>
      <SectionTitle kicker="Serie temporal" title="Histórico 1977–2023"
        desc="Voto absoluto, cuota, escaños y participación por elección. Las series por partido usan el mapeo versionado; la tabla conserva todas las etiquetas originales." />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">Métrica:
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="ml-1 rounded border border-line px-2 py-1" aria-label="Métrica">
            <option value="votos">Votos absolutos</option>
            <option value="cuota">Cuota de voto (%)</option>
            <option value="escanos">Escaños</option>
          </select></label>
        <label className="text-sm">Buscar: <input value={q} onChange={(e) => setQ(e.target.value)}
          className="rounded border border-line px-2 py-1 text-sm" placeholder="sigla o nombre" aria-label="Buscar candidatura o partido" /></label>
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">
          {showAll ? "Ver selección" : `Ver Todos (${parties.length})`}</button>
      </div>
      {!showAll && (
        <div className="mb-3 flex max-h-28 flex-wrap gap-2 overflow-auto" role="group" aria-label="Partidos">
          {parties.map((p) => (
            <label key={p} className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs">
              <input type="checkbox" checked={sel.includes(p)}
                onChange={() => setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))} />
              <span aria-hidden="true" style={{ color: partyColor(p, colors).hex }}>●</span> {p}
            </label>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-line bg-white p-4">
        <EChart option={option} height={420} ariaLabel="Evolución histórica por partido" />
        <Provenance items={["Interior", "Cuota sobre votos a candidaturas del ciclo", "Huecos = sin presencia mapeada (no ceros)"]} />
      </div>

      <h2 className="mb-2 mt-8 font-serif text-2xl">Cambios entre dos elecciones</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="text-sm">De: <select value={eA} onChange={(e) => setEA(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Elección base">
          {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
        <label className="text-sm">A: <select value={eB} onChange={(e) => setEB(e.target.value)}
          className="rounded border border-line px-2 py-1" aria-label="Elección comparada">
          {meta.elections.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
        {changes && <CsvButton filename={`cambios_${eA}_${eB}.csv`} rows={changes as unknown as Record<string, unknown>[]} />}
      </div>
      {changes ? (
        <div className="overflow-auto rounded-lg border border-line bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Cambios por partido entre elecciones</caption>
            <thead><tr className="border-b border-line text-left">
              <th className="p-2">Partido</th><th className="p-2">Δ votos</th><th className="p-2">Δ pp</th><th className="p-2">Comparable</th>
            </tr></thead>
            <tbody>
              {changes.slice(0, 20).map((c) => (
                <tr key={c.party} className="border-b border-line">
                  <td className="p-2">{c.party}</td>
                  <td className="p-2">{fmtInt(c.dv)}</td>
                  <td className="p-2">{fmtPp(c.dpp)}</td>
                  <td className="p-2">{c.comparable ? "sí" : "no (perímetro distinto)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty what="cambios (cargando detalle por elección)" />}

      <h2 className="mb-2 mt-8 font-serif text-2xl">Tabla completa ({eB})</h2>
      {rowsB ? (
        <div className="overflow-auto rounded-lg border border-line bg-white" style={{ maxHeight: 480 }}>
          <table className="w-full text-sm">
            <caption className="sr-only">Todas las candidaturas de la elección</caption>
            <thead className="sticky top-0 bg-white"><tr className="border-b border-line text-left">
              <th className="p-2">#</th><th className="p-2">Etiqueta original</th><th className="p-2">Partido</th>
              <th className="p-2">Votos</th><th className="p-2">Cuota %</th><th className="p-2">Escaños</th>
            </tr></thead>
            <tbody>
              {[...rowsB].sort((a, b) => b.v - a.v).map((r, i) => (
                <tr key={`${r.p}-${r.label}`} className="border-b border-line">
                  <td className="p-2">{i + 1}</td><td className="p-2">{r.label}</td>
                  <td className="p-2">{r.party ?? <em className="text-stone-500">sin mapear</em>}</td>
                  <td className="p-2">{fmtInt(r.v)}</td><td className="p-2">{fmtPct(r.share)}</td><td className="p-2">{r.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty what="detalle por etiqueta" />}
      {rowsB && <div className="mt-2"><CsvButton filename={`todas_${eB}.csv`} rows={rowsB as unknown as Record<string, unknown>[]} /></div>}
      <Provenance items={[`Interior (${rowsB?.length ?? "?"} filas prov×etiqueta agregadas por etiqueta)`, "Denominador: votos a candidaturas provincial"]} />
    </div>
  );
}
