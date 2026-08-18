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
  ]),
  {
    /*
     * The voice surface may create a draft and nothing else.
     *
     * With a database this would be a restricted DB role. There isn't one, so
     * the enforcement is structural: nothing under the voice paths may import
     * the mutation store or the write helpers, which makes the invariant fail
     * at build time rather than at runtime — and survives a future developer
     * who hasn't read 05_VOICE_AGENT_PLAN.md §3.4.
     */
    files: ["src/lib/voice/**/*.ts", "src/app/api/voice/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/store/*", "**/store/useStore"],
              message:
                "The voice surface must not reach the mutation store. Drafts go through lib/voice/store.ts only. See 05_VOICE_AGENT_PLAN.md §3.4.",
            },
            {
              group: ["@/lib/books", "@/lib/ledger"],
              message:
                "Books and ledger builders walk the whole fixture set and bloat the cold-start bundle. Measure before importing into a voice route. See §5.5.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
