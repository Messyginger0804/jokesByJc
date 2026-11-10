// Builds the Web Store zip with build.sh and checks what went into it.
// Usage: npm run check:package
// Also unpacks it into dist/unpacked so the E2E suite can run against the packaged build
// (EXT_DIR=dist/unpacked npm run e2e).
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, posix } from "node:path";

const ZIP = "jokesByJc-extension.zip";
const UNPACKED = "dist/unpacked";
const SHIPPED_FILES = ["manifest.json", "background.js", "popup.html", "popup.js", "jokes.js", "motion.js", "styles.css", "ad.css", "vendor/motion-mini.js", "vendor/confetti.js"];
const SHIPPED_DIRS = ["icons", "images", "vendor/licenses"];

const failures = [];
const fail = (message) => failures.push(message);

const listDir = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => posix.join(e.parentPath.replaceAll("\\", "/"), e.name));

execFileSync("./build.sh", { stdio: ["ignore", "ignore", "inherit"] });
const entries = execFileSync("unzip", ["-Z1", ZIP], { encoding: "utf8" })
  .split("\n")
  .filter((line) => line && !line.endsWith("/"));

// 1. Exactly the shipped files: nothing missing, nothing extra.
const expected = new Set([...SHIPPED_FILES, ...SHIPPED_DIRS.flatMap(listDir)]);
for (const file of expected) if (!entries.includes(file)) fail(`missing from zip: ${file}`);
for (const entry of entries) if (!expected.has(entry)) fail(`unexpected file in zip: ${entry}`);

// 2. Unpack it and check the packaged manifest.
rmSync("dist", { recursive: true, force: true });
mkdirSync(UNPACKED, { recursive: true });
execFileSync("unzip", ["-q", ZIP, "-d", UNPACKED]);
const sourceManifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const packagedManifest = JSON.parse(readFileSync(join(UNPACKED, "manifest.json"), "utf8"));
if (packagedManifest.version !== sourceManifest.version) {
  fail(`manifest version mismatch: zip ${packagedManifest.version}, source ${sourceManifest.version}`);
}
if (!/^\d+(\.\d+){0,3}$/.test(packagedManifest.version)) fail(`invalid manifest version: ${packagedManifest.version}`);
const readme = readFileSync("README.md", "utf8");
const readmeVersion = readme.match(/## Version\s+(\S+)/)?.[1];
if (readmeVersion !== sourceManifest.version) fail(`README version ${readmeVersion} does not match manifest ${sourceManifest.version}`);

// 3. Every file the extension references is in the package.
const referenced = new Set([
  packagedManifest.background.service_worker,
  packagedManifest.action.default_popup,
  ...Object.values(packagedManifest.icons),
  ...Object.values(packagedManifest.action.default_icon)
]);
const html = readFileSync(join(UNPACKED, "popup.html"), "utf8");
for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!/^https?:/.test(ref)) referenced.add(ref);
for (const file of entries.filter((e) => e.endsWith(".js") && !e.startsWith("vendor/"))) {
  const source = readFileSync(join(UNPACKED, file), "utf8");
  for (const [, ref] of source.matchAll(/(?:from|import\()\s*"(\.\/[^"]+)"/g)) referenced.add(posix.join(posix.dirname(file), ref));
}
for (const ref of referenced) if (!existsSync(join(UNPACKED, ref))) fail(`referenced but not packaged: ${ref}`);

if (failures.length) {
  console.error(`Package check failed:\n  ${failures.join("\n  ")}`);
  // Never leave a bad build behind for EXT_DIR=dist/unpacked to pick up.
  rmSync("dist", { recursive: true, force: true });
  process.exit(1);
}
console.log(`Package OK: ${entries.length} files, version ${packagedManifest.version}, unpacked to ${UNPACKED}`);
