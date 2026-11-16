import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateScenarios } from "./scenarios";
import { ProvinceDataSchema } from "./province";
import { analyzeLastSeat, guaranteedSeats, minimumTransferVotes, transferVotes } from "./last-seat";
import type { LabelRow } from "./types";

describe("escenarios simétricos de las 52 circunscripciones", () => {
  it("verifica cada mínimo, el total de escaños, candidaturas, umbral y transferencias", () => {
    for (let i = 1; i <= 52; i++) {
      const data = ProvinceDataSchema.parse(JSON.parse(readFileSync(join(__dirname, `../public/data/provinces/${String(i).padStart(2, "0")}.json`), "utf8")));
      const scenarios = generateScenarios(data);
      if (process.env.SCENARIO_EXAMPLES === "1" && [2, 24, 28, 42, 51, 52].includes(i)) {
        const example = scenarios.find(s => s.kind === "first") ?? scenarios.find(s => s.kind === "extra")!;
        const transfer = scenarios.find(s => s.kind === "transfer");
        console.log(JSON.stringify({ province: data.name, seats: data.seats2023, to: example.to, add: example.votes, before: example.before.allocation, after: example.after.allocation, transfer: transfer && { from: transfer.from, to: transfer.to, votes: transfer.votes, after: transfer.after.allocation } }));
      }
      expect(scenarios.length, data.name).toBeGreaterThan(0);
      expect(scenarios.some(s => s.kind === "unchanged"), data.name).toBe(true);
      for (const r of data.rows) expect(scenarios.some(s => s.to === r.label) || r.s === data.seats2023).toBe(true);
      for (const s of scenarios) {
        expect(s.after.allocated).toBe(data.seats2023);
        expect(Object.keys(s.after.allocation)).toHaveLength(data.rows.length);
        expect(s.after.validVotes).toBe(s.before.validVotes + (s.mode === "add" ? s.votes : 0));
        if (s.kind === "unchanged") expect(s.after.allocation).toEqual(s.before.allocation);
        else expect(guaranteedSeats(s.after, s.to)).toBeGreaterThan(s.before.allocation[s.to]);
        if (s.mode === "transfer") {
          expect(s.votes).toBeLessThanOrEqual(data.rows.find(r => r.label === s.from)!.v);
          const previous = analyzeLastSeat(transferVotes(data.rows, s.from!, s.to, s.votes - 1), data.seats2023, data.turnout.votos_blancos);
          expect(guaranteedSeats(previous, s.to)).toBeLessThanOrEqual(s.before.allocation[s.to]);
        }
      }
    }
  }, 120000);
  it("contrasta transferencias con enumeración exhaustiva, incluidos sorteos", () => {
    const rows: LabelRow[] = [13, 8, 3].map((v, i) => ({ p: "99", label: String(i), party: null, v, s: 0, share: 0 }));
    for (const seats of [1, 2, 3, 4]) for (const blank of [0, 40, 100]) for (const from of rows) for (const to of rows) {
      if (from === to) continue;
      const before = analyzeLastSeat(rows, seats, blank);
      const minimum = minimumTransferVotes(rows, seats, blank, from.label, to.label);
      const brute = Array.from({ length: from.v + 1 }, (_, n) => n).find(n => guaranteedSeats(analyzeLastSeat(transferVotes(rows, from.label, to.label, n), seats, blank), to.label) > before.allocation[to.label]);
      if (minimum.status === "ok") expect(minimum.votes).toBe(brute);
      else expect(brute).toBeUndefined();
    }
  });
});
