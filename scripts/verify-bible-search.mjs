/**
 * Search and reference parsing against the real 개역한글 JSON.
 * The verse strings are only read. Nothing in bible/ is written.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const BibleSearch = require(path.join(root, "bible-search.js"));

const {
  books,
  prepareQuery,
  parseReference,
  findMatchRanges,
  highlightHtml,
  searchBooks,
  jumpHit,
  bookNamesForScope
} = BibleSearch;

function readJson(file) {
  return JSON.parse(readFileSync(path.join(root, "bible", file), "utf8"));
}

function unescapeHtml(html) {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function plain(html) {
  return unescapeHtml(html.replace(/<mark class="bible-hit">/g, "").replace(/<\/mark>/g, ""));
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
const sw = readFileSync(path.join(root, "sw.js"), "utf8");
assert.match(sw, /deungbul-cache-v10/);
assert.match(sw, /\.\/bible-search\.js/);
assert.match(html, /<script src="bible-search\.js"><\/script>/);
assert.match(html, /function stripVerseNumbersForTTS/);
assert.match(html, /function toggleTTS/);
assert.match(html, /function stopTTS/);
assert.match(html, /성경전서 개역한글판의 저작권은 대한성서공회에 있습니다\./);

function tuples(name) {
  const m = html.match(new RegExp("const " + name + " = \\[([\\s\\S]*?)\\];"));
  assert.ok(m, name);
  return [...m[1].matchAll(/\["([^"]+)",(\d+)\]/g)].map((x) => [x[1], Number(x[2])]);
}
const appBooks = [...tuples("BOOKS"), ...tuples("NT_BOOKS")];
const ids = [...html.match(/const BIBLE_FILE_IDS = \[([\s\S]*?)\];/)[1].matchAll(/"([a-z0-9]+)"/g)].map((x) => x[1]);
assert.equal(appBooks.length, 66);
assert.equal(ids.length, 66);
assert.equal(books.length, 66);
books.forEach((book, i) => {
  assert.equal(book.name, appBooks[i][0], book.fileId);
  assert.equal(book.chapters, appBooks[i][1], book.name);
  assert.equal(book.fileId, ids[i], book.name);
  const data = readJson(book.fileId + ".json");
  assert.equal(data.id, book.fileId);
  assert.equal(data.chapters.length, book.chapters, book.name);
  if (book.fileId === "1jn") assert.equal(data.sourceName, "요한일서");
  else assert.equal(data.sourceName, book.name);
});

assert.equal(bookNamesForScope("ot").length, 39);
assert.equal(bookNamesForScope("nt").length, 27);
assert.equal(bookNamesForScope("all").length, 66);
assert.deepEqual(bookNamesForScope("요한복음"), ["요한복음"]);

const johnRef = parseReference("요 3:16");
assert.equal(johnRef.book, "요한복음");
assert.equal(johnRef.chapter, 3);
assert.equal(johnRef.verse, 16);
assert.deepEqual(parseReference("요한복음 3장 16절"), johnRef);
assert.deepEqual(parseReference("요한복음3:16"), johnRef);
assert.deepEqual(parseReference("  요  3 : 16절  "), johnRef);

const gen = parseReference("창 1");
assert.equal(gen.book, "창세기");
assert.equal(gen.chapter, 1);
assert.equal(gen.verse, null);
assert.deepEqual(parseReference("창세기 1장"), gen);

const ps = parseReference("시 23편 1절");
assert.equal(ps.book, "시편");
assert.equal(ps.chapter, 23);
assert.equal(ps.verse, 1);

assert.equal(parseReference("요일 1:1").book, "요한1서");
assert.equal(parseReference("요한일서 1장 1절").book, "요한1서");
assert.equal(parseReference("요한1서 1:1").book, "요한1서");
assert.equal(parseReference("욜 1:1").book, "요엘");
assert.equal(parseReference("욘 1:1").book, "요나");
assert.equal(parseReference("계 1:1").book, "요한계시록");
assert.equal(parseReference("고전 13:4").book, "고린도전서");
assert.equal(parseReference("요 99:1"), null);
assert.equal(parseReference("사랑"), null);
assert.equal(parseReference("하나님"), null);
assert.equal(parseReference("사랑하는"), null);
assert.equal(prepareQuery("  사랑  ").ok, true);
assert.equal(prepareQuery("   ").ok, false);
assert.equal(prepareQuery("abc").ok, false);
assert.equal(prepareQuery("ㄱ").ok, true);

const jhn = readJson("jhn.json");
const john316 = jhn.chapters[2][15];
assert.equal(john316, "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 저를 믿는 자마다 멸망치 않고 영생을 얻게 하려 하심이니라");
const before = john316;
const johnHits = searchBooks([{ name: "요한복음", chapters: jhn.chapters }], "독생자");
const john316Hit = johnHits.find((h) => h.chapter === 3 && h.verse === 16);
assert.ok(john316Hit, "독생자 should find 요한복음 3:16");
assert.equal(jhn.chapters[2][15], before);
const highlighted = highlightHtml(john316Hit.text, john316Hit.ranges);
assert.match(highlighted, /<mark class="bible-hit">독생자<\/mark>/);
assert.equal(plain(highlighted), john316);
assert.equal(jumpHit(johnRef, jhn.chapters).label, "요한복음 3:16");
console.log("독생자 →", john316Hit.book, john316Hit.chapter + ":" + john316Hit.verse);
console.log(highlighted);

const psData = readJson("ps.json");
assert.equal(psData.chapters[22][0], "여호와는 나의 목자시니 내가 부족함이 없으리로다");
const shepherd = searchBooks([{ name: "시편", chapters: psData.chapters }], "목자");
const ps23 = shepherd.find((h) => h.chapter === 23 && h.verse === 1);
assert.ok(ps23);
assert.match(highlightHtml(ps23.text, ps23.ranges), /<mark class="bible-hit">목자<\/mark>/);
const spacedShepherd = searchBooks([{ name: "시편", chapters: psData.chapters }], "목 자");
assert.ok(spacedShepherd.some((h) => h.chapter === 23 && h.verse === 1));

const all = books.map((book) => ({
  name: book.name,
  chapters: readJson(book.fileId + ".json").chapters
}));
const fear = searchBooks(all, "두려워말라");
const fearHit = fear.find((h) => h.text.includes("두려워 말라"));
assert.ok(fearHit, "spacing-insensitive match");
const fearRange = fearHit.ranges.find((r) => fearHit.text.slice(r[0], r[1]).replace(/\s+/g, "") === "두려워말라");
assert.ok(fearRange);
assert.ok(fearHit.text.slice(fearRange[0], fearRange[1]).includes(" "));
const fearExact = searchBooks(all, "두려워 말라");
assert.ok(fearExact.some((h) => h.book === fearHit.book && h.chapter === fearHit.chapter && h.verse === fearHit.verse));
console.log("두려워 말라 →", fearHit.book, fearHit.chapter + ":" + fearHit.verse);

const onlySon = searchBooks(all, "독생자");
assert.ok(onlySon.some((h) => h.book === "요한복음" && h.chapter === 3 && h.verse === 16));
for (let i = 1; i < onlySon.length; i++) {
  const prev = books.findIndex((b) => b.name === onlySon[i - 1].book);
  const next = books.findIndex((b) => b.name === onlySon[i].book);
  assert.ok(prev < next || (prev === next && (onlySon[i - 1].chapter < onlySon[i].chapter || (onlySon[i - 1].chapter === onlySon[i].chapter && onlySon[i - 1].verse < onlySon[i].verse))));
}
console.log("독생자 전체", onlySon.length, "구절");

const mat = readJson("mat.json");
const markers = searchBooks([{ name: "마태복음", chapters: mat.chapters }], "없음");
assert.ok(markers.some((h) => h.chapter === 17 && h.verse === 21 && h.text === "(없음)"));

const nasty = '"><img src=x onerror=alert(1)> 사랑';
const nastyHtml = highlightHtml(nasty, findMatchRanges(nasty, "사랑"));
assert.equal(plain(nastyHtml), nasty);
assert.ok(!nastyHtml.includes("<img"));
assert.ok(nastyHtml.includes("&lt;img"));
assert.match(nastyHtml, /<mark class="bible-hit">사랑<\/mark>/);
const injectedQuery = '사랑<img src=x onerror=alert(1)>';
assert.equal(highlightHtml("사랑은 오래 참고", findMatchRanges("사랑은 오래 참고", injectedQuery)), "사랑은 오래 참고");

const started = Date.now();
const god = searchBooks(all, "하나님");
const elapsed = Date.now() - started;
console.log("하나님", god.length, "구절,", elapsed + "ms");
assert.ok(god.length > 200);
assert.ok(elapsed < 2000, "search took " + elapsed + "ms");
assert.equal(god[0].book, "창세기");
assert.equal(god[0].chapter, 1);
assert.equal(god[0].verse, 1);

const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = re.exec(html))) scripts.push(match[1]);
const dir = mkdtempSync(path.join(tmpdir(), "bible-search-syntax-"));
scripts.forEach((src, i) => {
  const file = path.join(dir, "inline-" + i + ".js");
  writeFileSync(file, src);
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    console.error(checked.stderr);
    assert.fail("inline script " + i + " failed node --check");
  }
});
const self = spawnSync(process.execPath, ["--check", path.join(root, "bible-search.js")], { encoding: "utf8" });
assert.equal(self.status, 0, self.stderr);

console.log("verify-bible-search: ok");
