"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";
import {
  Card, CsvButton, Empty, ErrorBox, Loading, Provenance, SectionTitle,
  StatCard, Tag, selectClass,
} from "@/components/ui";
import { loadColors, loadNational, loadTaxonomy, type ColorEntry, type ElectionNat, type MappingRow } from "@/lib/data";
import { axisX, axisY, gridBase, legendBase, tooltipBase } from "@/lib/chart";
import { fmtInt, fmtPct, partyColor } from "@/lib/utils";

const DEFAULT = ["PP", "PSOE", "VOX", "SUMAR", "ERC", "JUNTS"];

export default function Partidos() {
  const [nat, setNat] = useState<ElectionNat[] | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [meta, setMeta] = useState<{ party_id: string; display_name: string; scope: string; kind: string; notes?: string }[]>([]);
  const [q, setQ] = useState("");
  const [conf, setConf] = useState("todas");
  const [sel, setSel] = useState<string[]>(DEFAULT);
  const [sort, setSort] = useState<"votes" | "share" | "elections">("votes");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadNational(), loadColors(), loadTaxonomy()])
      .then(([n, c, t]) => { setNat(n); setColors(c); setMapping(t.mapping); setMeta(t.parties); })
      .catch((e) => setErr(String(e)));
  }, []);

  const partyStats = useMemo(() => {
    if (!nat) return [];
    return meta.map((m) => {
      const appearances = nat.flatMap((e) => {
        const f = e.parties.find((x) => x.party_id === m.party_id);
        return f ? [{ election: e.election, ...f }] : [];
      });
      const totalVotes = appearances.reduce((a, p) => a + p.votes, 0);
      const totalSeats = appearances.reduce((a, p) => a + p.seats, 0);
      const best = appearances.reduce((a, p) => (!a || p.share > a.share ? p : a), null as null | (typeof appearances)[number]);
      const latest = appearances[appearances.length - 1];
      return {
        ...m, appearances: appearances.length, totalVotes, totalSeats,
        bestShare: best?.share ?? null, bestYear: best?.election.slice(0, 4) ?? null,
        latestShare: latest?.share ?? null, latestSeats: latest?.seats ?? null,
      };
    }).filter((p) => p.appearances > 0);
  }, [nat, meta]);

  const sorted = useMemo(() => [...partyStats].sort((a, b) => {
    if (sort === "share") return (b.bestShare ?? 0) - (a.bestShare ?? 0);
    if (sort === "elections") return b.appearances - a.appearances || b.totalVotes - a.totalVotes;
    return b.totalVotes - a.totalVotes;
  }), [partyStats, sort]);

  const filteredMapping = useMemo(() => {
    const term = q.trim().toLowerCase();
    return mapping.filter((m) => {
      if (conf !== "todas" && m.confidence !== conf) return false;
      if (!term) return true;
      return m.candidacy_raw.toLowerCase().includes(term) || m.candidacy_id.toLowerCase().includes(term) || (m.party_id ?? "").toLowerCase().includes(term);
    });
  }, [mapping, q, conf]);

  if (err) return <ErrorBox message={err} />;
  if (!nat) return <Loading what="catálogo de partidos" />;

  const chartOption = {
    grid: { ...gridBase, top: 30 },
    tooltip: { ...tooltipBase, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)} %` },
    legend: { ...legendBase },
    xAxis: { type: "category", data: nat.map((e) => e.election.slice(2, 4)), ...axisX },
    yAxis: { type: "value", ...axisY, name: "cuota nacional (%)", nameTextStyle: { color: "#78716c", fontSize: 11 } },
    series: sel.filter((p) => partyStats.some((s) => s.party_id === p)).map((p) => ({
      name: p, type: "line", connectNulls: false, symbolSize: 5,
      data: nat.map((e) => {
        const f = e.parties.find((x) => x.party_id === p);
        return f ? +f.share.toFixed(2) : null;
      }),
      itemStyle: { color: partyColor(p, colors).hex }, lineStyle: { width: 2.2 },
    })),
  };

  const unmapped = mapping.filter((m) => !m.party_id).length;
  const high = mapping.filter((m) => m.confidence === "high").length;
  const medium = mapping.filter((m) => m.confidence === "medium").length;

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Archivo · Catálogo"
        title="Partidos y candidaturas"
        desc={`${meta.length} partidos normalizados y ${fmtInt(mapping.length)} etiquetas originales. Las etiquetas no mapeadas no desaparecen: se conservan y se excluyen de las series por partido para no inventar equivalencias.`}
        sources={["Ministerio del Interior", "Taxonomía versionada 2026-10-16.v1", "Registro de colores"]}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Partidos" value={meta.length} hint={`${meta.filter((m) => m.scope === "national").length} nacionales · ${meta.filter((m) => m.scope === "regional").length} regionales`} />
        <StatCard label="Etiquetas originales" value={fmtInt(mapping.length)} hint="Tal como aparecen en el acta" />
        <StatCard label="Mapeadas" value={fmtInt(mapping.length - unmapped)} hint={`${high} alta · ${medium} media`} />
        <StatCard label="Sin mapear" value={fmtInt(unmapped)} hint={`${((unmapped / mapping.length) * 100).toFixed(1)} % · conservadas`} />
      </div>

      <Card
        title="Comparador de cuotas"
        subtitle="Hasta 6 partidos. Huecos = la formación no se presentó o no se mapeó; nunca cero."
        actions={
          <>
            <CsvButton filename="cuotas_partidos.csv" rows={nat.flatMap((e) => sel.map((p) => {
              const f = e.parties.find((x) => x.party_id === p);
              return { eleccion: e.election, partido: p, votos: f?.votes ?? "", cuota_pct: f?.share ?? "", escanos: f?.seats ?? "" };
            }))} />
            <button type="button" onClick={() => setSel(DEFAULT)} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Restablecer</button>
          </>
        }
      >
        <div className="mb-3 flex max-h-28 flex-wrap gap-1.5 overflow-auto" role="group" aria-label="Partidos del comparador">
          {partyStats.map((p) => {
            const active = sel.includes(p.party_id);
            return (
              <button key={p.party_id} type="button"
                onClick={() => setSel((s) => (s.includes(p.party_id) ? s.filter((x) => x !== p.party_id) : s.length >= 6 ? s : [...s, p.party_id]))}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${active ? "border-transparent text-white" : "border-line bg-white text-stone-600"}`}
                style={active ? { backgroundColor: partyColor(p.party_id, colors).hex } : undefined}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "#fff" : partyColor(p.party_id, colors).hex }} aria-hidden="true" />
                {p.party_id}
              </button>
            );
          })}
        </div>
        <EChart option={chartOption} height={420} ariaLabel="Comparador de cuota por partido" testId="partidos-series" />
        <Provenance items={["Interior + taxonomía versionada", "Denominador: votos a candidaturas del ciclo", "PP desde 1989; AP no se fusiona con PP"]} />
      </Card>

      <Card
        title="Ficha de partidos"
        subtitle="Agregados de todas las elecciones. El total de escaños es acumulado, no una composición simultánea."
        actions={
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selectClass} aria-label="Ordenar partidos">
            <option value="votes">Por votos totales</option>
            <option value="share">Por mejor cuota</option>
            <option value="elections">Por elecciones disputadas</option>
          </select>
        }
      >
        <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Partidos y agregados históricos</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line text-left">
                <th className="p-2">Partido</th><th className="p-2">Nombre</th><th className="p-2">Ámbito</th>
                <th className="p-2 text-right">Elecciones</th><th className="p-2 text-right">Votos totales</th>
                <th className="p-2 text-right">Mejor cuota</th><th className="p-2 text-right">Última cuota</th>
                <th className="p-2 text-right">Escaños acumulados</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {sorted.map((p) => {
                const col = partyColor(p.party_id, colors);
                return (
                  <tr key={p.party_id} className="border-b border-line">
                    <td className="p-2">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: col.hex }} aria-hidden="true" />
                      <span className="font-medium">{p.party_id}</span>
                    </td>
                    <td className="p-2 text-stone-600">{p.display_name}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <Tag>{p.scope === "national" ? "nacional" : "regional"}</Tag>
                        <Tag tone={p.kind === "coalition" ? "info" : "neutral"}>{p.kind === "coalition" ? "coalición" : "partido"}</Tag>
                      </div>
                    </td>
                    <td className="p-2 text-right">{p.appearances}</td>
                    <td className="p-2 text-right">{fmtInt(p.totalVotes)}</td>
                    <td className="p-2 text-right">{p.bestShare == null ? "—" : `${fmtPct(p.bestShare, 1)} (${p.bestYear})`}</td>
                    <td className="p-2 text-right">{p.latestShare == null ? "—" : fmtPct(p.latestShare, 1)}</td>
                    <td className="p-2 text-right">{p.totalSeats}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Provenance items={["Interior", "Los partidos sin apariciones nacionales mapeadas no figuran aquí", "Color del registro central; el fallback se marca en la tabla de verificación"]} />
      </Card>

      <Card
        title="Verificación etiqueta original → partido"
        subtitle={`${filteredMapping.length} de ${mapping.length} filas. Alta confianza = coincidencia explícita; media = alias documentado.`}
        actions={
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar etiqueta, id o partido"
              className="rounded-md border border-line px-2 py-1.5 text-sm" aria-label="Buscar etiquetas" />
            <select value={conf} onChange={(e) => setConf(e.target.value)} className={selectClass} aria-label="Filtrar por confianza">
              <option value="todas">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="unmapped">Sin mapear</option>
            </select>
            <CsvButton filename="taxonomia_filtrada.csv" rows={filteredMapping.slice(0, 500) as unknown as Record<string, unknown>[]} />
          </>
        }
      >
        {filteredMapping.length === 0 ? <Empty what="etiquetas con estos filtros" /> : (
          <div className="max-h-[480px] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Correspondencia entre etiquetas originales y partidos</caption>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left">
                  <th className="p-2">Elección</th><th className="p-2">Etiqueta original</th>
                  <th className="p-2">Partido</th><th className="p-2">Confianza</th><th className="p-2">Justificación</th>
                </tr>
              </thead>
              <tbody>
                {filteredMapping.slice(0, 400).map((m) => (
                  <tr key={`${m.election_date}-${m.candidacy_id}-${m.candidacy_raw}`} className="border-b border-line">
                    <td className="p-2 whitespace-nowrap text-stone-500">{m.election_date}</td>
                    <td className="p-2">{m.candidacy_raw}</td>
                    <td className="p-2">
                      {m.party_id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: partyColor(m.party_id, colors).hex }} aria-hidden="true" />
                          {m.party_id}
                        </span>
                      ) : <em className="text-stone-500">sin mapear</em>}
                    </td>
                    <td className="p-2"><Tag tone={m.confidence === "high" ? "good" : m.confidence === "medium" ? "info" : "warn"}>{m.confidence}</Tag></td>
                    <td className="p-2 text-xs text-stone-500">{m.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance items={["Taxonomía 2026-10-16.v1", `Mostrando hasta 400 de ${filteredMapping.length}`, "Cada etiqueta conserva su grafía original del acta"]} />
      </Card>
    </div>
  );
}
