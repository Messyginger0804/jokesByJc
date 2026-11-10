// End-to-end: the real extension (unpacked) in headless Chrome, joke APIs mocked.
// Run with: npm run e2e
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openPopup, jokeText, buttonIds, waitForButton, click, requestNewJoke, bodies, isForcedNetworkError } from "./harness.mjs";

let ext;

before(async () => {
  ext = await launch();
});

after(async () => {
  await ext?.close();
});

function assertClean(log, { allowNetworkErrors = false } = {}) {
  assert.deepEqual(log.csp, [], "no CSP violations");
  const errors = allowNetworkErrors ? log.errors.filter((e) => !isForcedNetworkError(e)) : log.errors;
  assert.deepEqual(errors, [], "no console or page errors");
}

describe("extension load", () => {
  it("registers the hourly daily-popup alarm on install", async () => {
    const worker = await ext.worker.worker();
    // onInstalled may still be running right after the worker starts.
    const alarm = await worker.evaluate(async () => {
      for (let i = 0; i < 50; i++) {
        const found = await chrome.alarms.get("dailyPopup");
        if (found) return found;
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    });
    assert.equal(alarm?.periodInMinutes, 60);
  });

  it("opens the daily popup window once when the startup alarm fires", async () => {
    const fresh = await launch();
    try {
      const worker = await fresh.worker.worker();
      const opened = [];
      fresh.browser.on("targetcreated", (target) => {
        if (target.url().endsWith("/popup.html")) opened.push(target);
      });
      // Unpacked extensions may schedule alarms below the 30 s minimum.
      await worker.evaluate(() => chrome.alarms.create("dailyPopupStartup", { when: Date.now() + 200 }));
      await new Promise((r) => setTimeout(r, 2500));
      assert.equal(opened.length, 1, "one popup window");
      const lastPopupDate = await worker.evaluate(async () => (await chrome.storage.local.get("lastPopupDate")).lastPopupDate);
      assert.equal(lastPopupDate, new Date().toDateString());

      // Already shown today: the next check opens nothing.
      await worker.evaluate(() => chrome.alarms.create("dailyPopupStartup", { when: Date.now() + 200 }));
      await new Promise((r) => setTimeout(r, 2000));
      assert.equal(opened.length, 1);
    } finally {
      await fresh.close();
    }
  });

  it("opens with the intro, both buttons and the logo rendered", async () => {
    const { page, log } = await openPopup(ext);
    assert.equal(await jokeText(page), "Hey, wanna hear a joke?");
    assert.deepEqual(await buttonIds(page), ["yes-button", "no-button"]);
    await page.waitForFunction(() => !document.documentElement.classList.contains("pre-intro"));
    const logo = await page.$eval(".ad-logo", (img) => ({ ok: img.complete && img.naturalWidth > 0, fallbackHidden: document.querySelector(".ad-logo-tile .ad-fallback").hidden }));
    assert.deepEqual(logo, { ok: true, fallbackHidden: true });
    assert.deepEqual(log.requests, [], "no network until the user asks for a joke");
    assertClean(log);
    await page.close();
  });
});

describe("joke flow", () => {
  it("setup, punchline, another joke, all from the byjc API", async () => {
    const { page, log } = await openPopup(ext);
    await click(page, "yes-button");
    await waitForButton(page, "joke-button");
    assert.equal(await jokeText(page), bodies["www.byjc.dev"](1).setup);
    assert.equal(await page.evaluate(() => document.activeElement.id), "joke-button");

    await click(page, "joke-button");
    await waitForButton(page, "joke-again-button");
    assert.equal(await jokeText(page), "To reach the other tab.");

    await click(page, "joke-again-button");
    await waitForButton(page, "joke-button");
    assert.equal(await jokeText(page), bodies["www.byjc.dev"](2).setup);
    assert.deepEqual(log.requests, ["www.byjc.dev", "www.byjc.dev"]);
    assertClean(log);
    await page.close();
  });

  it("restores the cached joke when the popup is reopened", async () => {
    const { page } = await openPopup(ext);
    await page.waitForFunction(() => document.getElementById("joke-button") || document.getElementById("joke-again-button"));
    assert.match(await jokeText(page), /Why did byjc joke \d+ cross the road\?|To reach/);
    await page.close();
  });

  it("falls back to another source when the byjc API fails", async () => {
    const { page, log } = await openPopup(ext, { route: (host) => (host === "www.byjc.dev" ? "500" : "ok") });
    await requestNewJoke(page);
    await page.waitForFunction(() => /Official|JokeAPI|dad joke/.test(document.getElementById("joke").textContent) && !document.querySelector(".button-container button").disabled, { timeout: 20000 });
    assert.equal(log.requests[0], "www.byjc.dev");
    assert.equal(log.requests.length, 2, "stops at the first working fallback");
    assert.ok(log.warnings.some((w) => w.includes("byjc API returned HTTP 500")));
    assertClean(log, { allowNetworkErrors: true });
    await page.close();
  });

  it("times out a hung source after 5 s and moves on", async () => {
    const { page, log } = await openPopup(ext, { route: (host) => (host === "www.byjc.dev" ? "hang" : "ok") });
    const started = Date.now();
    await requestNewJoke(page);
    await page.waitForFunction(() => /Official|JokeAPI|dad joke/.test(document.getElementById("joke").textContent), { timeout: 20000 });
    const elapsed = Date.now() - started;
    assert.ok(elapsed >= 4900 && elapsed < 12000, `fallback after the timeout (${elapsed} ms)`);
    assertClean(log, { allowNetworkErrors: true });
    await page.close();
  });
});

describe("all sources failing", () => {
  it("shows the error and a working retry button (no cache)", async () => {
    // Fresh profile so there is no cached joke to fall back to.
    const fresh = await launch();
    try {
      let online = false;
      const { page, log } = await openPopup(fresh, { route: () => (online ? "ok" : "fail") });
      await click(page, "yes-button");
      await waitForButton(page, "retry-button");
      assert.equal(await jokeText(page), "Oops! Could not fetch a joke.");
      assert.equal(log.requests.length, 4, "tried every source once");
      assert.equal(await page.evaluate(() => document.activeElement.id), "retry-button");

      online = true;
      await click(page, "retry-button");
      await waitForButton(page, "joke-button");
      assert.equal(await jokeText(page), bodies["www.byjc.dev"](5).setup);
      assertClean(log, { allowNetworkErrors: true });
    } finally {
      await fresh.close();
    }
  });

  it("does not repeat the joke on screen when asking for another one offline", async () => {
    // The cached joke is the one on screen, so it must not come back as "another" joke.
    const { page, log } = await openPopup(ext, { route: () => "fail" });
    await requestNewJoke(page);
    await waitForButton(page, "retry-button");
    assert.equal(await jokeText(page), "Oops! Could not fetch a joke.");
    assertClean(log, { allowNetworkErrors: true });
    await page.close();
  });
});

describe("reduced motion", () => {
  it("shows text instantly, runs no transform animations and skips confetti", async () => {
    const fresh = await launch();
    try {
      const { page, log } = await openPopup(fresh, { reducedMotion: true });
      await click(page, "yes-button");
      // No typewriter: the thinking line is complete immediately.
      assert.equal(await jokeText(page), "Thinking of a good one...");
      await waitForButton(page, "joke-button");
      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      assert.equal(await jokeText(page), "To reach the other tab.");
      await new Promise((r) => setTimeout(r, 600));
      const state = await page.evaluate(() => ({
        confetti: !!document.querySelector("canvas.confetti-canvas"),
        transformAnimations: document
          .getAnimations()
          .filter((a) => a.playState === "running" && a.effect.getKeyframes().some((k) => k.transform && k.transform !== "none")).length,
        bodyTransform: getComputedStyle(document.querySelector(".avatar-body")).transform,
        tilt: document.querySelector(".stage").style.getPropertyValue("--tilt-x")
      }));
      assert.deepEqual(state, { confetti: false, transformAnimations: 0, bodyTransform: "none", tilt: "" });
      assertClean(log);
    } finally {
      await fresh.close();
    }
  });

  it("animates (typewriter, confetti) without reduced motion", async () => {
    const fresh = await launch();
    try {
      const { page, log } = await openPopup(fresh);
      await click(page, "yes-button");
      const partial = await jokeText(page);
      assert.ok(partial.length < "Thinking of a good one...".length, "typewriter starts partway");
      await waitForButton(page, "joke-button");
      await click(page, "joke-button");
      await waitForButton(page, "joke-again-button");
      await page.waitForSelector("canvas.confetti-canvas", { timeout: 3000 });
      assertClean(log);
    } finally {
      await fresh.close();
    }
  });
});
