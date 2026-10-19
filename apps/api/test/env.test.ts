import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../src/config/env.js';

const DATABASE_URL = 'postgresql://user:secret-password@localhost:5432/kemi';

describe('parseEnv', () => {
  it('기본값을 채운다', () => {
    const env = parseEnv({ DATABASE_URL });
    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL,
      DATABASE_POOL_MAX: 5,
    });
  });

  it('문자열 숫자를 변환한다', () => {
    const env = parseEnv({ DATABASE_URL, NODE_ENV: 'production', PORT: '10000', DATABASE_POOL_MAX: '8' });
    expect(env.PORT).toBe(10000);
    expect(env.DATABASE_POOL_MAX).toBe(8);
  });

  it('DATABASE_URL이 없으면 실패한다', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('잘못된 값은 변수 이름과 함께 모두 보고한다', () => {
    try {
      parseEnv({ DATABASE_URL: 'mysql://x', PORT: 'abc', NODE_ENV: 'staging' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const { issues } = err as EnvValidationError;
      expect(issues.map((issue) => issue.split(':')[0])).toEqual(
        expect.arrayContaining(['DATABASE_URL', 'PORT', 'NODE_ENV']),
      );
    }
  });

  it('오류 메시지에 비밀값을 노출하지 않는다', () => {
    const secretUrl = 'mysql://user:secret-password@localhost/kemi';
    expect(() => parseEnv({ DATABASE_URL: secretUrl })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret-password') }),
    );
  });
});
