import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";
import ReviewPlayer from "../features/production/ReviewPlayer";
import deadlineTime from "../features/production/time";
import {
  loadDeliveries,
  loadDeliveryMedia,
  saveDelivery,
  uploadDelivery,
  saveRevision,
} from "./delivery-api";
import {
  assetSchema,
  deliveryCommandSchema,
  type DeliveryAsset,
  type DeliveryCommand,
  deliveryKindLabels,
  deliverySubmitLabels,
} from "./delivery-model";
import RevisionPanelMock from "./RevisionPanelMock";
import type { RevisionCommand } from "./revision-model";

function Video({
  contractId,
  versionId,
  name,
  initialSeconds,
  onPosition,
}: {
  contractId: string;
  versionId: string;
  name: string;
  initialSeconds: number;
  onPosition: (position: { seconds: number; duration: number }) => void;
}) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: [
      "mock-delivery-media",
      session.epoch(),
      user?.id,
      contractId,
      versionId,
    ],
    queryFn: ({ signal }) => loadDeliveryMedia(contractId, versionId, signal),
  });
  if (query.isFetching) return <p role="status">영상 불러오는 중…</p>;
  if (query.error)
    return (
      <div role="alert">
        <p>영상 접근·응답을 확인하지 못했어요.</p>
        <Button onClick={() => query.refetch()}>영상 불러오기 재시도</Button>
      </div>
    );
  return (
    query.data && (
      <ReviewPlayer
        key={query.dataUpdatedAt}
        blob={query.data}
        name={name}
        initialSeconds={initialSeconds}
        onPosition={onPosition}
      />
    )
  );
}
export default function DeliveryMock({ contractId }: { contractId: string }) {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [asset, setAsset] = useState<DeliveryAsset | null>(null);
  const [kind, setKind] = useState<"DRAFT" | "REVIEW" | "REVISION">("DRAFT");
  const [description, setDescription] = useState("");
  const [watermark, setWatermark] = useState(false);
  const [pending, setPending] = useState<
    DeliveryCommand | RevisionCommand | null
  >(null);
  const [position, setPosition] = useState({
    versionId: "",
    seconds: 0,
    duration: 0,
  });
  const [notice, setNotice] = useState("");
  const valid = z.string().uuid().safeParse(contractId).success;
  const query = useQuery({
    queryKey: ["mock-deliveries", session.epoch(), user?.id, contractId],
    queryFn: ({ signal }) => loadDeliveries(contractId, signal),
    enabled: valid,
    refetchOnReconnect: false,
  });
  const upload = useMutation({
    mutationFn: (value: File) => uploadDelivery(contractId, value),
  });
  const submit = useMutation({
    mutationFn: (value: DeliveryCommand | RevisionCommand) =>
      "type" in value
        ? saveRevision(contractId, value)
        : saveDelivery(contractId, value),
  });
  const busy = query.isFetching || upload.isPending || submit.isPending;
  const disabled =
    busy || Boolean(query.error) || Boolean(pending) || !query.data?.canSubmit;
  const versions = query.data?.state.versions ?? [];
  const openRequest = query.data?.state.requests.find(
    (r) => !r.resultVersionId,
  );
  let activeKind = kind;
  if (kind === "REVISION") activeKind = "REVIEW";
  if (openRequest) activeKind = "REVISION";
  const selectedId = params.get("version");
  const version = selectedId
    ? versions.find((v) => v.id === selectedId)
    : versions.at(-1);
  const reconcile = async () => {
    const epoch = session.epoch();
    const response = await query.refetch();
    if (epoch !== session.epoch() || response.isError || !response.data) return;
    if (
      pending &&
      response.data.state.receipts.some((r) => r.id === pending.id)
    ) {
      if (!("type" in pending))
        setParams({
          version: pending.id,
          ...(pending.requestId ? { request: pending.requestId } : {}),
        });
      else if (pending.type === "request")
        setParams({ version: pending.versionId, request: pending.id });
      setPending(null);
      setAsset(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setDescription("");
      setWatermark(false);
      submit.reset();
    }
    setNotice("영상 버전을 재조회했어요.");
  };
  const dispatch = (cmd: DeliveryCommand | RevisionCommand) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending(cmd);
    setNotice("");
    submit.mutate(cmd, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const response = await query.refetch();
        if (epoch !== session.epoch() || response.isError || !response.data)
          return;
        if (response.data.state.receipts.some((r) => r.id === cmd.id)) {
          if (!("type" in cmd))
            setParams({
              version: cmd.id,
              ...(cmd.requestId ? { request: cmd.requestId } : {}),
            });
          else if (cmd.type === "request")
            setParams({ version: cmd.versionId, request: cmd.id });
          setPending(null);
          setAsset(null);
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
          setDescription("");
          setWatermark(false);
          setNotice(
            "type" in cmd
              ? "수정 상태가 모의 기록에 반영됐어요."
              : "영상 제출이 모의 기록에 반영됐어요.",
          );
        }
      },
    });
  };
  const input = deliveryCommandSchema.safeParse({
    id: crypto.randomUUID(),
    revision: query.data?.state.revision,
    assetId: asset?.id,
    kind: activeKind,
    ...(openRequest ? { requestId: openRequest.id } : {}),
    description,
    watermarkConfirmed: watermark,
  });
  return (
    <section
      className="showcase-card grid min-w-0 gap-6 break-words"
      aria-label="영상 제출과 버전"
    >
      <h1 className="type-heading-lg">초안·완성 검토본과 영상 버전</h1>
      <p>
        개발용 Mock · 단일 탭 메모리. 새로고침 시 계약·영상 기록이 초기화돼요.
        실제 API·파일 저장·검사·변환·알림 미연결.
      </p>
      <p>
        검토본은 제작자가 영상 자체에 KEMI 워터마크를 넣어 준비해요. 이 예시는
        제작자의 확인을 기록하며 워터마크 존재를 검사하거나 합성하지 않아요.
      </p>
      <Button variant="outline" disabled={busy || !valid} onClick={reconcile}>
        영상 버전 재조회
      </Button>
      {!valid && <p role="alert">유효한 계약 식별이 필요해요.</p>}
      {busy && (
        <p role="status">
          {upload.isPending ? "모의 업로드 처리 중…" : "영상 상태 확인 중…"}
        </p>
      )}
      {(query.error || submit.error || (pending && !busy)) && (
        <p role="alert">
          제출 결과를 확인하지 못했어요. 재조회 또는 같은 요청 재시도로 확인해
          주세요. 새 제출은 차단해요.
        </p>
      )}
      {pending && !busy && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => dispatch(pending)}>
            같은 영상 제출 재시도
          </Button>
          <Button
            variant="outline"
            disabled={
              Boolean(query.error) || query.dataUpdatedAt <= submit.submittedAt
            }
            onClick={() => {
              setPending(null);
              submit.reset();
            }}
          >
            재조회 상태로 다시 작성
          </Button>
        </div>
      )}
      {query.data && (
        <div
          className={query.error ? "hidden" : "grid min-w-0 gap-6"}
          hidden={Boolean(query.error)}
        >
          <p>
            계약: {contractId} · {!query.data.started && "제작 시작 전"}
            {query.data.started && !query.data.prepared && "준비 문제 보류"}
            {query.data.prepared &&
              (versions.some((v) => v.kind === "REVIEW")
                ? "검토 중"
                : "제작 중·초안 단계")}{" "}
            · 초안·조회·대화는 회차 차감 없음
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to={`/workspace/${query.data.requestId}`}>
              같은 작업 공간으로 돌아가기
            </Link>
            <Link to={`/contracts/${contractId}/production`}>
              준비·납기 확인
            </Link>
          </div>
          {user?.id === query.data.creatorId && (
            <section
              className="grid gap-3 rounded-xl border p-4"
              aria-label="영상 제출 작성"
            >
              <h2 className="type-heading-md">영상 준비 후 별도로 제출</h2>
              {!query.data.canSubmit && (
                <p>
                  전액 결제·제작 시작·필수 준비 정상 상태를 확인해 주세요. 새
                  업로드와 제출을 차단해요.
                </p>
              )}
              <p>
                Mock 입력 보호 예시: MP4/WebM 1개·300MiB 이하·설명 2,000자.
                D17의 실제 파일 제한은 미결정이에요.
              </p>
              <Label htmlFor="delivery-file">검토 영상 파일</Label>
              <Input
                ref={fileInput}
                id="delivery-file"
                type="file"
                accept="video/mp4,video/webm"
                disabled={disabled}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setAsset(null);
                  setWatermark(false);
                  upload.reset();
                }}
              />
              <Button
                variant="outline"
                disabled={disabled || !file || Boolean(asset)}
                onClick={() => {
                  if (!file) return;
                  if (
                    !assetSchema.safeParse({
                      id: crypto.randomUUID(),
                      name: file.name,
                      size: file.size,
                      mime: file.type,
                    }).success
                  ) {
                    setNotice("Mock 지원 형식·빈 파일·크기를 확인해 주세요.");
                    return;
                  }
                  const epoch = session.epoch();
                  upload.mutate(file, {
                    onSuccess: (value) => {
                      if (epoch === session.epoch()) {
                        setAsset(value);
                        setNotice("영상 준비 완료 · 아직 제출되지 않았어요.");
                      }
                    },
                  });
                }}
              >
                {upload.error ? "영상 준비 재시도" : "영상 준비 (Mock 업로드)"}
              </Button>
              {upload.error && (
                <p role="alert">
                  영상 준비에 실패했어요. 파일을 유지했으니 재시도해 주세요.
                  제출 안내는 생성하지 않았어요.
                </p>
              )}
              {asset && (
                <p role="status">
                  준비된 파일: {asset.name} · {asset.size} bytes · 미제출
                </p>
              )}
              <Label htmlFor="delivery-kind">제출 종류</Label>
              {openRequest && (
                <p>
                  원요청 {openRequest.id}에 연결된 수정본 ·{" "}
                  {openRequest.category === "ERROR" &&
                  !openRequest.correctionAccepted
                    ? "오류 시정 합의 대기·제출 보류"
                    : "처리 설명과 새 영상을 준비해 주세요."}
                </p>
              )}
              <select
                id="delivery-kind"
                className="w-full rounded-xl border p-3"
                disabled={disabled || Boolean(openRequest)}
                value={activeKind}
                onChange={(e) => {
                  setKind(e.target.value === "REVIEW" ? "REVIEW" : "DRAFT");
                  setWatermark(false);
                }}
              >
                <option value="DRAFT">초안 공유</option>
                <option value="REVIEW">완성 검토본 제출</option>
                {openRequest && (
                  <option value="REVISION">요청 연결 수정본 제출</option>
                )}
              </select>
              <Label htmlFor="delivery-description">영상 설명</Label>
              <Textarea
                id="delivery-description"
                maxLength={2000}
                disabled={disabled}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {activeKind !== "DRAFT" && (
                <Label>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={watermark}
                    onChange={(e) => setWatermark(e.target.checked)}
                  />
                  영상 자체에 KEMI 워터마크를 넣어 준비했어요
                </Label>
              )}
              <Button
                disabled={
                  disabled ||
                  !input.success ||
                  Boolean(
                    openRequest?.category === "ERROR" &&
                    !openRequest.correctionAccepted,
                  )
                }
                onClick={() => {
                  if (input.success) dispatch(input.data);
                }}
              >
                {deliverySubmitLabels[activeKind]}
              </Button>
            </section>
          )}
          <section className="grid min-w-0 gap-4" aria-label="영상 버전 목록">
            <h2 className="type-heading-md">영상 버전 ({versions.length})</h2>
            {!versions.length && (
              <p>
                아직 제출된 영상이 없어요. 파일 준비만으로 버전이 생성되지
                않아요.
              </p>
            )}
            <ol className="grid gap-3">
              {versions.map((v) => (
                <li key={v.id} className="min-w-0 rounded-xl border p-4">
                  <Link
                    aria-current={v.id === version?.id ? "page" : undefined}
                    to={`?version=${v.id}`}
                  >
                    v{v.number} · {deliveryKindLabels[v.kind]}
                  </Link>
                  <p>
                    {deadlineTime(v.at)} ·{" "}
                    {v.authorId === user?.id ? "본인 제작자" : "상대 제작자"}
                  </p>
                  <p className="whitespace-pre-wrap">{v.description}</p>
                </li>
              ))}
            </ol>
          </section>
          {selectedId && !version && (
            <p role="alert">
              지정한 영상 버전을 찾을 수 없어요. 다른 버전으로 자동 이동하지
              않아요.
            </p>
          )}
          {version && !query.error && (
            <section
              className="grid min-w-0 gap-3"
              aria-label="선택한 영상 버전"
            >
              <h2 className="type-heading-md">
                v{version.number} · {deliveryKindLabels[version.kind]}
                {version.kind !== "DRAFT" && " · 검토 중"}
              </h2>
              <p>{version.description}</p>
              {version.kind !== "DRAFT" && (
                <p>
                  영상 자체 KEMI 워터마크: 제작자 준비 확인 (자동 검사 아님)
                </p>
              )}
              <Video
                key={`${version.id}-${params.get("t")}-${session.epoch()}`}
                contractId={contractId}
                versionId={version.id}
                name={version.asset.name}
                initialSeconds={Math.max(
                  0,
                  Math.min(86400, Number(params.get("t")) || 0),
                )}
                onPosition={(value) =>
                  setPosition({ ...value, versionId: version.id })
                }
              />
            </section>
          )}
          <RevisionPanelMock
            state={query.data.state}
            version={version}
            creator={user?.id === query.data.creatorId}
            terms={query.data.revisionTerms}
            disabled={
              busy ||
              Boolean(query.error) ||
              Boolean(pending) ||
              !query.data.prepared
            }
            position={
              position.versionId === version?.id
                ? position
                : { seconds: 0, duration: 0 }
            }
            selectedRequest={params.get("request")}
            submit={dispatch}
          />
          <p>
            초안 공유·조회·대화는 수정 회차·승인·완료·수령·정산을 변경하지
            않아요. 승인·최종 전달·수령·정산은 후속 범위예요.
          </p>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>4-B 개발 전용 시나리오</summary>
        <Label htmlFor="delivery-scenario">Mock 영상 응답</Label>
        <select
          id="delivery-scenario"
          disabled={busy}
          defaultValue="success"
          onChange={async (e) => {
            await fetch("/__mock__/deliveries/scenario", {
              method: "POST",
              body: e.target.value,
            });
          }}
        >
          {[
            "success",
            "delay",
            "lost-response",
            "network",
            "401",
            "403",
            "409",
            "500",
            "malformed",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </details>
    </section>
  );
}
