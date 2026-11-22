/**
 * The Capacitor bundle must include future static folders (bible/)
 * and must not include tooling or the signing key.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "copy-web.mjs");
const src = await mkdtemp(path.join(tmpdir(), "lp-src-"));
const dest = await mkdtemp(path.join(tmpdir(), "lp-www-"));
await rm(dest, { recursive: true, force: true });

await mkdir(path.join(src, "bible"), { recursive: true });
await mkdir(path.join(src, "icons"), { recursive: true });
await mkdir(path.join(src, "node_modules", "pkg"), { recursive: true });
await mkdir(path.join(src, "android"), { recursive: true });
await mkdir(path.join(src, ".github"), { recursive: true });
await writeFile(path.join(src, "index.html"), "<html>ok</html>");
await writeFile(path.join(src, "native-shell.js"), "/* shell */");
await writeFile(path.join(src, "bible", "gen.json"), "{\"book\":1}");
await writeFile(path.join(src, "bible", "NOTICE"), "copyright notice");
await writeFile(path.join(src, "icons", "icon-192.png"), "png");
await writeFile(path.join(src, "node_modules", "pkg", "secret.js"), "nope");
await writeFile(path.join(src, "android", "upload.p12"), "key");
await writeFile(path.join(src, "package.json"), "{}");
await writeFile(path.join(src, "README_배포가이드.md"), "doc");

const run = spawnSync(process.execPath, [script], {
  env: { ...process.env, WEB_SRC: src, WEB_DEST: dest }
});
assert.equal(run.status, 0, run.stderr && run.stderr.toString());

assert.equal(await readFile(path.join(dest, "index.html"), "utf8"), "<html>ok</html>");
assert.equal(await readFile(path.join(dest, "bible", "gen.json"), "utf8"), "{\"book\":1}");
assert.equal(await readFile(path.join(dest, "bible", "NOTICE"), "utf8"), "copyright notice");
assert.equal(await readFile(path.join(dest, "native-shell.js"), "utf8"), "/* shell */");
await assert.rejects(readFile(path.join(dest, "node_modules", "pkg", "secret.js")));
await assert.rejects(readFile(path.join(dest, "android", "upload.p12")));
await assert.rejects(readFile(path.join(dest, "package.json")));
await assert.rejects(readFile(path.join(dest, "README_배포가이드.md")));

await rm(src, { recursive: true, force: true });
await rm(dest, { recursive: true, force: true });
console.log("verify-copy: ok");
