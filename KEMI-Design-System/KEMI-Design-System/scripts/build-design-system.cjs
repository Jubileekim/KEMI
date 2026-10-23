// Keep the approved 1.1 board as a baseline; regenerate bounded revisions from editable sources.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const write = (name, content) => fs.writeFileSync(path.join(root, name), content);
const tokens = JSON.parse(read('tokens/tokens.json'));
const prim = tokens['01-primitives'];
const roles = JSON.parse(read('source/typography.json'));
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const variable = (name, value) => `  --${name}: ${value};`;
const values = [];
for (const [name, value] of Object.entries(prim.color)) values.push(variable(`kemi-${name}`, value));
for (const group of ['spacing', 'radius']) {
  for (const [name, value] of Object.entries(prim[group])) values.push(variable(`${group === 'spacing' ? 'space' : 'radius'}-${name}`, `${value}px`));
}
values.push(variable('font-family', prim.font.family));
for (const [name, value] of Object.entries(prim.font.size)) values.push(variable(`font-${name}`, `${value}px`));
for (const [name, value] of Object.entries(prim.font.lineHeight)) values.push(variable(`leading-${name}`, `${value}px`));
for (const [name, value] of Object.entries(prim.font.letterSpacing)) values.push(variable(`tracking-${name}`, value));
for (const [name, value] of Object.entries(prim.motion)) values.push(variable(`motion-${name}`, typeof value === 'number' ? `${value}ms` : value));
for (const [name, value] of Object.entries(tokens['04-effects-and-styles'])) {
  if (typeof value === 'string') values.push(variable(name.replace('/', '-'), value));
}
const glass = tokens['04-effects-and-styles']['glass/overlay'];
values.push(variable('glass-bg', glass.background), variable('glass-blur', `${glass.blur}px`), variable('glass-border', glass.border));
for (const [name, value] of Object.entries(tokens['03-component'])) {
  values.push(variable(name.replace('/', '-'), /^\{/.test(String(value)) ? `var(--${value.includes("/") ? value.slice(1,-1).replace("/","-") : "kemi-"+value.slice(1,-1)})` : typeof value === 'number' ? `${value}px` : value));
}
let css = '/* Generated from tokens.json by scripts/build-design-system.cjs. */\n:root {\n' + values.join('\n') + '\n}\n';
for (const [theme, themeTokens] of Object.entries(tokens['02-semantic'])) {
  css += `${theme === 'light' ? ':root, ' : ''}[data-theme="${theme}"] {\n`;
  css += Object.entries(themeTokens).map(([name, value]) => variable(name.replace('/', '-'), value.startsWith('{') ? `var(--kemi-${value.slice(1, -1)})` : value)).join('\n') + '\n}\n';
}
css += '@media (prefers-reduced-motion: reduce) { :root, [data-theme] { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; } }\n';
const typeCSS = roles.map(role => `.type-${role.token}, .doc-table .type-${role.token} { font-size: var(--font-${role.token}); line-height: var(--leading-${role.token}); font-weight: ${role.weight}; letter-spacing: var(--tracking-${role.tracking}); }`).join('\n');
const mobileCSS = roles.filter(role => role.mobile).map(role => `.type-${role.token}, .doc-table .type-${role.token} { font-size: ${role.mobile}px; line-height: ${role.mobileLine}px; }`).join('\n');
css += `${typeCSS}\n@media(max-width:599px) { ${mobileCSS} }\n`;

css += ':root, [data-theme] {\n' + Object.entries(tokens['03-component']).filter(([,v]) => typeof v === 'string' && v.includes('/')).map(([k,v]) => variable(k.replace('/','-'), 'var(--'+v.slice(1,-1).replace('/','-')+')')).join('\n') + '\n}\n';
const layout = prim.layout;
css += ':root { --layout-max-width: '+layout.maxWidth+'px; --layout-gutter-mobile: '+layout.gutter.mobile+'px; --layout-gutter-desktop: '+layout.gutter.desktop+'px; --layout-filter-width: '+layout.filterPanelWidth.desktop+'px; --layout-filter-width-wide: '+layout.filterPanelWidth.wide+'px; }\n';
write('tokens/tokens.css', css);
fs.mkdirSync(path.join(root,'src/tokens'),{recursive:true});
write('src/tokens/tokens.css',css);
write('src/tokens/tokens.json',JSON.stringify(tokens,null,2)+'\n');

// Apply only replacements that are known to occur in the saved baseline.
let html = read('source/design-system-1.1.base.html');
function replaceOnce(find, replacement) {
  if (!html.includes(find)) throw new Error(`Baseline marker missing: ${find.slice(0, 80)}`);
  html = html.replace(find, () => replacement);
}
replaceOnce(/<style>[\s\S]*?<\/style>/.exec(html)[0], `<style>\n${css}</style>`);
replaceOnce('</head>', `<style>\n${read('source/revision.css')}\n${typeCSS}\n@media(max-width:599px) { ${mobileCSS} }\n</style>\n</head>`);
replaceOnce('<title>KEMI — Design System 1.1</title>', '<title>KEMI — Design System 1.1 · Leaf Green 수정본</title>');
replaceOnce('Design System 1.1 draft', 'Design System 1.1 · 2026.10.23 수정');
replaceOnce('<p class="doc-nav__group">Foundation</p>', '<details class="ds-nav-fold" id="ds-nav-fold"><summary>목차 보기</summary><p class="doc-nav__group">Foundation</p>');
replaceOnce('<button class="btn btn--secondary btn--sm btn--block" id="theme-toggle"', '</details><button class="btn btn--secondary btn--sm btn--block" id="theme-toggle"');
replaceOnce('<p class="doc-nav__group">Foundation</p>', '<p class="doc-nav__group">수정 기준</p><ul><li><a href="#revision">변경 개요</a></li><li><a href="#primary-system">Primary Color</a></li><li><a href="#typography-system">타이포그래피</a></li><li><a href="#component-rules">버튼·폼·상태</a></li><li><a href="#responsive-rules">반응형</a></li><li><a href="#current-patterns">현재 서비스 패턴</a></li><li><a href="#content-accessibility">콘텐츠·접근성</a></li><li><a href="#change-log">변경 기록</a></li></ul><p class="doc-nav__group">기존 브랜드 보드</p>');
replaceOnce('다크 모드 (Studio)</button>', '다크 모드 (확장안)</button>');
replaceOnce('dark ? "라이트 모드" : "다크 모드 (Studio)"', 'dark ? "라이트 모드" : "다크 모드 (확장안)"');
replaceOnce('<section class="doc-section" id="principles">', `${read('source/guidelines.html')}\n<section class="doc-section" id="principles">`);

const typeRows = roles.map(role => `<tr><td><code>${esc(role.token)}</code></td><td>${prim.font.size[role.token]} / ${prim.font.lineHeight[role.token]}px · ${role.weight} · ${prim.font.letterSpacing[role.tracking]}${role.mobile ? `<br>모바일 ${role.mobile} / ${role.mobileLine}px` : ''}</td><td>${esc(role.use)}</td><td class="ds-type-sample type-${role.token}">${esc(role.sample)}</td></tr>`).join('\n');
const typography = `<div id="typography-system"><h3 class="doc-sub">Typography · Pretendard</h3><p>11개 역할을 크기·줄높이·굵기·자간으로 정의합니다. 같은 크기도 Label·Caption·Body의 의미가 다릅니다. 제목은 짧고 명확하게, 본문은 충분한 줄높이를 유지합니다.</p><table class="doc-table"><thead><tr><th>역할</th><th>크기 / 줄높이 · 굵기 · 자간</th><th>사용 위치</th><th>한국어 예시</th></tr></thead><tbody>${typeRows}</tbody></table>
<div class="ds-type-card"><p class="type-label-md">작품 상세 · 실제 적용 예시</p><h3 class="type-heading-lg ds-type-sample">긴 제목도 중요한 단어가 잘리지 않도록 자연스럽게 줄바꿈합니다</h3><p class="type-body-md ds-type-sample">마음에 드는 작품을 찾았다면 저장해 두세요. 문의를 보낼 때 사용할 작품은 저장함에서 직접 선택합니다. 줄간격은 본문을 여러 줄 읽어도 다음 줄을 쉽게 찾을 수 있도록 유지합니다.</p><p class="type-body-sm">카드 제목은 2줄 말줄임을 허용하되 상세 화면에서는 전체 제목을 제공합니다.</p><p class="type-label-md ds-number">참고 작품 3개 · 예산 300,000–500,000원 (예시)</p><p class="type-caption ds-number">2026.10.23 · 영상 00:15 · 12.4 MB</p><p class="type-body-sm ds-error">문의가 전송되지 않았어요. 작성 내용은 유지했어요.</p></div>
<p class="ds-note">한국어는 단어 단위 줄바꿈을 우선하고 긴 URL·파일명은 넘치지 않도록 줄바꿈합니다. 본문은 최대 70ch, 숫자·시간·금액은 tabular-nums를 사용합니다. 12px Caption에는 필수 조건·오류·중요한 제한을 넣지 않습니다. 글꼴 미설치·로드 실패 시 시스템 글꼴로 대체하며, 200% 확대와 모바일에서도 문구가 잘리지 않는지 확인합니다. 스타일 이름은 HTML h1~h6의 의미 구조를 대신하지 않습니다.</p></div>`;
const typeMatch = /<h3 class="doc-sub">Typography[\s\S]*?<\/table>/.exec(html);
if (!typeMatch) throw new Error('Typography baseline marker missing');
replaceOnce(typeMatch[0], typography);

// Marketing calls to action keep the original gradient; ordinary buttons use Leaf-derived solids.
html = html.replace(/class="btn btn--primary" type="button" data-board-start/g, 'class="btn btn--marketing" type="button" data-board-start');
html = html.replace(/"--button-primary-text", "--kemi-/g, '"--button-marketing-text", "--kemi-');
html = html.replace('민트·라임·노랑을 주요 CTA와 브랜드 포인트에 사용합니다.', 'Leaf Green을 대표색으로 사용하고, 일반 주요 CTA에는 짙은 Leaf 파생색을 사용합니다. 민트·라임·노랑은 홈·홍보 포인트에 사용합니다.');
html = html.replace('브랜드·히어로·주요 CTA·저장 포인트', '홈·홍보 영역의 브랜드·히어로·강조 CTA');
html = html.replace('<p class="doc-nav__group">Components</p>', '<p class="doc-nav__group">기존 UI 표본</p>');
html = html.replace('<p class="doc-nav__group">Patterns</p>', '<p class="doc-nav__group">이전 서비스 패턴</p>');
replaceOnce('<h2>Core UI</h2>', '<h2>Core UI · 기존 표본</h2><p class="ds-note">공통 형태·조작의 참고 표본입니다. 문구·금액·구매·라이선스·거래 상태는 이전 서비스 예시이며, 현재 제품의 상태와 역할은 위의 수정 규칙을 우선합니다.</p>');
replaceOnce('<h2>LicenseSelector · RightsDisclosure · PaymentSummary</h2>', '<h2>이전 서비스 참고 · License · Rights · Payment</h2><p class="ds-note">구매·권리·결제 컴포넌트는 참고용으로 보존했습니다. 현재 문의·상담 MVP의 기능이 아닙니다.</p>');
html = html.replace('const pairs = [', 'const pairs = [\n  ["--action-primary-text", "--action-primary-hover", "Primary hover", 4.5],\n  ["--action-primary-text", "--action-primary-press", "Primary pressed", 4.5],\n  ["--focus-ring", "--surface-base", "포커스", 3],');
replaceOnce('<h2>패턴 · 영상 상세 → 라이선스 → 결제</h2>', '<h2>이전 서비스 참고 · 영상 상세 → 라이선스 → 결제</h2><p class="ds-note">이 아래의 구매·라이선스·계약·결제 흐름은 기존 서비스 예시입니다. 현재 KEMI의 상세 범위는 작품 탐색 → 문의 → 상담 → 종료이며, 이 예시가 제품 요구사항을 확정하지 않습니다.</p>');
replaceOnce('<h2>확정 · 가정 · 미결정</h2>', '<h2>이전 서비스의 가정 · 미결정 기록</h2><p class="ds-note">아래 기록은 원본 1.1의 이력 보존용입니다. 현재 제품의 확정 범위로 해석하지 마세요.</p>');
replaceOnce('<span class="badge badge--success">확정</span></td><td>영상 광고 소재 거래·매칭 플랫폼', '<span class="badge">이전 기준</span></td><td>영상 광고 소재 거래·매칭 플랫폼');
// Remove the outdated reference-board chip caption without altering the embedded artwork.
html = html.replace('#0F3D2E <i style="--sample:#AFD368"></i>#AFD368', '#0F3D2E / Soft Energy · 홍보 전용');
// Region scroll keeps wide specification tables usable on mobile and at zoom.
html = html.replace(/<table class="doc-table">[\s\S]*?<\/table>/g, table => `<div class="ds-table-scroll" tabindex="0" role="region" aria-label="가로 스크롤 가능한 규칙 표">${table}</div>`);
replaceOnce('</body>', `<script>\n${read('source/demo.js')}\n</script>\n</body>`);
write('reference/KEMI_Design_System_1.1.html', html);
console.log(`Generated: tokens.css and reference HTML; ${roles.length} typography roles; Leaf Green #539863.`);

fs.mkdirSync(path.join(root,'public'),{recursive:true});
write('KEMI_Design_System.html',html);
write('public/KEMI_Design_System.html',html);
