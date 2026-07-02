import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Legacy prototype components remain in the repository but are not mounted by
    // the offline golden path. Keep their existing event/effect model lintable
    // while the new harness follows the stricter React rules.
    files: ["app/admin/events/page.tsx", "app/components/FloatingBall.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    // Legacy prototype components remain in the repository but are not mounted by
    // the offline golden path. Keep their existing event/effect model lintable
    // while the new harness follows the stricter React rules.
    files: ["app/admin/events/page.tsx", "app/components/FloatingBall.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
