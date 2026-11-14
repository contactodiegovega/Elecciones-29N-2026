import {
  CampaignSchema, ColorEntrySchema, DemographySchema, ElectionNatSchema,
  LabelRowSchema, LatestPollsSchema, MappingRowSchema, MetaSchema, MLSchema, ModelRegistrySchema, OOSPointSchema,
  PollSourcesSchema, PollsResponseSchema, PublicationStatusSchema,
  SimulatorSchema, TerritorySchema, TurnoutRowSchema,
  type Campaign, type ColorEntry, type Demography, type ElectionNat,
  type LabelRow, type MappingRow, type Meta, type ML, type ModelRegistry, type ModelVersion, type OOSPoint,
  type Poll, type PollSourceCoverage, type PollSources, type PublicationStatus,
  type Simulator, type Territory, type TurnoutRow,
} from "./types";

async function getJSON<T>(path: string, schema: { parse: (x: unknown) => T }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store" });
  } catch {
    throw new Error(`No se pudo solicitar ${path}. Comprueba que el servidor está activo.`);
  }
  if (!res.ok) throw new Error(`Artefacto no disponible: ${path} (HTTP ${res.status}). Ejecuta el exportador de datos.`);
  const json: unknown = await res.json();
  try {
    return schema.parse(json);
  } catch (error) {
    throw new Error(`El artefacto ${path} no cumple el contrato de datos: ${String(error)}`);
  }
}

export const loadMeta = () => getJSON("/data/meta.json", MetaSchema);
export const loadTerritories = () => getJSON("/data/territories.json", { parse: (x: unknown) => (x as unknown[]).map((i) => TerritorySchema.parse(i)) });
export const loadNational = () => getJSON("/data/results_national.json", { parse: (x: unknown) => (x as unknown[]).map((i) => ElectionNatSchema.parse(i)) });
export const loadTurnout = () => getJSON("/data/turnout.json", { parse: (x: unknown) => (x as unknown[]).map((i) => TurnoutRowSchema.parse(i)) });
export const loadLabels = (election: string) =>
  getJSON(`/data/labels_by_election/${election}.json`,
    { parse: (x: unknown) => (x as { rows: unknown[] }).rows.map((r) => LabelRowSchema.parse(r)) });
export const loadPolls = (cycle: "2023" | "2026") =>
  getJSON(`/data/polls_${cycle}.json`, {
    parse: (x: unknown) => PollsResponseSchema.parse(x).polls as Poll[],
  });
export const loadColors = () =>
  getJSON("/data/colors.json", { parse: (x: unknown) => (x as { parties: unknown[] }).parties.map((p) => ColorEntrySchema.parse(p)) });
export const loadTaxonomy = () =>
  getJSON("/data/taxonomy.json", {
    parse: (x: unknown) => {
      const raw = x as { mapping: unknown[]; parties?: unknown[] };
      return {
        mapping: raw.mapping.map((m) => MappingRowSchema.parse(m)),
        parties: (raw.parties ?? []) as { party_id: string; display_name: string; scope: string; kind: string; notes?: string }[],
      };
    },
  });
export const loadDemography = () => getJSON("/data/demography.json", DemographySchema);
export const loadML = () => getJSON("/data/ml.json", MLSchema);
export const loadModelRegistry = () => getJSON("/data/model_registry.json", ModelRegistrySchema);
export const loadOOS = () => getJSON("/data/oos_map.json", { parse: (x: unknown) => (x as unknown[]).map((i) => OOSPointSchema.parse(i)) });
export const loadGeo = () =>
  getJSON("/maps/spain_provinces.geojson", { parse: (x: unknown) => x as GeoJSON.FeatureCollection });
export const loadSimulator = () => getJSON("/data/simulator.json", SimulatorSchema);
export const loadCampaign = () => getJSON("/data/campaign.json", CampaignSchema);
export const loadPollSources = () => getJSON("/data/poll_sources.json", PollSourcesSchema);
export const loadPublicationStatus = () => getJSON("/data/publication_status.json", PublicationStatusSchema);
export const loadLatestPolls = () => getJSON("/data/latest_polls.json", LatestPollsSchema);
export const loadMLGate = () => getJSON("/data/ml_gate.json", {
  parse: (x: unknown) => x as {
    generated_at: string;
    poll_correction: { labeled_elections: number; labeled_rows: number; minimum_elections_required: number; verdict: string; reason: string };
    turnout_projection: { baseline_best: string; baseline_best_macro_mae_pp: number; mean3_macro_mae_pp: number; phase4_best: string; phase4_best_macro_mae_pp: number; verdict: string; reason: string };
    party_projection_2026: { verdict: string; reason: string };
    public_projection_allowed: boolean;
    allowed_products: string[];
    forbidden_products: string[];
  },
});

export type {
  Meta, Territory, ElectionNat, LabelRow, TurnoutRow, Poll, ColorEntry, MappingRow,
  Demography, Simulator, Campaign, PollSources, PollSourceCoverage, PublicationStatus, ML,
  ModelRegistry, ModelVersion, OOSPoint,
};
