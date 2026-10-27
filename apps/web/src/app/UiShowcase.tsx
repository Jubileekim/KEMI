import customStyle from "@/lib/custom-style";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import Brand from "@/components/kemi/brand";
import EmptyState from "@/components/kemi/empty-state";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/textarea";
import Checkbox from "@/components/ui/checkbox";
import Label from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import Toaster from "@/components/ui/sonner";

export default function UiShowcase() {
  const [name, setName] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [checked, setChecked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-card focus:p-4"
      >
        본문으로 건너뛰기
      </a>
      <main id="main-content" className="page-container" tabIndex={-1}>
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Brand />
          <Badge variant="secondary">공통 UI · 0-B</Badge>
        </header>
        <div className="mb-8 grid gap-3">
          <p className="type-label-md text-primary">함께 만드는 크리에이티브</p>
          <h1 className="type-display-sm">케미의 시작을 단단하게</h1>
          <p className="type-body-md max-w-prose text-muted-foreground">
            브랜드와 공통 UI를 확인하는 개발용 샘플입니다. 입력과 선택은 이 화면
            안에서만 동작합니다.
          </p>
        </div>
        <div className="showcase-grid">
          <section className="showcase-card" aria-labelledby="actions-title">
            <h2 id="actions-title" className="type-heading-md">
              버튼과 상태
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  toast.info("공통 UI 동작 확인", {
                    description: "서버에 전송하거나 저장하지 않았습니다.",
                  })
                }
              >
                알림 확인
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.success("성공 상태 예시", {
                    description: "실제 저장 결과가 아닙니다.",
                  })
                }
              >
                성공 예시
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error("오류 상태 예시", {
                    description: "작성 내용은 유지됩니다.",
                  })
                }
              >
                오류 예시
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setName("");
                  setInvalid(false);
                }}
              >
                입력 초기화
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  toast.warning("주의 상태 예시", {
                    description: "삭제 작업은 수행하지 않았습니다.",
                  })
                }
              >
                주의 예시
              </Button>
              <Button disabled>사용 불가</Button>
              <Button disabled aria-busy="true">
                <Loader2Icon aria-hidden="true" className="animate-spin" />
                처리 중 예시
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2" aria-label="배지 예시">
              <Badge>기본</Badge>
              <Badge variant="secondary">선택</Badge>
              <Badge variant="outline">안내</Badge>
              <Badge variant="destructive">오류</Badge>
            </div>
            <p className="type-body-sm mt-4 text-muted-foreground">
              상태는 문구로도 구분합니다. Tab 키로 포커스를 확인할 수 있어요.
            </p>
          </section>
          <section className="showcase-card" aria-labelledby="fields-title">
            <h2 id="fields-title" className="type-heading-md">
              입력과 선택
            </h2>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                setInvalid(!name.trim());
                if (name.trim())
                  toast.info("입력 확인 완료", {
                    description: "화면 예시이며 저장하지 않았습니다.",
                  });
              }}
            >
              <div className="field-stack">
                <Label htmlFor="sample-name">이름 예시 (필수)</Label>
                <Input
                  id="sample-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (event.target.value.trim()) setInvalid(false);
                  }}
                  required
                  aria-invalid={invalid}
                  aria-describedby={
                    invalid ? "name-help name-error" : "name-help"
                  }
                  placeholder="이름을 입력해 주세요"
                />
                <p
                  id="name-help"
                  className="type-body-sm text-muted-foreground"
                >
                  UI 오류 연결을 확인하기 위한 입력입니다.
                </p>
                {invalid && (
                  <p
                    id="name-error"
                    role="alert"
                    className="type-body-sm text-destructive"
                  >
                    이름 예시를 입력해 주세요.
                  </p>
                )}
              </div>
              <div className="field-stack">
                <Label htmlFor="sample-select">항목 예시 (선택)</Label>
                <Select>
                  <SelectTrigger id="sample-select" className="w-full">
                    <SelectValue placeholder="항목을 선택해 주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">샘플 항목 A</SelectItem>
                    <SelectItem value="b">샘플 항목 B</SelectItem>
                    <SelectItem value="c" disabled>
                      사용 불가 항목
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="field-stack">
                <Label htmlFor="sample-description">설명 예시 (선택)</Label>
                <Textarea
                  id="sample-description"
                  placeholder="긴 한국어 문장과 여러 줄 입력을 확인하세요."
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sample-readonly">읽기 전용</Label>
                <Input
                  id="sample-readonly"
                  value="변경할 수 없는 예시"
                  readOnly
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sample-disabled">비활성 입력</Label>
                <Input
                  id="sample-disabled"
                  placeholder="입력할 수 없어요"
                  disabled
                />
              </div>
              <Label className="my-4 min-h-11 gap-3" htmlFor="sample-check">
                <Checkbox
                  id="sample-check"
                  checked={checked}
                  onCheckedChange={(value) => setChecked(value === true)}
                />
                선택 상태 확인 (약관 동의 아님)
              </Label>
              <Button type="submit">입력 확인</Button>
            </form>
          </section>
          <section className="showcase-card" aria-labelledby="navigation-title">
            <h2 id="navigation-title" className="type-heading-md">
              탭과 다이얼로그
            </h2>
            <Tabs defaultValue="summary">
              <TabsList aria-label="공통 UI 탭 예시">
                <TabsTrigger value="summary">안내</TabsTrigger>
                <TabsTrigger value="detail">상세</TabsTrigger>
                <TabsTrigger value="disabled" disabled>
                  사용 불가
                </TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="py-4">
                <p>방향키로 탭을 이동해 보세요.</p>
              </TabsContent>
              <TabsContent value="detail" className="py-4">
                <p>
                  탭 선택은 화면 상태만 바꿉니다. 실제 서비스 경로는 다음
                  범위에서 구성합니다.
                </p>
              </TabsContent>
            </Tabs>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">다이얼로그 열기</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>함께 확인해 주세요</DialogTitle>
                  <DialogDescription>
                    공통 다이얼로그 예시입니다. Escape 또는 닫기 버튼으로 닫으면
                    열기 버튼으로 포커스가 돌아갑니다.
                  </DialogDescription>
                </DialogHeader>
                <p>기능·계약·결제 정책을 확정하는 동작은 포함하지 않습니다.</p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button>확인하고 닫기</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </section>
          <section className="showcase-card" aria-labelledby="feedback-title">
            <h2 id="feedback-title" className="type-heading-md">
              빈 결과와 피드백
            </h2>
            <EmptyState
              title="표시할 샘플이 없어요"
              description="검색 결과가 비어 있을 때 안내와 다음 행동을 함께 제공합니다."
            />
            <div
              role="status"
              className="type-body-sm flex items-center gap-2 py-3 text-muted-foreground"
            >
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              로딩 표현 예시
            </div>
            <div className="grid gap-3 rounded-[var(--radius-card)] border p-4">
              <p className="type-body-sm text-destructive">
                오류 표현 예시 · 작성한 입력은 유지됩니다.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setRetryCount((count) => count + 1);
                  toast.info("재시도 버튼 동작 확인", {
                    description: "네트워크 요청은 보내지 않았습니다.",
                  });
                }}
              >
                재시도 예시
              </Button>
              <p role="status" className="type-body-sm text-muted-foreground">
                예시 재시도 횟수: {retryCount}
              </p>
            </div>
          </section>
          <section
            className="showcase-card lg:col-span-2"
            aria-labelledby="brand-title"
          >
            <h2 id="brand-title" className="type-heading-md">
              KEMI 시각 기준
            </h2>
            <div className="flex flex-wrap items-center gap-6">
              <Brand symbol />
              {[
                ["Leaf Green", "--kemi-leaf-green"],
                ["주요 행동", "--action-primary"],
                ["본문", "--text-primary"],
              ].map(([label, token]) => (
                <p
                  key={token}
                  className="swatch type-body-sm"
                  style={customStyle({ "--swatch": `var(${token})` })}
                >
                  {label}
                </p>
              ))}
            </div>
            <p className="type-body-sm mt-6 text-muted-foreground">
              원본 로고 · 카드 24px · 모달 28px · 버튼 999px · 라이트 테마
            </p>
            <p className="type-caption mt-2 text-muted-foreground">
              Pretendard 파일 미제공으로 시스템 대체 글꼴 사용
            </p>
          </section>
        </div>
      </main>
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{ duration: 6000 }}
      />
    </>
  );
}
