import { z } from "zod";

export const MetaSchema = z.object({
  title: z.string().optional(),
  generated_at: z.string().optional(),
  as_of: z.string().optional(),
  last_election: z.string(),
  elections: z.array(z.string()),
  counts: z.object({
    labels: z.number(),
    mapped_labels: z.number(),
    parties: z.number(),
    provinces: z.number(),
    polls: z.number(),
    estimates: z.number().optional(),
    poll_estimates: z.number().optional(),
    poll_houses: z.number().optional(),
  }).passthrough(),
  sources: z.array(z.object({ name: z.string(), license: z.string() }).passthrough()),
  notes: z.array(z.string()),
}).passthrough();
export type Meta = z.infer<typeof MetaSchema>;

export const TerritorySchema = z.object({
  province_code: z.string(), province_name_interior: z.string(),
  province_name_ine: z.string(), ccaa_code: z.string().nullable(), ccaa_name: z.string().nullable(),
});
export type Territory = z.infer<typeof TerritorySchema>;

export const PartyPointSchema = z.object({
  party_id: z.string().nullable(), votes: z.number(), seats: z.number(), share: z.number(),
});
export type PartyPoint = z.infer<typeof PartyPointSchema>;

export const ElectionNatSchema = z.object({
  election: z.string(), electores: z.number(), votantes: z.number(), turnout: z.number(),
  parties: z.array(PartyPointSchema.extend({ party_id: z.string() })),
  unmapped_votes: z.number(), n_labels: z.number(),
});
export type ElectionNat = z.infer<typeof ElectionNatSchema>;

export const LabelRowSchema = z.object({
  p: z.string(), label: z.string(), party: z.string().nullable(),
  v: z.number(), s: z.number(), share: z.number(),
});
export type LabelRow = z.infer<typeof LabelRowSchema>;

export const TurnoutRowSchema = z.object({
  election_date: z.string(), province_code: z.string(), electores: z.number(),
  votantes: z.number(), votos_validos: z.number(), votos_nulos: z.number(),
  votos_blancos: z.number(), votos_candidaturas: z.number(),
  turnout_rate: z.number().nullable(), abstention_rate: z.number().nullable(),
  null_rate: z.number().nullable(), blank_on_valid_rate: z.number().nullable(),
});
export type TurnoutRow = z.infer<typeof TurnoutRowSchema>;

export const PollEstSchema = z.object({
  p: z.string().nullable(), label: z.string(), v: z.number(), m: z.string(),
});
export type PollEst = z.infer<typeof PollEstSchema>;

export const PollSchema = z.object({
  id: z.string(), pollster: z.string(), sponsor: z.string().nullable(),
  fw_start: z.string().nullable(), fw_end: z.string().nullable(), n: z.number().nullable(),
  type: z.enum(["estimated_vote", "direct_intention"]), canonical: z.string(),
  published_at: z.string().nullable().optional(),
  publication_status: z.string().optional(),
  quality_flags: z.string().nullable().optional(),
  is_tracking_update: z.boolean().optional(),
  original_url: z.string().nullable().optional(),
  source_license: z.string().nullable().optional(),
  retrieved_at: z.string().nullable().optional(),
  source_hash: z.string().nullable().optional(),
  population: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
  geography: z.string().nullable().optional(),
  sponsor_type: z.string().nullable().optional(),
  n_raw: z.string().nullable().optional(),
  est: z.array(PollEstSchema),
}).passthrough();
export type Poll = z.infer<typeof PollSchema>;

export const ColorEntrySchema = z.object({
  party_id: z.string(), display_name: z.string(), hex_color: z.string(),
  color_name: z.string(), verification_status: z.string(), notes: z.string(),
  valid_from: z.string().nullable(), valid_to: z.string().nullable(),
});
export type ColorEntry = z.infer<typeof ColorEntrySchema>;

export const MappingRowSchema = z.object({
  election_date: z.string(), candidacy_raw: z.string(), candidacy_id: z.string(),
  party_id: z.string().nullable(), confidence: z.string(), justification: z.string(),
  family_id: z.string().nullable(),
});
export type MappingRow = z.infer<typeof MappingRowSchema>;

