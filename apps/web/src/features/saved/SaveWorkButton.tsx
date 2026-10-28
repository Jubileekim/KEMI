import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import Button from "../../components/ui/button";
import { useSession } from "../../app/session";
import { kemi } from "../../shared/api/kemi";
import { mockEnabled } from "../auth/config";
import { errorText } from "../live/errors";

// SAVE-01: 작품 저장(하트). 의뢰인은 저장·해제, 비로그인은 로그인 후 이 화면으로 돌아온다.
export default function SaveWorkButton({
  portfolioId,
  compact = false,
}: {
  portfolioId: string;
  compact?: boolean;
}) {
  const { role } = useSession();
  const location = useLocation();
  const cache = useQueryClient();
  const saved = useQuery({
    queryKey: ["work-bookmarks"],
    enabled: role === "client" && !mockEnabled,
    queryFn: ({ signal }) => kemi.workBookmarks(signal),
  });
  const isSaved = !!saved.data?.items.some(
    (item) => item.portfolio.id === portfolioId,
  );
  const toggle = useMutation({
    mutationFn: async (): Promise<{ saved: boolean }> =>
      isSaved ? kemi.unsaveWork(portfolioId) : kemi.saveWork(portfolioId),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["work-bookmarks"] }),
  });
  if (mockEnabled || role === "creator" || role === "ops") return null;
  const size = compact ? "sm" : "default";
  if (role === "guest")
    return (
      <Button asChild variant="outline" size={size}>
        <Link
          to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        >
          ♡ 저장
        </Link>
      </Button>
    );
  return (
    <span className="inline-grid gap-1">
      <Button
        type="button"
        variant={isSaved ? "default" : "outline"}
        size={size}
        aria-pressed={isSaved}
        disabled={toggle.isPending || saved.isPending}
        onClick={() => toggle.mutate()}
      >
        {isSaved ? "♥ 저장됨" : "♡ 저장"}
      </Button>
      {toggle.error && (
        <span role="alert" className="text-sm">
          {errorText(toggle.error, "저장하지 못했어요.")}
        </span>
      )}
    </span>
  );
}
