import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ElectionNatSchema, LabelRowSchema, PollSchema, TurnoutRowSchema } from "./types";
import { hashIndex, partyColor } from "./utils";

const PUB = join(__dirname, "..", "public");
const json = (p: string) => JSON.parse(readFileSync(join(PUB, p), "utf-8"));

describe("registro de colores", () => {
  const registry = json("data/colors.json").parties;
  it("PP azul, PSOE rojo, VOX verde desde el registro", () => {
    expect(partyColor("PP", registry).hex).toBe("#1B5FCC");
    expect(partyColor("PSOE", registry).hex).toBe("#E30613");
    expect(partyColor("VOX", registry).hex).toBe("#5CB531");
  });
  it("fallback determinista y distinto de corporativos", () => {
    const a = partyColor("SIGLA_INEXISTENTE_X", registry);
    const b = partyColor("SIGLA_INEXISTENTE_X", registry);
    expect(a).toEqual(b);
    expect(a.origin).toBe("fallback");
    expect(["#1B5FCC", "#E30613", "#5CB531"]).not.toContain(a.hex);
  });
  it("hashIndex estable", () => {
    expect(hashIndex("ABC", 6)).toBe(hashIndex("ABC", 6));
  });
});

describe("contrato de datos web", () => {
  it("81/81 candidaturas 2023", () => {
    const rows = json("data/labels_by_election/2023-07-23.json").rows.map((r: unknown) => LabelRowSchema.parse(r));
    expect(new Set(rows.map((r: { label: string }) => r.label)).size).toBe(81);
  });
  it("16 elecciones nacionales válidas y sin 2026", () => {
    const nat = json("data/results_national.json").map((e: unknown) => ElectionNatSchema.parse(e));
    expect(nat).toHaveLength(16);
    expect(nat.some((e: { election: string }) => e.election.startsWith("2026"))).toBe(false);
    expect(nat.at(-1)?.election).toBe("2023-07-23");
  });
  it("turnout provincial 832 filas con tasas", () => {
    const t = json("data/turnout.json").map((r: unknown) => TurnoutRowSchema.parse(r));
    expect(t).toHaveLength(832);
  });
  it("encuestas: tipos separados y sin filas de resultado", () => {
    for (const cyc of ["2023", "2026"]) {
      const polls = json(`data/polls_${cyc}.json`).polls.map((p: unknown) => PollSchema.parse(p));
      expect(polls.length).toBeGreaterThan(100);
      for (const p of polls) {
        expect(/election/i.test(p.pollster)).toBe(false);
        expect(["estimated_vote", "direct_intention"]).toContain(p.type);
      }
    }
  });
  it("ML importado de CSV: 6 folds y mean3 ganador", async () => {
    const ml = json("data/ml.json");
    expect(Object.keys(ml.phase3_macro)).toContain("mean3");
    const best = Object.entries(ml.phase3_macro as Record<string, number>).sort((a, b) => a[1] - b[1])[0];
    expect(best[0]).toBe("mean3");
  });
});
