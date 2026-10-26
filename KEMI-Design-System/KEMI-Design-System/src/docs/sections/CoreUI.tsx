import { useState } from "react";
import { Badge, Button, Checkbox, Chip, EmptyState, Field, Icon, InfoTip, Input, Modal, OverflowMenu, SegmentedControl, Select, Tabs, Textarea, useToast } from "../../components";
import { Note, Section, Sub, Table } from "../ui";

export function CoreUI() {
  const toast = useToast();
  const [sort, setSort] = useState("recommend");
  const [tab, setTab] = useState("progress");
  const [seg, setSeg] = useState("assets");
  const [modal, setModal] = useState(false);

  return (
    <Section id="core" title="Core UI" lead={<>Button, Field, Chip, Badge, Tabs, InfoTip, OverflowMenu, Toast, EmptyState, Modal. 모든 인터랙티브 요소는 키보드 포커스 링(2px <code>focus/ring</code>)을 보여줍니다.</>}>
      <Sub small="primary / secondary / ghost / danger · sm / md / lg · icon · disabled · loading">Button</Sub>
      <div className="doc-demo">
        <div className="doc-row">
          <Button size="lg">구매하기</Button>
          <Button>제작 의뢰</Button>
          <Button variant="secondary">장바구니</Button>
          <Button variant="ghost">미리보기</Button>
          <Button variant="danger">거래 취소</Button>
          <Button size="sm">적용</Button>
          <Button iconOnly variant="secondary" aria-label="저장"><Icon name="bookmark" /></Button>
          <Button disabled>구매 불가</Button>
          <Button loading>결제 중</Button>
        </div>
      </div>
      <Table head={["Props", "값", "규칙"]} rows={[
        [<code>variant</code>, "primary · secondary · ghost · danger", "primary는 화면당 1개. danger는 되돌릴 수 없는 행동(거래 취소·거절 확정)에만."],
        [<code>size</code>, "sm 36 · md 44 · lg 52px", "모바일 주요 CTA는 lg + block. sm은 데스크톱 표·툴바 전용(터치 대상 44px 미만)."],
        [<code>loading</code>, "boolean", "aria-busy + 스피너, 라벨은 진행형으로(“결제 중”)."],
        [<code>iconOnly</code>, "boolean", <>타입에서 <code>aria-label</code>이 필수가 됩니다.</>],
      ]} />

      <Sub>Field · Input · Select · Textarea · Checkbox</Sub>
      <div className="doc-demo">
        <div className="doc-grid doc-grid--3">
          <Field label="브랜드명" hint="계약서에 표시됩니다">{(c) => <Input {...c} placeholder="예: 클리어모션" />}</Field>
          <Field label="예산 (원)" error="최소 ₩100,000부터 의뢰할 수 있어요. 금액을 다시 입력해 주세요.">{(c) => <Input {...c} defaultValue="50,000" />}</Field>
          <Field label="영상 비율">{(c) => <Select {...c}><option>9:16 세로</option><option>1:1 정방형</option><option>16:9 가로</option></Select>}</Field>
        </div>
        <div className="doc-grid doc-grid--2" style={{ marginTop: "var(--space-4)" }}>
          <Field label="브리프" hint="타깃·톤·필수 문구를 적어 주세요">{(c) => <Textarea {...c} placeholder="예: 20대 여성, 산뜻한 톤, 마지막 2초 로고" />}</Field>
          <div className="doc-grid" style={{ alignContent: "start", paddingTop: 28 }}>
            <Checkbox label="2차 편집 허용" defaultChecked />
            <Checkbox label="해외 사용 가능" />
          </div>
        </div>
        <p className="code-ref" style={{ marginTop: "var(--space-4)" }}>{"<Field label hint error>{(control) => <Input {...control} />}</Field>"} — id·aria-describedby·aria-invalid를 자동 연결</p>
      </div>

      <Sub>Chip · Badge</Sub>
      <div className="doc-demo">
        <div className="doc-row">
          {[["recommend", "추천순"], ["new", "최신순"], ["price", "낮은 가격순"]].map(([v, l]) => (
            <Chip key={v} pressed={sort === v} onClick={() => setSort(v)}>{l}</Chip>
          ))}
          <Chip removable className="chip--applied">SNS</Chip>
        </div>
        <div className="doc-row" style={{ marginTop: "var(--space-4)" }}>
          <Badge>비독점</Badge>
          <Badge tone="primary">즉시 구매</Badge>
          <Badge tone="success">● 거래 가능</Badge>
          <Badge tone="warning">● 협의 필요</Badge>
          <Badge tone="danger">● 판매 중지</Badge>
          <Badge tone="creative">추천</Badge>
        </div>
        <Note>“인증”, “안전 거래” 같은 배지는 검증 절차가 정해지기 전까지 쓰지 않습니다.</Note>
      </div>

      <Sub small="알약형 · 선택 = text/primary 배경">Tabs · SegmentedControl</Sub>
      <div className="doc-demo">
        <div className="doc-grid doc-grid--2">
          <div>
            <Tabs aria-label="거래 상태" value={tab} onChange={setTab} items={[
              { value: "progress", label: "진행 중", count: 3 }, { value: "review", label: "검수 대기", count: 1 },
              { value: "done", label: "완료", count: 12 }, { value: "dispute", label: "분쟁", count: 0, disabled: true },
            ]} />
            <p className="code-ref">Tabs — 화면 영역 전환. role=tablist, ←/→/Home/End</p>
          </div>
          <div>
            <SegmentedControl aria-label="검색 대상" value={seg} onChange={setSeg} items={[{ value: "assets", label: "완성 소재" }, { value: "creators", label: "제작자" }]} />
            <p className="code-ref">SegmentedControl — 값 하나 선택. 네이티브 라디오</p>
          </div>
        </div>
      </div>

      <Sub>InfoTip · OverflowMenu</Sub>
      <div className="doc-demo">
        <div className="doc-row">
          <span className="text-label-md">독점 협의 가능</span>
          <InfoTip label="독점 협의 가능 기준">판매 이력과 무관하게 독점 계약을 받는 소재입니다. 기존 판매 건수는 상세에서 보여줍니다.</InfoTip>
          <span style={{ marginLeft: "auto" }} />
          <OverflowMenu label="소재 더보기" items={[
            { label: "저장 목록에 추가", onSelect: () => toast({ message: "저장 목록에 추가했어요.", tone: "success" }) },
            { label: "유사 소재 보기", onSelect: () => toast({ message: "유사 소재를 찾고 있어요." }) },
            { label: "신고하기", onSelect: () => toast({ message: "신고가 접수됐어요.", tone: "info" }), danger: true },
          ]} />
        </div>
        <Note>신뢰 표시는 기준과 함께 — 배지·필터 항목의 판단 기준은 InfoTip으로 공개합니다. “⋯” 메뉴는 터치 기기에서 hover 행동을 대신하고, ↑/↓/Esc로 조작합니다.</Note>
      </div>

      <Sub small="info · success · error · 4초, 행동 버튼이 있으면 8초">Toast</Sub>
      <div className="doc-demo">
        <div className="doc-row">
          <Button variant="secondary" onClick={() => toast({ message: "검색 조건을 저장했어요." })}>info</Button>
          <Button variant="secondary" onClick={() => toast({ message: "결제가 완료됐어요.", tone: "success" })}>success</Button>
          <Button variant="secondary" onClick={() => toast({ message: "결제가 승인되지 않았어요. 카드 한도를 확인해 주세요.", tone: "error" })}>error</Button>
          <Button variant="secondary" onClick={() => toast({ message: "비교 목록에서 뺐어요.", action: { label: "되돌리기", onClick: () => toast({ message: "다시 담았어요." }) } })}>action</Button>
        </div>
        <p className="code-ref">{"<ToastProvider>로 앱을 감싸고 useToast()로 호출"}</p>
      </div>

      <Sub>EmptyState</Sub>
      <EmptyState title="조건에 맞는 소재가 없어요" description="필터를 줄여 보거나, 지금 조건 그대로 제작자에게 의뢰할 수 있어요."
        actions={<><Button>이 조건으로 제작 의뢰하기</Button><Button variant="secondary">필터 초기화</Button></>} />

      <Sub small="dialog · sheet(모바일 바텀시트)">Modal</Sub>
      <div className="doc-demo">
        <Button variant="secondary" onClick={() => setModal(true)}>모달 열기</Button>
        <Modal open={modal} onClose={() => setModal(false)} title="라이선스 조건을 확정할까요?"
          actions={<><Button variant="secondary" onClick={() => setModal(false)}>취소</Button><Button onClick={() => setModal(false)}>확정하기</Button></>}>
          결제 시점의 조건이 계약 스냅샷으로 저장됩니다. 확정 후 조건을 바꾸려면 새로 협의해야 합니다.
        </Modal>
      </div>
    </Section>
  );
}
