import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { SegmentedControl } from "./Tabs";
import type { Option } from "./types";

export type SearchScope = "assets" | "creators";
export type SearchChannel = "all" | "instagram" | "tiktok" | "youtube" | "display";
/** empty: 입력 없음 · typing: 제안 표시 · loading: 조회 중 · no-results: 결과 없음 */
export type SearchState = "empty" | "typing" | "loading" | "no-results";

export const SEARCH_CHANNELS: Option<SearchChannel>[] = [
  { value: "all", label: "전체 채널" },
  { value: "instagram", label: "인스타그램" },
  { value: "tiktok", label: "틱톡" },
  { value: "youtube", label: "유튜브" },
  { value: "display", label: "디스플레이" },
];

const PLACEHOLDER: Record<SearchScope, string> = {
  assets: "어떤 광고 영상을 찾으세요?",
  creators: "어떤 제작자를 찾으세요? 예: 뷰티 숏폼",
};

export interface AssetSearchBarProps {
  /** 지정하면 완성 소재 / 제작자 전환이 생긴다 */
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** 지정하면 채널 선택이 생긴다 */
  channel?: SearchChannel;
  onChannelChange?: (channel: SearchChannel) => void;
  state: SearchState;
  /** state가 typing일 때 보여줄 자동완성 */
  suggestions?: string[];
  /** 검색창 아래 추천 키워드 칩 */
  keywords?: string[];
  onSubmit: (query: string) => void;
  /** no-results에서 막다른 길 대신 보여줄 행동. 예) 이 조건으로 제작 의뢰하기 */
  noResultsAction?: ReactNode;
  className?: string;
}

export function AssetSearchBar(props: AssetSearchBarProps) {
  const { scope, onScopeChange, query, onQueryChange, channel, onChannelChange, state, suggestions = [], keywords, onSubmit, noResultsAction, className } = props;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const showList = open && state !== "empty" && (state !== "typing" || suggestions.length > 0);

  const choose = (value: string) => {
    onQueryChange(value);
    onSubmit(value);
    setOpen(false);
    setActive(-1);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) return choose(suggestions[active]);
    onSubmit(query);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return setOpen(false);
    if (state !== "typing" || !suggestions.length || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    setOpen(true);
    setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
  };

  return (
    <form role="search" className={cx("search", className)} onSubmit={submit}>
      {scope && onScopeChange && (
        <SegmentedControl aria-label="검색 대상" value={scope} onChange={onScopeChange}
          items={[{ value: "assets", label: "완성 소재" }, { value: "creators", label: "제작자" }]} />
      )}
      <div className="search__box">
        <Icon name="search" className="search__icon" />
        <input className="search__input" type="search" value={query} placeholder={PLACEHOLDER[scope ?? "assets"]}
          aria-label={scope === "creators" ? "제작자 검색" : "영상 소재 검색"}
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off"
          onChange={(e) => { onQueryChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} />
        {channel && onChannelChange && (
          <>
            <span className="search__divider" aria-hidden="true" />
            <select className="search__channel" aria-label="게재 채널" value={channel} onChange={(e) => onChannelChange(e.target.value as SearchChannel)}>
              {SEARCH_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </>
        )}
        <Button type="submit" size="sm">검색</Button>
      </div>
      <div className="search__popup" onMouseDown={(e) => e.preventDefault()}>
        <ul className="search__suggestions" id={listId} role="listbox" aria-label="검색어 제안" hidden={!(showList && state === "typing")}>
          {state === "typing" && suggestions.map((s, i) => (
            <li key={s} id={`${listId}-${i}`} role="option" aria-selected={i === active} onClick={() => choose(s)}>{s}</li>
          ))}
        </ul>
        <div className="search__suggestions" role="status" hidden={!(showList && state !== "typing")}>
          {state === "loading" && <p className="search__status">검색 중…</p>}
          {state === "no-results" && (
            <div className="search__status search__status--empty">
              <span>"{query}"에 맞는 {scope === "creators" ? "제작자" : "소재"}가 없어요. 조건을 줄여 보거나 이 조건으로 제작을 의뢰해 보세요.</span>
              {noResultsAction && <div>{noResultsAction}</div>}
            </div>
          )}
        </div>
      </div>
      {keywords && keywords.length > 0 && (
        <div className="search__keywords" aria-label="추천 키워드">
          {keywords.map((k) => <Chip key={k} onClick={() => choose(k)}>{k}</Chip>)}
        </div>
      )}
    </form>
  );
}
