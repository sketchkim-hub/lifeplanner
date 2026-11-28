/**
 * Headless checks for Bible read-aloud sentence pauses.
 * The splitter never changes stored or displayed text; it only
 * describes the pieces handed to the speech engine.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSplitter() {
  const source = readFileSync(path.join(root, "tts-speech.js"), "utf8");
  const context = createContext({ console });
  runInContext(source, context, { filename: "tts-speech.js" });
  return context;
}

const api = loadSplitter();
const {
  splitTextForSpeech,
  TTS_SENTENCE_PAUSE_MS,
  TTS_CLAUSE_PAUSE_MS,
  TTS_BREATH_PAUSE_MS,
  TTS_MAX_CHUNK_CHARS
} = api;

assert.equal(TTS_SENTENCE_PAUSE_MS, 500);
assert.equal(TTS_CLAUSE_PAUSE_MS, 250);
assert.ok(TTS_BREATH_PAUSE_MS > 0 && TTS_BREATH_PAUSE_MS < TTS_SENTENCE_PAUSE_MS);
assert.ok(TTS_MAX_CHUNK_CHARS >= 40);

function compact(s) {
  return String(s).replace(/\s+/g, "");
}
function assertPreserves(original, chunks) {
  assert.equal(chunks.map((c) => c.text).join("").replace(/\s+/g, ""), compact(original));
  chunks.forEach((c) => {
    assert.ok(c.text.trim().length > 0, "empty chunk");
    assert.ok([...c.text].length <= TTS_MAX_CHUNK_CHARS + 8, c.text);
    assert.ok(c.pauseMs === TTS_SENTENCE_PAUSE_MS || c.pauseMs === TTS_CLAUSE_PAUSE_MS || c.pauseMs === TTS_BREATH_PAUSE_MS);
  });
}
function verseText(file, chapterIndex, verseIndex) {
  const data = JSON.parse(readFileSync(path.join(root, "bible", file), "utf8"));
  return data.chapters[chapterIndex][verseIndex];
}

const gn = [0, 1, 2].map((i) => verseText("gn.json", 0, i));
const gnChunks = splitTextForSpeech(gn.join("\n"));
console.log("창 1:1-3");
gnChunks.forEach((c, i) => console.log(`  ${i + 1}. (${c.pauseMs}ms) ${c.text}`));
assert.equal(gnChunks.length, 3);
gnChunks.forEach((c, i) => {
  assert.equal(c.text, gn[i]);
  assert.equal(c.pauseMs, TTS_SENTENCE_PAUSE_MS);
});

const jn = verseText("jhn.json", 2, 15);
const jnChunks = splitTextForSpeech(jn);
console.log("요 3:16");
jnChunks.forEach((c) => console.log(`  (${c.pauseMs}ms) ${c.text}`));
assert.equal(jnChunks.length, 1);
assert.equal(jnChunks[0].text, jn);
assert.equal(jnChunks[0].pauseMs, TTS_SENTENCE_PAUSE_MS);

const ps = JSON.parse(readFileSync(path.join(root, "bible", "ps.json"), "utf8")).chapters[22];
const psChunks = splitTextForSpeech(ps.join("\n"));
console.log("시 23편");
psChunks.forEach((c, i) => console.log(`  ${i + 1}. (${c.pauseMs}ms) ${c.text}`));
assert.equal(psChunks.length, ps.length);
psChunks.forEach((c, i) => {
  assert.equal(c.text, ps[i]);
  assert.equal(c.pauseMs, TTS_SENTENCE_PAUSE_MS);
});

const marked = "(없음)";
const markedChunks = splitTextForSpeech(marked);
assert.equal(markedChunks.length, 1);
assert.equal(markedChunks[0].text, "(없음)");
const included = "(12절에 포함되어 있음)";
assert.equal(splitTextForSpeech(included)[0].text, included);
const selah = "저를 하나님께 도움을 얻지 못한다 하나이다(셀라)";
assert.equal(splitTextForSpeech(selah)[0].text, selah);

const punctuated = "하나님이 가라사대 빛이 있으라. 빛이 있었고? 보시기에 좋았더라!";
const punctChunks = splitTextForSpeech(punctuated);
console.log("문장부호");
punctChunks.forEach((c) => console.log(`  (${c.pauseMs}ms) ${c.text}`));
assert.deepEqual(Array.from(punctChunks, (c) => c.text), [
  "하나님이 가라사대 빛이 있으라.",
  "빛이 있었고?",
  "보시기에 좋았더라!"
]);
punctChunks.forEach((c) => assert.equal(c.pauseMs, TTS_SENTENCE_PAUSE_MS));
assertPreserves(punctuated, punctChunks);

const clause = "엘리야가 가로되; 큰 소리로 부르라: 저는 신인즉 묵상하고 있는지";
const clauseChunks = splitTextForSpeech(clause);
console.log("세미콜론·콜론");
clauseChunks.forEach((c) => console.log(`  (${c.pauseMs}ms) ${c.text}`));
assert.equal(clauseChunks.length, 3);
assert.equal(clauseChunks[0].pauseMs, TTS_CLAUSE_PAUSE_MS);
assert.equal(clauseChunks[1].pauseMs, TTS_CLAUSE_PAUSE_MS);
assert.equal(clauseChunks[2].pauseMs, TTS_SENTENCE_PAUSE_MS);
assertPreserves(clause, clauseChunks);

const reference = "요한복음 3:16 은 이렇게 말합니다.";
const referenceChunks = splitTextForSpeech(reference);
assert.equal(referenceChunks.length, 1, "장절의 콜론에서는 쉬지 않아요");
assert.ok(referenceChunks[0].text.includes("3:16"));

const ellipsis = "내가 차라리 죽을찌언정…… 누구든지 내 자랑하는 것을 헛된 데로 돌리지 못하게 하리라";
const ellipsisChunks = splitTextForSpeech(ellipsis);
assert.ok(ellipsisChunks.length >= 2);
assert.ok(ellipsisChunks[0].text.endsWith("……"));
assert.equal(ellipsisChunks[0].pauseMs, TTS_SENTENCE_PAUSE_MS);
assertPreserves(ellipsis, ellipsisChunks);

const jer = JSON.parse(readFileSync(path.join(root, "bible", "jer.json"), "utf8"));
let longVerse = "";
jer.chapters.forEach((ch) => ch.forEach((t) => {
  if ([...t].length > [...longVerse].length) longVerse = t;
}));
const longChunks = splitTextForSpeech(longVerse);
console.log(`긴 절 (${[...longVerse].length}자) → ${longChunks.length}조각`);
longChunks.forEach((c, i) => console.log(`  ${i + 1}. (${c.pauseMs}ms, ${[...c.text].length}자) ${c.text.slice(0, 36)}…`));
assert.ok(longChunks.length > 1);
assert.equal(longChunks[longChunks.length - 1].pauseMs, TTS_SENTENCE_PAUSE_MS);
longChunks.slice(0, -1).forEach((c) => assert.equal(c.pauseMs, TTS_BREATH_PAUSE_MS));
assertPreserves(longVerse, longChunks);

assert.equal(splitTextForSpeech("").length, 0);
assert.equal(splitTextForSpeech("   \n  ").length, 0);

const html = readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /<script src="tts-speech\.js"><\/script>/);
assert.match(html, /splitTextForSpeech\(cleaned\)/);
assert.match(html, /filter\(v=>!isVerseMarker\(v\.t\)\)/);
assert.match(html, /function stopTTS\(\)\{[\s\S]*?ttsGen\+\+;[\s\S]*?clearTtsTimers\(\)/);
assert.match(html, /function pauseTTS\(\)/);
assert.match(html, /function resumeTTS\(\)/);
const sw = readFileSync(path.join(root, "sw.js"), "utf8");
assert.match(sw, /deungbul-cache-v10/);
assert.match(sw, /\.\/tts-speech\.js/);
assert.doesNotMatch(sw, /deungbul-cache-v8/);
assert.doesNotMatch(sw, /deungbul-cache-v9/);

const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = re.exec(html))) scripts.push(match[1]);
assert.ok(scripts.length >= 2, "inline scripts");
const dir = mkdtempSync(path.join(tmpdir(), "tts-syntax-"));
scripts.forEach((src, i) => {
  const file = path.join(dir, `inline-${i}.js`);
  writeFileSync(file, src);
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    console.error(checked.stderr);
    assert.fail(`inline script ${i} failed node --check`);
  }
});
const speechCheck = spawnSync(process.execPath, ["--check", path.join(root, "tts-speech.js")], { encoding: "utf8" });
assert.equal(speechCheck.status, 0, speechCheck.stderr);

console.log("syntax: ok");

const chromeBin = spawnSync("bash", ["-lc", "command -v google-chrome || command -v chromium || command -v chromium-browser"], { encoding: "utf8" });
if (chromeBin.status !== 0 || !chromeBin.stdout.trim()) {
  console.log("page load: chrome not installed, skipped");
} else {
  const pageErrors = await loadPageInChrome(path.join(root, "index.html"), chromeBin.stdout.trim());
  const interesting = pageErrors.filter((line) => /SyntaxError|ReferenceError|tts-speech|splitTextForSpeech|is not defined|Unexpected token/i.test(line));
  console.log("page load console errors:", pageErrors.length ? pageErrors : "(none)");
  if (interesting.length) {
    console.error(interesting.join("\n"));
    assert.fail("page load reported a script error");
  }
}
console.log("verify-tts-split: ok");

function loadPageInChrome(filePath, bin) {
  const url = "file://" + filePath;
  return new Promise((resolve, reject) => {
    const port = 9333;
    const chrome = spawn(bin, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${port}`,
      "about:blank"
    ], { stdio: "ignore" });
    const killer = setTimeout(() => {
      chrome.kill("SIGKILL");
      reject(new Error("chrome timed out"));
    }, 25000);
    chrome.on("error", (err) => {
      clearTimeout(killer);
      reject(err);
    });
    (async () => {
      try {
        let version = null;
        for (let i = 0; i < 40; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (res.ok) { version = await res.json(); break; }
          } catch (e) { /* chrome still starting */ }
          await new Promise((r) => setTimeout(r, 200));
        }
        if (!version || !version.webSocketDebuggerUrl) throw new Error("chrome debugger did not start");
        const browser = new WebSocket(version.webSocketDebuggerUrl);
        await onceOpen(browser);
        const errors = [];
        const pending = new Map();
        let nextId = 0;
        browser.addEventListener("message", (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg.result);
            pending.delete(msg.id);
          }
        });
        const send = (method, params) => new Promise((res) => {
          const id = ++nextId;
          pending.set(id, res);
          browser.send(JSON.stringify({ id, method, params }));
        });
        const target = await send("Target.createTarget", { url: "about:blank" });
        const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
        const page = targets.find((t) => t.id === target.targetId);
        if (!page) throw new Error("page target missing");
        const pageWs = new WebSocket(page.webSocketDebuggerUrl);
        await onceOpen(pageWs);
        const pagePending = new Map();
        let pageId = 0;
        const pageErrorsLocal = [];
        pageWs.addEventListener("message", (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id && pagePending.has(msg.id)) {
            pagePending.get(msg.id)(msg.result);
            pagePending.delete(msg.id);
          }
          if (msg.method === "Runtime.exceptionThrown") {
            const d = msg.params.exceptionDetails || {};
            const text = (d.exception && (d.exception.description || d.exception.value)) || d.text || "exception";
            pageErrorsLocal.push(String(text));
          }
          if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
            const text = (msg.params.args || []).map((a) => a.value || a.description || "").join(" ");
            pageErrorsLocal.push(text);
          }
        });
        const pageSend = (method, params) => new Promise((res) => {
          const id = ++pageId;
          pagePending.set(id, res);
          pageWs.send(JSON.stringify({ id, method, params }));
        });
        await pageSend("Runtime.enable");
        await pageSend("Page.enable");
        await pageSend("Page.navigate", { url });
        await new Promise((r) => setTimeout(r, 3500));
        errors.push(...pageErrorsLocal);
        pageWs.close();
        browser.close();
        clearTimeout(killer);
        chrome.kill("SIGKILL");
        resolve(errors);
      } catch (err) {
        clearTimeout(killer);
        chrome.kill("SIGKILL");
        reject(err);
      }
    })();
  });
}

function onceOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", (err) => reject(err));
  });
}
