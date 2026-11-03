import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ACTIVITY_STAGES } from "@kemi/shared";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { kemi } from "../../shared/api/kemi";
import { requestProgress } from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";

const filters = [
  { value: "active", label: "진행 중", empty: "진행 중인 대화가 없어요." },
  { value: "closed", label: "완료·종료", empty: "완료·종료된 대화가 없어요." },
  { value: "all", label: "전체", empty: "아직 대화가 없어요." },
] as const;

export default function ConversationList() {
  const rooms = useQuery({
    queryKey: ["chat-rooms"],
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => kemi.chatRooms(signal),
  });
  const activity = useQuery({
    queryKey: ["activity"],
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => kemi.activity(signal),
  });
  const requests = new Map(
    (activity.isError ? [] : activity.data?.requests)?.map((item) => [
      item.id,
      item,
    ]),
  );
  // 내 활동은 최근 100건만 반환하므로 누락된 방은 기존 상세 조회로 보완한다.
  // 활동 조회 자체가 실패했을 때 모든 방의 상세 요청을 한꺼번에 보내지는 않는다.
  const missingRooms = activity.isSuccess
    ? (rooms.data?.items ?? []).filter(
        (room) => !requests.get(room.workRequestId)?.stage && !room.readOnly,
      )
    : [];
  const details = useQueries({
    queries: missingRooms.map((room) => ({
      queryKey: ["terms", room.workRequestId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        kemi.terms(room.workRequestId, signal),
      refetchOnWindowFocus: true,
      retry: false,
    })),
  });
  const terms = new Map(
    missingRooms.map((room, index) => [
      room.workRequestId,
      details[index]?.isError ? undefined : details[index]?.data,
    ]),
  );
  const conversations = (rooms.data?.items ?? []).map((room) => {
    const request = requests.get(room.workRequestId);
    const detail = terms.get(room.workRequestId);
    const stage = request?.stage ?? detail?.stage;
    if (stage && ACTIVITY_STAGES.includes(stage)) {
      return {
        room,
        closed: ["COMPLETED", "CANCELED", "CLOSED"].includes(stage),
        unknown: false,
        label: requestProgress(
          request?.status ?? detail?.workRequestStatus ?? "",
          stage,
        ),
      };
    }
    return {
      room,
      closed: room.readOnly,
      unknown: !room.readOnly,
      label: room.readOnly ? "종료됨" : "상태 확인 필요",
    };
  });
  const pending =
    activity.isPending || details.some((query) => query.isPending);
  const failed = activity.isError || details.some((query) => query.isError);
  const unknown = conversations.some((item) => item.unknown);

  return (
    <Card title="대화 내역">
      {rooms.isPending && <Loading />}
      {rooms.error && <Failure error={rooms.error} />}
      {pending && <Loading text="대화의 진행 상태를 확인하고 있어요." />}
      {failed && (
        <p role="alert">
          일부 대화의 진행 상태를 불러오지 못했어요. 확인되지 않은 대화도 계속
          열 수 있어요.
        </p>
      )}
      {!pending && unknown && (
        <p className="text-sm text-muted-foreground">
          상태 확인이 필요한 대화는 진행 중과 전체에 함께 표시해요.
        </p>
      )}
      {(failed || unknown) && (
        <Button
          variant="outline"
          disabled={
            activity.isFetching || details.some((query) => query.isFetching)
          }
          onClick={() => {
            activity.refetch();
            details.forEach((query) => query.refetch());
          }}
        >
          진행 상태 다시 확인
        </Button>
      )}
      <Tabs defaultValue="active">
        <TabsList aria-label="대화 진행 상태">
          {filters.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {filters.map((filter) => {
          const visible = conversations.filter(
            (item) =>
              filter.value === "all" ||
              (filter.value === "closed" ? item.closed : !item.closed),
          );
          return (
            <TabsContent
              key={filter.value}
              value={filter.value}
              className="pt-3"
            >
              {rooms.isSuccess && !pending && visible.length === 0 && (
                <p>{filter.empty}</p>
              )}
              <ul className="grid gap-3">
                {visible.map(({ room, label }) => (
                  <li
                    key={room.workRequestId}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <Link
                      to={`/requests/${room.workRequestId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {room.projectTitle ?? "직접 의뢰"} ·{" "}
                      {room.counterpartName}
                    </Link>
                    <Badge variant="secondary">{label}</Badge>
                    {room.unreadCount > 0 && (
                      <Badge>새 메시지 {room.unreadCount}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </TabsContent>
          );
        })}
      </Tabs>
    </Card>
  );
}
