import { Link } from "react-router";
import { useSession } from "./session";

// Navigation to existing screens only; activity data and the feed remain unconnected.
export default function ScreenLinks() {
  const { role } = useSession();
  const member = role === "client" || role === "creator";
  const links = [
    {
      to: "/campaigns",
      title: "공개 모집 둘러보기",
      description: "모집 목록에서 상세 내용과 제안 흐름을 확인해요.",
    },
    ...(member
      ? [
          {
            to: "/requests",
            title: "내 제안·협의 이어가기",
            description:
              "본인 의뢰 상세와 작업 공간에서 조건서·계약·제작을 이어가요.",
          },
          {
            to: "/me/profile",
            title: "프로필 확인·수정",
            description: "함께할 사람에게 보여줄 내 정보를 관리해요.",
          },
        ]
      : []),
    ...(role === "client"
      ? [
          {
            to: "/campaigns/new",
            title: "캠페인 작성·저장한 초안",
            description:
              "새 모집을 작성하거나 저장한 캠페인을 이어서 확인해요.",
          },
        ]
      : []),
    ...(role === "creator"
      ? [
          {
            to: "/studio/packages",
            title: "패키지·제작 서비스 관리",
            description:
              "패키지와 대표 패키지, 제작 서비스 공개 상태를 관리해요.",
          },
          {
            to: "/studio/portfolio",
            title: "내 작업물 관리하기",
            description: "작업물을 작성하고 공개 상태를 확인해요.",
          },
        ]
      : []),
    ...(role === "guest"
      ? [
          {
            to: "/login",
            title: "로그인하고 이어가기",
            description: "내 프로필과 진행 중인 제안·협의를 확인해요.",
          },
          {
            to: "/signup",
            title: "회원가입 시작하기",
            description: "의뢰인 또는 크리에이터로 시작해요.",
          },
        ]
      : []),
  ];
  return (
    <nav aria-label="화면 이동 안내" className="grid gap-4 sm:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="grid gap-2 rounded-xl border p-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="type-heading-sm text-primary">{link.title}</span>
          <span className="text-sm text-muted-foreground">
            {link.description}
          </span>
        </Link>
      ))}
    </nav>
  );
}
