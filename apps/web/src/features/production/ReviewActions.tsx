import { useState } from "react";
import Button from "../../components/ui/button";
import Label from "../../components/ui/label";
import type {
  DeliveryState,
  DeliveryVersion,
} from "../../mocks/delivery-model";
import type { FinalCommand } from "../../mocks/final-model";
import { isDraftVersion } from "../../mocks/revision-model";

export default function ReviewActions({
  state,
  version,
  creator,
  disabled,
  submit,
}: {
  state: DeliveryState;
  version?: DeliveryVersion;
  creator: boolean;
  disabled: boolean;
  submit: (cmd: FinalCommand) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const { approval } = state.final;
  const blocked =
    !version ||
    version.id !== state.versions.at(-1)?.id ||
    isDraftVersion(state, version) ||
    state.requests.some((r) => !r.resultVersionId);
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border p-4"
      aria-label="검토본 승인"
    >
      <h2 className="type-heading-md">검토본 승인</h2>
      <p>
        승인은 선택한 검토 버전을 고정해요. 최종 파일 전달과 전용 수령 확인이
        별도로 필요하며 정산을 실행하지 않아요.
      </p>
      {approval ? (
        <p role="status">
          검토 승인 기록 · v
          {state.versions.find((v) => v.id === approval.versionId)?.number} ·{" "}
          {approval.actorId} · {approval.at}
        </p>
      ) : (
        <>
          {blocked && (
            <p>
              최신 완성 검토본을 선택해 주세요. 열린 수정 요청 중 승인은 D11
              협의 전 보류하는 Mock 예시예요.
            </p>
          )}
          {!creator && version && !isDraftVersion(state, version) && (
            <>
              <Label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={disabled || blocked}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                선택한 검토 버전의 내용을 확인했어요
              </Label>
              <Button
                disabled={disabled || blocked || !confirmed}
                onClick={() => {
                  if (version)
                    submit({
                      type: "approve",
                      id: crypto.randomUUID(),
                      revision: state.revision,
                      versionId: version.id,
                      confirmed: true,
                    });
                }}
              >
                이 검토 버전 승인 (Mock)
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}
