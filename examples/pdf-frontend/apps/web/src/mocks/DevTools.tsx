import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import { Button } from '@/components/ui/button';
import { mockEnabled, useSession } from '@/app/session';
import type { Role } from '@/app/routes';
export default function DevTools() {
  const { role, setRole } = useSession();
  const [scenario, setScenario] = useState('success');
  const probe = useQuery({
    queryKey: ['mock-probe', scenario, role],
    enabled: mockEnabled,
    queryFn: async ({ signal }) =>
      (
        await api.get<{ source: string; items: string[] }>('/__mock__/probe', {
          baseURL: '/',
          params: { scenario },
          signal,
        })
      ).data,
  });
  return (
    <aside aria-label="개발 전용 도구" className="dev-tools">
      <p>
        개발 전용 ·{' '}
        {mockEnabled
          ? 'Mock 활성 · 실제 API 미연결'
          : 'Mock 비활성 · 실제 API 미연결'}
      </p>
      <Link to="/__dev/ui">공통 UI 예시</Link>
      {mockEnabled && (
        <>
          <label>
            Mock 역할{' '}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {(['guest', 'client', 'creator', 'ops'] as const).map((value) => (
                <option key={value} value={value}>
                  {
                    {
                      guest: '비회원',
                      client: '의뢰인',
                      creator: '크리에이터',
                      ops: '운영(가정)',
                    }[value]
                  }
                </option>
              ))}
            </select>
          </label>
          <label>
            Mock 응답{' '}
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {[
                'success',
                'empty',
                'delay',
                '401',
                '403',
                '409',
                '500',
                'network',
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div aria-live="polite" data-testid="probe-result">
            {probe.isFetching ? (
              '불러오는 중…'
            ) : probe.error ? (
              <p role="alert">
                {probe.error instanceof ApiError
                  ? `${probe.error.status} · ${probe.error.message}`
                  : '요청 오류'}
              </p>
            ) : probe.data?.items.length === 0 ? (
              '결과가 없어요.'
            ) : (
              probe.data?.items.join(', ')
            )}
          </div>
          <Button
            variant="outline"
            disabled={probe.isFetching}
            onClick={() => void probe.refetch()}
          >
            다시 요청
          </Button>
        </>
      )}
    </aside>
  );
}
