import { z } from "zod";

export const MetaSchema = z.object({
  last_election: z.string(),
  elections: z.array(z.string()),
  counts: z.object({
    labels: z.number(), mapped_labels: z.number(), parties: z.number(),
    provinces: z.number(), polls: z.number(), estimates: z.number(),
  }),
  sources: z.array(z.object({ name: z.string(), license: z.string() }).passthrough()),
  notes: z.array(z.string()),
});
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
export const PollSchema = z.object({
  id: z.string(), pollster: z.string(), sponsor: z.string().nullable(),
  fw_start: z.string().nullable(), fw_end: z.string().nullable(), n: z.number().nullable(),
  type: z.enum(["estimated_vote", "direct_intention"]), canonical: z.string(),
  est: z.array(PollEstSchema),
});
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
