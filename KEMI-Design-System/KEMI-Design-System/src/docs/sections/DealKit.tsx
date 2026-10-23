import { CreatorMatchCard, DealNextAction, DealTimeline, DeliveryReview, OfferCard, PaymentSummary, useToast } from "../../components";
import { poster, productionSteps } from "../fixtures";
import { Note, Section, Sub, Table, Tag } from "../ui";

export function DealKit() {
  const toast = useToast();
  return (
    <>
      <Section id="license" title="LicenseSelector · RightsDisclosure · PaymentSummary" lead={<>광고 사용 범위(어디에, 얼마나)와 실제 포함 권리(음악·출연자·편집)를 분리해서 보여줍니다. 실제 화면 조합은 아래 <a href="#pattern-detail">영상 상세 패턴</a>에서 확인할 수 있습니다.</>}>
        <Table head={["컴포넌트", "상태", "데이터 계약 / 규칙"]} rows={[
          ["LicenseSelector", "선택 / 협의 / 계약 조건 확정", <><span className="code-ref">groups · value · onChange</span> — 필드: mediaChannels · territories · duration · exclusivity · modificationAllowed · thirdPartyRights · resaleAllowed · effectiveDate · licenseVersion. 가격이 달라지는 선택지는 라디오 카드, 기간은 “6개월 · 종료일”로 표기(<code>formatLicensePeriod</code>).</>],
          ["RightsDisclosure", "collapsed / expanded / acknowledged", <><span className="code-ref">permissions · restrictions · acknowledged</span> — 결제 전 “확인했습니다” 체크 필수. 음악·초상권·상표는 “확보됨 / 별도 확인 필요”로 표기.</>],
          ["PaymentSummary", "pending / paid / refunded / failed", <><span className="code-ref">lines · total · status · note</span> — 결제 버튼 위에 항상 총액. 수수료는 별도 줄로 표기해 숨은 비용을 없앰.</>],
        ]} />
        <div className="doc-grid doc-grid--3" style={{ marginTop: "var(--space-6)" }}>
          {(["paid", "refunded", "failed"] as const).map((s) => (
            <div key={s} className="card">
              <PaymentSummary status={s} lines={[{ label: "라이선스 (비독점 · 6개월)", value: "₩450,000" }, { label: "플랫폼 수수료", value: "₩45,000" }, { label: "부가세", value: "₩49,500" }]} total="₩544,500"
                note={s === "failed" ? "결제가 승인되지 않았어요. 카드 한도를 확인하거나 다른 결제수단을 선택해 주세요." : undefined} />
            </div>
          ))}
        </div>
      </Section>

      <Section id="deal" title={<>CreatorMatchCard · OfferCard <span className="badge badge--creative" style={{ verticalAlign: "middle" }}>P1</span></>}
        lead="제작자 매칭 확장 경로입니다. 추천 이유는 확인 가능한 사실 문장으로 쓰고, “적합도 92%” 같은 근거 없는 수치는 쓰지 않습니다.">
        <div className="doc-grid doc-grid--3">
          <CreatorMatchCard name="스튜디오 하늘" subtitle="서울 · 뷰티 · 라이프스타일" avatarUrl={poster(3)} portfolio={[poster(0), poster(5), poster(1)]}
            rating={4.8} completedCount={42} availability={{ status: "available" }}
            matchReasons={["보고 계신 영상과 같은 9:16 언박싱 스타일", "최근 3개월 뷰티 카테고리 납품 8건"]}
            onRequest={() => toast({ message: "제작 의뢰서를 열었어요." })} onPortfolio={() => {}}
            onSave={() => toast({ message: "저장 목록에 추가했어요.", tone: "success" })} onBlock={() => toast({ message: "이 제작자를 추천에서 숨겼어요." })} />
          <CreatorMatchCard name="김하늘" subtitle="부산 · 앱 설치 · 게임" avatarUrl={poster(2)} portfolio={[poster(4), poster(2), poster(1)]}
            rating={5} completedCount={3} availability={{ status: "waitlist", label: "대기 2주" }}
            matchReasons={["앱 설치 유도 영상 포트폴리오 보유"]} onRequest={() => {}} onPortfolio={() => {}} onSave={() => {}} />
          <div className="doc-grid">
            <OfferCard state="pending" price="₩1,200,000" deadline="마감 10/24" terms={["15초 세로 영상 2편", "수정 2회 포함 · 납품 14일"]}
              onAccept={() => toast({ message: "제안을 수락했어요. 계약 단계로 넘어가요.", tone: "success" })} onNegotiate={() => {}} />
            <OfferCard state="accepted" price="₩800,000" deadline="10/18 수락" terms={["30초 가로 영상 1편"]} />
            <OfferCard state="expired" price="₩900,000" deadline="마감 10/12" terms={[]} />
          </div>
        </div>
        <Table head={["Props", "규칙"]} rows={[
          [<code>rating · completedCount</code>, <>평점은 반드시 완료 건수와 같이. 완료 <code>MIN_COMPLETED_FOR_RATING</code>(5)건 미만이면 “평점 없음” — 두 번째 카드는 평점 5.0이지만 3건이라 숨김</>],
          [<code>matchReasons</code>, "최대 2개. 사실 문장만(“F&B 제작 32건”). 점수·퍼센트 금지"],
          [<code>availability</code>, <><code>available</code> · <code>waitlist(label)</code> · <code>paused(label)</code> — paused는 “일정 알림 받기”로 대체</>],
          [<code>onSave · onBlock</code>, "“⋯” 메뉴 (Insense 목록 관리 패턴)"],
          [<code>OfferCard state</code>, "pending · accepted · declined · expired. 제안함은 일반 메시지와 분리 (Instagram 관찰)"],
        ]} />
      </Section>

      <Section id="timeline" title="DealTimeline · DealNextAction · DeliveryReview" lead="거래 상태는 색만으로 구분하지 않고 항상 라벨을 붙이고, 현재 단계에서 누가·무엇을·언제까지 해야 하는지 함께 보여줍니다.">
        <Sub small="horizontal — 거래 상세 상단 요약">제작 의뢰 흐름</Sub>
        <div className="card">
          <DealTimeline orientation="horizontal" steps={productionSteps} />
        </div>
        <div style={{ marginTop: "var(--space-3)" }}>
          <DealNextAction status="active" stageLabel="제작 중" nextActor="제작자" nextAction="1차 영상 업로드" dueDate="2026-10-27" daysLeft={7}
            escrowNotice="결제 금액 ₩1,200,000은 검수 승인 전까지 플랫폼이 보관합니다." />
        </div>

        <Sub small="vertical — active / blocked / complete">단계 상세</Sub>
        <div className="doc-grid doc-grid--2">
          <div className="card">
            <DealTimeline steps={[
              { id: "1", title: "브리프 전달", meta: "광고주 · 10/14", status: "done" },
              { id: "2", title: "제안 수락 · 계약 체결", meta: "계약 v1.2 스냅샷 저장 · 10/16", status: "done" },
              { id: "3", title: "1차 납품 검수 중", meta: "광고주 검수 마감 10/22", status: "active" },
              { id: "4", title: "최종 승인 · 정산", meta: "예정", status: "todo" },
            ]} />
          </div>
          <div className="doc-grid" style={{ alignContent: "start" }}>
            <div className="card">
              <DealTimeline steps={[
                { id: "1", title: "결제 완료", meta: "10/18", status: "done" },
                { id: "2", title: "권리 증빙 보완 필요", meta: "배경음악 라이선스 확인 요청 · 공급자 응답 대기", status: "blocked" },
                { id: "3", title: "원본 파일 전달", meta: "대기", status: "todo" },
              ]} />
            </div>
            <DealNextAction status="blocked" stageLabel="확인 필요" nextActor="공급자" nextAction="배경음악 라이선스 제출" dueDate="2026-10-22" daysLeft={2} />
            <DealNextAction status="disputed" stageLabel="분쟁" nextActor="플랫폼" nextAction="중재 결과 안내" dueDate="2026-10-25" daysLeft={5}
              escrowNotice="분쟁이 끝날 때까지 결제 금액은 플랫폼이 보관합니다." />
          </div>
        </div>

        <Sub small="승인 / 수정 요청(남은 횟수) / 거절">DeliveryReview</Sub>
        <div className="doc-grid doc-grid--2">
          <DeliveryReview version="v2" submittedAt="10/21 14:20" remainingRevisions={2}
            onApprove={() => toast({ message: "v2를 최종본으로 승인했어요. 정산이 시작돼요.", tone: "success" })}
            onRequestRevision={(n) => toast({ message: `수정 요청을 보냈어요: ${n}` })}
            onReject={() => toast({ message: "거절했어요. 분쟁 절차 안내를 보내드렸어요.", tone: "error" })} />
          <DeliveryReview version="v3" submittedAt="10/25 09:10" remainingRevisions={0} onApprove={() => {}} onRequestRevision={() => {}} onReject={() => {}} />
        </div>
        <ul className="doc-list">
          <li><Tag kind="obs" />Billo는 수정 최대 2회를 사전에 고지합니다. 수정 요청 버튼 라벨에 남은 횟수를 표시하고, 0회면 비활성화합니다.</li>
          <li>수정 요청·거절은 내용 입력이 필수입니다. 거절은 분쟁 절차 안내로 이어집니다.</li>
          <li>버전(v1, v2…)별로 타임코드 댓글을 남기고, 승인한 버전이 최종 납품본으로 고정됩니다.</li>
        </ul>
        <Note><code>URGENT_DAYS</code>(3일) 이하로 남으면 기한을 경고색으로 표시합니다. <Tag kind="asm" />임박 기준은 운영하면서 조정합니다.</Note>
      </Section>
    </>
  );
}
