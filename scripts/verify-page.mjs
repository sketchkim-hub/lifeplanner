/**
 * Headless page load: the app shell should come up without console errors,
 * and the Bible search screen should find 요한복음 3:16 from the real text.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const which = spawnSync("bash", ["-lc", "command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser"], { encoding: "utf8" });
  if (which.status !== 0) return "";
  return which.stdout.trim().split("\n")[0];
}

const chromeBin = findChrome();
assert.ok(chromeBin, "headless page check needs Chrome or Chromium");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(root, pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const pageUrl = "http://127.0.0.1:" + server.address().port + "/index.html";
const profile = await mkdtemp(path.join(tmpdir(), "lp-chrome-"));
const chrome = spawn(chromeBin, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--disable-extensions",
  "--disable-sync",
  "--remote-debugging-port=0",
  "--user-data-dir=" + profile,
  "about:blank"
], { stdio: ["ignore", "pipe", "pipe"] });

const errors = [];
let pageWs = null;

function track(kind, text) {
  const line = String(text || "").trim();
  if (!line) return;
  errors.push(kind + ": " + line);
}

try {
  const listen = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not open a DevTools port\n" + buf)), 15000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const found = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    };
    chrome.stdout.on("data", onData);
    chrome.stderr.on("data", onData);
    chrome.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Chrome exited early (" + code + ")\n" + buf));
    });
  });
  const port = new URL(listen).port;
  const created = await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", { method: "PUT" });
  const tab = await created.json();
  assert.ok(tab.webSocketDebuggerUrl, "debugger page target");
  pageWs = new WebSocket(tab.webSocketDebuggerUrl);
  await onceOpen(pageWs);
  let id = 0;
  const pending = new Map();
  let loadFired = false;
  pageWs.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Page.loadEventFired") loadFired = true;
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails || {};
      track("exception", (d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      track("console", (msg.params.args || []).map((a) => a.value || a.description || a.type || "").join(" "));
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry && msg.params.entry.level === "error") {
      track("log", msg.params.entry.text);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => {
      pending.delete(callId);
      reject(new Error("CDP timeout: " + method));
    }, 20000);
    pending.set(callId, (msg) => {
      clearTimeout(timer);
      if (msg.error) reject(new Error(method + " " + JSON.stringify(msg.error)));
      else resolve(msg.result);
    });
    pageWs.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text || "evaluate failed");
    }
    return result.result && result.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  loadFired = false;
  await send("Page.navigate", { url: pageUrl });
  const loadDeadline = Date.now() + 15000;
  while (!loadFired) {
    if (Date.now() > loadDeadline) throw new Error("page load timed out");
    await delay(100);
  }
  await evaluate(`new Promise((resolve) => {
    const ready = () => {
      const loading = document.getElementById("authLoading");
      const auth = document.getElementById("authScreen");
      return (!loading || loading.style.display === "none") && auth && auth.style.display === "flex";
    };
    if (ready()) { resolve(true); return; }
    const timer = setInterval(() => { if (ready()) { clearInterval(timer); resolve(true); } }, 100);
    setTimeout(() => { clearInterval(timer); resolve(false); }, 12000);
  })`);

  const opened = await evaluate(`(() => {
    window.confirm = () => true;
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    ui.tab = "bible";
    renderAll();
    return {
      hasSearch: !!document.getElementById("bibleSearchInput"),
      attr: document.querySelector(".bible-search-attr") ? document.querySelector(".bible-search-attr").textContent : "",
      parsed: BibleSearch.parseReference("요 3:16")
    };
  })()`);
  assert.equal(opened.hasSearch, true);
  assert.match(opened.attr, /대한성서공회/);
  assert.equal(opened.parsed.book, "요한복음");
  assert.equal(opened.parsed.chapter, 3);
  assert.equal(opened.parsed.verse, 16);

  const started = await evaluate(`(() => {
    document.getElementById("bibleSearchInput").value = "독생자";
    document.getElementById("bibleSearchScope").value = "all";
    document.getElementById("bibleSearchBtn").click();
    return document.getElementById("bibleSearchStatus").textContent;
  })()`);
  assert.equal(started, "검색 중… 0/66");
  const found = await waitForSearch(evaluate, (snap) => snap.html.includes("요한복음 3:16") && snap.html.includes("bible-hit"));
  assert.match(found.status, /구절/);
  assert.match(found.html, /<mark class="bible-hit">독생자<\/mark>/);
  assert.ok(!found.html.includes("<img"), "search result HTML must not inject tags from the query");
  assert.match(found.attr, /대한성서공회/);

  await evaluate(`(() => {
    const bar = document.querySelector(".tabbar");
    const el = document.querySelector(".bible-search");
    const offset = bar ? bar.getBoundingClientRect().height + 8 : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo(0, Math.max(0, top));
    return true;
  })()`);
  await delay(200);
  await saveShot(send, "bible-search-results.png");

  await evaluate(`document.querySelector('#bibleSearchResults .bible-search-hit[data-book="요한복음"][data-ch="3"][data-verse="16"]').click()`);
  const openedVerse = await waitFor(async () => {
    const text = await evaluate(`(() => {
      const el = document.querySelector("#modalBody .verse.verse-flash");
      const open = document.getElementById("modalBackdrop").classList.contains("open");
      return { open, text: el ? el.innerText : "", num: el ? el.getAttribute("data-verse") : "" };
    })()`);
    return text && text.open && text.num === "16" ? text : null;
  }, 8000);
  assert.match(openedVerse.text, /독생자/);
  await saveShot(send, "bible-search-verse.png");

  await evaluate(`document.getElementById("modalClose").click()`);
  await evaluate(`(() => {
    document.getElementById("bibleSearchInput").value = "요 3:16";
    document.getElementById("bibleSearchBtn").click();
    return true;
  })()`);
  const jump = await waitForSearch(evaluate, (snap) => snap.firstClass.includes("bible-search-jump") && snap.firstText.includes("요한복음 3:16"));
  assert.match(jump.firstText, /이 구절로 이동/);

  await evaluate(`(() => {
    document.getElementById("bibleSearchInput").value = "하나님";
    document.getElementById("bibleSearchBtn").click();
    return true;
  })()`);
  const page1 = await waitForSearch(evaluate, (snap) => !snap.running && snap.count >= 100 && snap.more);
  assert.equal(page1.count, 100);
  assert.match(page1.status, /구절/);
  const moreMatch = page1.moreText.match(/\((\d+)\/(\d+)\)/);
  assert.ok(moreMatch, page1.moreText);
  assert.equal(Number(moreMatch[1]), 100);
  assert.ok(Number(moreMatch[2]) > 100);
  await evaluate(`document.getElementById("bibleSearchMore").click()`);
  const page2 = await evaluate(`document.querySelectorAll("#bibleSearchResults .bible-search-hit").length`);
  assert.equal(page2, 200);

  assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
  console.log("verify-page: ok");
  console.log("search status:", found.status);
} finally {
  try { if (pageWs) pageWs.close(); } catch { /* already closed */ }
  chrome.kill("SIGKILL");
  server.close();
  await delay(200);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

function onceOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("devtools websocket failed")));
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitFor(fn, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await delay(150);
  }
  throw new Error("timed out waiting for the page");
}
async function waitForSearch(evaluate, ready) {
  return waitFor(async () => {
    const snap = await evaluate(`(() => {
      const status = document.getElementById("bibleSearchStatus");
      const box = document.getElementById("bibleSearchResults");
      const more = document.getElementById("bibleSearchMore");
      const first = box ? box.querySelector(".bible-search-hit") : null;
      const running = !!(status && status.textContent.indexOf("검색 중") === 0);
      return {
        running,
        status: status ? status.textContent : "",
        html: box ? box.innerHTML : "",
        count: box ? box.querySelectorAll(".bible-search-hit").length : 0,
        more: !!(more && !more.hidden),
        moreText: more ? more.textContent : "",
        attr: document.querySelector(".bible-search-attr") ? document.querySelector(".bible-search-attr").textContent : "",
        firstClass: first ? first.className : "",
        firstText: first ? first.innerText : ""
      };
    })()`);
    if (snap.running) return null;
    return ready(snap) ? snap : null;
  }, 30000);
}
async function saveShot(send, name) {
  const dir = "/opt/cursor/artifacts";
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    return;
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (!shot || !shot.data) return;
  await writeFile(path.join(dir, name), Buffer.from(shot.data, "base64"));
  console.log("screenshot:", path.join(dir, name));
}
