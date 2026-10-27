import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { reviewCreateSchema } from "@kemi/shared";
import { useSession } from "../../app/session";
import Button from "../../components/ui/button";
import Textarea from "../../components/ui/textarea";
import Input from "../../components/ui/input";
import { kemi } from "../../shared/api/kemi";
import { dateTime, label, productionStatusLabels, won } from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";
import track from "../../shared/analytics/track";

// SETTLE-01·REVIEW-01: 모의 정산과 상호 리뷰 (실제 API). 실제 지급은 하지 않는다.
export default function SettlementLive({ contractId }: { contractId: string }) {
  const { user } = useSession();
  const client = useQueryClient();
  const key = ["delivery", contractId];
  const delivery = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => kemi.delivery(contractId, signal),
  });
  const [rating, setRating] = useState(5);
  const review = useMutation({
    mutationFn: ({ comment, tags }: { comment: string; tags: string }) =>
      kemi.review(
        contractId,
        reviewCreateSchema.parse({
          rating,
          ...(comment ? { comment } : {}),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      ),
    onSuccess: (next) => client.setQueryData(key, next),
  });
  const completed =
    delivery.data?.productionStatus === "COMPLETED" &&
    delivery.data.settlement?.status === "SIMULATED";
  useEffect(() => {
    if (completed) track("transaction_completed", contractId);
  }, [completed, contractId]);
  if (delivery.isPending)
    return <Loading text="정산 정보를 불러오고 있어요." />;
  if (delivery.error) return <Failure error={delivery.error} />;
  const d = delivery.data;
  const mine = d.reviews.find((r) => r.reviewerId === user?.id);
  const theirs = d.reviews.find((r) => r.reviewerId !== user?.id);
  return (
    <>
      <h1 className="type-heading-lg">정산·리뷰</h1>
      <Card title="모의 정산">
        {d.settlement ? (
          <Facts
            items={[
              ["거래 금액", won(d.settlement.grossKrw)],
              [
                "수수료",
                `${won(d.settlement.feeKrw)} (${d.settlement.feeRateBps / 100}%)`,
              ],
              ["크리에이터 지급(모의)", won(d.settlement.payoutKrw)],
              ["정산 시각", dateTime(d.settlement.createdAt)],
            ]}
          />
        ) : (
          <p>
            아직 정산 전이에요. 현재 단계:{" "}
            {label(productionStatusLabels, d.productionStatus)}. 최종본 수령
            확인 뒤 분쟁이 없으면 정산돼요.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          모의 정산이라 실제 돈은 지급되지 않아요.
        </p>
      </Card>
      <Card title="리뷰">
        <Button
          variant="outline"
          disabled={delivery.isFetching}
          onClick={() => delivery.refetch()}
        >
          리뷰 상태 다시 확인
        </Button>
        {theirs && (
          <p>
            상대방 리뷰: {"★".repeat(theirs.rating)} {theirs.comment ?? ""}
            {theirs.tags?.map((tag) => ` #${tag}`).join("")}
          </p>
        )}
        {mine && (
          <p>
            내 리뷰: {"★".repeat(mine.rating)} {mine.comment ?? ""}
            {mine.tags?.map((tag) => ` #${tag}`).join("")}
          </p>
        )}
        {!mine && d.canReview && (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              review.mutate({
                comment: String(data.get("comment") ?? "").trim(),
                tags: String(data.get("tags") ?? ""),
              });
            }}
          >
            <Field id="review-rating" label="별점">
              <select
                id="review-rating"
                className={selectClass}
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} ({n})
                  </option>
                ))}
              </select>
            </Field>
            <Field id="review-comment" label="한 줄 평 (선택)">
              <Textarea
                id="review-comment"
                name="comment"
                rows={3}
                maxLength={2000}
              />
            </Field>
            <Field
              id="review-tags"
              label="리뷰 태그 (선택, 쉼표로 구분 · 최대 5개, 각 30자)"
            >
              <Input id="review-tags" name="tags" />
            </Field>
            {review.error && (
              <p role="alert">
                {errorText(review.error, "리뷰를 남기지 못했어요.")}
              </p>
            )}
            <Button type="submit" disabled={review.isPending}>
              리뷰 남기기
            </Button>
          </form>
        )}
        {!mine && !d.canReview && (
          <p className="text-muted-foreground">
            정상 완료된 거래에만 리뷰를 남길 수 있어요.
          </p>
        )}
      </Card>
      <Button asChild variant="ghost">
        <Link to={`/contracts/${contractId}/deliveries`}>납품으로</Link>
      </Button>
    </>
  );
}
