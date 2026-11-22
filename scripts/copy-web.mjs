/**
 * Copy the static web app into www/ for Capacitor.
 * The GitHub Pages site keeps serving the repo root. This script only
 * builds the bundled copy that the Android WebView loads.
 *
 * Everything at the repo root is copied except tooling, so a future
 * folder such as bible/*.json is included without a script change.
 *
 * WEB_SRC / WEB_DEST override the paths (used by the copy test).
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.WEB_SRC
  ? path.resolve(process.env.WEB_SRC)
  : path.resolve(here, "..");
const dest = process.env.WEB_DEST
  ? path.resolve(process.env.WEB_DEST)
  : path.join(root, "www");

const EXCLUDE_DIRS = new Set([
  ".git",
  ".github",
  ".gradle",
  ".idea",
  ".cursor",
  "node_modules",
  "android",
  "www",
  "scripts",
  "twa",
  ".well-known"
]);

const EXCLUDE_FILES = new Set([
  "package.json",
  "package-lock.json",
  "capacitor.config.json",
  "capacitor.config.ts",
  ".gitignore",
  "twa-manifest.json",
  "README_배포가이드.md",
  "설정안내.md"
]);

function excludedFile(name) {
  if (EXCLUDE_FILES.has(name)) return true;
  if (name.startsWith(".")) {
    // Keep .nojekyll out of the APK; it only matters for GitHub Pages.
    return true;
  }
  return /\.(p12|jks|keystore|aab|apk)$/i.test(name);
}

function copyFilter(src) {
  const base = path.basename(src);
  if (base === ".DS_Store") return false;
  if (/\.(p12|jks|keystore|aab|apk)$/i.test(base)) return false;
  return true;
}

const entries = await readdir(root, { withFileTypes: true });
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

let copied = 0;
for (const ent of entries) {
  if (ent.isDirectory()) {
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    await cp(path.join(root, ent.name), path.join(dest, ent.name), {
      recursive: true,
      filter: copyFilter
    });
    copied += 1;
    continue;
  }
  if (!ent.isFile() || excludedFile(ent.name)) continue;
  await cp(path.join(root, ent.name), path.join(dest, ent.name));
  copied += 1;
}

const indexPath = path.join(dest, "index.html");
try {
  await readdir(dest);
} catch (err) {
  console.error(err);
  process.exit(1);
}
const { access } = await import("node:fs/promises");
try {
  await access(indexPath);
} catch {
  console.error("copy-web: index.html was not copied to " + dest);
  process.exit(1);
}

console.log(`copy-web: ${copied} entries -> ${dest}`);
