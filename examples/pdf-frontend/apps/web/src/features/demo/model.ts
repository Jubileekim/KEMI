export type Party = 'client' | 'creator';
export type Role = Party | 'guest' | 'ops';
export type Campaign = {
  id: string;
  title: string;
  category: string;
  description: string;
  budget: number;
  duration: number;
  status: 'draft' | 'open' | 'closed' | 'ended';
  publishedAt?: number;
  owner: string;
  bookmarked: boolean;
};
export type Terms = {
  version: number;
  scope: string;
  amount: number;
  days: number;
  revisions: number;
  requestedAt?: number;
  signatures: Party[];
};
export type Message = {
  id: string;
  role: Role;
  text: string;
  at: number;
  failed?: boolean;
  attachment?: string;
};
export type Delivery = {
  id: string;
  version: number;
  kind: '초안' | '검토본' | '수정본' | '최종 파일';
  name: string;
  at: number;
  url: string;
};
export type Revision = {
  id: string;
  deliveryId: string;
  kind: '일반 수정' | '초안 의견' | '계약 오류 시정';
  time: string;
  problem: string;
  change: string;
  attachment: string;
  done: boolean;
};
export type Cancellation = {
  version: number;
  reason: string;
  compensation: number;
  refund: number;
  files: string;
  unfinished: string;
  rights: string;
  signatures: Party[];
  refunded: boolean;
  handedOver: boolean;
};
export type Request = {
  id: string;
  campaignId?: string;
  title: string;
  source: '공개 모집' | '직접 의뢰';
  proposal: string;
  createdAt: number;
  status: 'pending' | 'negotiating' | 'rejected' | 'withdrawn' | 'closed';
  messages: Message[];
  terms: Terms[];
  contract?: {
    version: number;
    amount: number;
    revisions: number;
    days: number;
  };
  payment: 'unpaid' | 'checking' | 'failed' | 'paid';
  paymentAttempts: string[];
  materialMode: 'files' | 'product';
  material: 'missing' | 'provided' | 'shipped' | 'received' | 'problem';
  materialNote: string;
  deadline?: number;
  deadlineChange?: {
    old: number;
    next: number;
    reason: string;
    signatures: Party[];
  };
  deadlineHistory: string[];
  deliveries: Delivery[];
  revisions: Revision[];
  approved?: string;
  received: boolean;
  reviews: { role: Party; rating: number; text: string }[];
  cancellation?: Cancellation;
  cancelled: boolean;
  hold: boolean;
  evidence: string[];
};
export type Notification = {
  id: string;
  role: Party;
  title: string;
  target: string;
  read: boolean;
};
export type Package = {
  id: string;
  title: string;
  description: string;
  price: number;
  public: boolean;
  representative: boolean;
};
export type Portfolio = {
  id: string;
  title: string;
  category: string;
  style: string;
  role: string;
  source: string;
  consent: boolean;
  public: boolean;
  asset: number;
};
export type State = {
  campaigns: Campaign[];
  requests: Request[];
  notifications: Notification[];
  packages: Package[];
  portfolios: Portfolio[];
  profile: { name: string; bio: string; brand: string; servicePublic: boolean };
  clientProfile: { name: string; bio: string; brand: string };
  operationRecords: string[];
};
export const money = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export const isExpired = (r: Request, now = Date.now()) =>
  r.source === '직접 의뢰' &&
  r.status === 'pending' &&
  now >= r.createdAt + 48 * 3600000;
export const campaignExpired = (c: Campaign, now = Date.now()) =>
  c.status === 'open' && now >= (c.publishedAt ?? now) + c.duration * 86400000;
export const usedRounds = (r: Request) =>
  r.revisions.filter((x) => x.kind === '일반 수정' && x.done).length;
export const canSettle = (r: Request) =>
  !!r.contract &&
  r.payment === 'paid' &&
  r.received &&
  !r.hold &&
  !r.cancelled &&
  !r.cancellation;
