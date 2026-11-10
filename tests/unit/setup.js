import { vi, beforeEach } from "vitest";

// jsdom has no matchMedia. Tests flip `matchMediaState.reduced` and call
// `matchMediaState.emit()` to simulate a live prefers-reduced-motion change.
export const matchMediaState = { reduced: false, listeners: [] };

beforeEach(() => {
  matchMediaState.reduced = false;
  matchMediaState.listeners = [];
  matchMediaState.emit = (matches) => {
    matchMediaState.reduced = matches;
    for (const fn of matchMediaState.listeners) fn({ matches });
  };
  vi.stubGlobal("matchMedia", (query) => ({
    media: query,
    get matches() {
      return matchMediaState.reduced;
    },
    addEventListener: (type, fn) => matchMediaState.listeners.push(fn)
  }));
});
