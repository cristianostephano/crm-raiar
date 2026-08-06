import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // .claude/ guarda a instalação do GSD (scripts .cjs em CommonJS) e worktrees
    // de agentes com cópias inteiras do código-fonte — nenhum dos dois é código
    // do produto, e lintá-los produz centenas de falsos positivos
    // (@typescript-eslint/no-require-imports) além de duplicar os achados do app.
    ".claude/**",
  ]),
]);

export default eslintConfig;
