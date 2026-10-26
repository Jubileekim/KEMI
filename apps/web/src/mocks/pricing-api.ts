import axios from "axios";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import {
  pricingAnalysisRequestSchema,
  pricingReportSchema,
} from "./pricing-model";

export default async function analyzePricing(
  description: string,
  signal: AbortSignal,
) {
  const input = pricingAnalysisRequestSchema.parse({ description });
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.post<unknown>("/__mock__/pricing/analyze", input, {
    baseURL: "/",
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const report = pricingReportSchema.parse(response.data);
  if (report.input.description !== input.description)
    throw new Error("분석 입력과 응답이 일치하지 않아요.");
  return report;
}