export const DemographyRowSchema = z.object({
  target_election_date: z.string(),
  as_of_date: z.string(),
  province_code: z.string(),
  vintage_ref: z.string().nullable(),
  vintage_status: z.string().nullable(),
}).passthrough();
export type DemographyRow = z.infer<typeof DemographyRowSchema> & Record<string, number | string | null>;

export const DemographySchema = z.object({
  rows: z.array(DemographyRowSchema),
  coverage: z.array(z.record(z.unknown())).optional(),
  age_national: z.array(z.record(z.unknown())).optional(),
  dictionary: z.union([z.string(), z.record(z.unknown())]).optional(),
}).passthrough();
export type Demography = z.infer<typeof DemographySchema>;

export const SimulatorPartySchema = z.object({
  party_id: z.string(),
  display_name: z.string(),
  hex_color: z.string(),
  national_votes: z.number(),
  national_share: z.number(),
  seats_2023_official: z.number(),
});
export type SimulatorParty = z.infer<typeof SimulatorPartySchema>;

export const SimulatorProvinceSchema = z.object({
  province_code: z.string(),
  province_name: z.string(),
  seats: z.number(),
  seats_2026: z.number().optional(),
  seats_2023: z.number().optional(),
  seats_change: z.number().optional(),
  valid_votes: z.number(),
  turnout_rate: z.number().nullable(),
  baseline_votes: z.record(z.number()),
  baseline_shares: z.record(z.number()),
  seats_2023_official: z.record(z.number()),
});
export type SimulatorProvince = z.infer<typeof SimulatorProvinceSchema>;

