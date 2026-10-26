import { str } from './helpers';
import { useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ArrowRight, SlidersHorizontal, Star } from 'lucide-react';
import { useDemo } from './context';
import { money } from './model';
import {
  Heading,
  Panel,
  Empty,
  ActionLink,
  Artwork,
  Tag,
  Field,
  Form,
  Button,
  Notice,
} from './ui';

export function Feed() {
  const { state } = useDemo();
  const [params, setParams] = useSearchParams();
  const category = params.get('type') ?? '전체';
  const style = params.get('style') ?? '전체 스타일';
  const items = state.profile.servicePublic
    ? state.portfolios.filter(
        (p) =>
          p.public &&
          p.consent &&
          (category === '전체' || p.category === category) &&
          (style === '전체 스타일' || p.style === style),
      )
    : [];
  return (
    <>
      <section className="feed-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="green-dot" /> GOOD STORIES START WITH GOOD
            CHEMISTRY
          </p>
          <h1>
            당신의 이야기,
            <br />
            좋은 <span>케미</span>로 완성하세요
            <span className="hero-period">.</span>
          </h1>
          <p>
            마음에 드는 장면에서 시작하는 협업.
            <br />
            당신의 생각을 영상으로 만들 제작자를 만나보세요.
          </p>
          <div className="inline">
            <ActionLink to="/campaigns">함께할 프로젝트 찾기</ActionLink>
            <Link to="/campaigns/new" className="text-link">
              제작 의뢰하기 <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-caption">
            <span className="tiny-avatars">
              <i>M</i>
              <i>J</i>
              <i>S</i>
            </span>
            <span>서로 다른 시선이 만나, 더 좋은 장면으로</span>
          </div>
        </div>
        <div className="hero-art">
          <Artwork index={0} />
          <div className="hero-art-note">
            <span>CREATOR SPOTLIGHT</span>
            <strong>
              함께 만드는
              <br />
              좋은 장면.
            </strong>
            <Link to="/works/w1">
              스튜디오 모먼트의 작업 보기 <ArrowUpRightIcon />
            </Link>
          </div>
          <span className="floating-star">✳</span>
        </div>
      </section>
      <div className="section-title">
        <div>
          <p className="eyebrow">DISCOVER THE NEXT SCENE</p>
          <h2>어떤 장면을 찾고 있나요?</h2>
        </div>
        <span className="muted">
          공개 샘플 작품 · {items.length}개의 이야기
        </span>
      </div>
      <div className="filter-bar">
        <div className="filter-tabs" aria-label="작업 유형">
          {['전체', '브랜드 필름', '숏폼', '공간', '웨딩', '인터뷰'].map(
            (c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => setParams({ type: c, style })}
              >
                {c}
              </button>
            ),
          )}
        </div>
        <label className="filter-select">
          <SlidersHorizontal size={15} />
          <span className="sr-only">스타일 필터</span>
          <select
            value={style}
            onChange={(e) =>
              setParams({ type: category, style: e.target.value })
            }
          >
            <option>전체 스타일</option>
            <option>따뜻한</option>
            <option>감각적인</option>
          </select>
        </label>
      </div>
      {items.length ? (
        <div className="work-grid">
          {items.map((p, i) => (
            <Link to={`/works/${p.id}`} className="work-card" key={p.id}>
              <Artwork index={p.asset} title={p.title} play />
              <div className="work-card-body">
                <div>
                  <h3>{p.title}</h3>
                  <p>
                    {state.profile.name} <span>· {p.category}</span>
                  </p>
                </div>
                <span className="work-count">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="조건에 맞는 공개 작품이 없어요"
          description="다른 작업 유형이나 스타일을 선택해 보세요."
        />
      )}
      <div className="collab-banner">
        <div>
          <Tag>YOUR NEXT PROJECT</Tag>
          <h2>아직 구체적인 계획이 없어도 괜찮아요.</h2>
          <p>필요한 영상을 설명하고, 잘 맞는 제작자를 만나보세요.</p>
        </div>
        <ActionLink to="/campaigns/new">공개 모집 시작하기</ActionLink>
      </div>
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
export function WorkDetail() {
  const { workId } = useParams();
  const { state } = useDemo();
  const p = state.portfolios.find(
    (x) => x.id === workId && x.public && x.consent,
  );
  if (!p || !state.profile.servicePublic)
    return <Empty title="공개된 작품을 찾을 수 없어요" />;
  return (
    <>
      <Heading
        eyebrow="SELECTED WORK"
        title={p.title}
        description={`${p.category} · ${p.style}`}
      />
      <div className="detail-grid">
        <div>
          <video
            controls
            poster={`/art-${p.asset}.svg`}
            src="/demo.webm"
            className="film-player"
            aria-label="시연용 작품 영상"
          />
          <Notice>
            직접 생성한 시연용 영상입니다. 고객 납품물은 피드에 자동 공개되지
            않습니다.
          </Notice>
        </div>
        <Panel>
          <Tag>공개 샘플</Tag>
          <h2>{state.profile.name}</h2>
          <p>{state.profile.bio}</p>
          <dl className="definition">
            <dt>본인 역할</dt>
            <dd>{p.role}</dd>
            <dt>출처</dt>
            <dd>{p.source}</dd>
            <dt>공개 권한</dt>
            <dd>공개 권한 및 고객 동의 확인</dd>
          </dl>
          <ActionLink to="/creators/creator">제작자 프로필 보기</ActionLink>
        </Panel>
      </div>
      <PackageList />
    </>
  );
}
export function PackageList() {
  const { state } = useDemo();
  return (
    <>
      <div className="section-title">
        <h2>함께할 수 있는 제작 서비스</h2>
        <span className="muted">공개 패키지</span>
      </div>
      <div className="package-grid">
        {state.packages
          .filter((p) => p.public)
          .map((p) => (
            <Panel key={p.id}>
              <Tag>{p.representative ? '대표 패키지' : '공개 패키지'}</Tag>
              <h3>{p.title}</h3>
              <p className="muted">{p.description}</p>
              <strong className="price">{money(p.price)}</strong>
              <ActionLink to="/creators/creator/request" secondary>
                직접 의뢰하기
              </ActionLink>
            </Panel>
          ))}
      </div>
    </>
  );
}
export function CreatorDetail() {
  const { state } = useDemo();
  if (!state.profile.servicePublic) return <Empty title="비공개 서비스예요" />;
  return (
    <>
      <div className="creator-cover">
        <div className="avatar large">M</div>
        <Tag>CREATOR</Tag>
        <h1>{state.profile.name}</h1>
        <p>{state.profile.bio}</p>
        <p>
          <Star size={16} /> 공개 샘플로 시작하는 협업
        </p>
        <ActionLink to="/creators/creator/request">직접 의뢰하기</ActionLink>
      </div>
      <PackageList />
      <div className="section-title">
        <h2>포트폴리오</h2>
      </div>
      <div className="work-grid">
        {state.portfolios
          .filter((p) => p.public && p.consent)
          .map((p) => (
            <Link to={`/works/${p.id}`} key={p.id}>
              <Artwork index={p.asset} title={p.title} play />
            </Link>
          ))}
      </div>
    </>
  );
}
export function DirectRequest() {
  const { act } = useDemo();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  return (
    <>
      <Heading
        eyebrow="LET’S WORK TOGETHER"
        title="어떤 이야기를 만들까요?"
        description="제작자에게 직접 의뢰를 보내세요. 응답 기한은 발송 후 48시간입니다."
      />
      <Panel title="직접 의뢰 내용">
        <Form
          onSubmit={(d) => {
            if (
              act({
                type: 'request',
                title: str(d, 'title'),
                proposal: str(d, 'proposal'),
              })
            )
              setSent(true);
          }}
        >
          <Field label="프로젝트 제목">
            <input
              name="title"
              required
              placeholder="만들고 싶은 영상의 제목"
            />
          </Field>
          <Field label="제작 조건과 요청 사항">
            <textarea
              name="proposal"
              required
              rows={6}
              placeholder="영상 목적, 분량, 일정과 예산을 알려주세요."
            />
          </Field>
          <Notice>
            협의 수락은 계약 확정이 아닙니다. 모집 없이도 같은 작업 공간에서
            조건 합의부터 리뷰까지 진행합니다.
          </Notice>
          <Button type="submit" disabled={sent}>
            {sent ? '의뢰가 발송됐어요' : '직접 의뢰 보내기'}
          </Button>
          {sent && (
            <Button variant="secondary" onClick={() => navigate('/requests')}>
              의뢰 현황 보기
            </Button>
          )}
        </Form>
      </Panel>
    </>
  );
}
