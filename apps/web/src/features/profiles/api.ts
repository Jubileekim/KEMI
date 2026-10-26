import { api, ApiError } from "../../shared/api/client";
import { profileResponseSchema, type ProfileRole } from "./contracts";

export function readProfile(data: unknown, role: ProfileRole) {
  const parsed = profileResponseSchema.safeParse(data);
  if (!parsed.success || parsed.data.profile.type !== role)
    throw new ApiError(
      0,
      "INVALID_PROFILE",
      "프로필 응답을 확인하지 못했어요. 다시 불러와 주세요.",
    );
  return parsed.data;
}
export async function getProfile(role: ProfileRole, signal?: AbortSignal) {
  const response = await api.get<unknown>("/api/profiles/me", { signal });
  return readProfile(response.data, role);
}
export async function saveProfile(role: ProfileRole, input: unknown) {
  const response = await api.patch<unknown>("/api/profiles/me", input);
  return readProfile(response.data, role);
}
export function profileError(error: unknown) {
  if (!(error instanceof ApiError))
    return "응답을 확인하지 못했어요. 다시 시도해 주세요.";
  if (error.status === 400)
    return "입력 내용을 확인해 주세요. 저장되지 않았어요.";
  if (error.status === 401)
    return "세션을 다시 확인했어요. 입력을 확인하고 다시 저장해 주세요.";
  return error.message;
}
