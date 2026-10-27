// 문서용 가상 데이터. 소재명·가격·제작자명은 모두 시안용이다.
import type { AspectRatio, DealStep, FilterGroup, LicenseGroup, VideoAssetCardProps } from "../components";
import { licenseEndDate } from "../components";

// 실제 영상 썸네일 대신 쓰는 그라데이션 포스터 (A안 thumb--1~6)
const GRADIENTS: [string, string, string][] = [
  ["#f7c59f", "#e07a5f", "#3d405b"],
  ["#a8dadc", "#457b9d", "#1d3557"],
  ["#f1faee", "#b5c99a", "#718355"],
  ["#ffd6a5", "#cdb4db", "#6d597a"],
  ["#e9edc9", "#ccd5ae", "#5f6f52"],
  ["#ffcad4", "#f4acb7", "#9d8189"],
];
export const poster = (i: number, ratio: AspectRatio = "9:16") => {
  const [a, b, c] = GRADIENTS[i % GRADIENTS.length];
  const [w, h] = { "9:16": [90, 160], "16:9": [160, 90], "1:1": [120, 120] }[ratio];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** CC0 샘플 영상(MDN). 오프라인이면 플레이어가 error 상태를 보여준다 */
export const SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm";
export const SAMPLE_CAPTIONS = `data:text/vtt,${encodeURIComponent("WEBVTT\n\n00:00.000 --> 00:04.000\n여름 한정 아이스 음료\n\n00:04.000 --> 00:09.000\n지금 매장에서 만나 보세요\n")}`;

type Asset = Omit<VideoAssetCardProps, "onOpen" | "onSelect" | "onSave" | "selected" | "saved">;
const krw = (amount: number) => ({ amount, currency: "KRW" as const });

export const assets: Asset[] = [
  { id: "a1", title: "여름 아이스 음료 언박싱 숏폼", durationSeconds: 15, aspectRatio: "9:16", assetType: "ready-made", price: krw(300000), licenseSummary: "SNS · 국내 · 비독점", availability: "available" },
  { id: "a2", title: "스킨케어 루틴 UGC 리뷰", durationSeconds: 30, aspectRatio: "9:16", assetType: "ready-made", price: krw(450000), licenseSummary: "SNS·디지털 · 국내", availability: "available" },
  { id: "a3", title: "캠핑 용품 아웃도어 무드컷", durationSeconds: 20, aspectRatio: "9:16", assetType: "ready-made", price: krw(380000), licenseSummary: "SNS · 국내 · 비독점", availability: "available", status: { tone: "warning", label: "● 독점은 협의" } },
  { id: "a4", title: "패션 룩북 트랜지션", durationSeconds: 15, aspectRatio: "9:16", assetType: "ready-made", price: krw(520000), licenseSummary: "SNS · 글로벌", availability: "available" },
  { id: "a5", title: "앱 설치 유도 세로 영상", durationSeconds: 20, aspectRatio: "9:16", assetType: "custom", price: null, licenseSummary: "제작자 김하늘 · 맞춤 제작", availability: "available" },
  { id: "a6", title: "반려동물 간식 리액션", durationSeconds: 15, aspectRatio: "9:16", assetType: "ready-made", price: krw(340000), licenseSummary: "SNS·디지털 · 국내", availability: "reserved" },
  { id: "a7", title: "모닝 루틴 브이로그 컷", durationSeconds: 30, aspectRatio: "16:9", assetType: "ready-made", price: krw(410000), licenseSummary: "SNS · 국내", availability: "available" },
  { id: "a8", title: "피트니스 웨어 다이내믹 컷", durationSeconds: 20, aspectRatio: "9:16", assetType: "ready-made", price: krw(600000), licenseSummary: "독점 판매 완료", availability: "unavailable" },
].map((a, i) => ({ ...a, posterUrl: poster(i, a.aspectRatio as AspectRatio) }) as Asset);

export const searchCatalog = ["여름 음료 언박싱", "언박싱 리뷰 세로형", "스킨케어 루틴 UGC", "캠핑 아웃도어 무드", "패션 룩북 트랜지션", "음식 ASMR 클로즈업"];
export const searchKeywords = ["뷰티", "F&B", "앱 설치", "패션", "9:16 세로", "언박싱", "ASMR"];

// B안 6-6 필터 순서: 거래 방식 → 게재 매체 → 카테고리 → 비율 → 가격대 → 라이선스 → 길이
export const filterGroups: FilterGroup[] = [
  { id: "type", label: "거래 방식", kind: "segment", options: [{ value: "all", label: "전체" }, { value: "ready", label: "완성 소재" }, { value: "custom", label: "제작 의뢰" }] },
  { id: "channel", label: "게재 매체", kind: "checks", options: [{ value: "sns", label: "SNS" }, { value: "youtube", label: "유튜브" }, { value: "display", label: "디지털 배너" }, { value: "tv", label: "TV·OTT" }] },
  { id: "category", label: "카테고리", kind: "checks", options: ["뷰티", "F&B", "패션", "앱·게임", "리빙", "반려동물", "피트니스", "여행"].map((c) => ({ value: c, label: c })) },
  { id: "ratio", label: "비율", kind: "chips", options: [{ value: "9:16", label: "9:16" }, { value: "1:1", label: "1:1" }, { value: "16:9", label: "16:9" }] },
  { id: "price", label: "가격대", kind: "chips", options: [{ value: "~30", label: "₩300,000 이하" }, { value: "30-50", label: "₩300,000–500,000" }, { value: "50~", label: "₩500,000 이상" }] },
  { id: "license", label: "라이선스", kind: "checks", info: "독점 가능: 판매 이력과 무관하게 독점 계약을 받는 소재. 2차 편집: 컷 편집·자막·로고 삽입 허용.", options: [{ value: "exclusive", label: "독점 협의 가능" }, { value: "edit", label: "2차 편집 허용" }, { value: "global", label: "해외 사용 가능" }] },
  { id: "length", label: "길이", kind: "chips", options: [{ value: "15", label: "~15초" }, { value: "30", label: "~30초" }, { value: "60", label: "~60초" }, { value: "60+", label: "60초+" }] },
];

// 영상 상세 → 라이선스 (배수·수수료는 화면 동작용 임의 값)
export const BASE_PRICE = 300000;
export const FEE_RATE = 0.1;
export const VAT_RATE = 0.1;
export const MULTIPLIER: Record<string, Record<string, number>> = {
  channel: { sns: 1, digital: 1.6, all: 2.5 },
  period: { "3": 1, "6": 1.5, "12": 2.2 },
  territory: { kr: 1, global: 2 },
  exclusive: { no: 1, yes: 1 },
};
export const licenseGroups = (): LicenseGroup[] => [
  { name: "channel", legend: "광고 채널", options: [
    { value: "sns", title: "SNS 광고", description: "인스타그램·틱톡·페이스북" },
    { value: "digital", title: "SNS + 디지털", description: "유튜브·배너·자사몰 포함", priceLabel: "×1.6" },
    { value: "all", title: "전체 매체", description: "TV·OTT·옥외 포함", priceLabel: "×2.5" },
  ] },
  { name: "period", legend: "사용 기간", layout: "row", options: [
    { value: "3", title: "3개월", description: `${licenseEndDate(3)}까지` },
    { value: "6", title: "6개월", description: `${licenseEndDate(6)}까지`, priceLabel: "×1.5" },
    { value: "12", title: "12개월", description: `${licenseEndDate(12)}까지`, priceLabel: "×2.2" },
  ] },
  { name: "territory", legend: "지역", layout: "row", half: true, options: [
    { value: "kr", title: "국내" },
    { value: "global", title: "글로벌", priceLabel: "×2" },
  ] },
  { name: "exclusive", legend: "독점 여부", layout: "row", half: true, options: [
    { value: "no", title: "비독점" },
    { value: "yes", title: "독점", description: "협의 필요" },
  ] },
];

export const productionSteps: DealStep[] = [
  { id: "brief", title: "브리프", meta: "10/14", status: "done" },
  { id: "offer", title: "제안·견적", meta: "10/15", status: "done" },
  { id: "contract", title: "계약·결제", meta: "10/16", status: "done" },
  { id: "making", title: "제작 중", meta: "~10/27", status: "active" },
  { id: "review", title: "납품·검수", status: "todo" },
  { id: "settle", title: "정산", status: "todo" },
];

export interface DealRow {
  id: string;
  name: string;
  counterpart: string;
  tab: "progress" | "review" | "done" | "dispute";
  stage: string;
  next: string;
  due: string;
  amount: string;
}
export const deals: DealRow[] = [
  { id: "d1", name: "여름 음료 숏폼 2편", counterpart: "스튜디오 하늘", tab: "progress", stage: "제작 중", next: "제작자 · 1차 영상 업로드", due: "10/27", amount: "₩1,200,000" },
  { id: "d2", name: "스킨케어 UGC 리뷰", counterpart: "모션랩 서울", tab: "review", stage: "검수 대기", next: "광고주 · v2 검수", due: "10/22", amount: "₩450,000" },
  { id: "d3", name: "캠핑 무드컷 라이선스", counterpart: "리뷰하우스", tab: "progress", stage: "권리 증빙 보완", next: "공급자 · 배경음악 라이선스 제출", due: "10/24", amount: "₩380,000" },
  { id: "d4", name: "패션 룩북 독점", counterpart: "스튜디오 하늘", tab: "done", stage: "정산 완료", next: "—", due: "10/12", amount: "₩2,400,000" },
  { id: "d5", name: "앱 설치 영상 3편", counterpart: "김하늘", tab: "dispute", stage: "분쟁", next: "플랫폼 · 중재 결과 안내", due: "10/25", amount: "₩900,000" },
];
