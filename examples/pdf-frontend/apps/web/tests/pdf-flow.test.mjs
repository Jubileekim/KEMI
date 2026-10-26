import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  transition,
  canSettle,
  campaignExpired,
  isExpired,
  usedRounds,
} from '../src/features/demo/model.ts';
const START = 1793000000000;
test('의뢰인 프로필 변경은 제작자 프로필을 바꾸지 않는다', () => {
  const s = initialState(START);
  const next = transition(
    s,
    {
      type: 'profile',
      profile: {
        name: '개인 의뢰인',
        bio: '소개',
        brand: '',
        servicePublic: false,
      },
    },
    'client',
    START,
  );
  assert.equal(next.clientProfile.name, '개인 의뢰인');
  assert.equal(next.profile.name, s.profile.name);
  assert.equal(next.profile.servicePublic, true);
});
test('미결제 취소는 양측 승인으로 종료하고 환불하지 않는다', () => {
  const f = flow();
  f.contract();
  f.act('cancel', {
    reason: '미결제 취소',
    compensation: 0,
    files: '없음',
    unfinished: '제작 전',
    rights: '없음',
  });
  f.act('signCancel');
  f.act('signCancel', {}, 'creator');
  assert.equal(f.req().cancelled, true);
  assert.equal(f.req().cancellation.refund, 0);
  assert.equal(f.req().cancellation.refunded, false);
});
function flow(direct = true) {
  let state = initialState(START),
    now = START;
  const send = (action, role = 'client') => {
    state = transition(state, action, role, ++now);
    return state;
  };
  send(
    {
      type: 'request',
      title: '테스트 영상',
      proposal: '영상 1편',
      ...(direct ? {} : { campaignId: 'c1' }),
    },
    direct ? 'client' : 'creator',
  );
  const id = state.requests[0].id;
  const act = (type, fields = {}, role = 'client') =>
    send({ type, id, ...fields }, role);
  const req = () => state.requests.find((r) => r.id === id);
  act(
    'requestStatus',
    { status: 'negotiating' },
    direct ? 'creator' : 'client',
  );
  const terms = () =>
    act('terms', {
      scope: '영상 1편 · 촬영 편집',
      amount: 200000,
      days: 7,
      revisions: 2,
    });
  const contract = () => {
    terms();
    act('requestSignature');
    act('sign');
    act('sign', {}, 'creator');
  };
  const pay = () => {
    act('payment', { result: 'checking' });
    act('payment', { result: 'paid' });
  };
  const ready = () => {
    act('material', { mode: 'files', status: 'provided', note: '필수 파일' });
    act(
      'material',
      { mode: 'files', status: 'received', note: '정상 확인' },
      'creator',
    );
    act('start', { deadline: START + 86400000 }, 'creator');
  };
  const deliver = (kind) =>
    act('delivery', { kind, name: `${kind}.webm` }, 'creator');
  return {
    act,
    send,
    req,
    terms,
    contract,
    pay,
    ready,
    deliver,
    state: () => state,
  };
}
test('같은 버전의 양측 서명만 계약을 확정한다', () => {
  const f = flow();
  f.terms();
  f.act('requestSignature');
  f.act('sign');
  assert.equal(f.req().contract, undefined);
  assert.throws(() => f.act('sign'), /이미 서명/);
  f.act('sign', {}, 'creator');
  assert.equal(f.req().contract.amount, 200000);
});
test('새 버전은 이전 서명을 재사용하지 않는다', () => {
  const f = flow();
  f.terms();
  f.act('requestSignature');
  f.act('sign');
  f.terms();
  assert.deepEqual(f.req().terms.at(-1).signatures, []);
  assert.equal(f.req().terms[0].signatures.length, 1);
  assert.throws(() => f.act('sign', {}, 'creator'), /확인 요청/);
});
test('요청한 버전은 고정되고 48시간 후 서명은 차단된다', () => {
  const f = flow();
  f.terms();
  f.act('requestSignature');
  assert.throws(() => f.act('requestSignature'), /고정/);
  assert.throws(
    () =>
      transition(
        f.state(),
        { type: 'sign', id: f.req().id },
        'creator',
        START + 48 * 3600000 + 100,
      ),
    /만료/,
  );
  assert.equal(f.req().status, 'negotiating');
});
test('공개 모집 제안, 중복 제안, 마감 경계를 검사한다', () => {
  const f = flow(false);
  assert.throws(
    () =>
      f.send(
        { type: 'request', campaignId: 'c1', title: '중복', proposal: '중복' },
        'creator',
      ),
    /이미 제안/,
  );
  const s = initialState(START);
  assert.equal(campaignExpired(s.campaigns[0], START + 7 * 86400000), true);
  assert.throws(
    () =>
      transition(
        s,
        { type: 'request', campaignId: 'c1', title: '마감', proposal: '마감' },
        'creator',
        START + 7 * 86400000,
      ),
    /모집 중/,
  );
});
test('직접 의뢰 응답은 48시간에 만료된다', () => {
  const s = initialState(START);
  const next = transition(
    s,
    { type: 'request', title: '직접', proposal: '직접' },
    'client',
    START,
  );
  const r = next.requests[0];
  assert.equal(isExpired(r, START + 48 * 3600000), true);
  assert.throws(
    () =>
      transition(
        next,
        { type: 'requestStatus', id: r.id, status: 'negotiating' },
        'creator',
        START + 48 * 3600000,
      ),
    /변경할 수 없는/,
  );
});
test('결제와 정상 수령 전에는 제작할 수 없다', () => {
  const f = flow();
  f.contract();
  assert.throws(
    () => f.act('start', { deadline: START + 86400000 }, 'creator'),
    /결제와 정상 수령/,
  );
  f.pay();
  assert.throws(
    () => f.act('start', { deadline: START + 86400000 }, 'creator'),
    /정상 수령/,
  );
  f.ready();
  assert.ok(f.req().deadline);
});
test('성공 복귀만으로 결제 완료되지 않고 중복 승인을 차단한다', () => {
  const f = flow();
  f.contract();
  assert.throws(() => f.act('payment', { result: 'paid' }), /조회 단계/);
  f.pay();
  assert.throws(() => f.act('payment', { result: 'paid' }), /미결제/);
  assert.equal(f.req().paymentAttempts.length, 2);
});
test('제작 시작 시 납기는 한 번만 계산된다', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.ready();
  assert.throws(
    () => f.act('start', { deadline: START + 2 * 86400000 }, 'creator'),
    /확인하고/,
  );
});
test('납기 변경에는 양측 승인이 필요하고 기존 기한을 보존한다', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.ready();
  const old = f.req().deadline;
  f.act('deadline', { deadline: old + 86400000, reason: '합의 일정 변경' });
  assert.equal(f.req().deadline, old);
  assert.throws(() => f.act('approveDeadline'), /상대방/);
  f.act('approveDeadline', {}, 'creator');
  assert.equal(f.req().deadline, old + 86400000);
  assert.equal(f.req().deadlineHistory.length, 1);
});
for (const direct of [true, false])
  test(`${direct ? '직접 의뢰' : '공개 모집'} 정상 거래: 검토 승인, 최종 수령, 10% 모의 정산, 양측 리뷰`, () => {
    const f = flow(direct);
    f.contract();
    f.pay();
    f.ready();
    f.deliver('검토본');
    f.act('approve');
    assert.equal(canSettle(f.req()), false);
    f.deliver('최종 파일');
    assert.equal(canSettle(f.req()), false);
    f.act('receive');
    assert.equal(canSettle(f.req()), true);
    assert.equal(f.req().contract.amount * 0.1, 20000);
    assert.equal(f.req().contract.amount * 0.9, 180000);
    f.act('review', { rating: 5, text: '좋은 협업' });
    assert.throws(() => f.act('review', { rating: 5, text: '중복' }), /한 번/);
    f.act('review', { rating: 4, text: '감사합니다' }, 'creator');
    assert.equal(f.req().reviews.length, 2);
  });
