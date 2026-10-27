import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import { loadNotifications } from "./engagement-api";

export default function NotificationBadgeMock() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-notifications", session.epoch(), user?.id],
    queryFn: ({ signal }) => loadNotifications(signal),
    enabled: Boolean(user),
    refetchInterval: 10000,
  });
  return (
    <Link to="/notifications">
      알림 ·{" "}
      {query.isError ? "확인 실패" : (query.data?.unreadCount ?? "확인 중")}
    </Link>
  );
}
