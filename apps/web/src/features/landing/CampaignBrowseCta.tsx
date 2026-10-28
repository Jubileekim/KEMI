import type { ReactNode } from "react";
import { Link } from "react-router";
import { useSession } from "../../app/session";
import Button from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";

export default function CampaignBrowseCta({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const { status } = useSession();
  if (status === "authenticated")
    return (
      <Link className={className} to="/campaigns">
        {children}
      </Link>
    );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={className}
          disabled={["checking", "logging-out"].includes(status)}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>로그인이 필요해요</DialogTitle>
          <DialogDescription>
            공개 모집을 올리거나 크리에이터로 참여하려면 회원가입 또는 로그인이
            필요해요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button asChild>
            <Link to="/signup?returnTo=%2Fcampaigns">회원가입</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login?returnTo=%2Fcampaigns">로그인</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          가입 및 프로필 설정 또는 로그인 후 공개 모집으로 이어집니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}
