import { useEffect, useRef, useState } from "react";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";

export default function ProfileExtrasMock({
  role,
}: {
  role: "CLIENT" | "CREATOR";
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <section className="showcase-card grid gap-4" aria-label="추가 정보 Mock">
      <h2 className="type-heading-sm">추가 정보 · Mock 미리보기</h2>
      <p>
        저장 API가 없는 선택 정보예요. 이 화면에서만 임시 편집하며 화면
        이동·새로고침·로그아웃 시 폐기해요. 이미지 파일은 업로드하지 않아요.
      </p>
      <form
        className="grid gap-4"
        onChange={() => setSaved(false)}
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <Label htmlFor="extra-image">
          {role === "CLIENT" ? "로고" : "프로필 이미지"} (선택 · Mock)
        </Label>
        <Input
          id="extra-image"
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-describedby="extra-image-hint"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (
              selected &&
              !["image/png", "image/jpeg", "image/webp"].includes(selected.type)
            ) {
              setError("미리보기는 PNG·JPEG·WebP만 지원해요.");
              setPreview("");
            } else {
              setError("");
              setPreview(selected ? URL.createObjectURL(selected) : "");
            }
          }}
        />
        <p id="extra-image-hint" className="text-sm text-muted-foreground">
          미리보기 지원 형식: PNG·JPEG·WebP. 서비스 업로드 정책은 미정이에요.
        </p>
        {preview && (
          <img
            src={preview}
            alt="선택한 이미지 Mock 미리보기"
            className="h-24 w-24 rounded-lg object-cover"
          />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPreview("");
            setError("");
            if (imageInput.current) imageInput.current.value = "";
            setSaved(false);
          }}
        >
          이미지 비우기
        </Button>
        {role === "CREATOR" && (
          <>
            <Label htmlFor="extra-career">경력 (선택 · Mock)</Label>
            <Textarea id="extra-career" />
            <Label htmlFor="extra-link">링크 (선택 · Mock)</Label>
            <Input
              id="extra-link"
              type="url"
              pattern="https?://.*"
              placeholder="https://"
            />
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <Button type="submit" variant="outline" disabled={!!error}>
          추가 정보 Mock 확인
        </Button>
        {saved && (
          <p role="status">
            추가 정보를 이 화면에만 임시 보관했어요. 기본 프로필 저장과
            별개예요.
          </p>
        )}
      </form>
    </section>
  );
}
