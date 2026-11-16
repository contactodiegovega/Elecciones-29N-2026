import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HistorySchema, historicalScenarios, illustrativeScenarios, officialSnapshot, redistributeVotes, validatedOfficial, withinIntroductoryBound, seatChanges } from "./contextual-scenarios";
import { ProvinceDataSchema } from "./province";
import { analyzeLastSeat } from "./last-seat";

const json = (name: string) => JSON.parse(readFileSync(join(__dirname, "../public/data", name), "utf8"));
const leon = ProvinceDataSchema.parse(json("provinces/24.json"));
const history = HistorySchema.parse(json("scenario_history/24.json"));

describe("contexto histórico y simulaciones ilustrativas", () => {
  it("reproduce 2019 y 2023 en las 52 provincias con candidaturas íntegras y trazabilidad", () => {
    let oldSeats = 0, newSeats = 0;
    for (let n = 1; n <= 52; n++) {
      const code = String(n).padStart(2, "0");
      const data = ProvinceDataSchema.parse(json(`provinces/${code}.json`));
      const past = HistorySchema.parse(json(`scenario_history/${code}.json`));
      if (process.env.CONTEXT_EXAMPLES === "1" && ["24", "28", "42", "51", "52"].includes(code)) {
        const observations = historicalScenarios(data, past).map(s => ({ candidate: s.to, votes: s.votes, sharePP: s.shareDeltaPP, before: s.before.allocation[s.to], after: s.after.allocation[s.to] }));
        const examples = (["add", "transfer", "redistribute"] as const).flatMap(mode => illustrativeScenarios(data, mode, 1).filter(withinIntroductoryBound).slice(0, 3).map(s => ({ mode, to: s.to, from: s.from, votes: s.votes, referencePercent: s.referencePercent, sharePP: s.shareDeltaPP, change: seatChanges(s), validAfter: s.after.validVotes })));
        console.log(JSON.stringify({ province: data.name, observations, examples }));
      }
      expect(validatedOfficial(officialSnapshot(data), code), data.name).toBe(true);
      expect(validatedOfficial(past.previous, code), data.name).toBe(true);
      oldSeats += past.previous.seats; newSeats += data.seats2023;
      for (const scenario of historicalScenarios(data, past)) {
        expect(scenario.before.matchesOfficial).toBe(true);
        expect(scenario.after.matchesOfficial).toBe(true);
        expect(scenario.reference.rows).toEqual(past.previous.rows);
        expect(scenario.modified.rows).toEqual(data.rows);
        expect(scenario.sources.length).toBeGreaterThan(0);
        expect(scenario.artifacts.length).toBeGreaterThan(0);
        expect(scenario.identityNote).toContain(past.identityPolicy.version);
        const before = past.previous.rows.find(r => r.label === scenario.to)!;
        const after = data.rows.find(r => r.label === scenario.to)!;
        expect(scenario.votes).toBe(after.v - before.v);
        expect(scenario.shareDeltaPP).toBeCloseTo((after.v / data.turnout.votos_validos - before.v / past.previous.turnout.votos_validos) * 100, 10);
      }
    }
    expect([oldSeats, newSeats]).toEqual([350, 350]);
  });
  it("León: PP +26.933 votos y 1 → 2 diputados, sin equiparar UPL renombrada ni SUMAR/Unidas Podemos", () => {
    const observed = historicalScenarios(leon, history);
    const pp = observed.find(s => s.to === "PARTIDO POPULAR - PP")!;
    expect(pp.votes).toBe(26933);
    expect(pp.before.allocation[pp.to]).toBe(1);
    expect(pp.after.allocation[pp.to]).toBe(2);
    expect(observed.map(s => s.to)).toEqual(expect.arrayContaining(["VOX - VOX", "PARTIDO SOCIALISTA OBRERO ESPAÑOL - PSOE"]));
    expect(observed.some(s => /SUMAR|PODEMOS|U.P.L./.test(s.to))).toBe(false);
    expect(pp.reference.turnout.votos_validos).toBe(262679);
    expect(pp.modified.turnout.votos_validos).toBe(275240);
  });
  it("excluye tarjetas con base incompleta, identidad inexistente o provincia incorrecta", () => {
    expect(historicalScenarios(leon, { ...history, code: "28" })).toEqual([]);
    expect(historicalScenarios(leon, { ...history, artifacts: [] })).toEqual([]);
    expect(historicalScenarios(leon, { ...history, comparable: ["Coalición inventada"] })).toEqual([]);
    const broken = { ...leon, rows: leon.rows.slice(1) };
    expect(illustrativeScenarios(broken, "add", 1)).toEqual([]);
    expect(historicalScenarios(broken, history)).toEqual([]);
    expect(validatedOfficial({ ...officialSnapshot(leon), turnout: { ...leon.turnout, votos_validos: 0 } }, "24")).toBe(false);
  });
  it("aplica las mismas magnitudes a todas las candidaturas, sin seleccionar por ganar un escaño", () => {
    for (let n = 1; n <= 52; n++) {
      const data = ProvinceDataSchema.parse(json(`provinces/${String(n).padStart(2, "0")}.json`));
      for (const pp of [.5, 1, 2] as const) for (const mode of ["add", "transfer", "redistribute"] as const) {
        const scenarios = illustrativeScenarios(data, mode, pp);
        if (mode !== "transfer") expect(scenarios).toHaveLength(data.rows.length);
        else expect(scenarios).toHaveLength(data.rows.filter(r => r.v >= Math.round(data.turnout.votos_validos * pp / 100)).length * (data.rows.length - 1));
        for (const s of scenarios) {
          expect(s.votes).toBe(Math.round(data.turnout.votos_validos * pp / 100));
          expect(s.referencePercent).toBeCloseTo(100 * s.votes / s.before.validVotes, 10);
          expect(s.after.validVotes).toBe(s.before.validVotes + (mode === "add" ? s.votes : 0));
          expect(s.modified.turnout.votantes).toBe(s.after.validVotes + data.turnout.votos_nulos);
          expect(s.after.allocated).toBe(data.seats2023);
          expect(s.modified.rows.map(r => r.label)).toEqual(data.rows.map(r => r.label));
          expect(s.justification).toContain("No procede de un modelo");
          expect(s.sources).toHaveLength(1);
          expect(s.artifacts).toContain(`provinces/${data.code}.json`);
          expect(analyzeLastSeat(s.modified.rows, s.modified.seats, s.modified.turnout.votos_blancos).allocation).toEqual(s.after.allocation);
        }
      }
    }
  }, 120000);
  it("redistribuye enteros proporcionalmente y conserva exactamente cada voto sin mutar la entrada", () => {
    const rows = leon.rows;
    const output = redistributeVotes(rows, rows[0].label, 2752);
    expect(output.reduce((sum, r) => sum + r.v, 0)).toBe(rows.reduce((sum, r) => sum + r.v, 0));
    expect(output[0].v).toBe(rows[0].v + 2752);
    expect(rows[0].v).toBe(101605);
    expect(output.every(r => Number.isSafeInteger(r.v) && r.v >= 0)).toBe(true);
    expect(() => redistributeVotes(rows, rows[0].label, 1e9)).toThrow();
    expect(redistributeVotes([...rows].reverse(), rows[0].label, 2752).reverse()).toEqual(output);
  });
  it("las cuotas de adición usan el nuevo denominador; las tarjetas no son mínimos ni requieren cambio", () => {
    const examples = illustrativeScenarios(leon, "add", 1);
    expect(examples).toHaveLength(leon.rows.length);
    expect(examples.every(s => s.votes === 2752 && s.type === "illustrative")).toBe(true);
    expect(examples.some(s => JSON.stringify(s.before.allocation) === JSON.stringify(s.after.allocation))).toBe(true);
    expect(examples.every(s => s.shareDeltaPP < s.referencePercent)).toBe(true);
    expect(examples.find(s => s.to === "ESPAÑA VACIADA - ESPAÑA VACIADA") && withinIntroductoryBound(examples.find(s => s.to === "ESPAÑA VACIADA - ESPAÑA VACIADA")!)).toBe(false);
    expect(withinIntroductoryBound(examples.find(s => s.to === "PARTIDO POPULAR - PP")!)).toBe(true);
  });
});
