// 단어 끝 글자의 받침에 맞는 목적격 조사(을/를)를 붙인다. 예: 계약을, 제작자를
export default function withObjectParticle(word: string): string {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  // 한글 음절이 아니면 "을"을 쓴다(숫자·영문 끝은 드물다).
  if (code < 0 || code > 11171) return `${word}을`;
  return `${word}${code % 28 === 0 ? "를" : "을"}`;
}
