import type { z } from "zod";
import memberRequest from "./member-request";
import { safetyViewSchema, type safetyCommandSchema } from "./safety-model";

export default async function loadSafety(
  ops: boolean,
  signal?: AbortSignal,
  cmd?: z.infer<typeof safetyCommandSchema>,
) {
  return safetyViewSchema.parse(
    await memberRequest(
      `/__mock__/safety/${ops ? "operations" : "member"}`,
      signal,
      cmd,
    ),
  );
}
