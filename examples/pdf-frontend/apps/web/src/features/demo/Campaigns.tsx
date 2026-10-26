import { str, num } from './helpers';
import { useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Bookmark, Search, Clock, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { useDemo } from './context';
import { campaignExpired, money, type Campaign } from './model';
import {
  Heading,
  Panel,
  Empty,
  ActionLink,
  Tag,
  Field,
  Form,
  Button,
  Notice,
} from './ui';
const campaignStatus = (c: Campaign) =>
  ({
    draft: '임시 저장',
    open: campaignExpired(c) ? '모집 마감' : '모집 중',
    closed: '모집 마감',
    ended: '모집 종료',
  })[c.status];
const categories = ['브랜드 필름', '숏폼', '공간', '웨딩', '인터뷰'];
export function Campaigns({
  mode = 'all',
}: {
  mode?: 'all' | 'bookmarks' | 'recommended';
}) {
  const { state, act } = useDemo();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '전체';
  const sort = params.get('sort') ?? '최신순';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    next.set('page', '1');
    setParams(next);
  };
  const list = state.campaigns
    .filter(
      (c) =>
        c.status !== 'draft' &&
        (!q || `${c.title} ${c.description}`.includes(q)) &&
        (category === '전체' || category === c.category) &&
        (mode !== 'bookmarks' || c.bookmarked) &&
        (mode !== 'recommended' ||
          (c.status === 'open' &&
            !campaignExpired(c) &&
            state.portfolios.some(
              (p) => p.public && p.category === c.category,
            ))),
    )
    .sort((a, b) =>
      sort === '높은 예산순'
        ? b.budget - a.budget
        : sort === '마감 임박순'
          ? (a.publishedAt ?? 0) +
            a.duration * 86400000 -
            (b.publishedAt ?? 0) -
            b.duration * 86400000
          : (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
    );
  const pages = Math.max(1, Math.ceil(list.length / 4));
  const current = Math.min(page, pages);
  return (
    <>
      <Heading
        eyebrow="FIND YOUR NEXT COLLABORATION"
        title={
          mode === 'bookmarks'
            ? '저장한 캠페인'
            : mode === 'recommended'
              ? '나에게 맞는 캠페인'
              : '좋은 케미를 기다리는 프로젝트'
        }
        description={
          mode === 'recommended'
            ? '공개 포트폴리오의 작업 유형을 기준으로 추천합니다.'
            : '새로운 시선이 필요한 곳에서, 당신의 다음 이야기를 만나세요.'
        }
        action={<ActionLink to="/campaigns/new">모집 작성하기</ActionLink>}
      />
      <div className="campaign-search">
        <label className="search-box">
          <Search size={19} />
          <input
            aria-label="캠페인 검색"
            value={q}
            onChange={(e) => update('q', e.target.value)}
            placeholder="어떤 프로젝트를 찾고 있나요?"
          />
        </label>
        <select
          aria-label="작업 유형"
          value={category}
          onChange={(e) => update('category', e.target.value)}
        >
          <option>전체</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="정렬"
          value={sort}
          onChange={(e) => update('sort', e.target.value)}
        >
          <option>최신순</option>
          <option>높은 예산순</option>
          <option>마감 임박순</option>
        </select>
      </div>
      <div className="section-title">
        <p>
          전체 <strong>{list.length}</strong>개 프로젝트
        </p>
        <Link className="text-link" to="/recommendations">
          맞춤 추천 보기 <ArrowUpRight size={16} />
        </Link>
      </div>
      {list.length ? (
        <div className="campaign-grid">
          {list.slice((current - 1) * 4, current * 4).map((c) => (
            <article className="campaign-card" key={c.id}>
              <div className="inline spread">
                <Tag tone={campaignStatus(c) === '모집 중' ? '' : 'neutral'}>
                  {campaignStatus(c)}
                </Tag>
                <button
                  className={`icon-button ${c.bookmarked ? 'saved' : ''}`}
                  aria-label={`${c.title} ${c.bookmarked ? '저장 해제' : '저장'}`}
                  aria-pressed={c.bookmarked}
                  onClick={() => act({ type: 'bookmark', id: c.id })}
                >
                  <Bookmark
                    size={20}
                    fill={c.bookmarked ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              <Link to={`/campaigns/${c.id}`}>
                <span className="category-label">{c.category}</span>
                <h2>{c.title}</h2>
                <p className="muted line-clamp">{c.description}</p>
              </Link>
              <div className="campaign-bottom">
                <div>
                  <span>제작 예산</span>
                  <strong>{money(c.budget)}</strong>
                </div>
                <span>
                  <Clock size={14} />
                  {c.duration}일 모집
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="해당하는 캠페인이 없어요"
          description="검색어나 필터를 바꿔보세요."
        />
      )}
      <nav className="pagination" aria-label="캠페인 페이지">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            aria-current={current === i + 1 ? 'page' : undefined}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('page', String(i + 1));
              setParams(next);
            }}
          >
            {i + 1}
          </button>
        ))}
      </nav>
    </>
  );
}
export function CampaignDetail() {
  const { campaignId } = useParams();
  const { state, role, act } = useDemo();
  const c = state.campaigns.find(
    (c) =>
      c.id === campaignId &&
      (c.status !== 'draft' || (role === 'client' && c.owner === 'client')),
  );
  if (!c) return <Empty title="모집을 찾을 수 없어요" />;
  return (
    <>
      <Heading
        eyebrow="PROJECT BRIEF"
        title={c.title}
        description={`${c.category} · ${campaignStatus(c)}`}
      />
      <div className="detail-grid">
        <Panel title="함께 만들고 싶은 이야기">
          <p className="pre-wrap">{c.description}</p>
          <dl className="definition">
            <dt>제작 예산</dt>
            <dd>{money(c.budget)}</dd>
            <dt>모집 기간</dt>
            <dd>{c.duration}일</dd>
            <dt>마감 시각</dt>
            <dd>
              {c.publishedAt
                ? new Date(
                    c.publishedAt + c.duration * 86400000,
                  ).toLocaleString('ko-KR')
                : '공개 후 계산'}
            </dd>
          </dl>
          <Notice>
            모집 마감 후에도 기존 협의는 유지됩니다. 협의 요청만으로 선정되거나
            다른 후보가 거절되지 않습니다.
          </Notice>
        </Panel>
        <Panel title="다음 장면을 함께해요">
          <strong className="price">{money(c.budget)}</strong>
          <p className="muted">
            제작 조건과 일정은 조건서에서 최종 합의합니다.
          </p>
          {role === 'client' && c.owner === 'client' ? (
            <div className="stack">
              <ActionLink to={`/campaigns/${c.id}/edit`} secondary>
                모집 수정
              </ActionLink>
              <ActionLink to={`/campaigns/${c.id}/proposals`}>
                제안 목록 보기
              </ActionLink>
              {c.status === 'draft' && (
                <Button
                  onClick={() =>
                    act({ type: 'campaignStatus', id: c.id, status: 'open' })
                  }
                >
                  모집 공개
                </Button>
              )}
              {c.status === 'open' && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    act({ type: 'campaignStatus', id: c.id, status: 'closed' })
                  }
                >
                  신규 제안 마감
                </Button>
              )}
              {!['draft', 'ended'].includes(c.status) && (
                <Button
                  variant="danger"
                  onClick={() =>
                    act({ type: 'campaignStatus', id: c.id, status: 'ended' })
                  }
                >
                  무선정 종료 · 기존 협의 종료
                </Button>
              )}
            </div>
          ) : (
            <div className="stack">
              {c.status === 'open' && !campaignExpired(c) ? (
                <ActionLink to={`/campaigns/${c.id}/apply`}>
                  이 프로젝트에 제안하기
                </ActionLink>
              ) : (
                <Notice>신규 제안이 마감되었습니다.</Notice>
              )}
              <Button
                variant="secondary"
                onClick={() => act({ type: 'bookmark', id: c.id })}
              >
                {c.bookmarked ? '저장 해제' : '캠페인 저장'}
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
export function CampaignForm() {
  const { campaignId } = useParams();
  const { state, act } = useDemo();
  const c = state.campaigns.find((c) => c.id === campaignId);
  const navigate = useNavigate();
  const [budget, setBudget] = useState(c?.budget ?? 200000);
  const [analysis, setAnalysis] = useState<'idle' | 'failed' | 'result'>(
    'idle',
  );
  const [condition, setCondition] = useState(c?.description ?? '');
  if (campaignId && (!c || c.owner !== 'client'))
    return <Empty title="수정할 모집을 찾을 수 없어요" />;
  return (
    <>
      <Heading
        eyebrow="START A PROJECT"
        title={c ? '모집 내용을 다듬어주세요' : '새로운 이야기를 시작해요'}
        description="제작 조건을 먼저 정하고, 예산은 직접 결정해 주세요."
      />
      <div className="detail-grid">
        <Panel title="프로젝트 브리프">
          <Form
            onSubmit={(d) => {
              const id = c?.id ?? `c-${Date.now()}`;
              if (
                act({
                  type: 'campaign',
                  campaign: {
                    id,
                    title: str(d, 'title'),
                    description: condition,
                    category: str(d, 'category'),
                    budget,
                    duration: num(d, 'duration'),
                    status: str(d, 'intent') === 'draft' ? 'draft' : 'open',
                    owner: 'client',
                    bookmarked: c?.bookmarked ?? false,
                  },
                })
              )
                navigate(`/campaigns/${id}`);
            }}
          >
            <Field label="모집 제목">
              <input
                name="title"
                required
                defaultValue={c?.title}
                placeholder="함께 만들 영상에 대해 알려주세요"
              />
            </Field>
            <div className="form-row">
              <Field label="작업 유형">
                <select
                  name="category"
                  defaultValue={c?.category ?? categories[0]}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="모집 기간">
                <select name="duration" defaultValue={c?.duration ?? 7}>
                  <option value="3">3일</option>
                  <option value="7">7일 (기본)</option>
                  <option value="14">14일</option>
                </select>
              </Field>
            </div>
            <Field label="제작 조건">
              <textarea
                required
                name="description"
                rows={7}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="목적, 분량, 촬영 조건, 필수 산출물, 희망 일정 등을 입력해 주세요."
              />
            </Field>
            <Field label="제작 예산 (원)">
              <input
                name="budget"
                type="number"
                min="1"
                step="1"
                required
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </Field>
            <Field label="저장 방식">
              <select
                name="intent"
                defaultValue={c?.status === 'open' ? 'open' : 'draft'}
              >
                <option value="draft" disabled={c?.status === 'open'}>
                  임시 저장
                </option>
                <option value="open">공개 모집</option>
              </select>
            </Field>
            <Button type="submit">
              {c ? '변경 사항 저장' : '모집 저장하기'}
            </Button>
          </Form>
        </Panel>
        <Panel title="AI 참고 제작비">
          <Tag tone="neutral">AI 미연결</Tag>
          <p className="muted">
            문서에 산정 모델과 API가 없어 실제 분석은 제공하지 않습니다. 실패
            시에도 입력과 수동 예산은 유지됩니다.
          </p>
          <div className="stack">
            <Button
              variant="secondary"
              onClick={() => {
                if (!condition.trim()) {
                  toast.error('제작 조건을 먼저 입력해 주세요.');
                  return;
                }
                setAnalysis('result');
              }}
            >
              예시 분석 결과 보기
            </Button>
            <Button variant="ghost" onClick={() => setAnalysis('failed')}>
              분석 실패 상태 보기
            </Button>
          </div>
          {analysis === 'failed' && (
            <Notice>
              분석을 불러오지 못했어요. 위의 예산을 직접 입력해 계속할 수
              있어요.
            </Notice>
          )}
          {analysis === 'result' && (
            <div className="analysis-result">
              <p>시연 예시 · 외부 AI 분석 아님</p>
              <dl className="definition">
                <dt>기획</dt>
                <dd>50,000원</dd>
                <dt>촬영</dt>
                <dd>100,000원</dd>
                <dt>편집</dt>
                <dd>50,000원</dd>
                <dt>합계</dt>
                <dd>200,000원</dd>
              </dl>
              <p className="muted">
                가정: 촬영 1회, 짧은 영상 1편. 실제 견적이 아닙니다.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setBudget(200000);
                  toast.success('선택한 예시 금액을 예산에 반영했어요.');
                }}
              >
                이 예시 금액을 예산에 반영
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
export function Apply() {
  const { campaignId } = useParams();
  const { state, act } = useDemo();
  const navigate = useNavigate();
  const c = state.campaigns.find((c) => c.id === campaignId);
  if (!c) return <Empty title="모집을 찾을 수 없어요" />;
  return (
    <>
      <Heading
        eyebrow="SEND A PROPOSAL"
        title="당신의 시선을 제안해 주세요"
        description={c.title}
      />
      <Panel>
        <Form
          onSubmit={(d) => {
            if (
              act({
                type: 'request',
                title: c.title,
                campaignId: c.id,
                proposal: str(d, 'proposal'),
              })
            )
              navigate('/requests');
          }}
        >
          <Field label="제안서">
            <textarea
              name="proposal"
              rows={8}
              required
              placeholder="제작 방향, 관련 경험, 예상 일정과 제안 금액을 알려주세요."
            />
          </Field>
          <Notice>
            제안 제출은 계약 확정이 아닙니다. 마감·중복 여부를 로컬 시연 상태로
            확인합니다.
          </Notice>
          <Button type="submit">제안서 제출</Button>
        </Form>
      </Panel>
    </>
  );
}
