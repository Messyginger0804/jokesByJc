// Loads the unpacked extension in headless Chrome for Testing and mocks every joke API.
// Tests use withExtension() so each one gets its own profile and no state carries over.
// EXT_DIR points at the folder to load (defaults to the repo root; CI also runs it against
// the unzipped package).
import puppeteer from "puppeteer";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const EXT_DIR = resolve(process.env.EXT_DIR || ".");

export const JOKE_HOSTS = ["www.byjc.dev", "official-joke-api.appspot.com", "v2.jokeapi.dev", "icanhazdadjoke.com"];

// Response bodies in each API's own shape.
export const bodies = {
  "www.byjc.dev": (n) => ({ setup: `Why did byjc joke ${n} cross the road?`, punchline: "To reach the other tab." }),
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
  const worker = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("/background.js"), {
    timeout: 15000
  });
  const extensionId = new URL(worker.url()).host;
  return {
    browser,
    worker,
    extensionId,
    popupUrl: `chrome-extension://${extensionId}/popup.html`,
    async close() {
      await browser.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  };
}

/** Runs `fn` against a freshly launched extension with an empty profile, then closes it. */
export async function withExtension(fn) {
  const ext = await launch();
  try {
    return await fn(ext);
  } finally {
    await ext.close();
  }
}

/** Writes `items` to chrome.storage.local from the service worker, before the popup opens. */
export async function seedStorage(ext, items) {
  const worker = await ext.worker.worker();
  await worker.evaluate((data) => chrome.storage.local.set(data), items);
}

/**
 * Opens the popup in a tab with the joke APIs mocked.
 * `route(host, n)` returns "ok" (answer with that API's shape), "fail" (connection refused),
 * "500" or "hang" (never answers, so the 5 s timeout applies). Every request is recorded in
 * `log.requests`; `n` is the request's 1-based position there, so tests can derive the
 * expected body from `log.requests.length` instead of hard-coding a count.
 */
export async function openPopup(ext, { route = () => "ok", reducedMotion = false } = {}) {
  const page = await ext.browser.newPage();
  await page.setViewport({ width: 500, height: 600 });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

  const log = { requests: [], errors: [], warnings: [], csp: [] };
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "chrome-extension:") return request.continue();
    log.requests.push(url.host);
    if (!JOKE_HOSTS.includes(url.host)) return request.abort("blockedbyclient");
    const n = log.requests.length;
    const mode = route(url.host, n);
    if (mode === "fail") return request.abort("connectionrefused");
    if (mode === "hang") return;
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
    if (message.type() === "warn") log.warnings.push(text);
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
  return page.waitForFunction(
    (buttonId) => {
      const b = document.getElementById(buttonId);
      return b && !b.disabled;
    },
    { timeout },
    id
  );
}

export function click(page, id) {
  return page.$eval(`#${id}`, (b) => b.click());
}

/**
 * From whatever state the popup opened in (intro or a restored joke), asks for a new joke.
 * Resolves once the request has started, so the "Thinking" line is showing.
 */
export async function requestNewJoke(page) {
  await page.waitForFunction(() => {
    const b = document.querySelector(".button-container button");
    return b && !b.disabled;
  });
  let [first] = await buttonIds(page);
  if (first === "joke-button") {
    await click(page, "joke-button");
    await waitForButton(page, "joke-again-button");
    first = "joke-again-button";
  }
  await click(page, first);
}

// Console errors that are expected when a test makes the network fail on purpose.
export const isForcedNetworkError = (text) => /Failed to load resource|net::ERR_/.test(text);
