import { str, num } from './helpers';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDemo } from './context';
import { money } from './model';
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
  Artwork,
} from './ui';
export function Login({
  signup = false,
  onboarding = false,
}: {
  signup?: boolean;
  onboarding?: boolean;
}) {
  const { enter, state, role } = useDemo();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [social, setSocial] = useState('');
  const next = params.get('returnTo');
  const target =
    next?.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('\\') &&
    [...next].every((c) => c.charCodeAt(0) > 32)
      ? next
      : '/me/activity';
  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <p className="eyebrow">MAKE GOOD CHEMISTRY</p>
        <h1>
          좋은 이야기는
          <br />
          좋은 만남에서.
        </h1>
        <p>
          서로의 가능성을 발견하고,
          <br />
          함께 다음 장면을 만들어가세요.
        </p>
        <Artwork index={2} />
      </div>
      <Panel
        title={
          onboarding
            ? '역할과 표시 이름 확인'
            : signup
              ? '케미와 시작하기'
              : '다시 만나 반가워요'
        }
      >
        <Notice>
          로컬 프론트엔드 시연입니다. 실제 계정을 만들거나 인증하지 않습니다.
          실제 개인정보와 비밀번호를 입력하지 마세요.
        </Notice>
        <Form
          onSubmit={(d) => {
            const r = str(d, 'role') === 'creator' ? 'creator' : 'client';
            enter(r, str(d, 'name'));
            navigate(onboarding ? '/me/profile' : target);
          }}
        >
          <Field label="시연 역할">
            <select
              name="role"
              defaultValue={role === 'creator' ? 'creator' : 'client'}
            >
              <option value="client">의뢰인 · 영상을 의뢰하고 싶어요</option>
              <option value="creator">제작자 · 영상을 만들고 싶어요</option>
            </select>
          </Field>
          {(signup || onboarding) && (
            <Field label="표시 이름">
              <input
                name="name"
                required
                defaultValue={
                  onboarding
                    ? role === 'client'
                      ? state.clientProfile.name
                      : state.profile.name
                    : ''
                }
                placeholder="시연용 이름"
              />
            </Field>
          )}
          {!onboarding && (
            <>
              <Field label="이메일 (입력 UI 예시)">
                <input
                  type="email"
                  name="email"
                  placeholder="demo@example.com"
                  autoComplete="off"
                />
              </Field>
              <Field label="비밀번호 (저장·인증하지 않음)">
                <input
                  type="password"
                  name="password"
                  placeholder="시연에서는 입력하지 않아도 됩니다"
                  autoComplete="off"
                />
              </Field>
            </>
          )}
          <Button type="submit">
            {onboarding ? '이 역할로 계속하기' : '선택한 역할로 시연 시작'}
          </Button>
        </Form>
        {!onboarding && (
          <>
            <div className="auth-divider">또는 소셜 로그인</div>
            <div className="stack">
              <Button variant="secondary" onClick={() => setSocial('Google')}>
                G Google로 계속하기
              </Button>
              <Button variant="kakao" onClick={() => setSocial('카카오')}>
                ● 카카오로 계속하기
              </Button>
            </div>
            {social && (
              <div role="status" className="notice">
                {social} OAuth 설정이 없어 연결할 수 없어요.
                <div className="inline">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSocial('');
                      toast.info('소셜 로그인을 취소했어요.');
                    }}
                  >
                    취소
                  </Button>
                  <ActionLink to="/auth/social/callback?result=error" secondary>
                    실패 화면 보기
                  </ActionLink>
                </div>
              </div>
            )}
            <p className="auth-bottom">
              {signup ? '이미 케미와 함께하고 있나요?' : '케미가 처음인가요?'}{' '}
              <Link to={signup ? '/login' : '/signup'}>
                {signup ? '로그인' : '가입 화면 보기'}
              </Link>
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
export function SocialCallback() {
  const [p] = useSearchParams();
  return (
    <>
      <Heading
        title={
          p.get('result') === 'cancel'
            ? '소셜 로그인을 취소했어요'
            : '소셜 로그인에 연결할 수 없어요'
        }
        description="OAuth API와 콜백 설정이 제공되지 않았습니다."
      />
      <ActionLink to="/login">로그인으로 돌아가기</ActionLink>
    </>
  );
}
export function Profile() {
  const { state, role, act } = useDemo();
  const profile = role === 'client' ? state.clientProfile : state.profile;
  return (
    <>
      <Heading eyebrow="MY PROFILE" title="당신의 이야기를 소개해 주세요" />
      <Panel title={role === 'creator' ? '제작자 프로필' : '의뢰인 프로필'}>
        <Form
          key={role}
          onSubmit={(d) => {
            if (
              act({
                type: 'profile',
                profile: {
                  name: str(d, 'name'),
                  bio: str(d, 'bio'),
                  brand: str(d, 'brand'),
                  servicePublic:
                    role === 'creator'
                      ? d.get('public') === 'on'
                      : state.profile.servicePublic,
                },
              })
            )
              toast.success('시연 프로필을 저장했어요.');
          }}
        >
          <Field label="표시 이름">
            <input name="name" required defaultValue={profile.name} />
          </Field>
          <Field label="소개">
            <textarea name="bio" rows={4} defaultValue={profile.bio} />
          </Field>
          {role === 'client' && (
            <Field label="브랜드 정보 (선택)">
              <input
                name="brand"
                defaultValue={profile.brand}
                placeholder="개인 의뢰인은 비워두어도 괜찮아요"
              />
            </Field>
          )}
          {role === 'creator' && (
            <label className="check-label">
              <input
                type="checkbox"
                name="public"
                defaultChecked={state.profile.servicePublic}
              />
              제작 서비스 공개 (공개 대표 패키지 필요)
            </label>
          )}
          <Button type="submit">프로필 저장</Button>
        </Form>
      </Panel>
      {role === 'creator' && (
        <div className="inline">
          <ActionLink to="/studio/packages" secondary>
            패키지 관리
          </ActionLink>
          <ActionLink to="/studio/portfolio" secondary>
            포트폴리오 관리
          </ActionLink>
        </div>
      )}
    </>
  );
}
export function Packages() {
  const { state, act } = useDemo();
  const [editing, setEditing] = useState<string>('new');
  const p = state.packages.find((p) => p.id === editing);
  return (
    <>
      <Heading
        eyebrow="MY SERVICES"
        title="당신의 전문성을 서비스로"
        description="초안으로 저장한 뒤 공개 대표 상품을 갖춰 서비스를 공개하세요."
      />
      <div className="detail-grid">
        <div className="stack">
          {state.packages.map((p) => (
            <Panel key={p.id}>
              <div className="inline spread">
                <Tag>
                  {p.public ? '공개' : '초안 · 비공개'}
                  {p.representative ? ' · 대표' : ''}
                </Tag>
                <Button variant="ghost" onClick={() => setEditing(p.id)}>
                  수정
                </Button>
              </div>
              <h2>{p.title}</h2>
              <p className="muted">{p.description}</p>
              <strong className="price">{money(p.price)}</strong>
            </Panel>
          ))}
          <Button variant="secondary" onClick={() => setEditing('new')}>
            새 패키지 작성
          </Button>
        </div>
        <Panel title={p ? '패키지 수정' : '새 패키지'}>
          <Form
            key={editing}
            onSubmit={(d) => {
              if (
                act({
                  type: 'package',
                  item: {
                    id: p?.id ?? `p-${Date.now()}`,
                    title: str(d, 'title'),
                    description: str(d, 'description'),
                    price: num(d, 'price'),
                    public: d.get('public') === 'on',
                    representative: d.get('representative') === 'on',
                  },
                })
              ) {
                toast.success('패키지를 저장했어요.');
                setEditing('new');
              }
            }}
          >
            <Field label="패키지 이름">
              <input name="title" required defaultValue={p?.title} />
            </Field>
            <Field label="제공 범위">
              <textarea name="description" defaultValue={p?.description} />
            </Field>
            <Field label="금액 (원)">
              <input
                type="number"
                name="price"
                min="1"
                required
                defaultValue={p?.price ?? 200000}
              />
            </Field>
            <label className="check-label">
              <input type="checkbox" name="public" defaultChecked={p?.public} />
              공개 패키지
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="representative"
                defaultChecked={p?.representative}
              />
              대표 패키지 (하나만 지정)
            </label>
            <Button type="submit">패키지 저장</Button>
          </Form>
        </Panel>
      </div>
    </>
  );
}
export function Portfolios() {
  const { state, act } = useDemo();
  const [editing, setEditing] = useState('new');
  const p = state.portfolios.find((p) => p.id === editing);
  return (
    <>
      <Heading
        eyebrow="MY PORTFOLIO"
        title="당신만의 장면을 모아주세요"
        description="고객 납품물은 자동 공개되지 않습니다. 공개 권한과 동의를 확인해 주세요."
      />
      <div className="detail-grid">
        <div className="portfolio-list">
          {state.portfolios.map((p) => (
            <button
              key={p.id}
              onClick={() => setEditing(p.id)}
              className="portfolio-row"
            >
              <Artwork index={p.asset} />
              <span>
                <strong>{p.title}</strong>
                <small>
                  {p.public ? '공개' : '초안 · 비공개'} · {p.category}
                </small>
              </span>
            </button>
          ))}
          <Button variant="secondary" onClick={() => setEditing('new')}>
            새 작품 추가
          </Button>
        </div>
        <Panel title={p ? '작품 수정' : '새 작품'}>
          <Form
            key={editing}
            onSubmit={(d) => {
              if (
                act({
                  type: 'portfolio',
                  item: {
                    id: p?.id ?? `w-${Date.now()}`,
                    title: str(d, 'title'),
                    category: str(d, 'category'),
                    style: str(d, 'style'),
                    role: str(d, 'role'),
                    source: str(d, 'source'),
                    consent: d.get('consent') === 'on',
                    public: d.get('public') === 'on',
                    asset: p?.asset ?? state.portfolios.length % 4,
                  },
                })
              ) {
                toast.success('작품을 저장했어요.');
                setEditing('new');
              }
            }}
          >
            <Field label="작품 제목">
              <input name="title" required defaultValue={p?.title} />
            </Field>
            <div className="form-row">
              <Field label="작업 유형">
                <select name="category" defaultValue={p?.category}>
                  {['브랜드 필름', '숏폼', '공간', '웨딩', '인터뷰'].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="스타일">
                <select name="style" defaultValue={p?.style}>
                  <option>따뜻한</option>
                  <option>감각적인</option>
                </select>
              </Field>
            </div>
            <Field label="본인 역할">
              <input
                name="role"
                required
                defaultValue={p?.role}
                placeholder="기획 · 촬영 · 편집"
              />
            </Field>
            <Field label="출처">
              <input
                name="source"
                required
                defaultValue={p?.source}
                placeholder="직접 제작한 샘플 등"
              />
            </Field>
            <Notice>
              파일 업로드 API는 미연결 상태입니다. 이 시연에서는 내장 샘플
              영상으로 작품 메타데이터를 관리합니다.
            </Notice>
            <label className="check-label">
              <input
                name="consent"
                type="checkbox"
                defaultChecked={p?.consent}
              />
              공개 권한 및 필요한 고객 동의 확인
            </label>
            <label className="check-label">
              <input name="public" type="checkbox" defaultChecked={p?.public} />
              공개
            </label>
            <Button type="submit">작품 저장</Button>
          </Form>
        </Panel>
      </div>
    </>
  );
}
export function Notifications() {
  const { state, role, act } = useDemo();
  const list = state.notifications.filter((n) => n.role === role);
  return (
    <>
      <Heading
        eyebrow="NOTIFICATIONS"
        title="새로운 소식을 확인하세요"
        description={`미확인 ${list.filter((n) => !n.read).length}개`}
      />
      {list.length ? (
        <div className="stack">
          {list.map((n) => (
            <Link
              key={n.id}
              className={`notification-row ${n.read ? '' : 'unread'}`}
              to={n.target}
              onClick={() => act({ type: 'read', id: n.id })}
            >
              <span className="green-dot" />
              <span>{n.title}</span>
              <Tag tone="neutral">{n.read ? '읽음' : '새 알림'}</Tag>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="아직 새로운 알림이 없어요"
          description="제안과 협의, 조건 확인과 납품 소식을 이곳에서 확인하세요."
        />
      )}
    </>
  );
}
