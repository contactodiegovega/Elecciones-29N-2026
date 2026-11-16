import { z } from "zod";
import type { ProvinceData } from "./province";
import { LabelRowSchema, TurnoutRowSchema, type LabelRow } from "./types";
import { addVotes, analyzeLastSeat, shortCandidacy, transferVotes } from "./last-seat";

export const SnapshotSchema = z.object({ election: z.string(), seats: z.number().int().positive(), rows: z.array(LabelRowSchema), turnout: TurnoutRowSchema, colors: z.record(z.string(), z.string()) });
export type Snapshot = z.infer<typeof SnapshotSchema>;
export const HistorySchema = z.object({ code: z.string(), previous: SnapshotSchema, comparable: z.array(z.string()), source: z.url(), artifacts: z.array(z.string()).min(1), identityPolicy: z.object({ version: z.string(), rule: z.string(), reference: z.string(), note: z.string() }).passthrough() });
export type History = z.infer<typeof HistorySchema>;
export type SimulationMode = "add" | "transfer" | "redistribute";
export type ContextScenario = {
  id: string; type: "historical" | "illustrative"; mode: SimulationMode | "manual";
  reference: Snapshot; modified: Snapshot; before: ReturnType<typeof analyzeLastSeat>; after: ReturnType<typeof analyzeLastSeat>;
  to: string; from?: string; votes: number; referencePercent: number; shareDeltaPP: number;
  justification: string; sources: string[]; artifacts: string[]; identityNote?: string;
};
export const officialSnapshot = (data: ProvinceData): Snapshot => ({ election: data.election, seats: data.seats2023, rows: data.rows, turnout: data.turnout, colors: data.colors });
export function validatedOfficial(s: Snapshot, code: string) {
  try {
    SnapshotSchema.parse(s);
    const t = s.turnout;
    return s.rows.length > 0 && s.rows.every(r => r.p === code && r.v > 0 && Number.isSafeInteger(r.s) && r.s >= 0) &&
      t.province_code === code && t.election_date === s.election && Number.isSafeInteger(t.electores) && t.electores > 0 &&
      [t.votos_validos, t.votos_blancos, t.votos_nulos, t.votantes, t.votos_candidaturas].every(n => Number.isSafeInteger(n) && n >= 0) &&
      s.rows.reduce((sum, r) => sum + r.v, 0) === t.votos_candidaturas && t.votos_candidaturas + t.votos_blancos === t.votos_validos &&
      t.votos_validos + t.votos_nulos === t.votantes && t.votantes <= t.electores && analyzeLastSeat(s.rows, s.seats, t.votos_blancos).matchesOfficial;
  } catch { return false; }
}

/** Proportional withdrawal, integer largest remainders; blanks and total remain fixed.
 * No polling/behavioural interpretation: every other list funds the same proportional rule. */
export function redistributeVotes(rows: LabelRow[], to: string, amount: number): LabelRow[] {
  if (!rows.some(r => r.label === to) || !Number.isSafeInteger(amount) || amount < 0) throw new Error("Cantidad o candidatura no válida.");
  const donors = rows.filter(r => r.label !== to);
  const available = donors.reduce((sum, r) => sum + r.v, 0);
  if (amount > available) throw new Error("Las demás candidaturas no disponen de suficientes votos.");
  if (!amount) return rows.map(r => ({ ...r }));
  const shares = donors.map(r => ({ label: r.label, take: Math.floor(amount * r.v / available), remainder: amount * r.v % available }));
  const remaining = amount - shares.reduce((sum, s) => sum + s.take, 0);
  shares.sort((a, b) => b.remainder - a.remainder || a.label.localeCompare(b.label, "es"));
  shares.forEach((s, i) => { if (i < remaining) s.take++; });
  const withdrawals = new Map(shares.map(s => [s.label, s.take]));
  return rows.map(r => ({ ...r, v: r.label === to ? r.v + amount : r.v - (withdrawals.get(r.label) ?? 0) }));
}

export function simulate(reference: Snapshot, mode: SimulationMode, to: string, amount: number, from?: string): Snapshot {
  const rows = mode === "add" ? addVotes(reference.rows, to, amount) : mode === "transfer" ? transferVotes(reference.rows, from ?? "", to, amount) : redistributeVotes(reference.rows, to, amount);
  const valid = rows.reduce((sum, r) => sum + r.v, reference.turnout.votos_blancos);
  const voters = valid + reference.turnout.votos_nulos;
  if (voters > reference.turnout.electores) throw new Error("La adición excedería el censo de referencia bajo el supuesto de nuevos votantes.");
  return { ...reference, rows, turnout: { ...reference.turnout, votos_validos: valid, votos_candidaturas: valid - reference.turnout.votos_blancos, votantes: voters, turnout_rate: voters / reference.turnout.electores * 100 } };
}

