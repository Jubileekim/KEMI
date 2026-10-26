import axios from "axios";
import { session } from "../app/session";
import { api, ApiError } from "../shared/api/client";
import { campaignStateSchema, type CampaignCommand } from "./campaign-model";

export async function campaignRequest(
  command?: CampaignCommand,
  revision?: number,
  signal?: AbortSignal,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    url: "/__mock__/campaigns",
    baseURL: "/",
    method: command ? "POST" : "GET",
    signal,
    headers: { Authorization: `Bearer ${token}` },
    data: command ? { command, revision } : undefined,
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return campaignStateSchema.parse(response.data);
}
export function campaignError(error: unknown) {
  if (error instanceof ApiError && error.status === 409)
    return "상태가 변경되었어요. 최신 값 확인 후 입력을 검토하고 다시 저장해 주세요.";
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return "로그인·의뢰인 권한을 확인해 주세요. 입력은 보존했어요.";
  return "응답을 확인하지 못했어요. 입력은 보존했어요. 최신 값 확인으로 저장·공개 결과를 먼저 확인해 주세요.";
}
