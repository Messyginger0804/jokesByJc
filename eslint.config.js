import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "coverage/", "dist/", "vendor/", "*.zip"]
  },
  js.configs.recommended,
  {
    // Extension code: runs in the popup page and the service worker.
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }]
    }
  },
  {
    // Dev tooling and tests run in Node.
    files: ["scripts/**/*.mjs", "tests/**/*.{js,mjs}", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser, ...globals.webextensions }
    }
  }
];
