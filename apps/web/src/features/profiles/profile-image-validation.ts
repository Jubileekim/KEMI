const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Validate image selection before the upload request. */
export default function profileImageError(
  file: Pick<File, "size" | "type">,
): string | undefined {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type))
    return "PNG, JPG, WebP 형식의 이미지를 선택해 주세요.";
  if (file.size === 0) return "비어 있는 파일은 업로드할 수 없어요.";
  if (file.size > MAX_IMAGE_BYTES)
    return "이미지는 10MB 이하의 파일을 선택해 주세요.";
  return undefined;
}
