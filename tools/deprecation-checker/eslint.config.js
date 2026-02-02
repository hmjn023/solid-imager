import typescriptEslintParser from "@typescript-eslint/parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import deprecationPlugin from "eslint-plugin-deprecation";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.vinxi/**", "**/.output/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        project: ["../../tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      "deprecation": deprecationPlugin,
    },
    rules: {
      "deprecation/deprecation": "error",
    },
  },
];
