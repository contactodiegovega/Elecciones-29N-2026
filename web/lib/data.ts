import {
  ColorEntrySchema, ElectionNatSchema, LabelRowSchema, MappingRowSchema,
  MetaSchema, PollSchema, TerritorySchema, TurnoutRowSchema,
  type ColorEntry, type ElectionNat, type LabelRow, type MappingRow, type Meta,
  type Poll, type Territory, type TurnoutRow,
} from "./types";

async function getJSON<T>(path: string, schema: { parse: (x: unknown) => T }): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falta artefacto generado: ${path} (HTTP ${res.status})`);
  return schema.parse(await res.json());
}

const arr = <T>(s: { parse: (x: unknown) => T }) => ({ parse: (x: unknown) => (x as unknown[]).map((i) => s.parse(i)) as T[] });

export const loadMeta = () => getJSON("/data/meta.json", MetaSchema);
export const loadTerritories = () => getJSON("/data/territories.json", arr(TerritorySchema));
export const loadNational = () => getJSON("/data/results_national.json", arr(ElectionNatSchema));
export const loadTurnout = () => getJSON("/data/turnout.json", arr(TurnoutRowSchema));
export const loadLabels = (election: string) =>
  getJSON(`/data/labels_by_election/${election}.json`,
    { parse: (x: unknown) => (x as { rows: unknown[] }).rows.map((r) => LabelRowSchema.parse(r)) as LabelRow[] });
export const loadPolls = (cycle: "2023" | "2026") =>
  getJSON(`/data/polls_${cycle}.json`,
    { parse: (x: unknown) => ((x as { polls: unknown[] }).polls.map((p) => PollSchema.parse(p))) as Poll[] });
export const loadColors = () =>
  getJSON("/data/colors.json", { parse: (x: unknown) => ((x as { parties: unknown[] }).parties.map((p) => ColorEntrySchema.parse(p))) as ColorEntry[] });
export const loadTaxonomy = () =>
  getJSON("/data/taxonomy.json", {
    parse: (x: unknown) => ({
      mapping: ((x as { mapping: unknown[] }).mapping.map((m) => MappingRowSchema.parse(m))) as MappingRow[],
    }),
  });
export const loadDemography = () =>
  getJSON("/data/demography.json", { parse: (x: unknown) => (x as { rows: Record<string, unknown>[] }).rows });
export const loadML = () => getJSON("/data/ml.json", { parse: (x: unknown) => x as Record<string, unknown> });
export const loadOOS = () =>
  getJSON("/data/oos_map.json", { parse: (x: unknown) => x as { test_election: string; province: string; model: string; error_pp: number }[] });
export const loadGeo = () =>
  getJSON("/maps/spain_provinces.geojson", { parse: (x: unknown) => x as GeoJSON.FeatureCollection });

export type { Meta, Territory, ElectionNat, LabelRow, TurnoutRow, Poll, ColorEntry, MappingRow };
