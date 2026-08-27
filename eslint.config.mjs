import { defineConfig, globalIgnores } from "eslint/config";
import convexPlugin from "@convex-dev/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...convexPlugin.configs.recommended,
  // Wave Lab is legacy but still linted; scope compiler exceptions to its
  // existing blocking patterns instead of excluding the paths entirely.
  {
    files: ["components/wave-lab/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  {
    files: ["hooks/wave-lab/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "convex/_generated/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
