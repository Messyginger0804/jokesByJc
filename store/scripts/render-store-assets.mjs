// Renders the Chrome Web Store screenshots and promo images from the real extension.
// Usage (repo root, after npm install):  node store/scripts/render-store-assets.mjs
//
// 1. Loads the unpacked extension in Chrome for Testing (the same Puppeteer setup as the
//    E2E suite) with the joke APIs mocked, walks the popup through its states and captures
//    the popup card at device scale factor 2.
// 2. Places each capture on a 1280x800 branded background with a short caption.
// 3. Renders the 440x280 small promo tile and the 1400x560 marquee.
// Outputs are opaque PNGs (no alpha channel) in store/screenshots/ and store/promo/.
// Math.random is seeded in the popup so the confetti burst comes out the same every run.
import puppeteer from "puppeteer";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SHOTS = join(ROOT, "store/screenshots");
const PROMO = join(ROOT, "store/promo");
const JOKE = { setup: "What do you call a fake noodle?", punchline: "An impasta!" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataUrl = (buf, type = "image/png") => `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
const asset = (path, type) => dataUrl(readFileSync(join(ROOT, path)), type);

// ---------- 1. Capture the popup ----------

async function capturePopup(browser, popupUrl) {
  const page = await browser.newPage();
  // 480 px is the popup's own width (body width in styles.css), so this is the popup window
  // as the toolbar shows it. Height is fitted to the content before each capture.
  await page.setViewport({ width: 480, height: 600, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "chrome-extension:") return request.continue();
    if (url.host !== "www.byjc.dev") return request.abort("blockedbyclient");
    request.respond({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(JOKE)
    });
  });
  await page.evaluateOnNewDocument(() => {
    let seed = 20261110;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  });
  await page.goto(popupUrl, { waitUntil: "load" });
  // Fit the window to the tallest state (two-line jokes) once, before any animation runs.
  const fit = await page.evaluate(() => Math.ceil(document.documentElement.getBoundingClientRect().height) + 30);
  await page.setViewport({ width: 480, height: fit, deviceScaleFactor: 2 });

  const button = (id) => page.waitForFunction((b) => document.getElementById(b) && !document.getElementById(b).disabled, { timeout: 20000 }, id);
  // The whole popup window, unmodified (confetti included, clipped at the window edge as in Chrome).
  const shot = async () => {
    const height = await page.evaluate(() => Math.ceil(document.documentElement.getBoundingClientRect().height));
    return page.screenshot({ clip: { x: 0, y: 0, width: 480, height } });
  };
  const pose = () => page.evaluate(() => [...document.querySelectorAll(".pose")].find((i) => +getComputedStyle(i).opacity > 0.5)?.dataset.pose);

  const caps = {};
  await sleep(1400);
  caps.intro = { png: await shot(), pose: await pose(), text: await page.$eval("#joke", (e) => e.textContent) };
  await page.click("#yes-button");
  await button("joke-button");
  await sleep(900);
  caps.setup = { png: await shot(), pose: await pose(), text: await page.$eval("#joke", (e) => e.textContent) };
  await page.click("#joke-button");
  await page.waitForFunction(() => document.getElementById("joke-again-button"), { timeout: 20000 });
  await sleep(420);
  caps.punch = { png: await shot(), pose: await pose(), text: await page.$eval("#joke", (e) => e.textContent) };
  await sleep(3000);
  caps.end = { png: await shot(), pose: await pose(), text: await page.$eval("#joke", (e) => e.textContent) };
  for (const [k, v] of Object.entries(caps)) console.log(`captured ${k}: pose=${v.pose} text=${JSON.stringify(v.text)}`);
  if (problems.length) throw new Error(`popup console errors:\n${problems.join("\n")}`);
  await page.close();
  return caps;
}

// ---------- 2. Compose ----------

const FONT = `"Noto Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const BG = `
  background:
    radial-gradient(900px 600px at 78% 45%, rgba(37, 99, 235, 0.42), transparent 70%),
    radial-gradient(700px 500px at 0% 100%, rgba(16, 185, 129, 0.10), transparent 70%),
    linear-gradient(160deg, #161b26 0%, #121212 60%, #0e1117 100%);`;

function screenshotHtml({ headline, sub, popup }) {
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
    body { ${BG} font-family: ${FONT}; color: #fff; position: relative; }
    .brand { position: absolute; left: 88px; top: 72px; display: flex; align-items: center; gap: 16px;
             font-size: 26px; font-weight: 700; letter-spacing: -0.3px; color: #e0e0e0; }
    .brand img { width: 56px; height: 56px; }
    .copy { position: absolute; left: 88px; top: 0; bottom: 0; width: 520px; display: flex;
            flex-direction: column; justify-content: center; }
    h1 { margin: 0 0 22px; font-size: 60px; line-height: 1.08; font-weight: 800; letter-spacing: -1.5px; }
    p { margin: 0; font-size: 26px; line-height: 1.45; color: #b8c0cc; }
    .shot { position: absolute; right: 84px; top: 50%; transform: translateY(-50%); width: 552px;
            border-radius: 14px; outline: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6), 0 0 0 8px rgba(37, 99, 235, 0.10); }
  </style></head><body>
    <div class="brand"><img src="${asset("icons/icon128.png")}" alt="">Jokes By JC</div>
    <div class="copy"><h1>${headline}</h1><p>${sub}</p></div>
    <img class="shot" src="${dataUrl(popup)}" alt="">
  </body></html>`;
}

function promoHtml({ width, height, avatar, title, tagline, big }) {
  const s = big ? 2.2 : 1;
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    body { ${BG} font-family: ${FONT}; color: #fff; position: relative; }
    /* Mirrored, as the popup shows it; the art's cropped edge then sits on the tile edge. */
    .avatar { position: absolute; right: 0; bottom: 0; height: ${big ? 520 : 250}px; transform: scaleX(-1);
              filter: drop-shadow(0 ${10 * s}px ${24 * s}px rgba(0,0,0,0.5)); }
    .glow { position: absolute; right: ${big ? -60 : -40}px; bottom: ${big ? -150 : -80}px; width: ${big ? 680 : 330}px;
            height: ${big ? 680 : 330}px; border-radius: 50%;
            background: radial-gradient(circle, #34405a 0%, #1f2533 62%, transparent 72%); }
    .copy { position: absolute; left: ${big ? 110 : 26}px; top: 0; bottom: 0; display: flex; flex-direction: column;
            justify-content: center; width: ${big ? 720 : 230}px; }
    .icon { width: ${big ? 112 : 56}px; height: ${big ? 112 : 56}px; margin: 0 0 ${big ? 26 : 12}px; }
    h1 { margin: 0; font-size: ${big ? 104 : 48}px; line-height: 1.0; font-weight: 800; letter-spacing: ${big ? -3 : -1.2}px; }
    p { margin: ${big ? 26 : 12}px 0 0; font-size: ${big ? 40 : 21}px; line-height: 1.3; font-weight: 600; color: #93b4ff; }
  </style></head><body>
    <div class="glow"></div>
    <img class="avatar" src="${asset(`images/${avatar}`)}" alt="">
    <div class="copy"><img class="icon" src="${asset("icons/icon128.png")}" alt=""><h1>${title}</h1><p>${tagline}</p></div>
  </body></html>`;
}

async function render(browser, html, width, height, out) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  await page.close();
  writeFileSync(out, stripAlpha(png));
  const { w, h, colorType } = pngInfo(readFileSync(out));
  console.log(`${out.slice(ROOT.length + 1)}: ${w}x${h}, color type ${colorType} (2 = RGB, no alpha)`);
  if (w !== width || h !== height || colorType !== 2) throw new Error(`bad output ${out}`);
}

// ---------- PNG helpers: Chrome writes RGBA; the store wants no alpha ----------

function pngInfo(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType: buf[25] };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Re-encodes an 8-bit RGBA PNG as 8-bit RGB (alpha dropped; the pages are fully opaque). */
function stripAlpha(buf) {
  const { w, h, colorType } = pngInfo(buf);
  if (colorType === 2) return buf;
  if (colorType !== 6 || buf[24] !== 8 || buf[28] !== 0) throw new Error("expected 8-bit non-interlaced RGBA PNG");
  const idat = [];
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const rgba = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rgba[y * stride + x - bpp] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rgba[y * stride + x] = v & 0xff;
    }
  }
  const out = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    out[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      if (rgba[y * stride + x * 4 + 3] !== 255) throw new Error(`transparent pixel at ${x},${y}`);
      rgba.copy(out, y * (w * 3 + 1) + 1 + x * 3, y * stride + x * 4, y * stride + x * 4 + 3);
    }
  }
  const ihdr = Buffer.from(buf.subarray(16, 29));
  ihdr[9] = 2;
  return Buffer.concat([buf.subarray(0, 8), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(out, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- Main ----------

const extDir = resolve(process.env.EXT_DIR || ROOT);
const userDataDir = mkdtempSync(join(tmpdir(), "jokes-store-"));
const browser = await puppeteer.launch({
  headless: true,
  pipe: true,
  enableExtensions: true,
  userDataDir,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, "--no-first-run", "--no-default-browser-check", "--no-sandbox"]
});
try {
  const worker = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("/background.js"), { timeout: 15000 });
  const popupUrl = `chrome-extension://${new URL(worker.url()).host}/popup.html`;
  const caps = await capturePopup(browser, popupUrl);
  const expected = { intro: "intro", setup: "pointing", punch: "lol", end: "coolguy" };
  for (const [k, p] of Object.entries(expected)) if (caps[k].pose !== p) throw new Error(`${k}: expected pose ${p}, got ${caps[k].pose}`);

  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(PROMO, { recursive: true });
  const shots = [
    ["01-intro", caps.intro, "A joke a day, delivered by JC", "Click the toolbar icon any time, or switch on the optional daily joke."],
    ["02-setup", caps.setup, "First, the setup&hellip;", "JC types it out, then points you to the punchline when you&rsquo;re ready."],
    ["03-punchline", caps.punch, "&hellip;then the punchline!", "JC cracks up with a burst of confetti. Reduced-motion settings are respected."],
    ["04-another", caps.end, "One more? Sure.", "Grab another joke whenever you like. No account, no tracking, just jokes."]
  ];
  for (const [name, cap, headline, sub] of shots) {
    await render(browser, screenshotHtml({ headline, sub, popup: cap.png }), 1280, 800, join(SHOTS, `${name}.png`));
  }
  await render(browser, promoHtml({ width: 440, height: 280, avatar: "intro.png", title: "Jokes By JC", tagline: "A daily joke,<br>with a laugh." }), 440, 280, join(PROMO, "small-promo-440x280.png"));
  await render(browser, promoHtml({ width: 1400, height: 560, avatar: "intro.png", title: "Jokes By JC", tagline: "A daily joke, with a laugh.", big: true }), 1400, 560, join(PROMO, "marquee-1400x560.png"));
} finally {
  await browser.close();
  rmSync(userDataDir, { recursive: true, force: true });
}
