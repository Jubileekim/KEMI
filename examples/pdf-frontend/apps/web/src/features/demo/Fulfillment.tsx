import { str, attachmentName } from './helpers';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDemo } from './context';
import {
  usedRounds,
  type Request,
  type Delivery,
  type Revision,
} from './model';
import {
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
import { Countdown } from './Workspace';
export function Fulfillment({
  r,
  mode,
}: {
  r: Request;
  mode: 'ready' | 'delivery';
}) {
  if (!r.contract)
    return (
      <Panel>
        <Empty
          title="계약 확정 후 이용할 수 있어요"
          description="동일 버전 조건서에 양측이 서명해 주세요."
        />
      </Panel>
    );
  return mode === 'ready' ? <Preparation r={r} /> : <Deliveries r={r} />;
}
function Preparation({ r }: { r: Request }) {
  const { role, act } = useDemo();
  const blocked = r.hold || !!r.cancellation || r.cancelled;
  const status = {
    missing: '필수 자료 누락',
    provided: '파일 제공 완료 · 제작자 확인 대기',
    shipped: '제품 발송 완료 · 정상 수령 미확인',
    received: '작업 가능한 정상 수령 확인',
    problem: '자료 문제 신고',
  }[r.material];
  return (
    <div className="stack">
      <Panel title="결제와 제작 시작 조건">
        <div className="readiness">
          <p>
            <Tag tone={r.payment === 'paid' ? '' : 'neutral'}>
              {r.payment === 'paid' ? '완료' : '대기'}
            </Tag>
            계약 전액 테스트 결제
          </p>
          <p>
            <Tag tone={r.material === 'received' ? '' : 'neutral'}>
              {r.material === 'received' ? '완료' : '대기'}
            </Tag>
            필수 자료 정상 수령
          </p>
          <p>
            <Tag tone={blocked ? 'warning' : ''}>
              {blocked ? '보류' : '확인'}
            </Tag>
            취소 · 분쟁 보류 상태
          </p>
        </div>
        <ActionLink to={`/contracts/${r.id}/payment`} secondary>
          테스트 결제 내역 보기
        </ActionLink>
        <Notice>
          PG가 미연결된 로컬 시연입니다. 브라우저 성공 화면 방문만으로 결제
          완료가 되지 않습니다.
        </Notice>
      </Panel>
      <Panel title="제품 · 필수 파일 준비">
        <Tag>{status}</Tag>
        {r.materialNote && <p>{r.materialNote}</p>}
        {!r.deadline && (
          <Form
            onSubmit={(d) => {
              if (
                act({
                  type: 'material',
                  id: r.id,
                  mode: str(d, 'mode') as Request['materialMode'],
                  status: str(d, 'status') as Request['material'],
                  note: str(d, 'note'),
                })
              )
                toast.success('준비 상태를 기록했어요.');
            }}
          >
            <Field label="필수 자료 방식">
              <select name="mode" defaultValue={r.materialMode}>
                <option value="files">파일 제공</option>
                <option value="product">제품 발송</option>
              </select>
            </Field>
            <Field label="처리 상태">
              <select name="status" key={role}>
                {role === 'client' ? (
                  <>
                    <option value="provided">파일 제공 기록</option>
                    <option value="shipped">제품 발송 기록</option>
                    <option value="missing">필수 자료 누락</option>
                  </>
                ) : (
                  <>
                    <option value="received">작업 가능한 정상 수령 확인</option>
                    <option value="problem">누락 · 문제 신고</option>
                  </>
                )}
              </select>
            </Field>
            <Field label="발송 · 파일 정보 또는 문제 설명">
              <textarea
                name="note"
                defaultValue={r.materialNote}
                placeholder="시연용 정보만 입력해 주세요"
              />
            </Field>
            <Button type="submit" disabled={blocked}>
              준비 상태 저장
            </Button>
          </Form>
        )}
      </Panel>
      <Panel title="실제 제작 납기">
        {r.deadline ? (
          <>
            <Countdown deadline={r.deadline} />
            {r.deadlineChange ? (
              <div className="notice">
                <p>
                  변경 요청:{' '}
                  {new Date(r.deadlineChange.next).toLocaleString('ko-KR')}
                </p>
                <p>사유: {r.deadlineChange.reason}</p>
                <p>
                  승인:{' '}
                  {r.deadlineChange.signatures
                    .map((x) => (x === 'client' ? '의뢰인' : '제작자'))
                    .join(', ')}
                </p>
                <Button
                  disabled={
                    blocked ||
                    r.deadlineChange.signatures.includes(
                      role === 'creator' ? 'creator' : 'client',
                    )
                  }
                  onClick={() => act({ type: 'approveDeadline', id: r.id })}
                >
                  상대방 납기 변경 승인
                </Button>
              </div>
            ) : (
              <Form
                onSubmit={(d) => {
                  if (
                    act({
                      type: 'deadline',
                      id: r.id,
                      deadline: new Date(str(d, 'deadline')).getTime(),
                      reason: str(d, 'reason'),
                    })
                  )
                    toast.success(
                      '상대방의 승인을 기다립니다. 기존 납기는 유지돼요.',
                    );
                }}
              >
                <Field label="변경 희망 납기">
                  <input type="datetime-local" name="deadline" required />
                </Field>
                <Field label="변경 사유">
                  <input name="reason" required />
                </Field>
                <Button type="submit" disabled={blocked} variant="secondary">
                  납기 변경 요청
                </Button>
              </Form>
            )}
            {r.deadlineHistory.map((h, i) => (
              <Notice key={i}>{h}</Notice>
            ))}
          </>
        ) : (
          <>
            <Notice>
              D09 기산 규칙이 문서에서 미결정 상태입니다. 자동 계산 대신 시연용
              실제 납기를 직접 지정합니다. 실제 정책 연동이 필요합니다.
            </Notice>
            <Form
              onSubmit={(d) => {
                if (
                  act({
                    type: 'start',
                    id: r.id,
                    deadline: new Date(str(d, 'deadline')).getTime(),
                  })
                )
                  toast.success(
                    '시연 제작을 시작했어요. 납기는 양측 변경 승인 없이 덮어쓸 수 없습니다.',
                  );
              }}
            >
              <Field label="시연용 합의 납기">
                <input type="datetime-local" name="deadline" required />
              </Field>
              <Button
                type="submit"
                disabled={
                  role !== 'creator' ||
                  r.payment !== 'paid' ||
                  r.material !== 'received' ||
                  blocked
                }
              >
                제작 시작 · 납기 기록
              </Button>
            </Form>
          </>
        )}
      </Panel>
    </div>
  );
}
function Deliveries({ r }: { r: Request }) {
  const { role, act } = useDemo();
  const [version, setVersion] = useState('latest');
  const d =
    version === 'latest'
      ? r.deliveries.at(-1)
      : r.deliveries.find((d) => d.id === version);
  const latest = r.deliveries.at(-1);
  const blocked = r.hold || !!r.cancellation || r.cancelled;
  return (
    <div className="stack">
      <Panel title="납품 버전과 검토">
        <div className="inline spread">
          <Tag>
            일반 수정{' '}
            {Math.max(0, (r.contract?.revisions ?? 0) - usedRounds(r))}회 남음
          </Tag>
          <select
            aria-label="납품 버전"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            <option value="latest">최신 버전</option>
            {r.deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                v{d.version} · {d.kind}
              </option>
            ))}
          </select>
        </div>
        {d ? (
          <>
            <video
              key={d.id}
              controls
              src={d.url}
              poster="/art-0.svg"
              className="film-player"
              aria-label={`납품 v${d.version} 시연 영상`}
            />
            <div className="inline spread">
              <h3>
                v{d.version} · {d.kind}
              </h3>
              <Tag tone="neutral">{d.name}</Tag>
            </div>
            <p className="muted">
              정식 제출 {new Date(d.at).toLocaleString('ko-KR')} · 파일 API
              미연결: 내장 시연 영상
            </p>
          </>
        ) : (
          <Empty
            title="아직 제출된 영상이 없어요"
            description="제작을 시작한 뒤 초안과 검토본을 정식 제출해 주세요."
          />
        )}
        {role === 'client' && (
          <div className="inline">
            <Button
              disabled={
                blocked ||
                !latest ||
                !['검토본', '수정본'].includes(latest.kind) ||
                !!r.approved
              }
              onClick={() => act({ type: 'approve', id: r.id })}
            >
              {r.approved ? '검토 승인 완료' : '최신 검토본 승인'}
            </Button>
            {latest?.kind === '최종 파일' && (
              <>
                <a
                  className="p-button secondary"
                  download="kemi-clean-final-sample.webm"
                  href={latest.url}
                >
                  시연 최종 파일 다운로드
                </a>
                <Button
                  disabled={blocked || r.received}
                  onClick={() => act({ type: 'receive', id: r.id })}
                >
                  {r.received ? '최종 수령 확인 완료' : '최종 수령 확인'}
                </Button>
              </>
            )}
          </div>
        )}
        <Notice>
          검토 승인, 다운로드, 최종 수령 확인은 별개입니다. 검토 승인만으로
          정산되지 않습니다.
        </Notice>
      </Panel>
      {role === 'creator' && !r.received && (
        <Panel title="정식 납품 제출">
          <Form
            onSubmit={(data) => {
              if (
                act({
                  type: 'delivery',
                  id: r.id,
                  kind: str(data, 'kind') as Delivery['kind'],
                  name: attachmentName(data) || str(data, 'filename'),
                })
              ) {
                setVersion('latest');
                toast.success('내장 시연 영상으로 납품 버전을 기록했어요.');
              }
            }}
          >
            <Field label="납품 종류">
              <select name="kind">
                {['초안', '검토본', '수정본', '최종 파일'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="시연 파일 이름">
              <input
                name="filename"
                required
                defaultValue="brand-film-v1.webm"
              />
            </Field>
            <FileName label="파일 선택 (업로드 미연결 · 파일명만 사용)" />
            <Notice>
              일반 회차는 수정 요청 시가 아닌 수정본 정식 제출 시 한 번
              차감됩니다.
            </Notice>
            <Button type="submit" disabled={blocked || !r.deadline}>
              정식 제출하기
            </Button>
          </Form>
        </Panel>
      )}
      {role === 'client' &&
        latest &&
        !r.approved &&
        latest.kind !== '최종 파일' && (
          <Panel title="수정 체크리스트">
            <Form
              onSubmit={(data) => {
                if (
                  act({
                    type: 'revision',
                    id: r.id,
                    deliveryId: latest.id,
                    kind: str(data, 'kind') as Revision['kind'],
                    time: str(data, 'time'),
                    problem: str(data, 'problem'),
                    change: str(data, 'change'),
                    attachment: attachmentName(data),
                  })
                )
                  toast.success('대상 버전에 수정 요청을 연결했어요.');
              }}
            >
              <Tag>
                대상: v{latest.version} · {latest.kind}
              </Tag>
              <Field label="수정 유형">
                <select name="kind" key={latest.kind}>
                  {latest.kind === '초안' ? (
                    <option>초안 의견</option>
                  ) : (
                    <>
                      <option>일반 수정</option>
                      <option>계약 오류 시정</option>
                    </>
                  )}
                </select>
              </Field>
              <Field label="영상 위치">
                <input name="time" placeholder="예: 00:15~00:20" />
              </Field>
              <Field label="현재 문제">
                <textarea name="problem" required rows={3} />
              </Field>
              <Field label="원하는 변경">
                <textarea name="change" required rows={3} />
              </Field>
              <FileName />
              <Button type="submit" disabled={blocked}>
                이 버전에 수정 요청
              </Button>
            </Form>
          </Panel>
        )}
      {r.revisions.length > 0 && (
        <Panel title="수정 이력">
          {r.revisions.map((rev) => (
            <div className="revision-item" key={rev.id}>
              <div className="inline">
                <Tag>{rev.kind}</Tag>
                <Tag tone="neutral">
                  {rev.done ? '수정본 제출 완료' : '수정 대기'}
                </Tag>
              </div>
              <p>
                <strong>{rev.time || '전체 영상'}</strong> · {rev.problem}
              </p>
              <p className="muted">원하는 변경: {rev.change}</p>
              {rev.attachment && <small>첨부 파일명: {rev.attachment}</small>}
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
