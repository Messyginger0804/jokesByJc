// End-to-end: the real extension (unpacked) in headless Chrome, joke APIs mocked.
// Run with: npm run e2e. Every test launches its own profile and seeds any storage it needs,
// so tests can run alone (--test-name-pattern) or in any order.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  withExtension,
  seedStorage,
  openPopup,
  jokeText,
  buttonIds,
  waitForButton,
  click,
  requestNewJoke,
  bodies,
  isForcedNetworkError
} from "./harness.mjs";

const FALLBACK_TEXT = /Official|JokeAPI|dad joke/;
const TWO_PART = { setup: "Seeded setup?", punchline: "Seeded punchline.", isOneLiner: false };

function assertClean(log, { allowNetworkErrors = false } = {}) {
  assert.deepEqual(log.csp, [], "no CSP violations");
  const errors = allowNetworkErrors ? log.errors.filter((e) => !isForcedNetworkError(e)) : log.errors;
  assert.deepEqual(errors, [], "no console or page errors");
}

const isPopupWindow = (target) => target.type() === "page" && target.url().endsWith("/popup.html");

// onInstalled may still be running right after the worker starts; wait for its alarm.
function waitForAlarm(worker, name) {
  return worker.evaluate(
    (alarmName) =>
      new Promise((resolve) => {
        const poll = async () => {
          const found = await chrome.alarms.get(alarmName);
          if (found) resolve(found);
          else setTimeout(poll, 50);
        };
        poll();
      }),
    name
  );
}

describe("extension load", () => {
  it("schedules no daily-popup alarm on a fresh install", () =>
    withExtension(async (ext) => {
      const worker = await ext.worker.worker();
      // Let onInstalled finish, then confirm it left nothing scheduled.
      await new Promise((r) => setTimeout(r, 1500));
      assert.equal(await worker.evaluate(() => chrome.alarms.get("dailyPopup")), undefined);
    }));

  it("registers the hourly alarm when the daily joke is turned on, and clears it when turned off", () =>
    withExtension(async (ext) => {
      const worker = await ext.worker.worker();
      await seedStorage(ext, { dailyPopupEnabled: true });
      const alarm = await waitForAlarm(worker, "dailyPopup");
      assert.equal(alarm.periodInMinutes, 60);

      await seedStorage(ext, { dailyPopupEnabled: false });
      await worker.evaluate(
        () =>
          new Promise((resolve) => {
            const poll = async () => ((await chrome.alarms.get("dailyPopup")) ? setTimeout(poll, 100) : resolve());
            poll();
          })
      );
    }));

  it("opens the daily popup window once when the startup alarm fires", () =>
    withExtension(async (ext) => {
      const worker = await ext.worker.worker();
      await seedStorage(ext, { dailyPopupEnabled: true });
      await waitForAlarm(worker, "dailyPopup");
      const opened = ext.browser.waitForTarget(isPopupWindow, { timeout: 10000 });
      // Unpacked extensions may schedule alarms below the 30 s minimum.
      await worker.evaluate(() => chrome.alarms.create("dailyPopupStartup", { when: Date.now() + 200 }));
      await opened;
      const lastPopupDate = await worker.evaluate(async () => (await chrome.storage.local.get("lastPopupDate")).lastPopupDate);
      assert.equal(lastPopupDate, new Date().toDateString());

      // Already shown today: the next check opens nothing. There is no event to wait for in
      // the negative case, so give the alarm a fixed window.
      let reopened = 0;
      ext.browser.on("targetcreated", (target) => {
        if (isPopupWindow(target)) reopened++;
      });
      await worker.evaluate(() => chrome.alarms.create("dailyPopupStartup", { when: Date.now() + 200 }));
      await new Promise((r) => setTimeout(r, 1500));
      assert.equal(reopened, 0);
    }));

  it("shows the daily joke toggle off by default and remembers it when turned on", () =>
    withExtension(async (ext) => {
      const { page } = await openPopup(ext);
      assert.equal(await page.$eval("#daily-toggle", (el) => el.checked), false);
      await page.click("#daily-toggle");
      await page.waitForFunction(async () => (await chrome.storage.local.get("dailyPopupEnabled")).dailyPopupEnabled === true);
    }));

  it("opens with the intro, both buttons and the logo rendered", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext);
      assert.equal(await jokeText(page), "Hey, wanna hear a joke?");
      assert.deepEqual(await buttonIds(page), ["yes-button", "no-button"]);
      await page.waitForFunction(() => !document.documentElement.classList.contains("pre-intro"));
      const logo = await page.$eval(".ad-logo", (img) => ({ ok: img.complete && img.naturalWidth > 0, fallbackHidden: document.querySelector(".ad-logo-tile .ad-fallback").hidden }));
      assert.deepEqual(logo, { ok: true, fallbackHidden: true });
      assert.deepEqual(log.requests, [], "no network until the user asks for a joke");
      assertClean(log);
    }));
});

