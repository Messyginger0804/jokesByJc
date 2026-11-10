import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "coverage/", "dist/", "*.zip"]
  },
  js.configs.recommended,
  {
    // Extension code: classic scripts loaded by popup.html and the service worker.
    // Top-level functions are referenced from listeners, so only flag unused locals.
    files: ["background.js", "popup.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      "no-unused-vars": ["error", { vars: "local", caughtErrors: "none" }]
    }
  },
  {
    // Manual API smoke test (npm run check:apis), runs in Node.
    files: ["test-apis.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node }
    }
  },
  {
    // Dev tooling and tests run in Node.
    files: ["tests/**/*.{js,mjs}", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser, ...globals.webextensions }
    }
  }
];
