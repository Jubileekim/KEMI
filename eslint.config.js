import js from '@eslint/js';
import { configs, plugins } from 'eslint-config-airbnb-extended';

// Airbnb 스타일(eslint-config-airbnb-extended) + TypeScript 규칙.
// 프론트엔드(apps/web)는 추가될 때 configs.react.* 를 같은 방식으로 붙인다(이슈 #2).
export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/src/generated/**'],
  },
  js.configs.recommended,
  plugins.stylistic,
  plugins.importX,
  plugins.node,
  plugins.typescriptEslint,
  ...configs.base.recommended,
  ...configs.node.recommended,
  ...configs.base.typescript,
  {
    rules: {
      // 저장소에는 Git이 LF로 저장한다. Windows 작업 폴더의 CRLF까지 오류로 잡지 않는다.
      '@stylistic/linebreak-style': 'off',
      // 서버 로그는 console.info/warn/error만 쓴다. (console.log 등 디버그 출력은 금지)
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      // 테스트·설정 파일은 개발 의존성(vitest, prisma 등)을 import할 수 있다.
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: ['**/test/**', '**/*.config.{js,ts}'],
      }],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // 팀 규칙 1: any 금지
      '@typescript-eslint/no-explicit-any': 'error',
      // 팀 규칙 2: 타입 단언(as, <T>) 금지 → 타입 가드로 좁힌다. (`as const`는 단언이 아니라 허용된다)
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // 운영 코드에서는 라이브러리에서 들어온 any 값도 그대로 쓰지 못하게 한다.
    // (테스트는 vitest의 expect.any()·supertest의 res.body가 any 타입이라 제외)
    files: ['apps/api/src/**/*.ts', 'packages/*/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
];
