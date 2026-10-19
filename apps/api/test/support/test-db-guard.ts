// DB 테스트가 개발·운영 DB를 건드리지 않도록 막는 안전장치.
// 조건을 하나라도 어기면 테스트를 시작하지 않고 실패한다. 개발 DB로 자동 대체하지 않는다.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class TestDatabaseGuardError extends Error {
  constructor(message: string) {
    super(`[DB 테스트 안전장치] ${message}`);
    this.name = 'TestDatabaseGuardError';
  }
}

export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.TEST_DATABASE_URL;
  if (!raw) {
    throw new TestDatabaseGuardError(
      'TEST_DATABASE_URL이 없습니다. apps/api/.env.test.example을 .env.test로 복사하고 `npm run test:db:up`으로 테스트 DB를 켜주세요.',
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TestDatabaseGuardError('TEST_DATABASE_URL 형식이 올바르지 않습니다.');
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new TestDatabaseGuardError('TEST_DATABASE_URL은 postgresql:// 주소여야 합니다.');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new TestDatabaseGuardError(`테스트 DB는 로컬(localhost)만 허용합니다. 현재 호스트: ${url.hostname}`);
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName.endsWith('_test')) {
    throw new TestDatabaseGuardError(`테스트 DB 이름은 _test로 끝나야 합니다. 현재 이름: ${databaseName || '(없음)'}`);
  }
  if (env.DATABASE_URL && sameDatabase(env.DATABASE_URL, url)) {
    throw new TestDatabaseGuardError('TEST_DATABASE_URL이 개발용 DATABASE_URL과 같은 DB를 가리킵니다.');
  }

  return raw;
}

function sameDatabase(other: string, testUrl: URL): boolean {
  try {
    const url = new URL(other);
    return (
      url.hostname === testUrl.hostname &&
      (url.port || '5432') === (testUrl.port || '5432') &&
      url.pathname === testUrl.pathname
    );
  } catch {
    return false;
  }
}
