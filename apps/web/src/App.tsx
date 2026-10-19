import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api";
import getHealth from "@/lib/health";

function HomePage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getHealth(signal),
    enabled: false,
  });

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 px-6 py-12">
      <p className="text-sm font-semibold tracking-widest text-muted-foreground">
        KEMI
      </p>
      <h1 className="text-4xl font-bold tracking-tight">
        함께 만드는 콘텐츠의 시작
      </h1>
      <p className="text-muted-foreground">
        의뢰인과 UGC 크리에이터를 연결합니다.
      </p>
      <section
        aria-labelledby="setup-title"
        className="rounded-xl border bg-card p-6"
      >
        <h2 id="setup-title" className="mb-3 text-lg font-semibold">
          개발 환경 연결 확인
        </h2>
        {import.meta.env.DEV ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              로컬 API 서버의 생존 상태를 확인합니다. DB 연결 확인은 별도입니다.
            </p>
            <Button
              type="button"
              disabled={health.isFetching}
              onClick={async () => {
                await health.refetch();
              }}
            >
              {health.isFetching ? "확인 중…" : "API 연결 확인"}
            </Button>
            <p role="status" className="mt-4 text-sm">
              {health.isSuccess &&
                `API 연결 성공 · 서버 가동 ${health.data.uptimeSeconds}초`}
              {health.isError && getApiErrorMessage(health.error)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            배포 연결은 Render 주소의 /health를 직접 열어 확인해주세요.
          </p>
        )}
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-24">
      <h1 className="text-3xl font-bold">페이지를 찾을 수 없습니다.</h1>
      <Link to="/" className="underline">
        홈으로 돌아가기
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
