// End-to-end: the real extension (unpacked) in headless Chrome, joke APIs mocked.
// Run with: npm run e2e. Each test launches its own browser profile.
// Known-bug paths on this branch (hung sources, offline repeats, restoring a revealed joke,
// double clicks during the typewriter) are covered by unit tests marked it.fails instead.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  withExtension,
  seedStorage,
  openPopup,
  jokeText,
  buttonIds,
  waitForButton,
  waitForText,
  click,
  bodies,
  FALLBACK_TEXT,
  isForcedNetworkError
} from "./harness.mjs";

// Known bug: popup.html's logo has an inline onerror="..." handler. The extension CSP blocks
// it (script-src-attr), so Chrome reports a violation on every open and the logo fallback can
// never run. PR #4 moves the handler into popup.js. Until then only this violation is allowed;
// the todo test below tracks it.
const isInlineHandlerViolation = (text) => /inline event handler|CSP script-src-attr\): inline/.test(text);

function assertClean(log, { allowNetworkErrors = false } = {}) {
  assert.deepEqual(log.csp.filter((e) => !isInlineHandlerViolation(e)), [], "no CSP violations");
  const errors = log.errors.filter((e) => !isInlineHandlerViolation(e) && !(allowNetworkErrors && isForcedNetworkError(e)));
  assert.deepEqual(errors, [], "no console or page errors");
}

const isPopupWindow = (target) => target.type() === "page" && target.url().endsWith("/popup.html");

// onInstalled clears and recreates the alarm asynchronously; wait for it instead of sleeping.
function waitForInstallAlarm(worker) {
  return worker.evaluate(
    () =>
      new Promise((resolve) => {
        const poll = async () => {
          const found = await chrome.alarms.get("dailyPopup");
          if (found) resolve(found);
          else setTimeout(poll, 50);
        };
        poll();
      })
  );
}

describe("background", () => {
  it("registers the daily alarm on install", () =>
    withExtension(async (ext) => {
      const alarm = await waitForInstallAlarm(await ext.worker());
      assert.equal(alarm.periodInMinutes, 1440);
    }));

  it("opens the popup window once when the alarm fires, and not again the same day", () =>
    withExtension(async (ext) => {
      const worker = await ext.worker();
      await waitForInstallAlarm(worker);
      // Unpacked extensions may schedule alarms below the 30 s minimum.
      const opened = ext.browser.waitForTarget(isPopupWindow, { timeout: 10000 });
      await worker.evaluate(() => chrome.alarms.create("dailyPopup", { when: Date.now() + 200 }));
      await opened;
      const lastPopupDate = await worker.evaluate(async () => (await chrome.storage.local.get("lastPopupDate")).lastPopupDate);
      assert.equal(lastPopupDate, new Date().toDateString());

      // Negative check: nothing to wait for, so give the alarm a fixed window to (not) open one.
      let reopened = 0;
      ext.browser.on("targetcreated", (target) => {
        if (isPopupWindow(target)) reopened++;
      });
      await worker.evaluate(() => chrome.alarms.create("dailyPopup", { when: Date.now() + 200 }));
      await new Promise((r) => setTimeout(r, 1500));
      assert.equal(reopened, 0, "already shown today");
    }));
});

describe("popup", () => {
  it("opens with the intro, both buttons and the logo, and makes no request", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext);
      assert.equal(await jokeText(page), "Hey, wanna hear a joke?");
      assert.deepEqual(await buttonIds(page), ["yes-button", "no-button"]);
      const logoLoaded = await page.$eval(".ad-logo", (img) => img.complete && img.naturalWidth > 0);
      assert.equal(logoLoaded, true);
      assert.deepEqual(log.requests, [], "no network until the user asks for a joke");
      assertClean(log);
    }));

  it("has no CSP violations at all", { todo: "inline onerror on the logo; fixed in PR #4" }, () =>
    withExtension(async (ext) => {
      const { log } = await openPopup(ext);
      assert.deepEqual(log.csp, []);
    }));

  it("setup, punchline, then another joke, all from the byjc API", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext);
      await click(page, "yes-button");
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](1).setup);

      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      await waitForText(page, bodies["www.byjc.dev"](1).punchline);

      await click(page, "joke-again-button");
      await page.waitForFunction(() => !document.getElementById("joke-again-button"));
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).setup);
      assert.deepEqual(log.requests, ["www.byjc.dev", "www.byjc.dev"]);
      assertClean(log);
    }));

  it("restores an unrevealed cached joke on open", () =>
    withExtension(async (ext) => {
      await seedStorage(ext, {
        lastJoke: { setup: "Seeded setup?", punchline: "Seeded punchline.", isOneLiner: false, punchlineShown: false, timestamp: 1 }
      });
      const { page, log } = await openPopup(ext);
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), "Seeded setup?");
      await click(page, "joke-button");
      await waitForText(page, "Seeded punchline.");
      assert.deepEqual(log.requests, []);
      assertClean(log);
    }));

  it("falls back to another source when the byjc API fails", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext, { route: (host) => (host === "www.byjc.dev" ? "500" : "ok") });
      await click(page, "yes-button");
      await waitForButton(page, "joke-button");
      assert.match(await jokeText(page), FALLBACK_TEXT);
      assert.equal(log.requests[0], "www.byjc.dev");
      assert.equal(log.requests.length, 2);
      assertClean(log, { allowNetworkErrors: true });
    }));

  it("shows an error when every source fails, and Yes works again once back online", () =>
    withExtension(async (ext) => {
      let online = false;
      const { page, log } = await openPopup(ext, { route: () => (online ? "ok" : "fail") });
      await click(page, "yes-button");
      await waitForText(page, "Oops! Could not fetch a joke.");

      online = true;
      await click(page, "yes-button");
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).setup);
      assertClean(log, { allowNetworkErrors: true });
    }));

  it("shows text instantly with reduced motion", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext, { reducedMotion: true });
      await click(page, "yes-button");
      assert.equal(await jokeText(page), "Thinking of a good one...");
      await waitForButton(page, "joke-button");
      await click(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](1).punchline);
      assertClean(log);
    }));

  it("types text out without reduced motion", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext);
      await click(page, "yes-button");
      const partial = await jokeText(page);
      assert.ok(partial.length < "Thinking of a good one...".length, "typewriter starts partway");
      await waitForText(page, "Thinking of a good one...");
      assertClean(log);
    }));
});
