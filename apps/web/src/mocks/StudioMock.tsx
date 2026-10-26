import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Label from "../components/ui/label";
import Button from "../components/ui/button";
import { studioRequest, studioError } from "./studio-api";
import {
  packageFields,
  applyStudio,
  visiblePackages,
  type PackageItem,
  type StudioCommand,
  type StudioState,
} from "./studio-model";
import PortfolioManagerMock from "./PortfolioManagerMock";
import PackageEditorMock from "./PackageEditorMock";

function StudioContent({
  state,
  queryKey,
  fetching,
  reload,
  readError,
  portfolio,
}: {
  state: StudioState;
  queryKey: readonly unknown[];
  fetching: boolean;
  reload: () => void;
  readError: unknown;
  portfolio: boolean;
}) {
  const cache = useQueryClient();
  const [editor, setEditor] = useState<PackageItem | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: async (command: StudioCommand) => {
      applyStudio(state, command);
      const epoch = session.epoch();
      const result = await studioRequest(command, state.revision);
      if (epoch !== session.epoch()) return;
      cache.setQueryData(queryKey, result);
      cache.invalidateQueries({ queryKey: ["my-profile"] });
      setNotice("모의 변경을 저장했어요.");
    },
  });
  const busy = mutation.isPending || fetching;
  const save = async (command: StudioCommand) => {
    if (busy) return false;
    setNotice("");
    try {
      await mutation.mutateAsync(command);
      return true;
    } catch {
      return false;
    }
  };
  const statuses = { DRAFT: "초안", PUBLIC: "공개", PRIVATE: "비공개" };
  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6">
      <div className="grid gap-2">
        <p className="type-label-sm text-primary">CREATOR STUDIO</p>
        <h1 className="type-heading-lg">
          {portfolio ? "작업물 관리" : "패키지·서비스 관리"}
        </h1>
        <div className="flex flex-wrap gap-4">
          <Link to="/me/profile">내 프로필 확인</Link>
          {portfolio ? (
            <Link to="/studio/packages">패키지·서비스로 이동</Link>
          ) : (
            <Link to="/studio/portfolio">작업물 관리로 이동</Link>
          )}
        </div>
      </div>
      <p role="status" className="rounded-xl bg-muted p-4">
        개발용 Mock · 실제 API·DB·탐색·거래에는 반영되지 않아요. 이 탭에서만
        보관하며 새로고침하면 초기화돼요.
      </p>
      <section
        className="showcase-card grid gap-4"
        aria-label="서비스 공개 관리"
      >
        <h2 className="type-heading-sm">
          제작 서비스: {statuses[state.service]}
        </h2>
        <p>
          프로필·패키지 저장만으로 서비스가 공개되지 않아요. 공개 대표 패키지가
          필요하며 포트폴리오는 필수가 아니에요.
        </p>
        <p>
          D01 필수 프로필 항목은 미결정이에요. 공개 조건 결과는 개발 도구의 모의
          값으로만 검사해요.
        </p>
        <p>
          비공개 시 신규 직접 의뢰·제안 제출과 탐색 노출을 중단해요. 기존
          협의·계약·납품 접근은 유지해요. 실제 활동 기능의 권한 검증은
          미연결이에요.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || state.service === "PUBLIC"}
            onClick={() => save({ type: "service", public: true })}
          >
            서비스 공개
          </Button>
          <Button
            variant="outline"
            disabled={busy || state.service === "PRIVATE"}
            onClick={() => save({ type: "service", public: false })}
          >
            서비스 비공개
          </Button>
        </div>
      </section>
      <details className="rounded-xl border p-4">
        <summary>1-D 개발 전용 시나리오</summary>
        <div className="mt-4 grid gap-4">
          <Label htmlFor="studio-response">Mock 관리 응답</Label>
          <select
            id="studio-response"
            defaultValue="success"
            onChange={(event) => {
              fetch("/__mock__/studio/scenario", {
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
              "409",
              "500",
              "network",
              "malformed",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <Label htmlFor="studio-gate">D01 모의 프로필 조건</Label>
          <select
            id="studio-gate"
            disabled={busy}
            value={state.profileGate}
            onChange={(event) => {
              const { value } = event.target;
              if (
                value === "UNKNOWN" ||
                value === "READY" ||
                value === "MISSING"
              )
                save({ type: "profile-gate", value });
            }}
          >
            <option value="UNKNOWN">기준 미결정</option>
            <option value="READY">모의 충족</option>
            <option value="MISSING">모의 누락</option>
          </select>
          <Button variant="outline" disabled={busy} onClick={reload}>
            최신 값 확인
          </Button>
        </div>
      </details>
      {!!readError && (
        <p role="alert">
          최신 값을 확인하지 못했어요. 편집 내용은 유지돼요.{" "}
          {studioError(readError)}
        </p>
      )}
      {mutation.error && (
        <p role="alert" className="rounded-xl border border-destructive p-4">
          {studioError(mutation.error)}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {portfolio ? (
        <PortfolioManagerMock state={state} busy={busy} onSave={save} />
      ) : (
        <>
          {editor !== null ? (
            <PackageEditorMock
              key={typeof editor === "string" ? editor : editor.id}
              item={editor === "new" ? undefined : editor}
              busy={busy}
              onSave={save}
              onClose={() => setEditor(null)}
            />
          ) : (
            <Button
              className="justify-self-start"
              disabled={busy}
              onClick={() => setEditor("new")}
            >
              새 패키지 만들기
            </Button>
          )}
          <div className="grid gap-4">
            <h2 className="type-heading-sm">
              내 패키지 ({state.packages.length})
            </h2>
            {state.packages.length === 0 && (
              <p>첫 패키지를 초안으로 준비해 보세요. 대표는 직접 지정해요.</p>
            )}
            {state.packages.map((item) => (
              <article
                key={item.id}
                aria-label={`패키지 ${item.title || "제목 없는 초안"}`}
                className="showcase-card grid gap-4"
              >
                <h3 className="type-heading-sm">
                  {item.title || "제목 없는 초안"} · {statuses[item.visibility]}
                  {state.primaryId === item.id && " · 대표"}
                </h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(packageFields).map(([name, label]) => (
                    <div key={name} className="min-w-0">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {String(Reflect.get(item, name)) || "미입력"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>가격과 조건 변경은 기존 계약에 반영되지 않아요.</p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={busy || editor !== null}
                    onClick={() => setEditor(item)}
                  >
                    패키지 수정
                  </Button>
                  {item.visibility === "PUBLIC" && (
                    <>
                      <Button
                        disabled={
                          busy || editor !== null || state.primaryId === item.id
                        }
                        onClick={() => save({ type: "primary", id: item.id })}
                      >
                        대표로 지정
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || editor !== null}
                        onClick={() =>
                          save({
                            type: "save-package",
                            id: item.id,
                            values: item,
                            visibility: "PRIVATE",
                          })
                        }
                      >
                        패키지 비공개
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy || !!state.reference || editor !== null}
                    onClick={() =>
                      save({ type: "capture-reference", id: item.id })
                    }
                  >
                    모의 계약 참조 보관
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <section
            className="showcase-card grid gap-3"
            aria-label="모의 공개 결과"
          >
            <h2 className="type-heading-sm">공개 결과 미리보기 · Mock</h2>
            <p>
              신규 활동:{" "}
              {state.service === "PUBLIC" ? "모의 허용" : "모의 차단"}
            </p>
            <ul>
              {visiblePackages(state).map((p) => (
                <li key={p.id}>
                  {p.title} · {p.price}원
                  {p.id === state.primaryId ? " · 대표" : ""}
                </li>
              ))}
            </ul>
            {visiblePackages(state).length === 0 && <p>공개 노출 상품 없음</p>}
            <p>기존 거래: 실제 연결 미구현 · 아래 참조는 테스트용 예시예요.</p>
            {state.reference && (
              <p>
                보관된 모의 계약: {state.reference.title} ·{" "}
                {state.reference.price}원 · {state.reference.included}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default function StudioMock({
  portfolio = false,
}: {
  portfolio?: boolean;
}) {
  const { user } = useSession();
  const key = ["mock-studio", user?.id, session.epoch()] as const;
  const query = useQuery({
    queryKey: key,
    enabled: user?.role === "CREATOR",
    queryFn: ({ signal }) => studioRequest(undefined, undefined, signal),
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });
  if (!user || user.role !== "CREATOR")
    return (
      <p role="alert">
        크리에이터 계정으로 로그인해 주세요. 역할 전환 도구만으로는 저장할 수
        없어요.
      </p>
    );
  if (query.isPending) return <p role="status">관리 정보를 불러오고 있어요.</p>;
  if (!query.data)
    return (
      <section role="alert">
        <h1 className="type-heading-lg">관리 정보를 불러오지 못했어요</h1>
        <p>{studioError(query.error)}</p>
        <Button onClick={() => query.refetch()}>관리 정보 다시 불러오기</Button>
      </section>
    );
  return (
    <StudioContent
      key={`${user.id}-${session.epoch()}-${portfolio}`}
      state={query.data}
      portfolio={portfolio}
      readError={query.error}
      queryKey={key}
      fetching={query.isFetching}
      reload={() => query.refetch()}
    />
  );
}
