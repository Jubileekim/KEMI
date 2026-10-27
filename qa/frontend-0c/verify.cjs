const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const results = [];
const pass = name => { results.push(name); console.log('PASS', name); };
const base = process.env.KEMI_QA_URL || 'http://127.0.0.1:5175';
const preview = process.env.KEMI_PREVIEW_URL || 'http://127.0.0.1:4175';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const productRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) productRequests.push(r.url()); });
    await page.goto(base);
    await page.getByTestId('probe-result').filter({ hasText: '통신 기반 확인' }).waitFor();
    pass('MSW ready before first Axios/Query read');
    const role = page.getByLabel('Mock 역할');
    const response = page.getByLabel('Mock 응답');
    for (const [scenario, copy] of [['empty','결과가 없어요.'], ['401','로그인이 필요해요.'], ['403','접근 권한이 없어요.'], ['409','상태가 변경되었어요.'], ['500','서버 오류가 발생했어요.'], ['network','네트워크 연결을 확인해 주세요.']]) {
      await response.selectOption(scenario);
      await page.getByTestId('probe-result').filter({ hasText: copy }).waitFor();
      pass(`mock-${scenario}`);
    }
    await response.selectOption('delay');
    await page.getByTestId('probe-result').filter({ hasText: '불러오는 중' }).waitFor();
    assert.equal(await page.getByRole('button', {name:'다시 요청'}).isDisabled(), true);
    await page.getByTestId('probe-result').filter({ hasText: '통신 기반 확인' }).waitFor();
    await page.getByRole('button', {name:'다시 요청'}).click();
    await page.getByTestId('probe-result').filter({ hasText: '불러오는 중' }).waitFor();
    await page.getByTestId('probe-result').filter({ hasText: '통신 기반 확인' }).waitFor();
    pass('delay, disabled duplicate, explicit retry');
    await response.selectOption('success');
    await page.getByRole('link', {name:'내 활동', exact:true}).click();
    await page.waitForURL('**/login?returnTo=*');
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/me/activity');
    await role.selectOption('client');
    await page.getByRole('link', {name:'이전 화면으로 돌아가기'}).click();
    await page.getByRole('heading', {name:'내 활동',exact:true}).waitFor();
    pass('guest redirect and safe return');
    await page.goto(`${base}/login?returnTo=https%3A%2F%2Fevil.example`);
    await role.selectOption('client');
    assert.equal(await page.getByRole('link', {name:'이전 화면으로 돌아가기'}).getAttribute('href'), '/me/activity');
    pass('external return rejected');
    const routes = [
      ['/','작품 피드','guest'], ['/works/42','작품 상세','guest'], ['/creators/42','크리에이터 프로필','guest'],
      ['/login','로그인','guest'], ['/signup','회원가입','guest'], ['/auth/social/callback','소셜 로그인 확인','guest'],
      ['/onboarding','역할·이름 설정','client'], ['/me/profile','내 프로필','client'],
      ['/studio/portfolio','작품 관리','creator'], ['/studio/packages','패키지 관리','creator'],
      ['/campaigns','공개 모집','guest'], ['/campaigns/42','모집 상세','guest'], ['/campaigns/new','모집 작성','client'],
      ['/campaigns/42/edit','모집 수정','client'], ['/campaigns/42/proposals','후보 비교','client'], ['/campaigns/42/apply','제안 제출','creator'],
      ['/requests','의뢰 현황','client'], ['/requests/42','의뢰 상세','client'], ['/creators/42/request','직접 의뢰','client'],
      ['/workspace/42','작업 공간','creator'], ['/contracts/42/payment','테스트 결제','client'], ['/payments/result','결제 결과 확인','client'],
      ['/contracts/42/cancellation','취소 협의','client'], ['/disputes/42','분쟁 현황','creator'], ['/me/activity','내 활동','client'],
      ['/bookmarks','저장한 캠페인','creator'], ['/recommendations','추천 캠페인','creator'], ['/notifications','알림','client'],
      ['/contracts/42/review','리뷰 작성','creator'], ['/reports/new','신고 접수','client'], ['/ops/reports','신고 검토','ops'], ['/ops/disputes','분쟁 검토','ops'],
    ];
    for (const [path, title, selected] of routes) {
      console.log('CHECK', path);
      await page.goto(`${base}${path}`);
      await role.selectOption(selected);
      if (selected !== 'guest' && new URL(page.url()).pathname === '/login') await page.getByRole('link',{name:'이전 화면으로 돌아가기'}).click();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      if (path !== '/login') assert.equal(await page.title(), `${title} | KEMI`);
    }
    pass('32 planned route entries, direct navigation and ranked static matching');
    await page.evaluate(async () => {
      const { default: queryClient } = await import('/src/app/query-client.ts');
      queryClient.setQueryData(['private-fixture'], { secret: 'test-only' });
    });
    await role.selectOption('client');
    assert.equal(await page.evaluate(async () => {
      const { default: queryClient } = await import('/src/app/query-client.ts');
      return queryClient.getQueryData(['private-fixture']);
    }), undefined);
    pass('role change clears prior private cache');
    await page.getByRole('heading',{name:'접근 권한이 없어요'}).waitFor();
    await role.selectOption('creator');
    await page.getByRole('heading',{name:'접근 권한이 없어요'}).waitFor();
    pass('ops denied to both member roles');
    await page.goto(`${base}/studio/portfolio`);
    await role.selectOption('client');
    await page.getByRole('link',{name:'이전 화면으로 돌아가기'}).click();
    await page.getByRole('heading',{name:'접근 권한이 없어요'}).waitFor();
    await role.selectOption('creator');
    await page.getByRole('heading',{name:'작품 관리'}).waitFor();
    await role.selectOption('guest');
    await page.getByRole('heading',{name:'로그인',exact:true}).waitFor();
    await page.goBack();
    assert.equal(await page.getByRole('heading',{name:'작품 관리'}).count(),0);
    pass('creator restriction, logout and back navigation');
    await page.goto(`${base}/not-a-route`);
    await page.getByRole('heading',{name:'페이지를 찾을 수 없어요'}).waitFor();
    pass('404 fallback');
    await page.goto(base);
    await page.getByRole('heading', {name:'작품 피드',exact:true}).waitFor();
    await page.getByTestId('probe-result').filter({ hasText: '통신 기반 확인' }).waitFor();
    for (const width of [320,390,599,600,768,1023,1024,1280]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      if ([390,768,1280].includes(width)) await page.screenshot({path:`qa/frontend-0c/layout-${width}.png`,fullPage:true});
    }
    pass('8 responsive widths without overflow');
    await page.getByRole('link',{name:'공개 모집',exact:true}).click();
    await page.reload();
    await page.getByRole('heading',{name:'공개 모집',exact:true}).waitFor();
    assert.equal(await page.locator('main').evaluate(el=>el === document.activeElement),true);
    pass('reload and main focus');
    assert.deepEqual(errors,[]);
    assert.deepEqual(productRequests,[]);
    pass('zero page errors and zero product API requests');
    const prod = await browser.newContext();
    const pp = await prod.newPage();
    const requests = [];
    pp.on('request',r=>requests.push(r.url()));
    await pp.goto(preview);
    await pp.getByRole('heading',{name:'작품 피드'}).waitFor();
    assert.equal(await pp.getByLabel('개발 전용 도구').count(),0);
    await pp.goto(`${preview}/workspace/42`);
    await pp.getByRole('heading',{name:'인증 연결 준비 중'}).waitFor();
    await pp.goto(`${preview}/__dev/ui`);
    await pp.getByRole('heading',{name:'페이지를 찾을 수 없어요'}).waitFor();
    assert.equal(requests.some(url=>/mockServiceWorker|__mock__/.test(url)),false);
    assert.equal(await pp.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length),0);
    assert.equal(fs.existsSync('apps/web/dist/mockServiceWorker.js'),false);
    pass('production no tools, no dev route, no worker, protected routes closed');
    fs.writeFileSync('qa/frontend-0c/results.json',JSON.stringify({results,errors,productRequests},null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
