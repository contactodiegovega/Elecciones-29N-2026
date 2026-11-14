import { z } from "zod";
import { LabelRowSchema, TurnoutRowSchema } from "./types";

export type ProvinceIndex = { code: string; name: string; seats2023: number; seats2026: number };
export const ProvinceDataSchema = z.object({
  code: z.string(), name: z.string(), seats2023: z.number().int().positive(), seats2026: z.number().int().positive(),
  election: z.literal("2023-07-23"), turnout: TurnoutRowSchema,
  rows: z.array(LabelRowSchema), colors: z.record(z.string()),
});
export type ProvinceData = z.infer<typeof ProvinceDataSchema>;
