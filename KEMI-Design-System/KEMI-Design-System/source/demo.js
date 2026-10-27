// Local document examples only. No network requests or product-state mutations.
const navFold = document.getElementById('ds-nav-fold');
const desktopNav = matchMedia('(min-width:1024px)');
const updateNav = () => { navFold.open = desktopNav.matches; };
updateNav();
desktopNav.addEventListener('change', updateNav);
document.querySelectorAll('[data-ds-action]').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById('ds-action-feedback').textContent = `${button.textContent.trim()} 버튼 예시입니다. 실제 전송·삭제는 실행되지 않았어요.`;
  });
});
const demoForm = document.getElementById('ds-form');
demoForm.addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('ds-purpose');
  const invalid = !input.value.trim();
  input.setAttribute('aria-invalid', String(invalid));
  document.getElementById('ds-purpose-error').hidden = !invalid;
  document.getElementById('ds-form-result').textContent = invalid ? '' : '입력을 확인했어요. 문서 시연이며 실제 문의는 전송하지 않았어요.';
  if (invalid) input.focus();
});
document.getElementById('ds-purpose').addEventListener('input', event => {
  if (event.target.value.trim()) {
    event.target.setAttribute('aria-invalid', 'false');
    document.getElementById('ds-purpose-error').hidden = true;
  }
  document.getElementById('ds-form-result').textContent = '';
});
const modeSelect = document.getElementById('ds-list-mode');
const stateExamples = {
  loading: '<strong>작품을 불러오고 있어요</strong><p>선택한 조건과 작성 내용은 유지합니다. 처리 중인 요청의 중복 실행을 막습니다.</p>',
  result: '<strong>선택한 조건에 맞는 작품이 있어요</strong><p>작품 카드 → 상세 보기 → 저장. 저장과 문의 선택은 별도 행동입니다.</p>',
  empty: '<strong>조건에 맞는 작품이 없어요</strong><p>조건을 바꾸거나 전체 작품을 둘러보세요.</p><button class="btn btn--secondary" type="button" data-ds-recover>전체 탐색 예시 보기</button>',
  error: '<strong>작품을 불러오지 못했어요</strong><p>검색 조건은 유지했어요. 연결을 확인하고 다시 시도해 주세요.</p><button class="btn btn--secondary" type="button" data-ds-recover>재시도 예시 보기</button>',
  partial: '<strong>제작자 A · 전송 성공 / 제작자 B · 전송 실패</strong><p>성공한 문의는 유지합니다. 실패한 대상만 다시 시도하고 중복 전송을 방지합니다.</p><button class="btn btn--secondary" type="button" data-ds-recover>실패 대상 재시도 예시 보기</button>'
};
function showStateExample() {
  document.getElementById('ds-list-example').innerHTML = stateExamples[modeSelect.value];
}
modeSelect.addEventListener('change', showStateExample);
document.getElementById('ds-list-example').addEventListener('click', event => {
  if (!event.target.closest('[data-ds-recover]')) return;
  modeSelect.value = 'result';
  showStateExample();
});
showStateExample();
