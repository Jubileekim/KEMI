import { str, num } from './helpers';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDemo } from './context';
import { canSettle, money, type Request } from './model';
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
import { EvidenceForm } from './Workspace';
function useContract() {
  const { contractId, disputeId } = useParams();
  const [p] = useSearchParams();
  const demo = useDemo();
  return {
    ...demo,
    r: demo.state.requests.find(
      (r) => r.id === (contractId ?? disputeId ?? p.get('request')),
    ),
  };
}
export function Payment({ result = false }: { result?: boolean }) {
  const { r, role, act } = useContract();
  if (!r?.contract) return <Empty title="확정된 계약을 찾을 수 없어요" />;
  const blocked = r.hold || !!r.cancellation || r.cancelled;
  return (
    <>
      <Heading
        eyebrow="TEST PAYMENT"
        title={result ? '결제 결과 확인' : '계약 전액 테스트 결제'}
        description={r.title}
      />
      <div className="detail-grid">
        <Panel title="주문 · 계약 확인">
          <dl className="definition">
            <dt>시연 주문 ID</dt>
            <dd>{r.id}</dd>
            <dt>확정 조건 버전</dt>
            <dd>v{r.contract.version}</dd>
            <dt>결제 금액</dt>
            <dd>{money(r.contract.amount)}</dd>
            <dt>결제자</dt>
            <dd>시연 의뢰인</dd>
          </dl>
          <Tag tone={r.payment === 'failed' ? 'warning' : ''}>
            {
              {
                unpaid: '결제 대기',
                checking: '결과 확인 중',
                failed: '결제 실패',
                paid: '시연 승인 결과: 성공',
              }[r.payment]
            }
          </Tag>
          <Notice>
            Toss Sandbox와 서버 승인 API는 미연결입니다. 아래 버튼은 로컬 상태를
            변경하는 시연 기능입니다. URL의 성공 값만으로 승인하지 않습니다.
          </Notice>
          {role === 'client' && (
            <div className="stack">
              <Button
                disabled={
                  blocked || r.payment === 'paid' || r.payment === 'checking'
                }
                onClick={() =>
                  act({ type: 'payment', id: r.id, result: 'checking' })
                }
              >
                시연 결제 시작 · 승인 확인 중
              </Button>
              <Button
                variant="secondary"
                disabled={
                  blocked || !['checking', 'failed'].includes(r.payment)
                }
                onClick={() =>
                  act({ type: 'payment', id: r.id, result: 'paid' })
                }
              >
                시연 승인 결과 조회: 성공
              </Button>
              <Button
                variant="ghost"
                disabled={
                  blocked || !['checking', 'failed'].includes(r.payment)
                }
                onClick={() =>
                  act({ type: 'payment', id: r.id, result: 'failed' })
                }
              >
                시연 승인 결과 조회: 실패
              </Button>
            </div>
          )}
          <ActionLink to={`/workspace/${r.id}`} secondary>
            작업 공간으로
          </ActionLink>
        </Panel>
        <Panel title="결제 시도 이력">
          {r.paymentAttempts.length ? (
            r.paymentAttempts.map((p, i) => (
              <p className="timeline-entry" key={i}>
                {p}
              </p>
            ))
          ) : (
            <p className="muted">아직 결제 시도가 없어요.</p>
          )}
          <Notice>
            실패 기록은 유지됩니다. 실제 중복 승인 방지, PG 결과 재조회,
            금액·결제자 검증은 서버 구현이 필요합니다.
          </Notice>
        </Panel>
      </div>
    </>
  );
}
export function Settlement({ r }: { r: Request }) {
  const full = canSettle(r);
  const partial =
    r.cancelled &&
    r.cancellation?.refunded &&
    r.cancellation.handedOver &&
    !r.hold;
  const amount = partial
    ? r.cancellation!.compensation
    : (r.contract?.amount ?? 0);
  const fee = amount * 0.1;
  return (
    <Panel title="모의 정산 내역">
      <Tag tone={full || partial ? '' : 'neutral'}>
        {full
          ? '거래 완료 · 모의 정산 가능'
          : partial
            ? '합의 취소 · 잔여 대가 모의 정산'
            : '정산 대기 · 지급 없음'}
      </Tag>
      {full || partial ? (
        <>
          <dl className="definition">
            <dt>{partial ? '합의 작업 대가' : '거래 금액'}</dt>
            <dd>{money(amount)}</dd>
            {partial && (
              <>
                <dt>모의 환불</dt>
                <dd>{money(r.cancellation!.refund)}</dd>
              </>
            )}
            <dt>계약 당시 수수료 10%</dt>
            <dd>{money(fee)}</dd>
            <dt>모의 지급액</dt>
            <dd className="settlement-total">{money(amount - fee)}</dd>
          </dl>
          <Notice>
            실제 지급은 발생하지 않습니다. PDF의 예시를 기준으로 계산하며, 원
            미만 절사 등 D12 정책은 미확정입니다.
          </Notice>
        </>
      ) : (
        <Notice>
          결제 성공·최종 파일 수령·보류 없음이 필요합니다. 취소 거래는 양측
          승인·모의 환불 성공·합의 파일 인도 확인 후 잔여 대가를 표시합니다.
        </Notice>
      )}
    </Panel>
  );
}
export function Review({ r }: { r: Request }) {
  const { role, act } = useDemo();
  const own = r.reviews.some((x) => x.role === role);
  return (
    <Panel title="함께한 경험을 남겨주세요">
      {r.reviews.map((x) => (
        <div key={x.role} className="review-entry">
          <Tag>{x.role === 'client' ? '의뢰인' : '제작자'} 리뷰</Tag>
          <strong>
            {'★'.repeat(x.rating)}
            {'☆'.repeat(5 - x.rating)}
          </strong>
          <p>{x.text}</p>
        </div>
      ))}
      {canSettle(r) && !own ? (
        <Form
          onSubmit={(d) => {
            if (
              act({
                type: 'review',
                id: r.id,
                rating: num(d, 'rating'),
                text: str(d, 'text'),
              })
            )
              toast.success('시연 리뷰를 등록했어요.');
          }}
        >
          <Field label="평점">
            <select name="rating">
              {[5, 4, 3, 2, 1].map((n) => (
                <option value={n} key={n}>
                  {n}점
                </option>
              ))}
            </select>
          </Field>
          <Field label="거래 리뷰">
            <textarea name="text" required rows={4} />
          </Field>
          <Button type="submit">리뷰 등록 · 한 번만 가능</Button>
        </Form>
      ) : (
        <p className="muted">
          {own
            ? '이 역할의 리뷰를 이미 등록했어요.'
            : '정상 거래 완료 후 양측이 한 번씩 리뷰할 수 있습니다.'}
        </p>
      )}
    </Panel>
  );
}
export function ReviewPage() {
  const { r } = useContract();
  return r ? (
    <>
      <Heading title="거래 리뷰" description={r.title} />
      <Review r={r} />
    </>
  ) : (
    <Empty title="거래를 찾을 수 없어요" />
  );
}
export function Cancellation() {
  const { r, role, act } = useContract();
  if (!r?.contract) return <Empty title="취소 협의할 계약이 없어요" />;
  const c = r.cancellation;
  return (
    <>
      <Heading
        eyebrow="CANCELLATION AGREEMENT"
        title="취소 · 부분 환불 협의"
        description={r.title}
      />
      <div className="detail-grid">
        <Panel title={`취소 합의 ${c ? `v${c.version}` : '작성'}`}>
          <Notice>
            {r.payment === 'paid'
              ? `원결제 ${money(r.contract.amount)} = 완료 작업 대가 + 환불액`
              : '미결제 계약입니다. 결제 후 환불과 구분하며, 대가는 0원으로 작성합니다.'}
          </Notice>
          {!r.cancelled && (
            <Form
              onSubmit={(d) => {
                if (
                  act({
                    type: 'cancel',
                    id: r.id,
                    reason: str(d, 'reason'),
                    compensation: num(d, 'compensation'),
                    files: str(d, 'files'),
                    unfinished: str(d, 'unfinished'),
                    rights: str(d, 'rights'),
                  })
                )
                  toast.success(
                    '새 취소 합의 버전을 저장했어요. 양측 승인이 필요합니다.',
                  );
              }}
            >
              <Field label="취소 사유">
                <textarea name="reason" required defaultValue={c?.reason} />
              </Field>
              <Field label="완료 작업 대가 (원)">
                <input
                  name="compensation"
                  type="number"
                  min="0"
                  max={r.payment === 'paid' ? r.contract.amount : 0}
                  required
                  defaultValue={
                    c?.compensation ??
                    (r.payment === 'paid'
                      ? Math.min(80000, r.contract.amount)
                      : 0)
                  }
                />
              </Field>
              <Field label="인도할 파일 (없으면 없음)">
                <input name="files" required defaultValue={c?.files} />
              </Field>
              <Field label="미완성 상태">
                <textarea
                  name="unfinished"
                  required
                  defaultValue={c?.unfinished}
                />
              </Field>
              <Field label="사용권 합의">
                <textarea name="rights" required defaultValue={c?.rights} />
              </Field>
              <Button type="submit" disabled={!!c?.refunded}>
                {c ? '수정하여 새 합의 버전 작성' : '취소 합의 작성'}
              </Button>
            </Form>
          )}
          {c && (
            <div className="stack">
              <dl className="definition">
                <dt>취소 사유</dt>
                <dd>{c.reason}</dd>
                <dt>합의 대가</dt>
                <dd>{money(c.compensation)}</dd>
                <dt>환불액</dt>
                <dd>{money(c.refund)}</dd>
                <dt>인도 파일</dt>
                <dd>{c.files}</dd>
                <dt>미완성 상태</dt>
                <dd>{c.unfinished}</dd>
                <dt>사용권</dt>
                <dd>{c.rights}</dd>
                <dt>승인</dt>
                <dd>
                  {c.signatures
                    .map((x) => (x === 'client' ? '의뢰인' : '제작자'))
                    .join(' · ') || '승인 대기'}
                </dd>
              </dl>
              <Button
                disabled={
                  r.hold ||
                  r.cancelled ||
                  c.signatures.includes(
                    role === 'creator' ? 'creator' : 'client',
                  )
                }
                onClick={() => act({ type: 'signCancel', id: r.id })}
              >
                현재 역할로 취소 합의 승인
              </Button>
              {role === 'client' && r.payment === 'paid' && (
                <>
                  <Button
                    variant="secondary"
                    disabled={r.hold || c.signatures.length !== 2 || c.refunded}
                    onClick={() => act({ type: 'refund', id: r.id })}
                  >
                    {c.refunded ? '모의 환불 성공' : '시연 환불 성공 결과 반영'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={r.hold || !c.refunded || c.handedOver}
                    onClick={() => act({ type: 'handover', id: r.id })}
                  >
                    {c.handedOver
                      ? '합의 파일 인도 확인 완료'
                      : '합의 파일 인도 확인'}
                  </Button>
                </>
              )}
              <Notice>
                실제 PG 환불은 미연결입니다. 미합의·무응답 상태에서 자동 지급
                또는 환불하지 않습니다.
              </Notice>
            </div>
          )}
        </Panel>
        <div className="stack">
          <Settlement r={r} />
          <Panel title="보류와 증빙">
            <Tag tone={r.hold ? 'warning' : 'neutral'}>
              {r.hold ? '분쟁 보류 중' : '진행 중인 보류 없음'}
            </Tag>
            <ActionLink to={`/disputes/${r.id}`} secondary>
              분쟁 신고 · 증빙 제출
            </ActionLink>
            <ActionLink to={`/workspace/${r.id}`} secondary>
              기존 대화로 돌아가기
            </ActionLink>
          </Panel>
        </div>
      </div>
    </>
  );
}
export function Dispute() {
  const { r } = useContract();
  if (!r) return <Empty title="신고 대상 의뢰를 찾을 수 없어요" />;
  return (
    <>
      <Heading
        eyebrow="DISPUTE & EVIDENCE"
        title="문제를 함께 확인할게요"
        description={r.title}
      />
      <Panel title="신고와 증빙">
        <Tag tone={r.hold ? 'warning' : 'neutral'}>
          {r.hold ? '분쟁 보류 · 정산 차단' : '보류 없음'}
        </Tag>
        <EvidenceForm r={r} />
        <div className="stack">
          {r.evidence.map((e, i) => (
            <Notice key={i}>{e}</Notice>
          ))}
        </div>
        <ActionLink to={`/workspace/${r.id}`} secondary>
          대화는 계속할 수 있어요
        </ActionLink>
      </Panel>
    </>
  );
}
export function Reports() {
  const { state } = useDemo();
  return (
    <>
      <Heading title="신고 대상 선택" />
      <div className="stack">
        {state.requests.length ? (
          state.requests.map((r) => (
            <ActionLink secondary key={r.id} to={`/disputes/${r.id}`}>
              {r.title}
            </ActionLink>
          ))
        ) : (
          <Empty title="신고할 의뢰가 없어요" />
        )}
      </div>
    </>
  );
}
export function Operations() {
  const { state, act } = useDemo();
  const cases = state.requests.filter((r) => r.evidence.length);
  return (
    <>
      <Heading
        eyebrow="OPERATIONS / DEMO"
        title="신고 · 분쟁 검토"
        description="운영자 권한과 서버 접근 제어는 미연결 상태입니다. 아래 처리는 로컬 시연입니다."
      />
      {cases.length ? (
        cases.map((r) => (
          <Panel key={r.id} title={r.title}>
            <Tag tone={r.hold ? 'warning' : 'neutral'}>
              {r.hold ? '정산 보류 중' : '보류 해제 이력 있음'}
            </Tag>
            {r.evidence.map((e, i) => (
              <p className="timeline-entry" key={i}>
                {e}
              </p>
            ))}
            {r.hold && (
              <Form
                onSubmit={(d) => {
                  if (
                    act({ type: 'resolve', id: r.id, reason: str(d, 'reason') })
                  )
                    toast.success('처리 근거와 보류 해제를 기록했어요.');
                }}
              >
                <Field label="처리 사유 · 근거">
                  <textarea name="reason" required />
                </Field>
                <Button type="submit" variant="secondary">
                  시연 보류 해제 · 근거 기록
                </Button>
              </Form>
            )}
          </Panel>
        ))
      ) : (
        <Empty title="접수된 신고가 없어요" />
      )}
      <Panel title="처리 · 보류 이력">
        {state.operationRecords.length ? (
          state.operationRecords.map((x, i) => (
            <p key={i} className="timeline-entry">
              {x}
            </p>
          ))
        ) : (
          <p className="muted">아직 처리 이력이 없어요.</p>
        )}
      </Panel>
    </>
  );
}
