import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { checkData, phaseAt, validatePublication } = require("../scripts/check-data.cjs");
const calendar = require("../../config/campaign.json");
const status = require("../public/data/publication_status.json");
const authorized = {
  public_release_authorized: true,
  cache_withdrawal_verified: true,
  legacy_urls_withdrawal_verified: true,
};

describe("despliegue estático sin Python", () => {
  it("incluye los recursos usados por la web y los repartos de 350 escaños", () => {
    expect(() => checkData()).not.toThrow();
  });
  it("rechaza un checkout sin datos públicos en vez de generar datos de relleno", () => {
    const empty = mkdtempSync(join(tmpdir(), "electoral-deploy-"));
    try { expect(() => checkData(empty)).toThrow(/Artefacto ausente/); }
    finally { rmSync(empty, { recursive: true }); }
  });
  it.each([
    ["2026-11-12", "pre_campaign"], ["2026-11-13", "campaign"],
    ["2026-11-23", "campaign"], ["2026-11-24", "moratorium"],
    ["2026-11-28", "moratorium"], ["2026-11-29", "election_day"],
    ["2026-11-30", "post_election"],
  ])("respeta el cambio de periodo %s", (today, phase) => {
    expect(phaseAt(calendar, today)).toBe(phase);
  });
  it("conserva el bloqueo por controles de publicación pendientes", () => {
    expect(() => validatePublication({ policy: {}, calendar, status, today: "2026-11-16", release: true }))
      .toThrow(/public_release_authorized.*cache_withdrawal_verified.*legacy_urls_withdrawal_verified/);
  });
  it("admite un snapshot coherente en el mismo periodo editorial", () => {
    expect(() => validatePublication({ policy: authorized, calendar, status, today: "2026-11-16", release: true }))
      .not.toThrow();
  });
  it("bloquea un snapshot de campaña al entrar en restricción", () => {
    expect(() => validatePublication({ policy: authorized, calendar, status, today: "2026-11-24", release: true }))
      .toThrow(/restricción editorial/);
    expect(() => validatePublication({ policy: authorized, calendar, status, today: "2026-11-24", release: false }))
      .toThrow(/Reloj editorial/);
  });
  it("rechaza datos que oculten por error encuestas durante campaña", () => {
    expect(() => validatePublication({ policy: authorized, calendar, status: { ...status, polls_visible: false }, today: "2026-11-16", release: true }))
      .toThrow(/Reloj editorial/);
  });
});
