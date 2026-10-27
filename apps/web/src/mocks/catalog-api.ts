import { api } from "../shared/api/client";
import { catalogViewSchema } from "./catalog-model";

export default async function loadCatalog(query: string, signal?: AbortSignal) {
  const result = await api.get<unknown>(`/__mock__/catalog?${query}`, {
    baseURL: "/",
    signal,
  });
  return catalogViewSchema.parse(result.data);
}
