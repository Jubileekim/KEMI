import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { session } from "../../app/session";
import { kemi } from "../../shared/api/kemi";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";
import profileImageError from "./profile-image-validation";

export default function ProfileImageField({
  value,
  label,
  busy,
  onSelect,
  onRemove,
}: {
  value: string;
  label: string;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const [fileProblem, setFileProblem] = useState("");
  const image = useQuery({
    queryKey: ["profile-image", value, session.epoch()],
    enabled: !!value,
    queryFn: () => kemi.download(value),
    staleTime: 5 * 60_000,
  });
  return (
    <div className="grid gap-3">
      <Label htmlFor="profile-image">{label} (선택)</Label>
      {image.data && (
        <img
          src={image.data.url}
          alt={label}
          className="h-24 w-24 rounded-xl object-cover"
        />
      )}
      {image.isError && (
        <p role="status">
          이미지를 불러오지 못했어요. 다시 선택하거나 나중에 확인해 주세요.
        </p>
      )}
      <Input
        id="profile-image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        aria-describedby={
          fileProblem
            ? "profile-image-hint profile-image-error"
            : "profile-image-hint"
        }
        onChange={(event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          input.value = "";
          if (!file) return;
          const issue = profileImageError(file);
          setFileProblem(issue ?? "");
          if (!issue) onSelect(file);
        }}
      />
      <p id="profile-image-hint" className="text-sm text-muted-foreground">
        PNG·JPG·WebP, 최대 10MB. 선택한 뒤 프로필을 저장하면 적용돼요.
      </p>
      {fileProblem && (
        <p id="profile-image-error" role="alert" className="text-destructive">
          {fileProblem}
        </p>
      )}
      {value && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onRemove}
        >
          이미지 연결 해제
        </Button>
      )}
    </div>
  );
}
