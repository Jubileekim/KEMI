import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { session, useSession } from "../app/session";
import loadActivity from "./activity-api";
import Button from "../components/ui/button";

export default function BookmarkMock({ id }: { id: string }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["mock-activity", session.epoch(), user?.id, "bookmark", id],
    queryFn: ({ signal }) => loadActivity(signal),
    enabled: user?.role === "CREATOR",
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: () =>
      loadActivity(undefined, {
        id,
        saved: !query.data?.savedIds.includes(id),
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["mock-activity"] }),
  });
  if (user?.role !== "CREATOR") return null;
  return (
    <div className="grid gap-3">
      <Button
        variant="outline"
        disabled={
          query.isFetching || query.isError || !query.data || mutation.isPending
        }
        onClick={() => mutation.mutate()}
      >
        {query.data?.savedIds.includes(id) ? "캠페인 저장 해제" : "캠페인 저장"}
      </Button>
      <Link to="/bookmarks">저장 목록 확인</Link>
      {(query.error || mutation.error) && (
        <>
          <p role="alert">
            저장 상태를 확인하지 못했어요. 목록을 다시 확인해 주세요.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            저장 상태 재조회
          </Button>
        </>
      )}
    </div>
  );
}