describe("joke flow", () => {
  it("setup, punchline, another joke, all from the byjc API", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext);
      await click(page, "yes-button");
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).setup);
      assert.equal(await page.evaluate(() => document.activeElement.id), "joke-button");

      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).punchline);

      await click(page, "joke-again-button");
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).setup);
      assert.deepEqual(log.requests, ["www.byjc.dev", "www.byjc.dev"]);
      assertClean(log);
    }));

  it("restores an unrevealed cached joke with the punchline button", () =>
    withExtension(async (ext) => {
      await seedStorage(ext, { lastJoke: { ...TWO_PART, punchlineShown: false, timestamp: 1 } });
      const { page, log } = await openPopup(ext);
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), TWO_PART.setup);
      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      assert.equal(await jokeText(page), TWO_PART.punchline);
      assert.deepEqual(log.requests, []);
      assertClean(log);
    }));

  it("restores a revealed cached joke with its setup and punchline", () =>
    withExtension(async (ext) => {
      await seedStorage(ext, { lastJoke: { ...TWO_PART, punchlineShown: true, timestamp: 1 } });
      const { page, log } = await openPopup(ext);
      await waitForButton(page, "joke-again-button");
      assert.equal(await jokeText(page), `${TWO_PART.setup} ${TWO_PART.punchline}`);
      assert.deepEqual(log.requests, []);
      assertClean(log);
    }));

  it("falls back to another source when the byjc API fails", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext, { route: (host) => (host === "www.byjc.dev" ? "500" : "ok") });
      await requestNewJoke(page);
      await waitForButton(page, "joke-button");
      assert.match(await jokeText(page), FALLBACK_TEXT);
      assert.equal(log.requests[0], "www.byjc.dev");
      assert.equal(log.requests.length, 2, "stops at the first working fallback");
      assert.ok(log.warnings.some((w) => w.includes("byjc API returned HTTP 500")));
      assertClean(log, { allowNetworkErrors: true });
    }));

  it("times out a hung source after 5 s and moves on", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext, { route: (host) => (host === "www.byjc.dev" ? "hang" : "ok") });
      const started = Date.now();
      await requestNewJoke(page);
      await page.waitForFunction((re) => new RegExp(re).test(document.getElementById("joke").textContent), { timeout: 20000 }, FALLBACK_TEXT.source);
      const elapsed = Date.now() - started;
      assert.ok(elapsed >= 4900 && elapsed < 12000, `fallback after the timeout (${elapsed} ms)`);
      assertClean(log, { allowNetworkErrors: true });
    }));
});

describe("all sources failing", () => {
  it("shows the error and a working retry button (no cache)", () =>
    withExtension(async (ext) => {
      let online = false;
      const { page, log } = await openPopup(ext, { route: () => (online ? "ok" : "fail") });
      await click(page, "yes-button");
      await waitForButton(page, "retry-button");
      assert.equal(await jokeText(page), "Oops! Could not fetch a joke.");
      assert.equal(log.requests.length, 4, "tried every source once");
      assert.equal(await page.evaluate(() => document.activeElement.id), "retry-button");

      online = true;
      await click(page, "retry-button");
      await waitForButton(page, "joke-button");
      assert.equal(log.requests.at(-1), "www.byjc.dev");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).setup);
      assertClean(log, { allowNetworkErrors: true });
    }));

  it("does not repeat the joke on screen when asking for another one offline", () =>
    withExtension(async (ext) => {
      // The cached joke is the one on screen, so it must not come back as "another" joke.
      await seedStorage(ext, { lastJoke: { ...TWO_PART, punchlineShown: true, timestamp: 1 } });
      const { page, log } = await openPopup(ext, { route: () => "fail" });
      await waitForButton(page, "joke-again-button");
      await click(page, "joke-again-button");
      await waitForButton(page, "retry-button");
      assert.equal(await jokeText(page), "Oops! Could not fetch a joke.");
      assertClean(log, { allowNetworkErrors: true });
    }));
});

describe("reduced motion", () => {
  it("shows text instantly, runs no transform animations and skips confetti", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext, { reducedMotion: true });
      await click(page, "yes-button");
      // No typewriter: the thinking line is complete immediately.
      assert.equal(await jokeText(page), "Thinking of a good one...");
      await waitForButton(page, "joke-button");
      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](log.requests.length).punchline);
      // Right after the punch (when the full-motion build would be animating), nothing that runs
      // may move anything; then wait for every fade to settle rather than sleeping.
      const transformAnimations = await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === "running" && a.effect.getKeyframes().some((k) => k.transform && k.transform !== "none")).length
      );
      assert.equal(transformAnimations, 0);
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), { timeout: 5000 });
      const state = await page.evaluate(() => ({
        confetti: !!document.querySelector("canvas.confetti-canvas"),
        bodyTransform: getComputedStyle(document.querySelector(".avatar-body")).transform,
        tilt: document.querySelector(".stage").style.getPropertyValue("--tilt-x")
      }));
      assert.deepEqual(state, { confetti: false, bodyTransform: "none", tilt: "" });
      assertClean(log);
    }));

  it("animates (typewriter, confetti) without reduced motion", () =>
    withExtension(async (ext) => {
      const { page, log } = await openPopup(ext);
      await click(page, "yes-button");
      const partial = await jokeText(page);
      assert.ok(partial.length < "Thinking of a good one...".length, "typewriter starts partway");
      await waitForButton(page, "joke-button");
      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      await page.waitForSelector("canvas.confetti-canvas", { timeout: 3000 });
      assertClean(log);
    }));
});