export function illustrativeScenarios(data: ProvinceData, mode: SimulationMode, pp: 0.5 | 1 | 2): ContextScenario[] {
  const reference = officialSnapshot(data);
  if (!validatedOfficial(reference, data.code) || ![0.5, 1, 2].includes(pp)) return [];
  const before = analyzeLastSeat(reference.rows, reference.seats, reference.turnout.votos_blancos);
  const votes = Math.round(reference.turnout.votos_validos * pp / 100);
  if (!votes) return [];
  const parties = [...reference.rows].sort((a, b) => shortCandidacy(a.label).localeCompare(shortCandidacy(b.label), "es"));
  const result: ContextScenario[] = [];
  for (const party of parties) for (const source of mode === "transfer" ? parties.filter(r => r.label !== party.label) : [undefined]) {
    try {
      const modified = simulate(reference, mode, party.label, votes, source?.label);
      const after = analyzeLastSeat(modified.rows, modified.seats, modified.turnout.votos_blancos);
      if (after.allocated !== reference.seats) continue;
      result.push({ id: `${mode}:${pp}:${source?.label ?? ""}:${party.label}`, type: "illustrative", mode, reference, modified, before, after, to: party.label, from: source?.label, votes,
        referencePercent: votes / reference.turnout.votos_validos * 100,
        shareDeltaPP: ((party.v + votes) / after.validVotes - party.v / before.validVotes) * 100,
        justification: `Escala ilustrativa común de ${pp} puntos del voto válido de 2023, redondeada al voto entero. No procede de un modelo ni de evidencia de trasvases. ${mode === "add" ? "Se suponen nuevos votantes; blanco, nulos y censo constantes. La cuota final no aumenta exactamente esos puntos porque crece el denominador." : mode === "transfer" ? "Se resta al origen y se suma al destino; blanco, nulos, participación y total válido constantes." : "Se retira de todas las demás listas en proporción a sus votos, por restos mayores; blanco, nulos, participación y total constantes. Los restos empatados se ordenan por etiqueta."}`,
        sources: ["https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907"], artifacts: [`provinces/${data.code}.json`, "lib/contextual-scenarios.ts"] });
    } catch { /* A pair without sufficient source votes is explicitly unavailable, never clamped. */ }
  }
  return result;
}

export function historicalScenarios(data: ProvinceData, history: History): ContextScenario[] {
  const modified = officialSnapshot(data), reference = history.previous;
  if (history.code !== data.code || reference.election !== "2019-11-10" || !history.source || !history.artifacts.length || !history.identityPolicy.version ||
      !validatedOfficial(reference, data.code) || !validatedOfficial(modified, data.code)) return [];
  const before = analyzeLastSeat(reference.rows, reference.seats, reference.turnout.votos_blancos);
  const after = analyzeLastSeat(modified.rows, modified.seats, modified.turnout.votos_blancos);
  return [...new Set(history.comparable)].sort((a, b) => shortCandidacy(a).localeCompare(shortCandidacy(b), "es")).flatMap(label => {
    const previous = reference.rows.find(r => r.label === label), current = modified.rows.find(r => r.label === label);
    if (!previous || !current || !previous.party || previous.party !== current.party) return [];
    const votes = current.v - previous.v;
    return [{ id: `historical:${label}`, type: "historical" as const, mode: "manual" as const, reference, modified, before, after, to: label, votes,
      referencePercent: votes / before.validVotes * 100, shareDeltaPP: (current.v / after.validVotes - previous.v / before.validVotes) * 100,
      justification: "Dos resultados oficiales completos: cambiaron simultáneamente candidaturas, votos, blanco, nulos y censo. No se atribuye el reparto a esta variación aislada ni se identifican transferencias de votantes.",
      sources: [history.source, "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907"], artifacts: history.artifacts,
      identityNote: `${history.identityPolicy.version}: etiqueta completa idéntica de partido registrado, sin equivalencias entre coaliciones. ${history.identityPolicy.note}` }];
  });
}

export function seatChanges(s: Pick<ContextScenario, "before" | "after">): string {
  const labels = [...new Set([...Object.keys(s.before.allocation), ...Object.keys(s.after.allocation)])];
  return labels.filter(label => (s.before.allocation[label] ?? 0) !== (s.after.allocation[label] ?? 0)).map(label => `${shortCandidacy(label)}: ${s.before.allocation[label] ?? 0} → ${s.after.allocation[label] ?? 0}`).join(" · ") || "No cambia el reparto de diputados.";
}

/** Introductory editorial bound, not a probability or evidence of plausibility.
 * Identical rule for every affected candidacy; the full catalogue remains explorable. */
export function withinIntroductoryBound(s: ContextScenario): boolean {
  return s.type === "historical" || s.reference.rows.every(r => Math.abs((s.modified.rows.find(after => after.label === r.label)?.v ?? 0) - r.v) <= r.v * .10);
}