test('수정은 대상 버전에 연결되고 수정본 제출 때 한 번 차감된다', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.ready();
  f.deliver('검토본');
  f.act('revision', {
    deliveryId: f.req().deliveries.at(-1).id,
    kind: '일반 수정',
    time: '00:10',
    problem: '자막',
    change: '오른쪽으로',
    attachment: '',
  });
  assert.equal(usedRounds(f.req()), 0);
  f.deliver('수정본');
  assert.equal(usedRounds(f.req()), 1);
  assert.throws(() => f.deliver('수정본'), /대상 수정/);
  assert.equal(usedRounds(f.req()), 1);
});
test('초안 의견은 일반 회차에서 제외된다', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.ready();
  f.deliver('초안');
  f.act('revision', {
    deliveryId: f.req().deliveries.at(-1).id,
    kind: '초안 의견',
    time: '',
    problem: '구성',
    change: '순서 변경',
    attachment: '',
  });
  f.deliver('수정본');
  assert.equal(usedRounds(f.req()), 0);
});
test('검토 승인 전 최종 파일 제출 및 최종 수령은 차단된다', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.ready();
  assert.throws(() => f.deliver('최종 파일'), /검토본 승인/);
  assert.throws(() => f.act('receive'), /최종 파일/);
});
test('20만원 결제의 대가 8만원 합의: 환불 12만원, 수수료 8천원, 지급 7만2천원', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.act('cancel', {
    reason: '상호 합의',
    compensation: 80000,
    files: '완료 파일',
    unfinished: '촬영 미완성',
    rights: '합의된 파일만 사용',
  });
  f.act('signCancel');
  assert.throws(() => f.act('refund'), /양측 승인/);
  f.act('signCancel', {}, 'creator');
  f.act('refund');
  assert.equal(f.req().cancellation.refund, 120000);
  assert.throws(() => f.act('refund'), /한 번만/);
  f.act('handover');
  assert.equal(f.req().cancelled, true);
  assert.equal(f.req().cancellation.compensation * 0.1, 8000);
  assert.equal(f.req().cancellation.compensation * 0.9, 72000);
});
test('분쟁 보류 중에도 대화와 증빙은 유지되고 진행과 정산은 차단된다', () => {
  const f = flow();
  f.contract();
  f.pay();
  f.act('dispute', { evidence: '확인 필요' });
  f.act('message', { text: '증빙을 보내드립니다.' });
  assert.equal(f.req().messages.length, 1);
  assert.equal(canSettle(f.req()), false);
  assert.throws(
    () => f.act('delivery', { kind: '초안', name: '파일' }, 'creator'),
    /분쟁 보류/,
  );
  f.send(
    { type: 'resolve', id: f.req().id, reason: '증빙 확인 후 상호 재개' },
    'ops',
  );
  assert.equal(f.req().hold, false);
  assert.equal(f.state().operationRecords.length, 1);
});
test('공개 대표 패키지는 하나, 비공개 대표는 차단된다', () => {
  let s = initialState(START);
  s = transition(
    s,
    {
      type: 'package',
      item: {
        id: 'p3',
        title: '새 대표',
        description: '',
        price: 200000,
        public: true,
        representative: true,
      },
    },
    'creator',
    START,
  );
  assert.equal(s.packages.filter((x) => x.representative).length, 1);
  assert.throws(
    () =>
      transition(
        s,
        {
          type: 'package',
          item: {
            id: 'p4',
            title: '비공개 대표',
            description: '',
            price: 1,
            public: false,
            representative: true,
          },
        },
        'creator',
        START,
      ),
    /공개 상태/,
  );
});
test('권한 없는 역할은 모집과 패키지를 수정하지 못한다', () => {
  const s = initialState(START);
  assert.throws(
    () =>
      transition(
        s,
        { type: 'campaignStatus', id: 'c1', status: 'ended' },
        'creator',
        START,
      ),
    /본인 모집/,
  );
  assert.throws(
    () =>
      transition(s, { type: 'package', item: s.packages[0] }, 'client', START),
    /제작자만/,
  );
});
