import { useParams } from "react-router";
import { session, useSession } from "../app/session";
import Label from "../components/ui/label";
import DiscoveryListMock from "./DiscoveryListMock";
import DiscoveryDetailMock from "./DiscoveryDetailMock";

function Scenario() {
  return (
    <details className="rounded-xl border p-4">
      <summary>2-C 개발 전용 시나리오</summary>
      <Label htmlFor="discovery-scenario">Mock 모집 응답</Label>
      <select
        id="discovery-scenario"
        defaultValue="success"
        onChange={(event) => {
          fetch("/__mock__/discovery/scenario", {
            method: "POST",
            body: event.target.value,
          });
        }}
      >
        {[
          "success",
          "delay",
          "401",
          "403",
          "404",
          "409",
          "500",
          "network",
          "malformed",
          "lost-response",
        ].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </details>
  );
}
export default function DiscoveryMock() {
  const { campaignId } = useParams();
  const { user } = useSession();
  return (
    <section className="grid min-w-0 gap-6">
      <p className="rounded-xl bg-muted p-4">
        개발용 Mock · 예시 모집 9개와 이 탭에서 공개한 공고예요. 새로고침하면
        작성 데이터가 초기화돼요. 실제 API·DB·알림은 미연결이에요.
      </p>
      <Scenario />
      {campaignId ? (
        <DiscoveryDetailMock
          key={`${campaignId}-${user?.id}-${session.epoch()}`}
          id={campaignId}
        />
      ) : (
        <DiscoveryListMock />
      )}
    </section>
  );
}
