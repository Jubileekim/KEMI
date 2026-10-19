import js from "@eslint/js";
import { configs, plugins } from "eslint-config-airbnb-extended";
import prettierConfig from "eslint-config-prettier/flat";
import reactRefresh from "eslint-plugin-react-refresh";

const webFiles = ["apps/web/**/*.{ts,tsx}"];
const webReactConfigs = [
  plugins.react,
  plugins.reactA11y,
  plugins.reactHooks,
  ...configs.react.recommended,
  ...configs.react.typescript,
].map((config) => ({
  ...config,
  files: webFiles,
}));

// Airbnb 규칙(eslint-config-airbnb-extended) + TypeScript 규칙.
// 코드 형식(들여쓰기·따옴표·줄 길이 등)은 Prettier 기본 설정이 맡고, ESLint는 그 밖의 규칙만 검사한다.
// React 규칙은 apps/web에만 적용한다(이슈 #2).
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "apps/api/src/generated/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  plugins.stylistic,
  plugins.importX,
  plugins.node,
  plugins.typescriptEslint,
  ...configs.base.recommended,
  ...configs.node.recommended.map((config) => ({
    ...config,
    ignores: [...(config.ignores ?? []), "apps/web/src/**"],
  })),
  ...configs.base.typescript,
  ...webReactConfigs,
  {
    files: webFiles,
    settings: { react: { version: "detect" } },
    rules: {
      // React의 자동 JSX 변환과 함수 컴포넌트를 사용한다.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/require-default-props": "off",
      "react/prop-types": "off",
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["apps/web/src/components/ui/button.tsx"],
    rules: {
      // shadcn의 버튼 스타일은 다른 컴포넌트에서도 재사용한다.
      "react-refresh/only-export-components": [
        "error",
        { allowExportNames: ["buttonVariants"] },
      ],
    },
  },
  {
    rules: {
      // 서버 로그는 console.info/warn/error만 쓴다. (console.log 등 디버그 출력은 금지)
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      // 테스트·설정 파일은 개발 의존성(vitest, prisma 등)을 import할 수 있다.
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: ["**/test/**", "**/e2e/**", "**/*.config.{js,ts}"],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // 팀 규칙 1: any 금지
      "@typescript-eslint/no-explicit-any": "error",
      // 팀 규칙 2: 타입 단언(as, <T>) 금지 → 타입 가드로 좁힌다.
      // 예외: const assertion(`as const`)은 이 규칙이 assertionStyle 'never'에서도 허용한다.
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    // 운영 코드에서는 라이브러리에서 들어온 any 값도 그대로 쓰지 못하게 한다.
    // (테스트는 vitest의 expect.any()·supertest의 res.body가 any 타입이라 제외)
    files: [
      "apps/api/src/**/*.ts",
      "packages/*/src/**/*.ts",
      "apps/web/src/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },
  // 마지막에 둔다: Prettier와 겹치는 형식 규칙(@stylistic/* 등)을 모두 끈다.
  prettierConfig,
];
