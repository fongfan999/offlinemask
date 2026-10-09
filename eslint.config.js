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
      "dist/**",
      "dist-desktop/**",
      "node_modules/**",
      "artifacts/**",
      "public/**",
      "src-tauri/**",
      // Frozen evaluation tooling is reproduced from recorded sources, not linted.
      "scripts/**",
      "!scripts/prepare-*.mjs",
      "!scripts/build-*.mjs",
      "!scripts/verify-*.mjs",
      "!scripts/check-*.mjs",
      "scripts/**/node_modules/**",
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
    // Frozen, fingerprinted detection sources (see .prettierignore). Their regex
    // literals escape `/` and `[` inside character classes; leave them as recorded.
    files: ["src/core/**"],
    rules: { "no-useless-escape": "off" },
  },
  {
    files: ["src/vite-env.d.ts"],
    rules: {
      // Vue's own SFC module declaration shape.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  prettier,
];
