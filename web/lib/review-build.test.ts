import { createRequire } from "node:module";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { prepareReview, auditReview } = require("../scripts/build-review.cjs");

it("exporta solo el catálogo histórico y rechaza archivos inesperados sin modificar originales", () => {
  // Under web/ so Next could resolve the same dependencies if needed; no build is run here.
  const temp = mkdtempSync(join(tmpdir(), "electoral-review-"));
  const source = join(__dirname, "../archive/data/latest_polls.json");
  const before = readFileSync(source);
  try {
    const stage = join(temp, "stage");
    const resources = prepareReview(stage);
    expect(resources).not.toContain("data/latest_polls.json");
    expect(resources).not.toContain("data/campaign.json");
    expect(resources).toContain("data/provinces/52.json");
    expect(resources).toContain("data/scenario_history/52.json");
    const atlas = JSON.parse(readFileSync(join(stage, "public/data/simulator.json"), "utf8"));
    expect(Object.keys(atlas.provinces[0]).sort()).toEqual(["province_code", "province_name", "seats", "seats_2023", "seats_2026"]);
    const out = join(temp, "out");
    cpSync(join(stage, "public"), out, { recursive: true });
    expect(auditReview(out, join(stage, "public"))).toHaveLength(resources.length);
    writeFileSync(join(out, "data/unknown-poll-snapshot.json"), '{"estimate":999}');
    expect(() => auditReview(out, join(stage, "public"))).toThrow(/no clasificados/);
    expect(readFileSync(source).equals(before)).toBe(true);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}, 30000);
