/**
 * Highlight and chapter-read storage.
 * Verse text is never stored. Read state uses the existing readingProgress
 * key (book_chapter) instead of a second progress map.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const BibleMarks = require(path.join(root, "bible-marks.js"));

const checked = spawnSync(process.execPath, ["--check", path.join(root, "bible-marks.js")], { encoding: "utf8" });
assert.equal(checked.status, 0, checked.stderr);

assert.equal(BibleMarks.LONG_PRESS_MS, 500);
assert.equal(BibleMarks.MOVE_CANCEL_PX, 10);
assert.deepEqual(BibleMarks.COLORS.map((c) => c.id), ["yellow", "green", "blue", "pink"]);
assert.equal(BibleMarks.verseKey("요한복음", 3, 16), "요한복음_3_16");
assert.equal(BibleMarks.verseKey("시편", 119, 176), "시편_119_176");
assert.equal(BibleMarks.chapterKey("요한복음", 3), "요한복음_3");
assert.equal(BibleMarks.verseKey("", 1, 1), "");
assert.equal(BibleMarks.verseKey("요한복음", 0, 1), "");
assert.equal(BibleMarks.chapterKey("나쁜_이름", 1), "");

const scripture = "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니";
const highlighted = BibleMarks.applyHighlight({}, "요한복음", 3, 16, "yellow");
assert.deepEqual(highlighted, { "요한복음_3_16": "yellow" });
assert.equal(JSON.stringify(highlighted).includes(scripture), false);
assert.equal(JSON.stringify(highlighted).includes("독생자"), false);

const original = { "요한복음_3_16": "yellow" };
const changed = BibleMarks.applyHighlight(original, "요한복음", 3, 16, "green");
assert.equal(original["요한복음_3_16"], "yellow");
assert.equal(changed["요한복음_3_16"], "green");
const kept = BibleMarks.applyHighlight(original, "요한복음", 3, 16, "red");
assert.equal(kept["요한복음_3_16"], "yellow");
const removed = BibleMarks.applyHighlight(original, "요한복음", 3, 16, "");
assert.equal(removed["요한복음_3_16"], undefined);
assert.equal(original["요한복음_3_16"], "yellow");
const added = BibleMarks.applyHighlight(highlighted, "창세기", 1, 1, "blue");
assert.equal(added["요한복음_3_16"], "yellow");
assert.equal(added["창세기_1_1"], "blue");

assert.deepEqual(
  BibleMarks.normalizeHighlights({
    "요한복음_3_16": "yellow",
    "요한복음_3_17": "rainbow",
    "bad": "green",
    "시편_119_176": "pink"
  }),
  { "요한복음_3_16": "yellow", "시편_119_176": "pink" }
);

let progress = { "창세기_1": "2024-01-01" };
progress = BibleMarks.applyChapterRead(progress, "요한복음", 3, true, "2026-11-28");
assert.equal(progress["요한복음_3"], "2026-11-28");
assert.equal(progress["창세기_1"], "2024-01-01");
assert.equal(progress.chaptersRead, undefined);
assert.equal(progress.bibleHighlights, undefined);
assert.equal(JSON.stringify(progress).includes(scripture), false);
const progressBefore = { ...progress };
progress = BibleMarks.applyChapterRead(progress, "요한복음", 3, false, "2026-11-28");
assert.equal(progress["요한복음_3"], undefined);
assert.equal(progress["창세기_1"], "2024-01-01");
assert.equal(progressBefore["요한복음_3"], "2026-11-28");

const legacyRemote = { "창세기_1": "2020-01-01", "0": "2020-01-02" };
const legacy = BibleMarks.pickReading(legacyRemote, 0, {}, 0, 1000);
assert.equal(legacy.upload, false);
assert.equal(legacy.map["창세기_1"], "2020-01-01");
assert.equal(legacy.map["0"], "2020-01-02");
assert.deepEqual(legacyRemote, { "창세기_1": "2020-01-01", "0": "2020-01-02" });

const newerLocal = BibleMarks.pickReading(
  { "창세기_1": "2020-01-01" },
  10,
  { "창세기_1": "2020-01-01", "요한복음_3": "2026-11-28" },
  20,
  9999
);
assert.equal(newerLocal.upload, true);
assert.equal(newerLocal.map["요한복음_3"], "2026-11-28");
assert.equal(newerLocal.savedAt, 20);

const removedCloud = BibleMarks.pickHighlights(
  { "요한복음_3_16": "yellow", "창세기_1_1": "blue" },
  10,
  { "창세기_1_1": "blue" },
  40,
  9999
);
assert.equal(removedCloud.upload, true);
assert.equal(removedCloud.map["요한복음_3_16"], undefined);
assert.equal(removedCloud.map["창세기_1_1"], "blue");

const cloudNewer = BibleMarks.pickHighlights(
  { "요한복음_3_16": "pink" },
  30,
  { "요한복음_3_16": "green", "창세기_1_1": "blue" },
  20,
  9999
);
assert.equal(cloudNewer.upload, false);
assert.deepEqual(cloudNewer.map, { "요한복음_3_16": "pink" });

const fromDevice = BibleMarks.pickHighlights(null, 0, { "요한복음_3_16": "yellow" }, 5, 9999);
assert.equal(fromDevice.upload, true);
assert.equal(fromDevice.map["요한복음_3_16"], "yellow");

const tied = BibleMarks.pickHighlights(
  { "요한복음_3_16": "yellow" },
  0,
  { "창세기_1_1": "green" },
  0,
  1234
);
assert.equal(tied.upload, true);
assert.equal(tied.savedAt, 1234);
assert.equal(tied.map["요한복음_3_16"], "yellow");
assert.equal(tied.map["창세기_1_1"], "green");

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

const storage = memoryStorage();
BibleMarks.writeLocal(storage, "uidA", {
  highlights: { "창세기_1_1": "blue" },
  highlightsSavedAt: 10,
  readingProgress: { "창세기_1": "2026-01-01" },
  readingSavedAt: 10
});
BibleMarks.writeLocal(storage, "uidB", {
  highlights: { "요한복음_3_16": "pink" },
  highlightsSavedAt: 11,
  readingProgress: { "요한복음_3": "2026-02-02" },
  readingSavedAt: 11
});
const userA = BibleMarks.readLocal(storage, "uidA");
assert.equal(userA.highlights["창세기_1_1"], "blue");
assert.equal(userA.highlights["요한복음_3_16"], undefined);
assert.equal(userA.readingProgress["창세기_1"], "2026-01-01");
assert.equal(userA.readingSavedAt, 10);
const userB = BibleMarks.readLocal(storage, "uidB");
assert.equal(userB.highlights["요한복음_3_16"], "pink");
assert.equal(userB.readingProgress["창세기_1"], undefined);

BibleMarks.clearLocal(storage, "uidA");
assert.deepEqual(BibleMarks.readLocal(storage, "uidA"), BibleMarks.emptyPack());
assert.equal(BibleMarks.readLocal(storage, "uidB").highlights["요한복음_3_16"], "pink");

storage.setItem(BibleMarks.STORAGE_KEY, "{");
assert.deepEqual(BibleMarks.readLocal(storage, "uidB").highlights, {});

const existing = {
  email: "reader@example.com",
  createdAt: "stamp",
  journal: [{ id: "j1", qt: "묵상" }],
  prayers: [{ id: "p1" }],
  memoryCards: { five: [{ id: "c1" }] },
  gratitudes: [{ id: "g1" }],
  readingProgress: { "창세기_1": "2020-01-01" },
  bibleText: { "창세기": { "1": "개인 메모" } },
  settings: { tzOffsetMinutes: 540 }
};
const highlightPatch = BibleMarks.userPatch("bibleHighlights", {
  bibleHighlights: { "요한복음_3_16": "yellow", "요한복음_3_17": "nope" },
  bibleHighlightsSavedAt: 50,
  readingProgress: { "이 필드는 패치에 들어가면 안 됨": true },
  journal: []
});
assert.deepEqual(Object.keys(highlightPatch).sort(), ["bibleHighlights", "bibleHighlightsSavedAt"]);
assert.deepEqual(highlightPatch.bibleHighlights, { "요한복음_3_16": "yellow" });
const merged = BibleMarks.mergeUserDoc(existing, highlightPatch);
assert.equal(merged.email, "reader@example.com");
assert.equal(merged.createdAt, "stamp");
assert.deepEqual(merged.journal, existing.journal);
assert.deepEqual(merged.prayers, existing.prayers);
assert.deepEqual(merged.memoryCards, existing.memoryCards);
assert.deepEqual(merged.gratitudes, existing.gratitudes);
assert.deepEqual(merged.readingProgress, { "창세기_1": "2020-01-01" });
assert.equal(merged.bibleText["창세기"]["1"], "개인 메모");
assert.equal(merged.settings.tzOffsetMinutes, 540);
assert.equal(merged.bibleHighlights["요한복음_3_16"], "yellow");
assert.equal(JSON.stringify(merged.bibleHighlights).includes("독생자"), false);

const readPatch = BibleMarks.userPatch("readingProgress", {
  readingProgress: { "요한복음_3": "2026-11-28", "창세기_1": "2020-01-01" },
  readingProgressSavedAt: 60,
  bibleHighlights: { "요한복음_3_16": "blue" }
});
assert.deepEqual(Object.keys(readPatch).sort(), ["readingProgress", "readingProgressSavedAt"]);
const mergedRead = BibleMarks.mergeUserDoc(merged, readPatch);
assert.equal(mergedRead.bibleHighlights["요한복음_3_16"], "yellow");
assert.equal(mergedRead.readingProgress["요한복음_3"], "2026-11-28");
assert.equal(mergedRead.email, "reader@example.com");
assert.equal(mergedRead.journal[0].qt, "묵상");

const html = readFileSync(path.join(root, "index.html"), "utf8");
const sw = readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = readFileSync(path.join(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
const gradle = readFileSync(path.join(root, "android/app/build.gradle"), "utf8");

assert.match(html, /<script src="bible-marks\.js"><\/script>/);
assert.match(html, /BibleMarks\.applyHighlight/);
assert.match(html, /BibleMarks\.applyChapterRead/);
assert.match(html, /BibleMarks\.LONG_PRESS_MS/);
assert.match(html, /BibleMarks\.writeLocal/);
assert.match(html, /bibleHighlights/);
assert.match(html, /chapter-read-end/);
assert.match(html, /이 장 읽음/);
assert.match(html, /id="hlPop"|hlPop/);
assert.match(html, /contextmenu/);
assert.match(html, /지우기/);
assert.match(sw, /deungbul-cache-v11/);
assert.match(sw, /\.\/bible-marks\.js/);
assert.match(manifest, /android:name="android\.hardware\.screen\.portrait"\s+android:required="false"/);
assert.match(manifest, /android:name="android\.hardware\.screen\.landscape"\s+android:required="false"/);
assert.match(gradle, /versionCode 9/);
assert.match(gradle, /versionName "1\.0\.8"/);

console.log("verify-bible-marks: ok");
