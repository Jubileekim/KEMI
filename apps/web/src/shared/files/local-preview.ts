import { z } from "zod";

// Candidate local preview protection only; D02 upload limits/formats remain unresolved.
export const demoFileLimit = 50 * 1024 * 1024;
export const assetSchema = z.object({
  name: z.string().max(4000),
  mime: z.enum(["video/mp4", "video/webm"]),
  size: z.number().int().positive().max(demoFileLimit),
  ready: z.boolean(),
});
export type LocalAsset = z.infer<typeof assetSchema>;
