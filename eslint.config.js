// ESLint flat config. Formatting belongs to Prettier; eslint-config-prettier
// switches off every stylistic rule so the two tools never disagree.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/artifacts/**",
      "desktop/dist/**",
      "desktop/dist-desktop/**",
      "desktop/public/**",
      "desktop/src-tauri/**",
      // Frozen evaluation tooling is reproduced from recorded sources, not linted.
      "desktop/scripts/**/*",
      "!desktop/scripts/prepare-*.mjs",
      "!desktop/scripts/build-*.mjs",
      "!desktop/scripts/verify-*.mjs",
      "!desktop/scripts/check-*.mjs",
      "!desktop/scripts/quick-actions-matrix/**",
      "landing/dist/**",
      "landing/.wrangler/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Optional props are typed through TypeScript; `undefined` is the default.
      "vue/require-default-prop": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // The detection rules escape `/` and `[` inside regex character classes for
    // readability; the escapes are harmless and the patterns are test-covered.
    files: ["desktop/src/core/detection/**"],
    rules: { "no-useless-escape": "off" },
  },
  {
    files: ["desktop/src/vite-env.d.ts"],
    rules: {
      // Vue's own SFC module declaration shape.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  prettier,
];
