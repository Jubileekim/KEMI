import { useEffect, useState } from "react";
import {
  AppliedFilters, AssetFilterPanel, AssetSearchBar, Button, getAppliedFilters, VideoAssetCard, VideoAssetCardSkeleton, VideoPreviewPlayer,
  type FilterValues, type SearchChannel, type SearchScope, type SearchState,
} from "../../components";
import { assets, filterGroups, poster, SAMPLE_CAPTIONS, SAMPLE_VIDEO, searchCatalog, searchKeywords } from "../fixtures";
import { Caption, Note, Section, Table, Tag } from "../ui";

/** 입력 → 400ms 뒤 결과. 실제 API 대신 쓰는 문서용 흉내 */
export function useFakeSearch(query: string) {
  const [state, setState] = useState<SearchState>("empty");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!q) return setState("empty");
    setState("loading");
    const t = setTimeout(() => {
      const hits = searchCatalog.filter((c) => c.includes(q));
      setSuggestions(hits);
      setState(hits.length ? "typing" : "no-results");
    }, 400);
    return () => clearTimeout(t);
  }, [query]);
  return { state, suggestions };
}

export function MediaKit() {
  const [selected, setSelected] = useState<string[]>(["a3"]);
  const [saved, setSaved] = useState<string[]>([]);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("assets");
  const [channel, setChannel] = useState<SearchChannel>("all");
  const { state, suggestions } = useFakeSearch(query);
  const [filters, setFilters] = useState<FilterValues>({ channel: ["sns"] });
  const applied = getAppliedFilters(filterGroups, filters);

  const showcase = [
    { ...assets[0], caption: "available" },
    { ...assets[2], caption: "selected · status 지정" },
    { ...assets[4], caption: "custom (견적 요청)" },
    { ...assets[5], caption: "reserved" },
    { ...assets[6], caption: "16:9 → 레터박스" },
    { ...assets[7], caption: "unavailable" },
  ];

  return (
    <>
      <Section id="asset-card" title="VideoAssetCard" lead="카드에는 핵심 가격, 거래 가능 여부, 라이선스 한 줄만 보여줍니다. 상세 권리는 LicenseSelector와 RightsDisclosure에서 확인합니다. 카드에 마우스를 올리면 저장·비교 담기 버튼이 나타납니다.">
        <div className="doc-grid doc-grid--5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {showcase.map(({ caption, ...a }) => (
            <div key={a.id}>
              <VideoAssetCard {...a} selected={selected.includes(a.id)} saved={saved.includes(a.id)}
                onSelect={(id) => setSelected((s) => toggle(s, id))} onSave={(id) => setSaved((s) => toggle(s, id))} />
              <Caption>{caption}</Caption>
            </div>
          ))}
          <div><VideoAssetCardSkeleton /><Caption>loading</Caption></div>
        </div>
        <Table head={["Props", "타입", "규칙"]} rows={[
          [<code>title · posterUrl</code>, "string", "제목은 2줄까지, 넘치면 말줄임"],
          [<code>durationSeconds · aspectRatio</code>, <>number · <code>"9:16" | "16:9" | "1:1"</code></>, "썸네일 위 글래스 pill. 그리드는 9:16 기준이고 가로·정방형은 레터박스"],
          [<code>assetType</code>, <code>"ready-made" | "custom"</code>, "custom이면 가격 대신 “견적 요청”, 배지는 creative"],
          [<code>price</code>, <code>Money | null</code>, "가장 낮은 라이선스 기준. “₩300,000~”"],
          [<code>licenseSummary</code>, "string", "한 줄만. 상세 조건은 카드에 넣지 않음"],
          [<code>availability</code>, <code>"available" | "reserved" | "unavailable"</code>, "reserved는 썸네일만 55% 투명도(글자 대비 유지)이고 클릭 가능. unavailable은 클릭 불가"],
          [<code>status</code>, <code>{"{ tone, label }"}</code>, "기본 배지 문구를 바꿀 때(예: “독점은 협의”)"],
          [<code>selected · onSelect · saved · onSave · onOpen</code>, "boolean · (id) => void", "hover·포커스 시 보조 행동 노출, 터치 기기에서는 항상 노출"],
          [<code>verified</code>, "boolean", "데이터 계약에만 존재. 검증 기준이 정해지기 전까지 UI에 노출하지 않음"],
        ]} />
        <Note><Tag kind="obs" />Pond5는 hover 시 외곽선 강조 + 찜·장바구니 아이콘을 보여줬습니다. 선택은 카드 전체가 아닌 별도 토글 버튼으로 분리해, 카드 본문 클릭(onOpen)은 상세로 이동하는 데 씁니다.</Note>
      </Section>

      <Section id="search" title="AssetSearchBar · AssetFilterPanel" lead="검색창은 empty / typing / loading / no-results 상태를 가집니다. “언박싱”이나 없는 단어를 입력해 보세요. 필터를 고르면 그리드 위에 지울 수 있는 칩으로 다시 보여줍니다.">
        <div className="doc-grid doc-grid--2">
          <div className="doc-demo" style={{ alignSelf: "start" }}>
            <AssetSearchBar scope={scope} onScopeChange={setScope} query={query} onQueryChange={setQuery}
              channel={channel} onChannelChange={setChannel} state={state} suggestions={suggestions}
              keywords={searchKeywords} onSubmit={() => {}} noResultsAction={<Button size="sm">이 조건으로 제작 의뢰하기</Button>} />
            <div style={{ height: 160 }} />
            <AppliedFilters items={applied} onClearAll={() => setFilters({})}
              onRemove={(f) => setFilters((v) => ({ ...v, [f.groupId]: (v[f.groupId] ?? []).filter((x) => x !== f.value) }))} />
          </div>
          <AssetFilterPanel groups={filterGroups} values={filters} onChange={setFilters} />
        </div>
        <Table head={["컴포넌트", "Props", "규칙"]} rows={[
          ["AssetSearchBar", <span className="code-ref">scope · query · channel · state · suggestions · keywords · onSubmit · noResultsAction</span>, "완성 소재·제작자 검색을 같은 바에서 전환. no-results에서는 “조건 줄이기” + “제작 의뢰” 동시 제시"],
          ["AssetFilterPanel", <span className="code-ref">groups · values · onChange</span>, "그룹 순서: 거래 방식 → 게재 매체 → 카테고리 → 비율 → 가격대 → 라이선스 → 길이. 6개 초과는 “더보기”, 그룹 제목 옆에 적용 개수"],
          ["AppliedFilters", <span className="code-ref">items · onRemove · onClearAll</span>, <><code>getAppliedFilters(groups, values)</code>로 만든 목록을 칩으로 표시 + “모두 지우기”</>],
        ]} />
        <Note><Tag kind="obs" />JoinBrands의 분할형 검색바와 Pond5의 미디어 유형 선택을 합쳤습니다. <Tag kind="pro" />B안의 가격 범위 슬라이더 대신 A안처럼 구간 칩을 씁니다. 실제 가격 분포가 나오면 슬라이더 필요 여부를 다시 봅니다.</Note>
      </Section>

      <Section id="player" title="VideoPreviewPlayer" lead="Liquid Glass를 허용하는 대표 컴포넌트입니다. 구매 전 미리보기에는 워터마크가 들어갑니다. 상태: ready / playing / buffering / error. 첫 번째 플레이어는 실제 샘플 영상(CC0)을 재생합니다.">
        <div className="doc-grid doc-grid--4">
          <div><VideoPreviewPlayer src={SAMPLE_VIDEO} posterUrl={poster(1)} durationSeconds={5} captionsSrc={SAMPLE_CAPTIONS} /><Caption>ready → 재생 · 자막 토글</Caption></div>
          <div><VideoPreviewPlayer posterUrl={poster(3)} durationSeconds={15} forcedState="playing" /><Caption>playing</Caption></div>
          <div><VideoPreviewPlayer posterUrl={poster(2)} durationSeconds={15} forcedState="buffering" /><Caption>buffering</Caption></div>
          <div><VideoPreviewPlayer posterUrl={poster(4)} durationSeconds={15} forcedState="error" /><Caption>error</Caption></div>
        </div>
        <p className="code-ref" style={{ marginTop: "var(--space-4)" }}>props: src · posterUrl · durationSeconds · watermark · captionsSrc · forcedState(문서용) · onRetry</p>
        <Note>썸네일 hover 자동재생을 붙일 때는 소리 없이, <code>prefers-reduced-motion</code>이면 끕니다(<code>media.reducedMotion</code>). 자막 토글과 재생 버튼은 모두 aria-label을 가집니다.</Note>
      </Section>
    </>
  );
}
