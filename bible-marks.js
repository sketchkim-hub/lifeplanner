/* 형광펜·장 읽음 저장.
   성경 본문(bible/*.json)은 읽기만 하고, 여기 데이터에는 절 문구를 넣지 않아요.
   브라우저 스크립트와 Node 테스트가 같은 함수를 씁니다.
   읽음은 기존 readingProgress(책_장)를 그대로 쓰고, 형광펜만 bibleHighlights(책_장_절)에 둡니다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BibleMarks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLORS = [
    { id: "yellow", label: "노랑" },
    { id: "green", label: "초록" },
    { id: "blue", label: "파랑" },
    { id: "pink", label: "분홍" }
  ];
  const COLOR_IDS = new Set(COLORS.map((c) => c.id));
  const STORAGE_KEY = "lp_bible_marks";
  const LONG_PRESS_MS = 500;
  const MOVE_CANCEL_PX = 10;
  const MAX_CHAPTER = 200;
  const MAX_VERSE = 250;

  function finiteNumber(n) {
    const x = Number(n);
    return Number.isFinite(x) && x > 0 ? x : 0;
  }

  function cleanName(book) {
    const name = typeof book === "string" ? book.trim() : "";
    if (!name || name.indexOf("_") !== -1) return "";
    return name;
  }

  function cleanChapter(chapter) {
    const ch = Number(chapter);
    if (!Number.isInteger(ch) || ch < 1 || ch > MAX_CHAPTER) return 0;
    return ch;
  }

  function cleanVerse(verse) {
    const vs = Number(verse);
    if (!Number.isInteger(vs) || vs < 1 || vs > MAX_VERSE) return 0;
    return vs;
  }

  function isColor(color) {
    return COLOR_IDS.has(color);
  }

  function chapterKey(book, chapter) {
    const name = cleanName(book);
    const ch = cleanChapter(chapter);
    if (!name || !ch) return "";
    return name + "_" + ch;
  }

  function verseKey(book, chapter, verse) {
    const name = cleanName(book);
    const ch = cleanChapter(chapter);
    const vs = cleanVerse(verse);
    if (!name || !ch || !vs) return "";
    return name + "_" + ch + "_" + vs;
  }

  function normalizeHighlights(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    Object.keys(raw).forEach((key) => {
      if (!verseKeyFromStored(key)) return;
      const color = raw[key];
      if (isColor(color)) out[key] = color;
    });
    return out;
  }

  function verseKeyFromStored(key) {
    if (typeof key !== "string") return "";
    const m = /^(.+)_(\d+)_(\d+)$/.exec(key);
    if (!m) return "";
    const built = verseKey(m[1], Number(m[2]), Number(m[3]));
    return built === key ? built : "";
  }

  /* 예전 읽기표는 "0","1" 같은 일차 키를 썼어요. 마이그레이션 전에는 그 값도 유지합니다. */
  function normalizeReadingProgress(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    Object.keys(raw).forEach((key) => {
      if (typeof key !== "string" || !key) return;
      const value = raw[key];
      if (value === true) out[key] = true;
      else if (typeof value === "number" && Number.isFinite(value) && value !== 0) out[key] = value;
      else if (typeof value === "string" && value.trim()) out[key] = value;
    });
    return out;
  }

  function applyHighlight(highlights, book, chapter, verse, color) {
    const next = normalizeHighlights(highlights);
    const key = verseKey(book, chapter, verse);
    if (!key) return next;
    if (color == null || color === "") {
      delete next[key];
      return next;
    }
    if (!isColor(color)) return next;
    next[key] = color;
    return next;
  }

  function applyChapterRead(progress, book, chapter, checked, dateStr) {
    const next = normalizeReadingProgress(progress);
    const key = chapterKey(book, chapter);
    if (!key) return next;
    if (checked) next[key] = (typeof dateStr === "string" && dateStr.trim()) ? dateStr : true;
    else delete next[key];
    return next;
  }

  function sameMap(a, b) {
    const ak = Object.keys(a);
    if (ak.length !== Object.keys(b).length) return false;
    return ak.every((key) => a[key] === b[key]);
  }

  function countKeys(map) {
    return Object.keys(map).length;
  }

  /* 더 나중에 저장된 쪽을 통째로 써요. 클라우드에 시각이 아직 없으면(예전 앱)
     로컬 시각이 더 클 때만 로컬이 이기고, 둘 다 시각이 없으면 기존 기록을 비우지 않게 합칩니다. */
  function pickMap(remoteMap, remoteAt, localMap, localAt, normalize, nowMs) {
    const remote = normalize(remoteMap);
    const local = normalize(localMap);
    const rAt = finiteNumber(remoteAt);
    const lAt = finiteNumber(localAt);
    const now = finiteNumber(nowMs) || Date.now();

    if (lAt > rAt) {
      return { map: local, savedAt: lAt, upload: !sameMap(remote, local) };
    }
    if (rAt > lAt) {
      return { map: remote, savedAt: rAt, upload: false };
    }
    if (!countKeys(remote) && !countKeys(local)) {
      return { map: {}, savedAt: 0, upload: false };
    }
    if (!countKeys(local)) {
      return { map: remote, savedAt: rAt, upload: false };
    }
    if (!countKeys(remote)) {
      return { map: local, savedAt: lAt || now, upload: true };
    }
    if (sameMap(remote, local)) {
      return { map: remote, savedAt: rAt || lAt, upload: false };
    }
    const merged = { ...local, ...remote };
    return { map: merged, savedAt: now, upload: true };
  }

  function pickHighlights(remoteMap, remoteAt, localMap, localAt, nowMs) {
    return pickMap(remoteMap, remoteAt, localMap, localAt, normalizeHighlights, nowMs);
  }

  function pickReading(remoteMap, remoteAt, localMap, localAt, nowMs) {
    return pickMap(remoteMap, remoteAt, localMap, localAt, normalizeReadingProgress, nowMs);
  }

  function emptyPack() {
    return {
      highlights: {},
      highlightsSavedAt: 0,
      readingProgress: {},
      readingSavedAt: 0
    };
  }

  function packFrom(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyPack();
    return {
      highlights: normalizeHighlights(raw.highlights),
      highlightsSavedAt: finiteNumber(raw.highlightsSavedAt),
      readingProgress: normalizeReadingProgress(raw.readingProgress),
      readingSavedAt: finiteNumber(raw.readingSavedAt)
    };
  }

  function readAll(storage) {
    if (!storage || typeof storage.getItem !== "function") return {};
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch (e) {
      return {};
    }
  }

  function readLocal(storage, uid) {
    if (!uid) return emptyPack();
    const all = readAll(storage);
    return packFrom(all[uid]);
  }

  function writeLocal(storage, uid, pack) {
    if (!storage || typeof storage.setItem !== "function" || !uid) return;
    const all = readAll(storage);
    const next = packFrom(pack);
    all[uid] = next;
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function clearLocal(storage, uid) {
    if (!storage || typeof storage.setItem !== "function" || !uid) return;
    const all = readAll(storage);
    delete all[uid];
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function userPatch(prop, state) {
    const src = state && typeof state === "object" ? state : {};
    if (prop === "bibleHighlights") {
      return {
        bibleHighlights: normalizeHighlights(src.bibleHighlights),
        bibleHighlightsSavedAt: finiteNumber(src.bibleHighlightsSavedAt)
      };
    }
    if (prop === "readingProgress") {
      return {
        readingProgress: (src.readingProgress && typeof src.readingProgress === "object" && !Array.isArray(src.readingProgress))
          ? src.readingProgress
          : {},
        readingProgressSavedAt: finiteNumber(src.readingProgressSavedAt)
      };
    }
    return { [prop]: src[prop] };
  }

  function mergeUserDoc(existing, patch) {
    const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
    const extra = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
    return { ...base, ...extra };
  }

  return {
    COLORS,
    COLOR_IDS,
    STORAGE_KEY,
    LONG_PRESS_MS,
    MOVE_CANCEL_PX,
    isColor,
    chapterKey,
    verseKey,
    normalizeHighlights,
    normalizeReadingProgress,
    applyHighlight,
    applyChapterRead,
    pickHighlights,
    pickReading,
    emptyPack,
    readLocal,
    writeLocal,
    clearLocal,
    userPatch,
    mergeUserDoc
  };
});
