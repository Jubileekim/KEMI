import type { z } from "zod";
import {
  activityViewSchema,
  type bookmarkCommandSchema,
} from "./activity-model";
import memberRequest from "./member-request";

export default async function loadActivity(
  signal?: AbortSignal,
  cmd?: z.infer<typeof bookmarkCommandSchema>,
) {
  return activityViewSchema.parse(
    await memberRequest("/__mock__/activity", signal, cmd),
  );
}
