import { z } from "zod";
import { packageItemSchema } from "./studio-model";

// DEV candidate validation only; not a production API or settled input policy.
const text = z.string().trim().min(1).max(4000);
export const directValuesSchema = z.strictObject({
  title: text,
  brief: text,
  conditions: text,
});
export type DirectValues = z.infer<typeof directValuesSchema>;
export const directSendSchema = z.strictObject({
  id: z.string().uuid(),
  creatorId: z.string().min(1),
  packageId: z.string().min(1),
  snapshot: packageItemSchema,
  values: directValuesSchema,
});
export type DirectSend = z.infer<typeof directSendSchema>;
export const directMetadataSchema = z.strictObject({
  snapshot: packageItemSchema,
  conditions: text,
  respondDueAt: z.iso.datetime(),
});
