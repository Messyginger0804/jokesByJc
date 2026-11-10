import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.js"],
    setupFiles: ["tests/unit/setup.js"],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      // Shipped first-party code only.
      include: ["background.js", "popup.js"],
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      // Floors at what the current code reaches without behaviour changes (lines 98.97%,
      // statements 97.51%, branches 74.52%, functions 100%). Raise them as tests are added.
      thresholds: {
        lines: 98,
        functions: 100,
        statements: 97,
        branches: 74
      }
    }
  }
});
