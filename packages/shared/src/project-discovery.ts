import { z } from "zod";

const optionalQueryInteger = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional();

export const projectDiscoveryQuerySchema = z.strictObject({
  page: optionalQueryInteger(1, 100_000).default(1),
  pageSize: optionalQueryInteger(1, 50).default(20),
});
export type ProjectDiscoveryQuery = z.output<
  typeof projectDiscoveryQuerySchema
>;
