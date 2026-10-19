import { describe, expect, it } from 'vitest';
import { resolveTestDatabaseUrl, TestDatabaseGuardError } from './support/test-db-guard.js';

const LOCAL_TEST_URL = 'postgresql://kemi_test:kemi_test@localhost:54329/kemi_test';

describe('resolveTestDatabaseUrl (DB 테스트 안전장치)', () => {
  it('로컬 _test DB 주소는 통과한다', () => {
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: LOCAL_TEST_URL })).toBe(LOCAL_TEST_URL);
  });

  it('TEST_DATABASE_URL이 없으면 실패하고 DATABASE_URL로 대체하지 않는다', () => {
    expect(() =>
      resolveTestDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@localhost:5432/kemi_test' }),
    ).toThrow(TestDatabaseGuardError);
  });

  it('로컬이 아닌 호스트(예: Supabase)는 거부한다', () => {
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: 'postgresql://u:p@aws-0-ap-northeast-2.pooler.supabase.com:5432/kemi_test',
      }),
    ).toThrow(/로컬/);
  });

  it('DB 이름이 _test로 끝나지 않으면 거부한다', () => {
    expect(() =>
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: 'postgresql://u:p@localhost:5432/postgres' }),
    ).toThrow(/_test/);
  });

  it('개발용 DATABASE_URL과 같은 DB면 거부한다', () => {
    expect(() =>
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: LOCAL_TEST_URL, DATABASE_URL: LOCAL_TEST_URL }),
    ).toThrow(/같은 DB/);
  });

  it('오류 메시지에 비밀번호를 노출하지 않는다', () => {
    expect(() =>
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: 'postgresql://u:secret-pw@db.example.com:5432/x_test' }),
    ).toThrow(expect.objectContaining({ message: expect.not.stringContaining('secret-pw') }));
  });
});
