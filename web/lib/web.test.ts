import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CampaignSchema, DemographySchema, ElectionNatSchema, LabelRowSchema, MetaSchema,
  MLSchema, ModelRegistrySchema, OOSPointSchema, PollSchema, PollSourcesSchema, PublicationStatusSchema,
  SimulatorSchema, TerritorySchema, TurnoutRowSchema,
} from "./types";
import { allocateDHondt, hashIndex, mean, median, partyColor, pearson } from "./utils";

const PUB = join(__dirname, "..", "public");
const json = (p: string) => JSON.parse(readFileSync(existsSync(join(__dirname, "../archive", p)) ? join(__dirname, "../archive", p) : join(PUB, p), "utf-8"));

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
  it("meta.json cumple el schema y conserva el conteo de estimaciones", () => {
    const meta = MetaSchema.parse(json("data/meta.json"));
    expect(meta.elections).toHaveLength(16);
    expect(meta.last_election).toBe("2023-07-23");
    expect(meta.counts.poll_estimates).toBe(16743);
    expect(meta.counts.estimates ?? meta.counts.poll_estimates).toBe(16743);
  });
  it("81/81 candidaturas 2023 y 17 ficheros de etiquetas", () => {
    const rows = json("data/labels_by_election/2023-07-23.json").rows.map((r: unknown) => LabelRowSchema.parse(r));
    expect(new Set(rows.map((r: { label: string }) => r.label)).size).toBe(81);
    const meta = MetaSchema.parse(json("data/meta.json"));
    for (const e of meta.elections) {
      const list = json(`data/labels_by_election/${e}.json`).rows;
      expect(list.length).toBeGreaterThan(0);
    }
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
  it("territorios: 52 provincias con código único", () => {
    const terr = json("data/territories.json").map((t: unknown) => TerritorySchema.parse(t));
    expect(terr).toHaveLength(52);
    expect(new Set(terr.map((t: { province_code: string }) => t.province_code)).size).toBe(52);
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
  it("ML importado de CSV: 6 folds y mean3 ganador", () => {
    const ml = MLSchema.parse(json("data/ml.json"));
    expect(ml.folds).toHaveLength(6);
    expect(Object.keys(ml.phase3_macro)).toContain("mean3");
    const best = Object.entries(ml.phase3_macro).sort((a, b) => a[1] - b[1])[0];
    expect(best[0]).toBe("mean3");
    expect(ml.phase4_by_election.length).toBe(12);
  });
  it("OOS: 624 errores para 6 folds y 2 modelos", () => {
    const oos = json("data/oos_map.json").map((r: unknown) => OOSPointSchema.parse(r));
    expect(oos).toHaveLength(624);
    expect(new Set(oos.map((r: { model: string }) => r.model))).toEqual(new Set(["mean3", "ridge"]));
    expect(new Set(oos.map((r: { test_election: string }) => r.test_election)).size).toBe(6);
  });
  it("demografía: 780 filas, 15 elecciones objetivo y cobertura", () => {
    const d = DemographySchema.parse(json("data/demography.json"));
    expect(d.rows).toHaveLength(780);
    expect(new Set(d.rows.map((r) => r.target_election_date)).size).toBe(15);
    expect(d.coverage?.length).toBe(15);
    expect(d.age_national?.length).toBeGreaterThan(10);
  });
  it("campaña y fuentes declaran sus limitaciones", () => {
    const c = CampaignSchema.parse(json("data/campaign.json"));
    expect(c.warnings.length).toBeGreaterThanOrEqual(4);
    expect(c.n_houses).toBe(37);
    expect(c.snapshots.every((s) => s.n_polls === 0)).toBe(true);
    const s = PollSourcesSchema.parse(json("data/poll_sources.json"));
    expect(s.coverage.length).toBeGreaterThan(50);
    expect(s.totals.houses).toBe(37);
    expect(s.totals.unknown_publication_measurements).toBe(s.totals.measurements);
  });
  it("geometría provincial: 52 features sin GeometryCollection", () => {
    const geo = json("maps/spain_provinces.geojson");
    expect(geo.type).toBe("FeatureCollection");
    expect(geo.features).toHaveLength(52);
    for (const f of geo.features) {
      expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
      expect(f.geometry.coordinates.length).toBeGreaterThan(0);
      expect(f.properties.province_code).toMatch(/^\d{2}$/);
    }
  });
  it("estado de publicación: veda de 5 días y elección 2026-11-29", () => {
    const p = PublicationStatusSchema.parse(json("data/publication_status.json"));
    expect(p.election_date).toBe("2026-11-29");
    expect(p.restriction_start).toBe("2026-11-24");
    expect(p.restriction_end).toBe("2026-11-28");
    expect(typeof p.restricted).toBe("boolean");
    expect(p.legal_note.length).toBeGreaterThan(20);
  });
});

describe("registro de versiones del modelo", () => {
  const reg = ModelRegistrySchema.parse(json("data/model_registry.json"));

  it("congela 8 versiones auditadas y no permite proyección pública", () => {
    expect(reg.versions).toHaveLength(8);
    expect(reg.public_projection_allowed).toBe(false);
    expect(reg.projection_2026).toBeNull();
    expect(reg.status).toBe("no_go");
    expect(reg.versions.every((v) => v.target === "turnout_pct")).toBe(true);
    expect(reg.versions.every((v) => v.metrics.by_election.length === v.metrics.n_folds)).toBe(true);
  });

  it("el baseline mean3 supera al mejor modelo de fase 4", () => {
    expect(reg.best_baseline.mae_macro_pp).toBeCloseTo(3.563, 3);
    expect(reg.best_experimental.version_id).toBe("f3-elasticnet");
    expect(reg.best_experimental.mae_macro_pp).toBeGreaterThan(reg.best_baseline.mae_macro_pp);
    expect(reg.reason.toLowerCase()).toContain("no existen");
  });
});

describe("motor D'Hondt", () => {
  const sim = SimulatorSchema.parse(json("data/simulator.json"));
  const parties = sim.parties.map((p) => p.party_id);

  it("reparte 350 escaños con la base agregada y la distribución oficial de 2026", () => {
    const result = allocateDHondt({
      thresholdPct: sim.threshold_pct,
      parties,
      provinces: sim.provinces.map((p) => ({
        code: p.province_code,
        name: p.province_name,
        seats: p.seats,
        votes: p.baseline_votes,
      })),
    });
    expect(Object.values(result.national).reduce((a, b) => a + b, 0)).toBe(350);
    expect(sim.provinces.reduce((a, p) => a + p.seats, 0)).toBe(350);
    expect(sim.provinces.find((p) => p.province_code === "28")?.seats).toBe(38);
    expect(sim.provinces.find((p) => p.province_code === "11")?.seats).toBe(8);
    // Las Palmas: NC-bc (42.430) + CCa (33.558) se agregan como CC y le quitan
    // un escaño a PP. Además, Cádiz pierde un escaño con el RD 806/2026: con el
    // patrón de voto de 2023, PP baja de 136 a 135 y no hay otras diferencias.
    expect(result.national.PP).toBe(135);
    expect(result.national.CC).toBe(2);
    const lasPalmas = result.byProvince.find((p) => p.code === "35");
    expect(lasPalmas?.allocation.PP).toBe(2);
    expect(lasPalmas?.allocation.CC).toBe(1);
    const cadiz = result.byProvince.find((p) => p.code === "11");
    expect(cadiz?.allocation.PP).toBe(3);
    expect(sim.validation.ok).toBe(true);
    expect(sim.validation.mismatches).toHaveLength(0);
    expect(sim.validation.seat_mismatches).toHaveLength(0);
  });

  it("asigna todos los escaños de cada circunscripción", () => {
    const result = allocateDHondt({
      thresholdPct: sim.threshold_pct,
      parties,
      provinces: sim.provinces.map((p) => ({
        code: p.province_code,
        name: p.province_name,
        seats: p.seats,
        votes: p.baseline_votes,
      })),
    });
    for (const prov of result.byProvince) {
      expect(Object.values(prov.allocation).reduce((a, b) => a + b, 0)).toBe(prov.seats);
    }
  });

  it("un swing uniforme conserva los 350 escaños", () => {
    const swing = Object.fromEntries(parties.map((p) => [p, 1]));
    const result = allocateDHondt({
      thresholdPct: sim.threshold_pct,
      parties,
      provinces: sim.provinces.map((p) => ({
        code: p.province_code,
        name: p.province_name,
        seats: p.seats,
        votes: Object.fromEntries(parties.map((k) => [k, (p.baseline_votes[k] ?? 0) * (1 + swing[k] * 0.05)])),
      })),
    });
    expect(Object.values(result.national).reduce((a, b) => a + b, 0)).toBe(350);
  });

  it("el umbral del 3 % excluye a formaciones pequeñas en provincias grandes", () => {
    const result = allocateDHondt({
      thresholdPct: 3,
      parties: ["A", "B", "C"],
      provinces: [{ code: "99", name: "Test", seats: 10, votes: { A: 8000, B: 1900, C: 100 } }],
    });
    expect(result.national.C).toBe(0);
    expect(result.byProvince[0].thresholdApplied).toBe(true);
  });
});

describe("utilidades estadísticas", () => {
  it("media y mediana", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("correlación perfecta y nula", () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1, 10);
    expect(pearson([[1, 1], [2, 1], [3, 1]])).toBeNaN();
  });
});
