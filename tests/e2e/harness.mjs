// Loads the unpacked extension in headless Chrome for Testing and mocks every joke API.
// Every test gets its own browser profile, so no state carries over between tests.
import puppeteer from "puppeteer";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const EXT_DIR = resolve(process.env.EXT_DIR || ".");

export const JOKE_HOSTS = ["www.byjc.dev", "official-joke-api.appspot.com", "v2.jokeapi.dev", "icanhazdadjoke.com"];
export const FALLBACK_TEXT = /Official|JokeAPI|dad joke/;

// Response bodies in each API's own shape; `n` is the request number within the page.
export const bodies = {
  "www.byjc.dev": (n) => ({ setup: `Why did byjc joke ${n} cross the road?`, punchline: `To reach tab ${n}.` }),
  "official-joke-api.appspot.com": (n) => ({ id: n, type: "general", setup: `Official setup ${n}?`, punchline: `Official punchline ${n}.` }),
  "v2.jokeapi.dev": (n) => ({ error: false, type: "twopart", setup: `JokeAPI setup ${n}?`, delivery: `JokeAPI delivery ${n}.` }),
  "icanhazdadjoke.com": (n) => ({ id: `d${n}`, status: 200, joke: `Why is dad joke ${n} so good? Because it is tested.` })
};

export async function launch() {
  const userDataDir = mkdtempSync(join(tmpdir(), "jokes-e2e-"));
  const browser = await puppeteer.launch({
    headless: true,
    pipe: true,
    enableExtensions: true,
    userDataDir,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      // GitHub-hosted Ubuntu runners block the Chrome sandbox's user namespaces.
      "--no-sandbox"
    ]
  });
  const workerTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("/background.js"), {
    timeout: 15000
  });
  const extensionId = new URL(workerTarget.url()).host;
  return {
    browser,
    workerTarget,
    worker: () => workerTarget.worker(),
    extensionId,
    popupUrl: `chrome-extension://${extensionId}/popup.html`,
    async close() {
      await browser.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  };
}

/** Runs `fn` against a freshly launched extension with an empty profile. */
export async function withExtension(fn) {
  const ext = await launch();
  try {
    return await fn(ext);
  } finally {
    await ext.close();
  }
}

/** Writes `items` to chrome.storage.local from the service worker before the popup opens. */
export async function seedStorage(ext, items) {
  const worker = await ext.worker();
  await worker.evaluate((data) => chrome.storage.local.set(data), items);
}

/**
 * Opens the popup in a tab with the joke APIs mocked.
 * `route(host, n)` returns "ok" (answer with that API's shape), "fail" (connection refused)
 * or "500". Every request is recorded in `log.requests`.
 */
export async function openPopup(ext, { route = () => "ok", reducedMotion = false } = {}) {
  const page = await ext.browser.newPage();
  await page.setViewport({ width: 500, height: 600 });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

  const log = { requests: [], errors: [], csp: [] };
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "chrome-extension:") return request.continue();
    log.requests.push(url.host);
    if (!JOKE_HOSTS.includes(url.host)) return request.abort("blockedbyclient");
    const n = log.requests.length;
    const mode = route(url.host, n);
    if (mode === "fail") return request.abort("connectionrefused");
    if (mode === "500") return request.respond({ status: 500, contentType: "application/json", body: "{}" });
    request.respond({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(bodies[url.host](n))
    });
  });
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") log.errors.push(text);
    if (/Content Security Policy|Refused to/i.test(text)) log.csp.push(text);
  });
  page.on("pageerror", (error) => log.errors.push(`pageerror: ${error.message}`));
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`Refused to load (CSP ${e.violatedDirective}): ${e.blockedURI}`);
    });
  });

  await page.goto(ext.popupUrl, { waitUntil: "load" });
  return { page, log };
}

export const jokeText = (page) => page.$eval("#joke", (el) => el.textContent);
export const buttonIds = (page) => page.$$eval(".button-container button", (bs) => bs.map((b) => b.id));

export function waitForButton(page, id, timeout = 20000) {
  return page.waitForFunction((buttonId) => !!document.getElementById(buttonId), { timeout }, id);
}

/** Waits until the joke line shows exactly `text` (the typewriter has finished). */
export function waitForText(page, text, timeout = 20000) {
  return page.waitForFunction((t) => document.getElementById("joke").textContent === t, { timeout }, text);
}

export function click(page, id) {
  return page.$eval(`#${id}`, (b) => b.click());
}

// Console errors that are expected when a test makes the network fail on purpose.
export const isForcedNetworkError = (text) => /Failed to load resource|net::ERR_/.test(text);
