import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addVotes, analyzeLastSeat, DEFAULT_PROVINCE, minimumAdditionalVotes, resolveProvince, transferVotes } from "./last-seat";
import { ProvinceDataSchema } from "./province";
import { LabelRowSchema, SimulatorSchema, TurnoutRowSchema, type LabelRow } from "./types";

const json = (path: string) => JSON.parse(readFileSync(join(__dirname, "../public", path), "utf-8"));
const row = (label: string, v: number, s = 0): LabelRow => ({ p: "99", label, party: null, v, s, share: 0 });

describe("reconstrucción histórica con candidaturas originales", () => {
  const labels = (json("data/labels_by_election/2023-07-23.json").rows as unknown[]).map(r => LabelRowSchema.parse(r));
  const turnout = (json("data/turnout.json") as unknown[]).map(r => TurnoutRowSchema.parse(r));
  const sim = SimulatorSchema.parse(json("data/simulator.json"));

  it("reproduce cada candidatura en las 52 provincias y los 350 diputados de 2023", () => {
    let total = 0;
    for (const province of sim.provinces) {
      const rows = labels.filter(r => r.p === province.province_code);
      const t = turnout.find(r => r.province_code === province.province_code && r.election_date === "2023-07-23")!;
      expect(t).toBeDefined();
      expect(rows.reduce((s, r) => s + r.v, 0) + t.votos_blancos).toBe(t.votos_validos);
      const result = analyzeLastSeat(rows, province.seats_2023!, t.votos_blancos);
      expect(result.matchesOfficial, province.province_name).toBe(true);
      const concurrent = rows.filter(r => r.v > 0 || r.s > 0);
      expect(analyzeLastSeat(concurrent, province.seats_2023!, t.votos_blancos).matchesOfficial).toBe(true);
      expect(concurrent.reduce((s, r) => s + r.v, 0)).toBe(t.votos_candidaturas);
      expect(result.drawRequired).toBe(false);
      expect(result.last?.awarded).toBe(true);
      expect(result.next?.awarded).toBe(false);
      expect(result.gap).toBeGreaterThanOrEqual(0);
      total += result.allocated;
    }
    expect(total).toBe(350);
  });

  it("sustenta el ejemplo público de Albacete con votos definitivos", () => {
    const rows = labels.filter(r => r.p === "02");
    const t = turnout.find(r => r.province_code === "02" && r.election_date === "2023-07-23")!;
    const result = analyzeLastSeat(rows, 4, t.votos_blancos);
    expect(result.last).toMatchObject({ votes: 76322, divisor: 2, value: 38161 });
    expect(result.next).toMatchObject({ votes: 36750, divisor: 1, value: 36750 });
    expect(result.gap).toBe(1411);
  });

  it("separa la asignación histórica de Madrid y Cádiz de la de 2026", () => {
    expect(sim.provinces.reduce((s, p) => s + p.seats_2026!, 0)).toBe(350);
    expect(sim.provinces.find(p => p.province_code === "28")).toMatchObject({ seats_2023: 37, seats_2026: 38 });
    expect(sim.provinces.find(p => p.province_code === "11")).toMatchObject({ seats_2023: 9, seats_2026: 8 });
  });

  it("mantiene NC-bc y CCa separadas en Las Palmas", () => {
    const lists = labels.filter(r => r.p === "35" && r.party === "CC");
    expect(lists.length).toBeGreaterThanOrEqual(2);
    expect(new Set(lists.map(r => r.label)).size).toBe(lists.length);
    expect(lists.map(r => r.v)).toEqual(expect.arrayContaining([33558, 42430]));
  });
});

describe("reglas legales y escenarios extremos", () => {
  it("cuenta el blanco en el umbral y admite exactamente el 3 %", () => {
    expect(analyzeLastSeat([row("A", 970), row("B", 30)], 40, 0).eligible).toContain("B");
    expect(analyzeLastSeat([row("A", 970), row("B", 30)], 40, 1).eligible).not.toContain("B");
  });
  it("desempata cocientes por votos, no por identificador", () => {
    const r = analyzeLastSeat([row("A", 50), row("Z", 100)], 2, 0);
    expect(r.last).toMatchObject({ label: "Z", divisor: 2 });
    expect(r.drawRequired).toBe(false);
  });
  it("marca el sorteo cuando empatan cociente y total de votos", () => {
    expect(analyzeLastSeat([row("A", 100), row("B", 100)], 1, 0).drawRequired).toBe(true);
  });
  it("aplica mayoría en una circunscripción uninominal aunque el blanco supere el 97 %", () => {
    expect(analyzeLastSeat([row("A", 2), row("B", 1)], 1, 1000).allocation).toEqual({ A: 1, B: 0 });
  });
  it("muestra el siguiente divisor aunque solo quede una candidatura elegible", () => {
    expect(analyzeLastSeat([row("A", 100)], 3, 0).next).toMatchObject({ label: "A", divisor: 4, awarded: false });
  });
  it("no inventa adjudicaciones cuando todos los votos son cero", () => {
    const result = analyzeLastSeat([row("A", 0)], 3, 0);
    expect(result.allocated).toBe(0);
    expect(result.last).toBeNull();
    expect(result.next).toBeNull();
  });
  it("rechaza votos negativos, fraccionarios y etiquetas duplicadas", () => {
    expect(() => analyzeLastSeat([row("A", -1)], 3, 0)).toThrow();
    expect(() => analyzeLastSeat([row("A", 1.5)], 3, 0)).toThrow();
    expect(() => analyzeLastSeat([row("A", 1), row("A", 2)], 3, 0)).toThrow();
  });
});

