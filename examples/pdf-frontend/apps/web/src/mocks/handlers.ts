import { http, HttpResponse, delay } from 'msw';
// Foundation fixtures only. These paths are not product API contracts.
export const handlers = [
  http.get('/__mock__/probe', async ({ request }) => {
    const scenario = new URL(request.url).searchParams.get('scenario');
    if (scenario === 'delay') await delay(1500);
    if (scenario === 'network') return HttpResponse.error();
    if (['401', '403', '409', '500'].includes(scenario ?? ''))
      return HttpResponse.json(
        { error: { code: `MOCK_${scenario}`, message: '개발용 오류' } },
        { status: Number(scenario) },
      );
    return HttpResponse.json({
      source: 'mock',
      items: scenario === 'empty' ? [] : ['통신 기반 확인'],
    });
  }),
];
