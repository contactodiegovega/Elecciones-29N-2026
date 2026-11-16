import type { ProvinceData } from "./province";
import { addVotes, analyzeLastSeat, minimumAdditionalVotes, minimumTransferVotes } from "./last-seat";

export type Scenario = {
  id: string; kind: "first" | "extra" | "transfer" | "unchanged";
  mode: "add" | "transfer"; to: string; from?: string; votes: number;
  before: ReturnType<typeof analyzeLastSeat>; after: ReturnType<typeof analyzeLastSeat>;
  losers: string[]; previousRequiresDraw: boolean;
};

/** Every original candidacy and ordered transfer pair receives the same calculation.
 * Presentation is alphabetical, never ranked by electoral convenience. */
export function generateScenarios(data: ProvinceData): Scenario[] {
  const { rows, seats2023: seats, turnout } = data;
  const blank = turnout.votos_blancos;
  const before = analyzeLastSeat(rows, seats, blank);
  if (before.drawRequired) return [];
  const scenarios: Scenario[] = [];
  const parties = [...rows].sort((a, b) => a.label.localeCompare(b.label, "es"));
  const append = (s: Omit<Scenario, "before" | "losers">) => scenarios.push({ ...s, before,
    losers: rows.filter(r => s.after.allocation[r.label] < before.allocation[r.label]).map(r => r.label),
  });
  for (const party of parties) {
    const minimum = minimumAdditionalVotes(rows, seats, blank, party.label);
    if (minimum.status === "ok") {
      append({ id: `add:${party.label}`, kind: before.allocation[party.label] ? "extra" : "first", mode: "add", to: party.label, votes: minimum.votes, after: minimum.after, previousRequiresDraw: minimum.previousRequiresDraw });
      // Derive a stable example just before the verified boundary, skipping a tied predecessor.
      const votes = minimum.votes - (minimum.previousRequiresDraw ? 2 : 1);
      if (votes > 0) {
        const after = analyzeLastSeat(addVotes(rows, party.label, votes), seats, blank);
        if (!after.drawRequired && rows.every(r => after.allocation[r.label] === before.allocation[r.label]))
          append({ id: `unchanged:${party.label}`, kind: "unchanged", mode: "add", to: party.label, votes, after, previousRequiresDraw: false });
      }
    }
    for (const source of parties) if (source.label !== party.label) {
      const transfer = minimumTransferVotes(rows, seats, blank, source.label, party.label);
      if (transfer.status === "ok") append({ id: `transfer:${source.label}:${party.label}`, kind: "transfer", mode: "transfer", from: source.label, to: party.label, votes: transfer.votes, after: transfer.after, previousRequiresDraw: transfer.previousRequiresDraw });
    }
  }
  return scenarios;
}
