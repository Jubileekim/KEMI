import { str, num, attachmentName } from './helpers';
import { useState } from 'react';
import { useClock } from './useClock';
import { Link, useParams } from 'react-router-dom';
import { MessageSquare, Send, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useDemo } from './context';
import { isExpired, money, canSettle, type Request } from './model';
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
  FileName,
} from './ui';
import { Fulfillment } from './Fulfillment';
import { Settlement, Review } from './Transaction';
const requestStatus = (r: Request) =>
  r.hold
    ? '분쟁 보류'
    : r.cancelled
      ? '취소 완료'
      : canSettle(r)
        ? '거래 완료'
        : r.cancellation
          ? '취소 협의'
          : r.contract
            ? '계약 확정'
            : isExpired(r)
              ? '응답 만료'
              : {
                  pending: '응답 대기',
                  negotiating: '협의 중',
                  rejected: '거절',
                  withdrawn: '철회',
                  closed: '협의 종료',
                }[r.status];
export function Requests({
  activity = false,
  proposals = false,
}: {
  activity?: boolean;
  proposals?: boolean;
}) {
  const { campaignId } = useParams();
  const { state, role } = useDemo();
  const list = state.requests.filter(
    (r) => !proposals || r.campaignId === campaignId,
  );
  return (
    <>
      <Heading
        eyebrow={activity ? 'MY OVERVIEW' : 'PROJECTS & CONVERSATIONS'}
        title={
          activity
            ? '함께 만드는 이야기들'
            : proposals
              ? '도착한 제안서'
              : '의뢰와 대화'
        }
        description="의뢰부터 마지막 장면까지, 진행 상황을 한눈에 확인하세요."
        action={
          <ActionLink to={role === 'client' ? '/campaigns/new' : '/campaigns'}>
            {role === 'client' ? '새 프로젝트 시작' : '프로젝트 둘러보기'}
          </ActionLink>
        }
      />
      <div className="stats-grid">
        {[
          ['전체 의뢰', list.length],
          [
            '협의 중',
            list.filter((r) => r.status === 'negotiating' && !r.contract)
              .length,
          ],
          [
            '계약 확정',
            list.filter((r) => r.contract && !r.cancelled && !r.received)
              .length,
          ],
          ['거래 완료', list.filter(canSettle).length],
        ].map(([label, count]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>
              {count}
              <small>건</small>
            </strong>
          </div>
        ))}
      </div>
      {list.length ? (
        <div className="request-list">
          {list.map((r) => (
            <Link to={`/requests/${r.id}`} className="request-row" key={r.id}>
              <span className="request-icon">
                <MessageSquare size={23} />
              </span>
              <div>
                <Tag tone="neutral">{r.source}</Tag>
                <h2>{r.title}</h2>
                <p className="muted">{r.proposal.slice(0, 80)}</p>
              </div>
              <div className="request-meta">
                <Tag>{requestStatus(r)}</Tag>
                <span className="muted">
                  {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="첫 번째 협업을 시작해 보세요"
          description="모집에 제안하거나 제작자에게 직접 의뢰를 보내면 이곳에서 이어갈 수 있어요."
        >
          <ActionLink to="/campaigns" secondary>
            공개 모집 둘러보기
          </ActionLink>
        </Empty>
      )}
      {activity && role === 'client' && (
        <>
          <div className="section-title">
            <h2>내 모집 · 임시 저장</h2>
          </div>
          <div className="stack">
            {state.campaigns
              .filter((c) => c.owner === 'client')
              .map((c) => (
                <Link
                  className="notification-row"
                  to={`/campaigns/${c.id}`}
                  key={c.id}
                >
                  <strong>{c.title}</strong>
                  <Tag tone="neutral">
                    {c.status === 'draft'
                      ? '임시 저장'
                      : c.status === 'open'
                        ? '공개 모집'
                        : '종료'}
                  </Tag>
                </Link>
              ))}
          </div>
        </>
      )}
    </>
  );
}
export function RequestDetail() {
  const { requestId } = useParams();
  const { state, role, act } = useDemo();
  const r = state.requests.find((r) => r.id === requestId);
  if (!r) return <Empty title="의뢰를 찾을 수 없어요" />;
  const receiver =
    r.source === '직접 의뢰' ? role === 'creator' : role === 'client';
  return (
    <>
      <Heading
        eyebrow={r.source}
        title={r.title}
        description={requestStatus(r)}
      />
      <div className="detail-grid">
        <Panel title="의뢰 · 제안 내용">
          <p className="pre-wrap">{r.proposal}</p>
          {r.source === '직접 의뢰' && (
            <Notice>
              응답 기한:{' '}
              {new Date(r.createdAt + 48 * 3600000).toLocaleString('ko-KR')} ·
              수락은 협의 시작이며 계약 확정이 아닙니다.
            </Notice>
          )}
          {r.campaignId && (
            <Link className="text-link" to={`/campaigns/${r.campaignId}`}>
              원본 모집 보기 →
            </Link>
          )}
        </Panel>
        <Panel title="협업 진행">
          <Tag>{requestStatus(r)}</Tag>
          {r.status === 'pending' && !isExpired(r) && (
            <div className="stack">
              {receiver ? (
                <>
                  <Button
                    onClick={() =>
                      act({
                        type: 'requestStatus',
                        id: r.id,
                        status: 'negotiating',
                      })
                    }
                  >
                    협의 요청 수락
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act({
                        type: 'requestStatus',
                        id: r.id,
                        status: 'rejected',
                      })
                    }
                  >
                    제안 거절
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() =>
                    act({
                      type: 'requestStatus',
                      id: r.id,
                      status: 'withdrawn',
                    })
                  }
                >
                  요청 철회
                </Button>
              )}
            </div>
          )}
          <ActionLink to={`/workspace/${r.id}`} secondary>
            대화 · 작업 공간 열기
          </ActionLink>
        </Panel>
      </div>
    </>
  );
}
export function Workspace() {
  const { requestId } = useParams();
  const { state } = useDemo();
  const [tab, setTab] = useState('조건 합의');
  const r = state.requests.find((r) => r.id === requestId);
  if (!r) return <Empty title="작업 공간을 찾을 수 없어요" />;
  return (
    <>
      <Heading
        eyebrow={`WORKSPACE / ${r.source}`}
        title={r.title}
        description="대화에서 합의까지, 모든 작업을 한곳에서."
        action={<Tag>{requestStatus(r)}</Tag>}
      />
      <div className="workflow-steps">
        {['협의', '계약', '결제 · 준비', '제작 · 검토', '최종 수령'].map(
          (step, i) => (
            <span
              key={step}
              className={
                i === 0 ||
                (i === 1 && r.contract) ||
                (i === 2 && r.payment === 'paid') ||
                (i === 3 && r.deadline) ||
                (i === 4 && r.received)
                  ? 'done'
                  : ''
              }
            >
              <i>{i === 0 ? <Check size={12} /> : i + 1}</i>
              {step}
            </span>
          ),
        )}
      </div>
      <div className="workspace-grid">
        <Chat r={r} />
        <div className="workspace-main">
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="작업 공간 섹션"
            onKeyDown={(event) => {
              const tabs = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              );
              const index = tabs.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                tabs[next].focus();
                tabs[next].click();
              }
            }}
          >
            {[
              '조건 합의',
              '결제 · 제작 준비',
              '납품 · 검토',
              '정산 · 리뷰',
            ].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                tabIndex={tab === t ? 0 : -1}
                id={`workspace-tab-${encodeURIComponent(t)}`}
                aria-controls="workspace-panel"
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            id="workspace-panel"
            role="tabpanel"
            aria-labelledby={`workspace-tab-${encodeURIComponent(tab)}`}
          >
            {tab === '조건 합의' ? (
              <TermsPanel r={r} />
            ) : tab === '결제 · 제작 준비' ? (
              <Fulfillment r={r} mode="ready" />
            ) : tab === '납품 · 검토' ? (
              <Fulfillment r={r} mode="delivery" />
            ) : (
              <>
                <Settlement r={r} />
                <Review r={r} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
function Chat({ r }: { r: Request }) {
  const { role, act } = useDemo();
  const [message, setMessage] = useState('');
  const [fail, setFail] = useState(false);
  const [attachment, setAttachment] = useState('');
  const readonly =
    ['closed', 'rejected', 'withdrawn'].includes(r.status) || r.cancelled;
  return (
    <Panel className="chat-panel">
      <div className="chat-heading">
        <span className="avatar">M</span>
        <div>
          <h2>프로젝트 대화</h2>
          <span className="muted">
            {readonly
              ? '읽기 전용 · 이전 기록 유지'
              : '시연 의뢰인 ↔ 시연 제작자'}
          </span>
        </div>
        <span className="green-dot" />
      </div>
      <div className="chat-messages" role="log" aria-label="프로젝트 메시지">
        <p className="chat-system">
          함께 좋은 이야기를 만들어보세요.
          <br />
          채팅 동의는 정식 서명·납기 승인·수령 확인을 대신하지 않습니다.
        </p>
        {r.messages.map((m) => (
          <div
            key={m.id}
            className={`chat-message ${m.role === role ? 'mine' : ''}`}
          >
            <span>
              {m.role === 'client' ? '의뢰인' : '제작자'} ·{' '}
              {new Date(m.at).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <p>
              {m.text}
              {m.attachment && (
                <small>첨부: {m.attachment} (파일명 시연)</small>
              )}
            </p>
            {m.failed && (
              <div className="inline">
                <span className="error-text">전송 실패</span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    act({ type: 'retry', id: r.id, messageId: m.id })
                  }
                >
                  재시도
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            act({ type: 'message', id: r.id, text: message, attachment, fail })
          ) {
            setMessage('');
            setAttachment('');
            e.currentTarget.reset();
          }
        }}
      >
        <textarea
          aria-label="대화 메시지"
          disabled={readonly}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            readonly ? '종료된 대화입니다' : '메시지를 입력해 주세요'
          }
        />
        <div className="inline spread">
          <label className="attachment-control">
            + 첨부
            <input
              aria-label="대화 첨부"
              type="file"
              disabled={readonly}
              onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? '')}
            />
          </label>
          <button
            type="submit"
            className="send-button"
            disabled={readonly || (!message.trim() && !attachment)}
            aria-label="메시지 보내기"
          >
            <Send size={17} />
          </button>
        </div>
        {attachment && <small>{attachment}</small>}
        <label className="check-label muted">
          <input
            type="checkbox"
            disabled={readonly}
            checked={fail}
            onChange={(e) => setFail(e.target.checked)}
          />
          전송 실패 시연
        </label>
      </form>
    </Panel>
  );
}
function TermsPanel({ r }: { r: Request }) {
  const { role, act } = useDemo();
  const t = r.terms.at(-1);
  const [edit, setEdit] = useState(false);
  const [version, setVersion] = useState('latest');
  const selected =
    version === 'latest'
      ? t
      : r.terms.find((t) => t.version === Number(version));
  const now = useClock();
  const expired = !!t?.requestedAt && now >= t.requestedAt + 48 * 3600000;
  return (
    <div className="stack">
      <Panel title={r.contract ? '양측 서명으로 확정된 계약' : '최종 조건서'}>
        <div className="inline spread">
          <Tag>
            {r.contract
              ? '계약 확정'
              : t?.signatures.length === 1
                ? '첫 서명 · 아직 미선정'
                : '조건 협의'}
          </Tag>
          {r.terms.length > 0 && (
            <select
              aria-label="조건서 버전"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              <option value="latest">최신 버전 v{t?.version}</option>
              {r.terms.slice(0, -1).map((t) => (
                <option value={t.version} key={t.version}>
                  이전 버전 v{t.version}
                </option>
              ))}
            </select>
          )}
        </div>
        {selected ? (
          <>
            <h3>조건서 v{selected.version}</h3>
            <p className="pre-wrap">{selected.scope}</p>
            <dl className="definition">
              <dt>계약 금액</dt>
              <dd>{money(selected.amount)}</dd>
              <dt>제작 기간</dt>
              <dd>{selected.days}일 · 실제 기산 정책은 미확정</dd>
              <dt>일반 수정</dt>
              <dd>{selected.revisions}회</dd>
              <dt>서명</dt>
              <dd>
                {selected.signatures
                  .map((s) => (s === 'client' ? '의뢰인' : '제작자'))
                  .join(' · ') || '아직 서명 없음'}
              </dd>
            </dl>
            {selected.requestedAt && (
              <Notice>
                <Clock size={14} /> 확인 요청 만료:{' '}
                {new Date(selected.requestedAt + 48 * 3600000).toLocaleString(
                  'ko-KR',
                )}
                . 만료되어도 대화는 유지됩니다.
              </Notice>
            )}
          </>
        ) : (
          <Empty
            title="합의할 조건을 정리해 주세요"
            description="범위, 금액, 제작 기간, 수정 횟수를 양측이 확인합니다."
          />
        )}
        {!r.contract && r.status === 'negotiating' && (
          <div className="inline">
            <Button
              variant="secondary"
              onClick={() => {
                setEdit(!edit);
                setVersion('latest');
              }}
            >
              {edit ? '작성 닫기' : t ? '새 버전 작성' : '조건서 작성'}
            </Button>
            {t && !t.requestedAt && (
              <Button
                onClick={() => act({ type: 'requestSignature', id: r.id })}
              >
                48시간 확인 요청
              </Button>
            )}
            {t?.requestedAt && !expired && version === 'latest' && (
              <Button
                disabled={t.signatures.includes(
                  role === 'creator' ? 'creator' : 'client',
                )}
                onClick={() => act({ type: 'sign', id: r.id })}
              >
                현재 역할로 v{t.version} 서명
              </Button>
            )}
          </div>
        )}
        {r.contract && (
          <Notice>
            동일한 버전의 양측 서명이 완료되었습니다. 이 방과 이전 기록은 계속
            유지됩니다.
          </Notice>
        )}
      </Panel>
      {edit && !r.contract && (
        <Panel title="새 조건 버전 작성">
          <Form
            onSubmit={(d) => {
              if (
                act({
                  type: 'terms',
                  id: r.id,
                  scope: str(d, 'scope'),
                  amount: num(d, 'amount'),
                  days: num(d, 'days'),
                  revisions: num(d, 'revisions'),
                })
              ) {
                setEdit(false);
                toast.success(
                  '이전 서명을 재사용하지 않는 새 버전을 저장했어요.',
                );
              }
            }}
          >
            <Field label="제작 범위 및 필수 산출물">
              <textarea
                name="scope"
                required
                defaultValue={t?.scope}
                rows={4}
              />
            </Field>
            <Field label="계약 금액 (원)">
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={t?.amount ?? 200000}
              />
            </Field>
            <div className="form-row">
              <Field label="제작 기간 (일)">
                <input
                  name="days"
                  type="number"
                  min="1"
                  required
                  defaultValue={t?.days ?? 7}
                />
              </Field>
              <Field label="일반 수정 횟수">
                <input
                  name="revisions"
                  type="number"
                  min="0"
                  required
                  defaultValue={t?.revisions ?? 2}
                />
              </Field>
            </div>
            <Button type="submit">새 조건서 저장</Button>
          </Form>
        </Panel>
      )}
      <Panel title="거래 관리">
        <div className="inline">
          <ActionLink to={`/contracts/${r.id}/cancellation`} secondary>
            취소 · 부분 환불 협의
          </ActionLink>
          <ActionLink to={`/disputes/${r.id}`} secondary>
            문제 신고 · 증빙 제출
          </ActionLink>
          {!r.contract && r.status === 'negotiating' && (
            <Button
              variant="ghost"
              onClick={() =>
                act({ type: 'requestStatus', id: r.id, status: 'closed' })
              }
            >
              협의 종료 · 읽기 전용 전환
            </Button>
          )}
        </div>
        <Notice>
          서명 방식 D08과 기산일 D09 등 PDF의 미결정 항목은 실제 서비스 정책으로
          확정하지 않았습니다.
        </Notice>
      </Panel>
    </div>
  );
}
export function Countdown({ deadline }: { deadline: number }) {
  const now = useClock();
  const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
  return (
    <div className="countdown">
      <span>{seconds ? '납기까지 남은 시간' : '납기가 지났어요'}</span>
      <strong>
        {Math.floor(seconds / 86400)}
        <small>일</small>{' '}
        {String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:
        {String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:
        {String(seconds % 60).padStart(2, '0')}
      </strong>
      <span>{new Date(deadline).toLocaleString('ko-KR')}</span>
    </div>
  );
}
export function EvidenceForm({ r }: { r: Request }) {
  const { act } = useDemo();
  return (
    <Form
      onSubmit={(d) => {
        const evidence = `${str(d, 'evidence')}${attachmentName(d) ? ` · 증빙 파일명: ${attachmentName(d)}` : ''}`;
        if (act({ type: 'dispute', id: r.id, evidence }))
          toast.success('시연 증빙을 기록하고 정산을 보류했어요.');
      }}
    >
      <Field label="문제 내용과 증빙 설명">
        <textarea name="evidence" rows={4} required />
      </Field>
      <FileName />
      <Button type="submit">신고 · 증빙 기록</Button>
    </Form>
  );
}