export function initialState(now = Date.now()): State {
  const titles = [
    '일상의 순간을 담는 브랜드 필름',
    '새로운 공간을 소개할 영상 제작',
    '제품의 매력을 전할 숏폼 콘텐츠',
    '함께 기억할 인터뷰 영상',
    '우리의 시작을 담는 웨딩 필름',
    '새 컬렉션의 무드를 담아주세요',
  ];
  return {
    campaigns: titles.map((title, i) => ({
      id: `c${i + 1}`,
      title,
      category: [
        '브랜드 필름',
        '공간',
        '숏폼',
        '인터뷰',
        '웨딩',
        '브랜드 필름',
      ][i],
      description:
        '브랜드가 가진 이야기를 자연스럽고 감각적인 영상으로 전하고 싶습니다. 기획부터 촬영, 편집까지 함께할 제작자를 찾습니다.',
      budget: [200000, 800000, 400000, 600000, 1200000, 900000][i],
      duration: 7,
      status: 'open',
      publishedAt: now,
      owner: 'client',
      bookmarked: false,
    })),
    requests: [],
    notifications: [],
    packages: [
      {
        id: 'p1',
        title: '브랜드의 이야기를 담는 필름',
        description: '기획 · 촬영 · 편집 / 영상 1편',
        price: 200000,
        public: true,
        representative: true,
      },
      {
        id: 'p2',
        title: '일상에 스며드는 숏폼',
        description: '세로 영상 기획 · 편집 / 영상 1편',
        price: 150000,
        public: true,
        representative: false,
      },
    ],
    portfolios: [
      '빛과 함께 머무는 시간',
      '작은 순간, 선명한 이야기',
      '도시의 새로운 표정',
      '있는 그대로의 아름다움',
      '우리만의 속도로',
      '당신의 다음 장면',
    ].map((title, i) => ({
      id: `w${i + 1}`,
      title,
      category: [
        '브랜드 필름',
        '숏폼',
        '공간',
        '브랜드 필름',
        '웨딩',
        '인터뷰',
      ][i],
      style: i % 2 ? '감각적인' : '따뜻한',
      role: '기획 · 촬영 · 편집',
      source: '직접 제작한 시연용 샘플',
      consent: true,
      public: true,
      asset: i % 4,
    })),
    profile: {
      name: '스튜디오 모먼트',
      bio: '평범한 순간 속 특별한 이야기를 발견합니다. 기획부터 마지막 편집까지, 함께 좋은 장면을 만듭니다.',
      brand: '',
      servicePublic: true,
    },
    clientProfile: { name: '시연 의뢰인', bio: '', brand: '' },
    operationRecords: [],
  };
}
export function newRequest(
  id: string,
  title: string,
  proposal: string,
  now: number,
  campaignId?: string,
): Request {
  return {
    id,
    title,
    proposal,
    campaignId,
    source: campaignId ? '공개 모집' : '직접 의뢰',
    createdAt: now,
    status: 'pending',
    messages: [],
    terms: [],
    payment: 'unpaid',
    paymentAttempts: [],
    materialMode: 'files',
    material: 'missing',
    materialNote: '',
    deadlineHistory: [],
    deliveries: [],
    revisions: [],
    received: false,
    reviews: [],
    cancelled: false,
    hold: false,
    evidence: [],
  };
}
export type Action =
  | { type: 'campaign'; campaign: Campaign }
  | { type: 'campaignStatus'; id: string; status: Campaign['status'] }
  | { type: 'bookmark'; id: string }
  | { type: 'request'; title: string; proposal: string; campaignId?: string }
  | { type: 'requestStatus'; id: string; status: Request['status'] }
  | {
      type: 'message';
      id: string;
      text: string;
      attachment?: string;
      fail?: boolean;
    }
  | { type: 'retry'; id: string; messageId: string }
  | {
      type: 'terms';
      id: string;
      scope: string;
      amount: number;
      days: number;
      revisions: number;
    }
  | { type: 'requestSignature' | 'sign'; id: string }
  | { type: 'payment'; id: string; result: Request['payment'] }
  | {
      type: 'material';
      id: string;
      mode: Request['materialMode'];
      status: Request['material'];
      note: string;
    }
  | { type: 'start'; id: string; deadline: number }
  | { type: 'deadline'; id: string; deadline: number; reason: string }
  | { type: 'approveDeadline'; id: string }
  | { type: 'delivery'; id: string; kind: Delivery['kind']; name: string }
  | {
      type: 'revision';
      id: string;
      deliveryId: string;
      kind: Revision['kind'];
      time: string;
      problem: string;
      change: string;
      attachment: string;
    }
  | { type: 'approve' | 'receive'; id: string }
  | { type: 'review'; id: string; rating: number; text: string }
  | {
      type: 'cancel';
      id: string;
      reason: string;
      compensation: number;
      files: string;
      unfinished: string;
      rights: string;
    }
  | { type: 'signCancel' | 'refund' | 'handover'; id: string }
  | { type: 'dispute'; id: string; evidence: string }
  | { type: 'resolve'; id: string; reason: string }
  | { type: 'profile'; profile: State['profile'] }
  | { type: 'package'; item: Package }
  | { type: 'portfolio'; item: Portfolio }
  | { type: 'read'; id: string };
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function integer(value: number, min = 0) {
  return Number.isSafeInteger(value) && value >= min;
}
export function transition(
  previous: State,
  action: Action,
  role: Role,
  now = Date.now(),
): State {
  const s: State = structuredClone(previous);
  const uid = (prefix: string) =>
    `${prefix}-${now}-${s.notifications.length}-${s.requests.length}`;
  const notify = (to: Party, title: string, target: string) =>
    s.notifications.unshift({
      id: uid('n'),
      role: to,
      title,
      target,
      read: false,
    });
  const member = role === 'client' || role === 'creator';
  if (action.type === 'read') {
    s.notifications.forEach((n) => {
      if (n.id === action.id && n.role === role) n.read = true;
    });
    return s;
  }
  ensure(member || role === 'ops', '시연 계정을 선택해 주세요.');
  if (action.type === 'profile') {
    ensure(member, '회원만 수정할 수 있어요.');
    ensure(action.profile.name.trim(), '표시 이름을 입력해 주세요.');
    if (role === 'client')
      s.clientProfile = {
        name: action.profile.name,
        bio: action.profile.bio,
        brand: action.profile.brand,
      };
    else {
      ensure(
        !action.profile.servicePublic ||
          s.packages.some((p) => p.public && p.representative),
        '공개 대표 패키지를 먼저 준비해 주세요.',
      );
      s.profile = action.profile;
    }
    return s;
  }
  if (action.type === 'package') {
    ensure(role === 'creator', '제작자만 패키지를 관리할 수 있어요.');
    ensure(
      action.item.title.trim() && integer(action.item.price, 1),
      '패키지 이름과 유효한 금액을 입력해 주세요.',
    );
    ensure(
      !action.item.representative || action.item.public,
      '대표 패키지는 공개 상태여야 해요.',
    );
    s.packages = s.packages
      .filter((p) => p.id !== action.item.id)
      .map((p) =>
        action.item.representative ? { ...p, representative: false } : p,
      );
    s.packages.push(action.item);
    if (!s.packages.some((p) => p.public && p.representative))
      s.profile.servicePublic = false;
    return s;
  }
  if (action.type === 'portfolio') {
    ensure(role === 'creator', '제작자만 작품을 관리할 수 있어요.');
    ensure(
      action.item.title.trim() &&
        action.item.role.trim() &&
        action.item.source.trim(),
      '제목, 본인 역할, 출처를 입력해 주세요.',
    );
    ensure(
      !action.item.public || action.item.consent,
      '공개에는 공개 권한·고객 동의 확인이 필요해요.',
    );
    s.portfolios = [
      ...s.portfolios.filter((p) => p.id !== action.item.id),
      action.item,
    ];
    return s;
  }
  if (action.type === 'bookmark') {
    ensure(role === 'creator', '제작자 시연 계정에서 저장할 수 있어요.');
    const c = s.campaigns.find((c) => c.id === action.id);
    ensure(c, '모집을 찾을 수 없어요.');
    c.bookmarked = !c.bookmarked;
    return s;
  }
  if (action.type === 'campaign') {
    ensure(role === 'client', '의뢰인만 모집을 작성할 수 있어요.');
    const c = action.campaign;
    const old = s.campaigns.find((x) => x.id === c.id);
    ensure(!old || old.owner === 'client', '본인 모집만 수정할 수 있어요.');
    ensure(
      !old || old.status === 'draft' || old.status === 'open',
      '종료된 모집은 수정할 수 없어요.',
    );
    ensure(
      c.title.trim() &&
        c.description.trim() &&
        integer(c.budget, 1) &&
        [3, 7, 14].includes(c.duration),
      '제목, 제작 조건, 유효한 예산과 모집 기간을 입력해 주세요.',
    );
    s.campaigns = [
      {
        ...c,
        owner: 'client',
        publishedAt:
          old?.publishedAt ?? (c.status === 'open' ? now : undefined),
      },
      ...s.campaigns.filter((x) => x.id !== c.id),
    ];
    return s;
  }
  if (action.type === 'campaignStatus') {
    const c = s.campaigns.find((c) => c.id === action.id);
    ensure(
      role === 'client' && c?.owner === 'client',
      '본인 모집만 변경할 수 있어요.',
    );
    ensure(
      c.status === 'draft' ||
        c.status === 'open' ||
        (c.status === 'closed' && action.status === 'ended'),
      '종료된 모집이에요.',
    );
    ensure(
      action.status !== 'draft',
      '공개한 모집을 초안으로 되돌릴 수 없어요.',
    );
    c.status = action.status;
    if (action.status === 'open') c.publishedAt = now;
    if (action.status === 'ended')
      s.requests
        .filter((r) => r.campaignId === c.id && !r.contract)
        .forEach((r) => {
          r.status = 'closed';
        });
    return s;
  }
  if (action.type === 'request') {
    const c = s.campaigns.find((c) => c.id === action.campaignId);
    ensure(action.proposal.trim(), '의뢰 또는 제안 내용을 입력해 주세요.');
    if (action.campaignId) {
      ensure(
        role === 'creator' &&
          c &&
          c.status === 'open' &&
          !campaignExpired(c, now),
        '모집 중인 공고에 제작자만 제안할 수 있어요.',
      );
      ensure(
        !s.requests.some(
          (r) => r.campaignId === c.id && r.status !== 'withdrawn',
        ),
        '이미 제안한 모집이에요.',
      );
    } else
      ensure(
        role === 'client' && s.profile.servicePublic,
        '공개 서비스를 제공하는 제작자에게 의뢰인만 요청할 수 있어요.',
      );
    const r = newRequest(
      uid('r'),
      c?.title ?? action.title,
      action.proposal,
      now,
      action.campaignId,
    );
    ensure(r.title.trim(), '제목을 입력해 주세요.');
    s.requests.unshift(r);
    notify(
      action.campaignId ? 'client' : 'creator',
      `${r.source} 요청이 도착했어요`,
      `/requests/${r.id}`,
    );
    return s;
  }
  const r = s.requests.find((r) => r.id === action.id);
  ensure(r, '의뢰를 찾을 수 없어요.');
  if (action.type === 'resolve') {
    ensure(
      role === 'ops' && action.reason.trim(),
      '운영 처리 사유가 필요해요.',
    );
    r.hold = false;
    s.operationRecords.unshift(
      `${r.title} · ${action.reason} · ${new Date(now).toISOString()}`,
    );
    return s;
  }
  ensure(member, '거래 당사자 시연 계정에서 이용해 주세요.');
  const other: Party = role === 'client' ? 'creator' : 'client';
  const target = `/workspace/${r.id}`;
  if (action.type === 'dispute') {
    ensure(action.evidence.trim(), '신고 내용과 증빙을 입력해 주세요.');
    r.hold = true;
    r.evidence.push(`${role}: ${action.evidence}`);
    notify(other, '분쟁 보류 · 대화와 증빙 제출은 유지됩니다', target);
    return s;
  }
  if (action.type === 'message') {
    ensure(
      !['closed', 'rejected', 'withdrawn'].includes(r.status) && !r.cancelled,
      '종료된 대화방은 읽기 전용이에요.',
    );
    ensure(
      action.text.trim() || action.attachment,
      '메시지 또는 첨부를 선택해 주세요.',
    );
    r.messages.push({
      id: `${uid('m')}-${r.messages.length}`,
      role,
      text: action.text,
      attachment: action.attachment,
      at: now,
      failed: action.fail,
    });
    return s;
  }
  if (action.type === 'retry') {
    const m = r.messages.find((m) => m.id === action.messageId);
    ensure(
      m?.role === role && m.failed && !r.cancelled && r.status !== 'closed',
      '재전송할 메시지가 없어요.',
    );
    m.failed = false;
    return s;
  }
  if (action.type === 'requestStatus') {
    ensure(
      !r.contract &&
        !isExpired(r, now) &&
        ['pending', 'negotiating'].includes(r.status),
      '변경할 수 없는 의뢰예요.',
    );
    ensure(
      (action.status === 'withdrawn' &&
        (r.source === '직접 의뢰' ? role === 'client' : role === 'creator')) ||
        (['negotiating', 'rejected'].includes(action.status) &&
          r.status === 'pending' &&
          (r.source === '직접 의뢰'
            ? role === 'creator'
            : role === 'client')) ||
        (action.status === 'closed' && r.status === 'negotiating'),
      '이 상태를 변경할 수 없어요.',
    );
    r.status = action.status;
    notify(
      other,
      `의뢰 상태: ${action.status === 'negotiating' ? '협의 중' : '종료'}`,
      target,
    );
    return s;
  }
  ensure(!r.cancelled, '취소가 완료된 거래예요.');
  if (action.type === 'terms') {
    ensure(
      r.status === 'negotiating' && !r.contract,
      '협의 중에만 조건을 작성할 수 있어요.',
    );
    ensure(
      action.scope.trim() &&
        integer(action.amount, 1) &&
        integer(action.days, 1) &&
        integer(action.revisions),
      '범위, 원화 정수 금액, 제작일, 수정 횟수를 확인해 주세요.',
    );
    r.terms.push({
      version: r.terms.length + 1,
      scope: action.scope,
      amount: action.amount,
      days: action.days,
      revisions: action.revisions,
      signatures: [],
    });
    return s;
  }
  if (action.type === 'requestSignature' || action.type === 'sign') {
    const t = r.terms.at(-1);
    ensure(t && !r.contract, '새 조건서를 먼저 작성해 주세요.');
    ensure(r.status === 'negotiating', '협의 중인 의뢰만 서명할 수 있어요.');
    if (action.type === 'requestSignature') {
      ensure(
        !t.requestedAt,
        '요청된 버전은 고정돼요. 새 버전을 작성해 주세요.',
      );
      t.requestedAt = now;
      notify(other, `조건서 v${t.version} · 48시간 내 확인 요청`, target);
      return s;
    }
    ensure(
      t.requestedAt && now < t.requestedAt + 48 * 3600000,
      '확인 요청이 없거나 48시간이 만료됐어요. 새 버전을 요청해 주세요.',
    );
    ensure(!t.signatures.includes(role), '이미 서명한 버전이에요.');
    t.signatures.push(role);
    if (t.signatures.length === 2) {
      ensure(
        !s.requests.some(
          (x) =>
            x.id !== r.id &&
            x.campaignId &&
            x.campaignId === r.campaignId &&
            x.contract,
        ),
        '이미 다른 계약이 확정된 모집이에요.',
      );
      r.contract = {
        version: t.version,
        amount: t.amount,
        days: t.days,
        revisions: t.revisions,
      };
      if (r.campaignId) {
        const c = s.campaigns.find((c) => c.id === r.campaignId);
        if (c) c.status = 'ended';
        s.requests
          .filter((x) => x.id !== r.id && x.campaignId === r.campaignId)
          .forEach((x) => {
            x.status = 'closed';
          });
      }
      notify(other, '양측 서명 완료 · 계약이 확정됐어요', target);
    }
    return s;
  }
  ensure(r.contract, '양측 서명으로 계약을 먼저 확정해 주세요.');
  if (action.type === 'cancel') {
    ensure(
      !r.received && !r.cancellation?.refunded,
      '수령 또는 환불 완료 후에는 취소 합의를 변경할 수 없어요.',
    );
    ensure(
      action.reason.trim() &&
        action.files.trim() &&
        action.unfinished.trim() &&
        action.rights.trim() &&
        integer(action.compensation) &&
        action.compensation <= r.contract.amount,
      '사유, 파일, 미완성 상태, 사용권과 유효한 대가를 입력해 주세요.',
    );
    ensure(
      r.payment === 'paid' || action.compensation === 0,
      '미결제 계약의 대가는 0원으로 작성해 주세요.',
    );
    r.cancellation = {
      version: (r.cancellation?.version ?? 0) + 1,
      reason: action.reason,
      compensation: action.compensation,
      refund:
        r.payment === 'paid' ? r.contract.amount - action.compensation : 0,
      files: action.files,
      unfinished: action.unfinished,
      rights: action.rights,
      signatures: [],
      refunded: false,
      handedOver: false,
    };
    return s;
  }
  if (
    action.type === 'signCancel' ||
    action.type === 'refund' ||
    action.type === 'handover'
  ) {
    const c = r.cancellation;
    ensure(c && !r.hold, '취소 합의가 없거나 분쟁 보류 중이에요.');
    if (action.type === 'signCancel') {
      ensure(!c.signatures.includes(role), '이미 승인했어요.');
      c.signatures.push(role);
      if (c.signatures.length === 2 && r.payment !== 'paid') r.cancelled = true;
    }
    if (action.type === 'refund') {
      ensure(
        role === 'client' &&
          c.signatures.length === 2 &&
          r.payment === 'paid' &&
          !c.refunded,
        '양측 승인된 결제 거래를 한 번만 모의 환불할 수 있어요.',
      );
      c.refunded = true;
    }
    if (action.type === 'handover') {
      ensure(
        role === 'client' && c.refunded,
        '모의 환불 후 인도 파일을 확인해 주세요.',
      );
      c.handedOver = true;
      r.cancelled = true;
    }
    return s;
  }
  ensure(
    !r.hold && !r.cancellation,
    '분쟁 보류 또는 취소 협의 중에는 거래 진행이 차단돼요.',
  );
  if (action.type === 'payment') {
    ensure(
      role === 'client' && r.payment !== 'paid',
      '의뢰인이 미결제 계약에서 진행해 주세요.',
    );
    ensure(
      action.result === 'checking' ||
        ((r.payment === 'checking' || r.payment === 'failed') &&
          ['paid', 'failed'].includes(action.result)),
      '시연 승인 조회 단계를 먼저 진행해 주세요.',
    );
    r.payment = action.result;
    r.paymentAttempts.push(`${new Date(now).toISOString()} · ${action.result}`);
    return s;
  }
  if (action.type === 'material') {
    ensure(
      ['files', 'product'].includes(action.mode) &&
        (action.status !== 'provided' || action.mode === 'files') &&
        (action.status !== 'shipped' || action.mode === 'product'),
      '파일 제공과 제품 발송 방식을 맞춰 주세요.',
    );
    if (role === 'creator')
      ensure(
        action.mode === r.materialMode,
        '의뢰인이 제공한 자료 방식으로 수령을 확인해 주세요.',
      );
    ensure(!r.deadline, '제작 시작 후 준비 상태를 덮어쓸 수 없어요.');
    ensure(
      (role === 'client' &&
        ['provided', 'shipped', 'missing'].includes(action.status)) ||
        (role === 'creator' && ['received', 'problem'].includes(action.status)),
      '발송·제공은 의뢰인, 정상 수령·문제 신고는 제작자가 확인해 주세요.',
    );
    if (action.status === 'received')
      ensure(
        r.material === 'provided' || r.material === 'shipped',
        '먼저 자료 제공 또는 발송을 기록해 주세요.',
      );
    r.materialMode = action.mode;
    r.material = action.status;
    r.materialNote = action.note;
    return s;
  }
  if (action.type === 'start') {
    ensure(
      role === 'creator' &&
        r.payment === 'paid' &&
        r.material === 'received' &&
        !r.deadline &&
        action.deadline > now,
      '결제와 정상 수령을 확인하고 미래 납기를 지정해 주세요.',
    );
    r.deadline = action.deadline;
    return s;
  }
  if (action.type === 'deadline') {
    ensure(
      r.deadline &&
        action.deadline > r.deadline &&
        action.reason.trim() &&
        !r.deadlineChange,
      '기존 납기 이후 날짜와 변경 사유가 필요해요.',
    );
    r.deadlineChange = {
      old: r.deadline,
      next: action.deadline,
      reason: action.reason,
      signatures: [role],
    };
    return s;
  }
  if (action.type === 'approveDeadline') {
    const d = r.deadlineChange;
    ensure(d && !d.signatures.includes(role), '상대방의 납기 승인이 필요해요.');
    d.signatures.push(role);
    r.deadline = d.next;
    r.deadlineHistory.push(
      `${new Date(d.old).toLocaleString('ko-KR')} → ${new Date(d.next).toLocaleString('ko-KR')} · ${d.reason}`,
    );
    r.deadlineChange = undefined;
    return s;
  }
  if (action.type === 'delivery') {
    ensure(
      role === 'creator' && r.deadline && !r.received && action.name.trim(),
      '제작 시작 후 제작자가 파일 이름을 입력해 제출해 주세요.',
    );
    if (action.kind === '최종 파일')
      ensure(r.approved, '최신 검토본 승인이 먼저 필요해요.');
    else ensure(!r.approved, '검토 승인 이후에는 최종 파일을 제출해 주세요.');
    if (action.kind === '수정본') {
      ensure(
        r.revisions.some((x) => !x.done),
        '대상 수정 요청이 필요해요.',
      );
      r.revisions
        .filter((x) => !x.done)
        .forEach((x) => {
          x.done = true;
        });
    }
    r.deliveries.push({
      id: `${uid('d')}-${r.deliveries.length}`,
      version: r.deliveries.length + 1,
      kind: action.kind,
      name: action.name,
      at: now,
      url: '/demo.webm',
    });
    notify(other, `${action.kind}이 정식 제출됐어요`, target);
    return s;
  }
  if (action.type === 'revision') {
    const d = r.deliveries.at(-1);
    ensure(
      role === 'client' &&
        d?.id === action.deliveryId &&
        d.kind !== '최종 파일' &&
        !r.approved &&
        action.problem.trim() &&
        action.change.trim(),
      '최신 버전의 현재 문제와 원하는 변경을 입력해 주세요.',
    );
    ensure(!r.revisions.some((x) => !x.done), '진행 중인 수정 요청이 있어요.');
    ensure(
      (d.kind === '초안') === (action.kind === '초안 의견'),
      '초안 의견과 검토본 수정을 구분해 주세요.',
    );
    ensure(
      action.kind !== '일반 수정' || usedRounds(r) < r.contract.revisions,
      '남은 일반 수정 회차가 없어요.',
    );
    r.revisions.push({
      id: uid('rev'),
      deliveryId: d.id,
      kind: action.kind,
      time: action.time,
      problem: action.problem,
      change: action.change,
      attachment: action.attachment,
      done: false,
    });
    return s;
  }
  if (action.type === 'approve') {
    const d = r.deliveries.at(-1);
    ensure(
      role === 'client' &&
        d &&
        ['검토본', '수정본'].includes(d.kind) &&
        !r.revisions.some((x) => !x.done),
      '최신 검토본 또는 수정본을 확인하고 남은 수정 요청을 완료해 주세요.',
    );
    r.approved = d.id;
    return s;
  }
  if (action.type === 'receive') {
    ensure(
      role === 'client' &&
        r.approved &&
        r.deliveries.at(-1)?.kind === '최종 파일' &&
        !r.received,
      '검토 승인 후 깨끗한 최종 파일을 확인해 주세요.',
    );
    r.received = true;
    notify(other, '최종 수령 완료 · 모의 정산을 확인하세요', target);
    return s;
  }
  if (action.type === 'review') {
    ensure(
      canSettle(r) &&
        integer(action.rating, 1) &&
        action.rating <= 5 &&
        action.text.trim() &&
        !r.reviews.some((x) => x.role === role),
      '정상 완료 거래에 당사자별 1~5점 리뷰를 한 번 작성할 수 있어요.',
    );
    r.reviews.push({ role, rating: action.rating, text: action.text });
    return s;
  }
  return s;
}
