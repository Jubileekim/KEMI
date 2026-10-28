import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import {
  PRODUCTION_ROLES,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
  packageCreateSchema,
  portfolioCreateSchema,
  type Portfolio,
} from "@kemi/shared";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { ApiError } from "../../shared/api/client";
import { kemi } from "../../shared/api/kemi";
import { getProfile } from "../profiles/api";
import { uploadFile } from "../../shared/api/upload";
import {
  catalogStatusLabels,
  label,
  purposeLabels,
  roleLabels,
  styleLabels,
  won,
} from "../live/labels";
import { Card, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";

const number = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && String(value ?? "") !== "" ? n : null;
};

function Checks({
  name,
  values,
  labels,
  selected,
  onChange,
}: {
  name: string;
  values: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {values.map((value) => (
        <label
          key={value}
          htmlFor={`${name}-${value}`}
          className="flex items-center gap-2"
        >
          <input
            id={`${name}-${value}`}
            type="checkbox"
            checked={selected.includes(value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, value]
                  : selected.filter((v) => v !== value),
              )
            }
          />
          {label(labels, value)}
        </label>
      ))}
    </div>
  );
}

// 제작 서비스 공개(공개된 대표 패키지가 있어야 한다)
function ServiceToggle() {
  const service = useMutation({
    mutationFn: (visible: boolean) => kemi.setServiceVisible(visible),
  });
  return (
    <Card title="제작 서비스 공개">
      <p className="text-muted-foreground">
        공개된 대표 패키지가 있어야 서비스를 공개할 수 있어요. 공개하면 제작자
        페이지와 피드에 보여요.
      </p>
      <div className="flex gap-3">
        <Button
          disabled={service.isPending}
          onClick={() => service.mutate(true)}
        >
          서비스 공개
        </Button>
        <Button
          variant="outline"
          disabled={service.isPending}
          onClick={() => service.mutate(false)}
        >
          비공개로
        </Button>
      </div>
      {service.data && (
        <p role="status">
          현재: {label(catalogStatusLabels, service.data.serviceStatus)}
        </p>
      )}
      {service.error && <p role="alert">{errorText(service.error)}</p>}
    </Card>
  );
}

// 공개에 꼭 필요한 항목(서버의 공개 조건과 같다). 빠진 항목을 화면에서 바로 알려 준다.
function missingForPublish(p: {
  videoFileId: string | null;
  purpose: string | null;
  roles: string[];
}) {
  return [
    !p.videoFileId && "영상",
    !p.purpose && "영상 목적",
    p.roles.length === 0 && "본인 역할",
  ].filter((name): name is string => typeof name === "string");
}

