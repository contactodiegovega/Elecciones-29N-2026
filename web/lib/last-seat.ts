import type { LabelRow } from "./types";

export type Quotient = { label: string; votes: number; divisor: number; value: number; awarded: boolean; rank: number };

/** Original candidacies only. Blank votes count towards the legal threshold.
 * LOREG 163: equal quotients favour greater total votes; equal votes require a draw.
 * A deterministic display order is never reported as an official draw result.
 */
export function analyzeLastSeat(rows: LabelRow[], seats: number, blankVotes: number) {
  if (!Number.isInteger(seats) || seats < 1 || !Number.isSafeInteger(blankVotes) || blankVotes < 0 ||
      rows.some(r => !Number.isSafeInteger(r.v) || r.v < 0) || new Set(rows.map(r => r.label)).size !== rows.length) {
    throw new Error("El reparto requiere candidaturas únicas, votos enteros no negativos y al menos un escaño.");
  }
  const validVotes = rows.reduce((sum, r) => sum + r.v, blankVotes);
  // Ceuta and Melilla: the single seat goes to the most-voted candidacy (LOREG 163.2).
  const eligible = rows.filter(r => r.v > 0 && (seats === 1 || r.v * 100 >= validVotes * 3));
  const quotients: Quotient[] = eligible.flatMap(r => Array.from({ length: seats === 1 ? 1 : seats + 1 }, (_, i) => ({
    label: r.label, votes: r.v, divisor: i + 1, value: r.v / (i + 1), awarded: false, rank: 0,
  })));
  quotients.sort((a, b) => b.votes * a.divisor - a.votes * b.divisor || b.votes - a.votes || a.label.localeCompare(b.label, "es"));
  const allocation: Record<string, number> = Object.fromEntries(rows.map(r => [r.label, 0]));
  quotients.forEach((q, i) => { q.rank = i + 1; q.awarded = i < seats; if (q.awarded) allocation[q.label]++; });
  const last = quotients[seats - 1] ?? null;
  const next = quotients[seats] ?? null;
  const drawRequired = !!last && !!next && last.votes * next.divisor === next.votes * last.divisor && last.votes === next.votes;
  return {
    validVotes, eligible: eligible.map(r => r.label), allocation, quotients, last, next, drawRequired,
    gap: last && next ? last.value - next.value : null,
    allocated: Object.values(allocation).reduce((a, b) => a + b, 0),
    matchesOfficial: !drawRequired && rows.every(r => allocation[r.label] === r.s) && Object.values(allocation).reduce((a, b) => a + b, 0) === seats,
  };
}

export const shortCandidacy = (label: string) => label.split(" - ").at(-1) ?? label;

export const DEFAULT_PROVINCE = "24";
export const MAX_SCENARIO_VOTES = 1_000_000_000;
export const resolveProvince = (requested: string | null, codes: string[]) =>
  requested && codes.includes(requested) ? requested : DEFAULT_PROVINCE;

export function addVotes(rows: LabelRow[], label: string, amount: number): LabelRow[] {
  if (!rows.some(r => r.label === label) || !Number.isSafeInteger(amount) || amount < 0 ||
      rows.some(r => r.v + (r.label === label ? amount : 0) > MAX_SCENARIO_VOTES)) {
    throw new Error("Introduce un número entero de votos entre 0 y 1.000.000.000 y una candidatura disponible.");
  }
  return rows.map(r => r.label === label ? { ...r, v: r.v + amount } : { ...r });
}

export function transferVotes(rows: LabelRow[], from: string, to: string, amount: number): LabelRow[] {
  const source = rows.find(r => r.label === from);
  if (from === to || !source || !rows.some(r => r.label === to) ||
      !Number.isSafeInteger(amount) || amount < 0 || amount > source.v) {
    throw new Error("Elige dos candidaturas distintas y una cantidad entera que no supere los votos del origen.");
  }
  return addVotes(rows, to, amount).map(r => r.label === from ? { ...r, v: r.v - amount } : r);
}