describe("León 2023 y selección inicial", () => {
  const leon = ProvinceDataSchema.parse(json("data/provinces/24.json"));
  it("León es la provincia inicial; una URL explícita válida tiene prioridad", () => {
    const codes = json("data/provinces/index.json").map((p: { code: string }) => p.code);
    expect(codes).toHaveLength(52);
    expect(DEFAULT_PROVINCE).toBe("24");
    expect(resolveProvince(null, codes)).toBe("24");
    expect(resolveProvince("02", codes)).toBe("02");
    expect(resolveProvince("99", codes)).toBe("24");
    for (const code of codes) expect(ProvinceDataSchema.parse(json(`data/provinces/${code}.json`)).code).toBe(code);
  });
  it("reproduce los 4 diputados, el censo y los cocientes definitivos de León", () => {
    const result = analyzeLastSeat(leon.rows, leon.seats2023, leon.turnout.votos_blancos);
    expect(leon.seats2023).toBe(4);
    expect(leon.seats2026).toBe(4);
    expect(leon.turnout).toMatchObject({ electores: 422917, votos_validos: 275240, turnout_rate: 65.67, votos_blancos: 1577 });
    expect(result.matchesOfficial).toBe(true);
    expect(result.quotients.slice(0, 4).map(q => q.votes)).toEqual([101605, 92578, 101605, 92578]);
    expect(result.last).toMatchObject({ votes: 92578, divisor: 2, value: 46289 });
    expect(result.next).toMatchObject({ votes: 35451, divisor: 1, value: 35451 });
    expect(leon.rows.reduce((sum, r) => sum + r.s, 0)).toBe(4);
  });
  it("encuentra 10.839 votos para el primer diputado de VOX, sin convertir un empate en certeza", () => {
    const result = minimumAdditionalVotes(leon.rows, 4, 1577, "VOX - VOX");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Mínimo no calculado");
    expect(result.votes).toBe(10839);
    expect(result.losers).toEqual(["PARTIDO SOCIALISTA OBRERO ESPAÑOL - PSOE"]);
    expect(result.after.allocation["VOX - VOX"]).toBe(1);
    expect(analyzeLastSeat(addVotes(leon.rows, "VOX - VOX", 10838), 4, 1577).allocation["VOX - VOX"]).toBe(0);
  });
});

describe("operaciones simétricas y mínimos enteros", () => {
  it("transferir conserva el total, no muta la entrada y se puede invertir", () => {
    const rows = [row("A", 130), row("B", 80), row("C", 30)];
    const transferred = transferVotes(rows, "A", "C", 40);
    expect(transferred.map(r => r.v)).toEqual([90, 80, 70]);
    expect(transferred.reduce((sum, r) => sum + r.v, 0)).toBe(240);
    expect(rows[0].v).toBe(130);
    expect(transferVotes(transferred, "C", "A", 40)).toEqual(rows);
    expect(() => transferVotes(rows, "A", "A", 1)).toThrow();
    expect(() => transferVotes(rows, "A", "B", 131)).toThrow();
    expect(() => transferVotes(rows, "A", "B", -1)).toThrow();
    expect(() => transferVotes(rows, "A", "B", 0.5)).toThrow();
  });
  it("añadir conserva todas las otras candidaturas", () => {
    const rows = [row("A", 13), row("B", 8)];
    expect(addVotes(rows, "B", 5).map(r => r.v)).toEqual([13, 13]);
    expect(() => addVotes(rows, "C", 1)).toThrow();
  });
  it("contrasta la búsqueda de mínimos con enumeración exhaustiva independiente", () => {
    const rows = [row("A", 13), row("B", 8), row("C", 3)];
    for (const seats of [1, 2, 3, 4]) for (const blank of [0, 10, 100]) for (const candidate of rows) {
      const result = minimumAdditionalVotes(rows, seats, blank, candidate.label);
      if (result.status === "full") continue;
      expect(result.status).toBe("ok");
      if (result.status !== "ok") continue;
      const before = analyzeLastSeat(rows, seats, blank).allocation[candidate.label];
      let brute = 0;
      for (; brute < 1000; brute++) {
        const simulated = analyzeLastSeat(addVotes(rows, candidate.label, brute), seats, blank);
        if (!simulated.drawRequired && simulated.allocation[candidate.label] > before) break;
      }
      expect(result.votes).toBe(brute);
    }
  });
  it("no recomienda un resultado de sorteo y maneja la provincia ya completa", () => {
    expect(minimumAdditionalVotes([row("A", 100), row("B", 100)], 1, 0, "A").status).toBe("draw");
    expect(minimumAdditionalVotes([row("A", 100)], 3, 0, "A").status).toBe("full");
    const result = minimumAdditionalVotes([row("A", 100), row("B", 0)], 1, 0, "B");
    expect(result.status).toBe("ok");
    if (result.status === "ok") { expect(result.votes).toBe(101); expect(result.previousRequiresDraw).toBe(true); }
  });
});