// 작업물이 피드에 보이려면 세 가지가 모두 필요하다(작업물 공개·공개된 대표 패키지·제작 서비스 공개).
function FeedChecklist({ hasPublicWork }: { hasPublicWork: boolean }) {
  const profile = useQuery({
    queryKey: ["studio-service-status"],
    queryFn: ({ signal }) => getProfile("CREATOR", signal),
  });
  const packages = useQuery({
    queryKey: ["my-packages"],
    queryFn: ({ signal }) => kemi.myPackages(signal),
  });
  const service =
    profile.data?.profile.type === "CREATOR" &&
    profile.data.profile.serviceStatus === "PUBLIC";
  const representative = !!packages.data?.items.some(
    (p) => p.isRepresentative && p.status === "PUBLIC",
  );
  const steps = [
    {
      done: hasPublicWork,
      text: "작업물 1개 이상 공개 (아래 목록의 공개 버튼)",
    },
    { done: representative, text: "공개된 대표 패키지 지정", link: true },
    { done: service, text: "제작 서비스 공개", link: true },
  ];
  const ready = steps.every((s) => s.done);
  return (
    <Card title={ready ? "피드에 보이고 있어요" : "피드에 보이려면"}>
      <ul className="grid gap-1">
        {steps.map((s) => (
          <li key={s.text} className="flex flex-wrap items-center gap-2">
            <span aria-hidden>{s.done ? "✅" : "⬜"}</span>
            <span>{s.text}</span>
            <span className="sr-only">{s.done ? "완료" : "아직"}</span>
            {s.link && !s.done && (
              <Link className="underline" to="/studio/packages">
                패키지 관리로 가기
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// PACK-01~03: 제작 패키지
function Packages() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["my-packages"],
    queryFn: ({ signal }) => kemi.myPackages(signal),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["my-packages"] });
  const act = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      kemi.createPackage(packageCreateSchema.parse(body)),
    onSuccess: refresh,
  });
  return (
    <>
      <h1 className="type-heading-lg">패키지 관리</h1>
      <ServiceToggle />
      <Card title="내 패키지">
        {list.isPending && <Loading />}
        {list.error && <Failure error={list.error} />}
        {list.data?.items.length === 0 && <p>아직 패키지가 없어요.</p>}
        <ul className="grid gap-3">
          {list.data?.items.map((p) => (
            <li
              key={p.id}
              className="grid gap-2 rounded-xl border border-input p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-title">{p.title}</span>
                <Badge variant="secondary">
                  {label(catalogStatusLabels, p.status)}
                </Badge>
                {p.isRepresentative && <Badge>대표</Badge>}
              </div>
              <p className="text-muted-foreground">
                {p.priceKrw ? won(p.priceKrw) : "가격 미정"} ·{" "}
                {p.deliveryDays ?? "-"}일 · 수정 {p.revisionCount ?? "-"}회
              </p>
              <div className="flex flex-wrap gap-2">
                {p.status !== "PUBLIC" ? (
                  <Button
                    size="sm"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate(() => kemi.setPackageVisible(p.id, true))
                    }
                  >
                    공개
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate(() => kemi.setPackageVisible(p.id, false))
                    }
                  >
                    비공개
                  </Button>
                )}
                {p.status === "PUBLIC" && !p.isRepresentative && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate(() => kemi.makeRepresentative(p.id))
                    }
                  >
                    대표로 지정
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {act.error && (
          <p role="alert">
            {errorText(
              act.error,
              "공개하려면 설명·목적·가격·작업 일수·수정 횟수·포함 내용이 모두 필요해요.",
            )}
          </p>
        )}
      </Card>
      <Card title="새 패키지">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const el = event.currentTarget;
            const form = new FormData(el);
            const text = (name: string) => String(form.get(name) ?? "").trim();
            create.mutate(
              {
                title: text("title"),
                description: text("description") || null,
                purpose: text("purpose") || null,
                priceKrw: number(form.get("priceKrw")),
                deliveryDays: number(form.get("deliveryDays")),
                revisionCount: number(form.get("revisionCount")),
                includes: text("includes")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
              { onSuccess: () => el.reset() },
            );
          }}
        >
          <Field id="pkg-title" label="제목">
            <Input
              id="pkg-title"
              name="title"
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field id="pkg-description" label="설명 (10자 이상)">
            <Textarea
              id="pkg-description"
              name="description"
              rows={3}
              maxLength={3000}
            />
          </Field>
          <Field id="pkg-purpose" label="영상 목적">
            <select
              id="pkg-purpose"
              name="purpose"
              className={selectClass}
              defaultValue=""
            >
              <option value="">선택하지 않음</option>
              {VIDEO_PURPOSES.map((v) => (
                <option key={v} value={v}>
                  {label(purposeLabels, v)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="pkg-price" label="가격 (원)">
              <Input
                id="pkg-price"
                name="priceKrw"
                type="number"
                min="1"
                step="1"
              />
            </Field>
            <Field id="pkg-days" label="작업 일수">
              <Input
                id="pkg-days"
                name="deliveryDays"
                type="number"
                min="1"
                step="1"
              />
            </Field>
            <Field id="pkg-revisions" label="수정 횟수">
              <Input
                id="pkg-revisions"
                name="revisionCount"
                type="number"
                min="0"
                max="10"
                step="1"
              />
            </Field>
          </div>
          <Field
            id="pkg-includes"
            label="포함 내용 (쉼표로 구분)"
            hint="예: 3분 영상 1편, 자막, 배경음악"
          >
            <Input id="pkg-includes" name="includes" />
          </Field>
          {create.error && (
            <p role="alert">
              {errorText(create.error, "패키지를 저장하지 못했어요.")}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            초안으로 저장
          </Button>
        </form>
      </Card>
    </>
  );
}

// PORT-01·02: 작업물. 고객 의뢰 작업물은 고객 동의 확인 기능 전까지 공개할 수 없다.
function Portfolios() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["my-portfolios"],
    queryFn: ({ signal }) => kemi.myPortfolios(signal),
  });
  const packages = useQuery({
    queryKey: ["my-packages"],
    queryFn: ({ signal }) => kemi.myPackages(signal),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["my-portfolios"] });
  const act = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const publish = (p: Portfolio) => {
    const missing = missingForPublish(p);
    if (missing.length > 0) {
      setNotice(
        `공개하려면 ${missing.join("·")}이(가) 필요해요. 이 초안을 지우고 빠진 항목을 넣어 다시 올려 주세요.`,
      );
      return;
    }
    setNotice(null);
    act.mutate(() => kemi.setPortfolioVisible(p.id, true));
  };
  // 삭제는 한 번 더 눌러 확인한다(되돌릴 수 없음).
  const [confirming, setConfirming] = useState<string | null>(null);
  const remove = (p: Portfolio) => {
    setNotice(null);
    setConfirming(null);
    act.mutate(() => kemi.deletePortfolio(p.id));
  };
  const [styles, setStyles] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const file = (name: string) => {
        const value = form.get(name);
        return value instanceof File && value.size > 0 ? value : null;
      };
      const video = file("video");
      const thumbnail = file("thumbnail");
      const [videoFile, thumbFile] = await Promise.all([
        video ? uploadFile(video, "PORTFOLIO") : null,
        thumbnail ? uploadFile(thumbnail, "PORTFOLIO") : null,
      ]);
      const text = (name: string) => String(form.get(name) ?? "").trim();
      const body = {
        title: text("title"),
        description: text("description") || null,
        purpose: text("purpose") || null,
        styles,
        roles,
        source: "OWN_WORK",
        videoFileId: videoFile?.id ?? null,
        thumbnailFileId: thumbFile?.id ?? null,
        packageId: text("packageId") || null,
      };
      return kemi.createPortfolio(portfolioCreateSchema.parse(body));
    },
    onSuccess: async () => {
      setNotice("초안으로 저장했어요. 목록에서 공개를 눌러야 피드에 보여요.");
      await refresh();
    },
  });
  return (
    <>
      <h1 className="type-heading-lg">작품 관리</h1>
      <FeedChecklist
        hasPublicWork={!!list.data?.items.some((p) => p.status === "PUBLIC")}
      />
      <Card title="내 작업물">
        {list.isPending && <Loading />}
        {list.error && <Failure error={list.error} />}
        {list.data?.items.length === 0 && <p>아직 작업물이 없어요.</p>}
        <ul className="grid gap-3">
          {list.data?.items.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-input p-3"
            >
              <span className="type-title">{p.title}</span>
              <Badge variant="secondary">
                {label(catalogStatusLabels, p.status)}
              </Badge>
              {p.status !== "PUBLIC" ? (
                <Button
                  size="sm"
                  disabled={act.isPending}
                  onClick={() => publish(p)}
                >
                  공개
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate(() => kemi.setPortfolioVisible(p.id, false))
                    }
                  >
                    비공개
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/works/${p.id}`}>공개 화면 보기</Link>
                  </Button>
                </>
              )}
              {p.status !== "PUBLIC" && missingForPublish(p).length > 0 && (
                <span className="text-sm text-muted-foreground">
                  공개에 필요: {missingForPublish(p).join("·")}
                </span>
              )}
              {confirming === p.id ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={act.isPending}
                    onClick={() => remove(p)}
                  >
                    정말 삭제
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(null)}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={act.isPending}
                  onClick={() => setConfirming(p.id)}
                >
                  삭제
                </Button>
              )}
            </li>
          ))}
        </ul>
        {notice && <p role="status">{notice}</p>}
        {act.error && (
          <p role="alert">
            {act.error instanceof ApiError && act.error.status === 409
              ? act.error.message
              : errorText(act.error, "요청을 처리하지 못했어요.")}
          </p>
        )}
      </Card>
      <Card title="새 작업물">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const el = event.currentTarget;
            create.mutate(new FormData(el), {
              onSuccess: () => {
                el.reset();
                setStyles([]);
                setRoles([]);
              },
            });
          }}
        >
          <Field id="work-title" label="제목">
            <Input
              id="work-title"
              name="title"
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field id="work-description" label="설명 (선택)">
            <Textarea
              id="work-description"
              name="description"
              rows={3}
              maxLength={3000}
            />
          </Field>
          <Field id="work-purpose" label="영상 목적">
            <select
              id="work-purpose"
              name="purpose"
              className={selectClass}
              defaultValue=""
            >
              <option value="">선택하지 않음</option>
              {VIDEO_PURPOSES.map((v) => (
                <option key={v} value={v}>
                  {label(purposeLabels, v)}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="grid gap-2">
            <legend className="type-label-md">스타일</legend>
            <Checks
              name="work-style"
              values={VIDEO_STYLES}
              labels={styleLabels}
              selected={styles}
              onChange={setStyles}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="type-label-md">본인 역할</legend>
            <Checks
              name="work-role"
              values={PRODUCTION_ROLES}
              labels={roleLabels}
              selected={roles}
              onChange={setRoles}
            />
          </fieldset>
          <Field id="work-video" label="영상 파일 (MP4·MOV)">
            <Input
              id="work-video"
              name="video"
              type="file"
              accept="video/mp4,video/quicktime"
            />
          </Field>
          <Field id="work-thumbnail" label="대표 이미지 (PNG·JPG·WebP, 선택)">
            <Input
              id="work-thumbnail"
              name="thumbnail"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </Field>
          <Field id="work-package" label="연결할 공개 패키지 (선택)">
            <select
              id="work-package"
              name="packageId"
              className={selectClass}
              defaultValue=""
            >
              <option value="">연결하지 않음</option>
              {packages.data?.items
                .filter((p) => p.status === "PUBLIC")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </Field>
          <p className="text-sm text-muted-foreground">
            고객 의뢰 작업물은 고객 동의 확인 기능이 준비될 때까지 올릴 수
            없어요. 본인 작업만 등록해 주세요.
          </p>
          {create.error && (
            <p role="alert">
              {errorText(
                create.error,
                create.error instanceof Error
                  ? create.error.message
                  : "작업물을 저장하지 못했어요.",
              )}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "올리는 중…" : "초안으로 저장"}
          </Button>
        </form>
      </Card>
    </>
  );
}

// 크리에이터 스튜디오: /studio/packages, /studio/portfolio
export default function StudioLive() {
  const { pathname } = useLocation();
  return pathname.startsWith("/studio/packages") ? (
    <Packages />
  ) : (
    <Portfolios />
  );
}