export const SeatDistributionSchema = z.object({
  source: z.string(),
  source_id: z.string().optional(),
  source_url: z.string().optional(),
  published_at: z.string().optional(),
  verified_at: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();
export type SeatDistribution = z.infer<typeof SeatDistributionSchema>;

export const SimulatorSchema = z.object({
  election_date: z.string(),
  baseline_election: z.string(),
  total_seats: z.number(),
  threshold_pct: z.number(),
  seat_distribution: SeatDistributionSchema.optional(),
  provinces: z.array(SimulatorProvinceSchema),
  parties: z.array(SimulatorPartySchema),
  national_valid_votes: z.number(),
  validation: z.object({
    election: z.string(), method: z.string(), seats_allocated: z.number(),
    seats_expected: z.number(), mismatches: z.array(z.unknown()), ok: z.boolean(),
    seat_mismatches: z.array(z.unknown()).optional(),
    seat_distribution: z.string().optional(),
  }).passthrough(),
  assumptions: z.array(z.string()),
  caveats: z.array(z.string()),
  generated_at: z.string(),
  poll_baseline_available: z.boolean(),
}).passthrough();
export type Simulator = z.infer<typeof SimulatorSchema>;

export const CampaignSnapshotSchema = z.object({
  date: z.string(), n_polls: z.number(), n_houses: z.number(),
  parties: z.record(z.number()).default({}),
}).passthrough();
export type CampaignSnapshot = z.infer<typeof CampaignSnapshotSchema>;

export const CampaignSchema = z.object({
  as_of: z.string(),
  generated_at: z.string().optional(),
  data_cutoff: z.string().nullable().optional(),
  primary_poll_type: z.string().optional(),
  n_polls_total: z.number().optional(),
  n_polls_primary: z.number().optional(),
  n_houses: z.number().optional(),
  n_duplicates: z.number().optional(),
  n_tracking_updates: z.number().optional(),
  snapshots: z.array(CampaignSnapshotSchema).default([]),
  warnings: z.array(z.string()).default([]),
  aggregation: z.record(z.unknown()).optional(),
  publication_status: z.record(z.unknown()).optional(),
  latest_by_house: z.array(z.record(z.unknown())).default([]),
  distribution: z.array(z.record(z.unknown())).default([]),
  timeline: z.array(z.record(z.unknown())).default([]),
  change_days: z.array(z.record(z.unknown())).default([]),
}).passthrough();
export type Campaign = z.infer<typeof CampaignSchema>;

export const PollSourceCoverageSchema = z.object({
  source_id: z.string(), house: z.string(), publisher: z.string().nullable().optional(),
  poll_type: z.string(), n_measurements: z.number(), n_polls: z.number(),
  latest_fieldwork_end: z.string().nullable().optional(),
  latest_published_at: z.string().nullable().optional(),
  original_url: z.string().nullable().optional(),
  n_duplicates: z.number().optional(),
  n_tracking_updates: z.number().optional(),
  n_unmapped_labels: z.number().optional(),
  unknown_publication: z.boolean().optional(),
  quality_flags: z.string().nullable().optional(),
}).passthrough();
export type PollSourceCoverage = z.infer<typeof PollSourceCoverageSchema>;

export const PollSourcesSchema = z.object({
  version: z.string().optional(),
  policy: z.string().optional(),
  active_connectors: z.array(z.unknown()).default([]),
  official: z.array(z.record(z.unknown())).default([]),
  secondary_aggregators: z.array(z.record(z.unknown())).default([]),
  houses_pending_verification: z.array(z.unknown()).default([]),
  ingested_source: z.record(z.unknown()).optional(),
  coverage: z.array(PollSourceCoverageSchema).default([]),
  totals: z.record(z.number()).default({}),
}).passthrough();
export type PollSources = z.infer<typeof PollSourcesSchema>;

export const PublicationStatusSchema = z.object({
  now_madrid: z.string(), today_madrid: z.string(), phase: z.string(),
  polls_visible: z.boolean(), poll_derived_visible: z.boolean(),
  simulator_poll_baseline_visible: z.boolean(), restricted: z.boolean(),
  restriction_start: z.string(), restriction_end: z.string(),
  campaign_start: z.string(), campaign_end: z.string(), election_date: z.string(),
  reason: z.string(), legal_note: z.string(),
});
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

export const MLModelRowSchema = z.object({
  test_election: z.string(), model: z.string(), MAE_pp: z.number(),
  RMSE_pp: z.number(), bias_pp: z.number(), n_train_rows: z.number().optional(),
  n_train_elections: z.number().optional(), MedAE_pp: z.number().optional(),
}).passthrough();
export type MLModelRow = z.infer<typeof MLModelRowSchema>;

export const MLSchema = z.object({
  question: z.string(), folds: z.array(z.string()),
  phase3_macro: z.record(z.number()), phase3_by_election: z.array(MLModelRowSchema),
  phase4_macro: z.record(z.number()), phase4_by_election: z.array(MLModelRowSchema),
  verdict: z.string(),
}).passthrough();
export type ML = z.infer<typeof MLSchema>;

export const OOSPointSchema = z.object({
  test_election: z.string(), province: z.union([z.string(), z.number()]),
  model: z.string(), error_pp: z.number(),
});
export type OOSPoint = z.infer<typeof OOSPointSchema>;

export const PollsResponseSchema = z.object({ polls: z.array(PollSchema) }).passthrough();
export type PollsResponse = z.infer<typeof PollsResponseSchema>;

export const ModelVersionSchema = z.object({
  version_id: z.string(),
  label: z.string(),
  phase: z.string(),
  created_at: z.string(),
  target: z.string(),
  data_cutoff: z.string(),
  inputs: z.array(z.string()),
  config: z.record(z.unknown()),
  metrics: z.object({
    mae_macro_pp: z.number(),
    by_election: z.array(z.object({
      test_election: z.string(), MAE_pp: z.number(), RMSE_pp: z.number(), bias_pp: z.number(),
    }).passthrough()),
    n_folds: z.number(),
  }),
  status: z.string(),
  note: z.string(),
}).passthrough();
export type ModelVersion = z.infer<typeof ModelVersionSchema>;

export const ModelRegistrySchema = z.object({
  generated_at: z.string(),
  as_of: z.string(),
  target_election: z.string(),
  question: z.string(),
  status: z.string(),
  public_projection_allowed: z.boolean(),
  headline: z.string(),
  reason: z.string(),
  scope_note: z.string(),
  best_baseline: z.object({ version_id: z.string(), mae_macro_pp: z.number() }),
  best_experimental: z.object({ version_id: z.string(), mae_macro_pp: z.number() }),
  versions: z.array(ModelVersionSchema),
  projection_2026: z.unknown().nullable(),
  required_to_reopen: z.array(z.string()),
  sources: z.array(z.object({ name: z.string(), license: z.string() })),
}).passthrough();
export type ModelRegistry = z.infer<typeof ModelRegistrySchema>;