type Analysis = ReturnType<typeof analyzeLastSeat>;
function boundaryParticipant(result: Analysis, label: string) {
  const last = result.last;
  return result.drawRequired && !!last && result.quotients.some(q =>
    q.label === label && q.votes === last.votes && q.divisor === last.divisor);
}

export function guaranteedSeats(result: Analysis, label: string) {
  const awardedAtTie = boundaryParticipant(result, label) && result.quotients.some(q =>
    q.label === label && q.awarded && q.divisor === result.last?.divisor);
  return result.allocation[label] - (awardedAtTie ? 1 : 0);
}

/** Minimum transfer giving the destination another guaranteed seat. Total and blank stay fixed. */
export function minimumTransferVotes(rows: LabelRow[], seats: number, blank: number, from: string, to: string) {
  const source = rows.find(r => r.label === from);
  if (!source || from === to || !rows.some(r => r.label === to)) throw new Error("Elige dos candidaturas distintas disponibles.");
  const before = analyzeLastSeat(rows, seats, blank);
  if (before.drawRequired) return { status: "draw" as const };
  const target = before.allocation[to] + 1;
  if (target > seats) return { status: "full" as const };
  const evaluate = (n: number) => analyzeLastSeat(transferVotes(rows, from, to, n), seats, blank);
  const succeeds = (n: number) => guaranteedSeats(evaluate(n), to) >= target;
  if (!source.v || !succeeds(source.v)) return { status: "unavailable" as const };
  let low = 0, high = source.v;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (succeeds(mid)) high = mid; else low = mid;
  }
  const after = evaluate(high), previous = evaluate(high - 1);
  if (guaranteedSeats(after, to) < target || guaranteedSeats(previous, to) >= target) throw new Error("Mínimo de transferencia no validado.");
  return { status: "ok" as const, votes: high, target, after, previousRequiresDraw: previous.drawRequired, validated: true };
}

/** Minimum integer increase, holding every other candidacy AND blank votes fixed.
 * Binary search on guaranteed seats; the endpoint and its predecessor are checked
 * with the same legal allocator. A draw is not counted as a guaranteed gain.
 */
export function minimumAdditionalVotes(rows: LabelRow[], seats: number, blank: number, label: string) {
  const original = rows.find(r => r.label === label);
  if (!original) throw new Error("Candidatura no disponible.");
  const before = analyzeLastSeat(rows, seats, blank);
  if (before.drawRequired) return { status: "draw" as const };
  const target = before.allocation[label] + 1;
  if (target > seats) return { status: "full" as const };
  const limit = MAX_SCENARIO_VOTES - original.v;
  const evaluate = (n: number) => analyzeLastSeat(addVotes(rows, label, n), seats, blank);
  const succeeds = (n: number) => guaranteedSeats(evaluate(n), label) >= target;
  let high = Math.min(1, limit);
  while (high < limit && !succeeds(high)) high = Math.min(limit, high * 2);
  if (!high || !succeeds(high)) return { status: "limit" as const };
  let low = 0;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (succeeds(mid)) high = mid; else low = mid;
  }
  const after = evaluate(high);
  const previous = evaluate(high - 1);
  if (guaranteedSeats(after, label) < target || guaranteedSeats(previous, label) >= target) {
    throw new Error("No se ha podido validar el mínimo entero.");
  }
  const losers = rows.filter(r => {
    // If the remaining cut needs a draw, report only a loss certain even if
    // this candidacy were to win that draw.
    const maximum = guaranteedSeats(after, r.label) + (boundaryParticipant(after, r.label) ? 1 : 0);
    return maximum < before.allocation[r.label];
  }).map(r => r.label);
  return { status: "ok" as const, votes: high, target, losers, after, previousRequiresDraw: previous.drawRequired, validated: true };
}
