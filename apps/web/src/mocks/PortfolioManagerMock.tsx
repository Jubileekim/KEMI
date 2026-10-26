import { useRef, useState } from "react";
import Button from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import WorkEditorMock from "./WorkEditorMock";
import { originLabels, type WorkItem } from "./portfolio-model";
import {
  visibleWorks,
  type StudioCommand,
  type StudioState,
} from "./studio-model";
import { optionLabels } from "../features/profiles/contracts";

export default function PortfolioManagerMock({
  state,
  busy,
  onSave,
}: {
  state: StudioState;
  busy: boolean;
  onSave: (command: StudioCommand) => Promise<boolean>;
}) {
  const [editor, setEditor] = useState<WorkItem | "new" | null>(null);
  const [target, setTarget] = useState<WorkItem | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const statuses = { DRAFT: "초안", PUBLIC: "공개 후보", PRIVATE: "비공개" };
  return (
    <>
      {editor !== null ? (
        <WorkEditorMock
          key={typeof editor === "string" ? editor : editor.id}
          item={editor === "new" ? undefined : editor}
          busy={busy}
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      ) : (
        <Button
          ref={createTrigger}
          className="justify-self-start"
          disabled={busy}
          onClick={() => setEditor("new")}
        >
          새 작업물 만들기
        </Button>
      )}
      <section className="grid gap-4" aria-label="내 작업물">
        <h2 className="type-heading-sm">내 작업물 ({state.works.length})</h2>
        {state.works.length === 0 && (
          <p>
            자작 샘플부터 준비해 보세요. 작업물을 등록해도 자동으로 노출되지
            않아요.
          </p>
        )}
        {state.works.map((item) => (
          <article
            key={item.id}
            className="showcase-card grid gap-4"
            aria-label={`작업물 ${item.title || "제목 없는 초안"}`}
          >
            <h3 className="type-heading-sm">
              {item.title || "제목 없는 초안"} · {statuses[item.visibility]}
            </h3>
            <p className="whitespace-pre-wrap break-words">
              {item.description || "설명 미입력"}
            </p>
            <p>
              {originLabels[item.origin]} · 본인 역할:{" "}
              {item.roles.map((r) => optionLabels[r]).join(" · ") || "미선택"}
            </p>
            <p className="break-words">
              스타일: {item.style || "미입력"} · 작업유형:{" "}
              {item.workType || "미입력"}
            </p>
            <p className="break-words">출처: {item.source || "미입력"}</p>
            <p className="break-words">
              {item.mediaKind === "FILE"
                ? `영상: ${item.asset?.name || "미선택"} (로컬 모의 메타데이터)`
                : `외부 URL 초안: ${item.externalUrl || "미입력"}`}
            </p>
            <p>
              공개 권한: {item.rights ? "본인 확인" : "미확인"} · 고객 동의:{" "}
              {item.consent ? "확인" : "미확인/해당 없음"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy || editor !== null}
                onClick={() => setEditor(item)}
              >
                작업물 수정
              </Button>
              {item.visibility === "PUBLIC" && (
                <Button
                  variant="outline"
                  disabled={busy || editor !== null}
                  onClick={() =>
                    onSave({
                      type: "save-work",
                      id: item.id,
                      values: item,
                      visibility: "PRIVATE",
                    })
                  }
                >
                  작업물 비공개
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={busy || editor !== null}
                onClick={(event) => {
                  deleteTrigger.current = event.currentTarget;
                  setDeleteError(false);
                  setTarget(item);
                }}
              >
                작업물 삭제
              </Button>
              <Button
                variant="ghost"
                disabled={busy || editor !== null || !!state.workReference}
                onClick={() =>
                  onSave({ type: "capture-work-reference", id: item.id })
                }
              >
                모의 제출 참조 보관
              </Button>
            </div>
          </article>
        ))}
      </section>
      <section
        className="showcase-card grid gap-4"
        aria-label="모의 작업물 공개 목록"
      >
        <h2 className="type-heading-sm">공개 작업물 후보 · Mock</h2>
        <p>
          서비스와 작업물이 모두 공개일 때만 이 모의 목록에 표시해요. 실제
          피드·검색·재생 기능은 미연결이에요.
        </p>
        {visibleWorks(state).length === 0 && <p>공개 노출 작업물 없음</p>}
        <ul>
          {visibleWorks(state).map((item) => (
            <li key={item.id}>
              {item.title} · {originLabels[item.origin]} ·{" "}
              {item.roles.map((r) => optionLabels[r]).join(" · ")}
            </li>
          ))}
        </ul>
        {state.workReference && (
          <p className="break-words">
            보관된 모의 제출: {state.workReference.title} ·{" "}
            {state.workReference.source} ·{" "}
            {originLabels[state.workReference.origin]}
          </p>
        )}
      </section>
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (deleteTrigger.current?.isConnected)
              deleteTrigger.current.focus();
            else createTrigger.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogTitle>작업물을 삭제할까요?</DialogTitle>
          <DialogDescription>
            {target?.title || "제목 없는 초안"}을 내 목록과 공개 후보에서
            제거해요. 모의 제출 참조는 별도로 유지해요. 실제 제출 당시 파일·증빙
            보존 방식 D02는 미결정이며 실제 거래 기록은 변경하지 않아요.
          </DialogDescription>
          {deleteError && (
            <p role="alert">
              삭제하지 못했어요. 항목은 유지되며 자동 재전송하지 않아요. 취소 후
              응답 상태·최신 값을 확인하거나 직접 다시 시도해 주세요.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              삭제 취소
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!target) return;
                const saved = await onSave({
                  type: "delete-work",
                  id: target.id,
                });
                if (saved) setTarget(null);
                else setDeleteError(true);
              }}
            >
              삭제 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
