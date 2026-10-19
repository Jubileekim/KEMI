import type { HealthResponse } from "@kemi/shared";
import axios from "axios";
import { z } from "zod";

const healthSchema = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
}) satisfies z.ZodType<HealthResponse>;

// /health는 /api 밖에 있다. 서비스 API 인스턴스를 쓰지 않는다.
export default async function getHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const response = await axios.get<unknown>("/health", {
    timeout: 15_000,
    signal,
  });
  return healthSchema.parse(response.data);
}
