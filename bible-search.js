/* 성경 본문 검색.
   절 문자열은 파일 그대로 두고, 찾은 구간만 화면에서 표시용으로 감쌉니다.
   브라우저 스크립트와 Node 테스트가 같은 함수를 씁니다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BibleSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BOOKS = [
    { name: "창세기", testament: "ot", chapters: 50, fileId: "gn", aliases: ["창세", "창"] },
    { name: "출애굽기", testament: "ot", chapters: 40, fileId: "ex", aliases: ["출애굽", "출"] },
    { name: "레위기", testament: "ot", chapters: 27, fileId: "lv", aliases: ["레위", "레"] },
    { name: "민수기", testament: "ot", chapters: 36, fileId: "nu", aliases: ["민수", "민"] },
    { name: "신명기", testament: "ot", chapters: 34, fileId: "dt", aliases: ["신명", "신"] },
    { name: "여호수아", testament: "ot", chapters: 24, fileId: "jos", aliases: ["수"] },
    { name: "사사기", testament: "ot", chapters: 21, fileId: "jdg", aliases: ["사사", "삿"] },
    { name: "룻기", testament: "ot", chapters: 4, fileId: "ru", aliases: ["룻"] },
    { name: "사무엘상", testament: "ot", chapters: 31, fileId: "1sa", aliases: ["삼상"] },
    { name: "사무엘하", testament: "ot", chapters: 24, fileId: "2sa", aliases: ["삼하"] },
    { name: "열왕기상", testament: "ot", chapters: 22, fileId: "1ki", aliases: ["왕상"] },
    { name: "열왕기하", testament: "ot", chapters: 25, fileId: "2ki", aliases: ["왕하"] },
    { name: "역대상", testament: "ot", chapters: 29, fileId: "1ch", aliases: ["대상"] },
    { name: "역대하", testament: "ot", chapters: 36, fileId: "2ch", aliases: ["대하"] },
    { name: "에스라", testament: "ot", chapters: 10, fileId: "ezr", aliases: ["스"] },
    { name: "느헤미야", testament: "ot", chapters: 13, fileId: "neh", aliases: ["느"] },
    { name: "에스더", testament: "ot", chapters: 10, fileId: "est", aliases: ["에"] },
    { name: "욥기", testament: "ot", chapters: 42, fileId: "job", aliases: ["욥"] },
    { name: "시편", testament: "ot", chapters: 150, fileId: "ps", aliases: ["시"] },
    { name: "잠언", testament: "ot", chapters: 31, fileId: "prv", aliases: ["잠"] },
    { name: "전도서", testament: "ot", chapters: 12, fileId: "ec", aliases: ["전도", "전"] },
    { name: "아가", testament: "ot", chapters: 8, fileId: "sng", aliases: ["아가서", "아"] },
    { name: "이사야", testament: "ot", chapters: 66, fileId: "isa", aliases: ["사"] },
    { name: "예레미야", testament: "ot", chapters: 52, fileId: "jer", aliases: ["렘"] },
    { name: "예레미야애가", testament: "ot", chapters: 5, fileId: "lam", aliases: ["애가", "애"] },
    { name: "에스겔", testament: "ot", chapters: 48, fileId: "ezk", aliases: ["겔"] },
    { name: "다니엘", testament: "ot", chapters: 12, fileId: "dan", aliases: ["단"] },
    { name: "호세아", testament: "ot", chapters: 14, fileId: "hos", aliases: ["호"] },
    { name: "요엘", testament: "ot", chapters: 3, fileId: "jol", aliases: ["욜"] },
    { name: "아모스", testament: "ot", chapters: 9, fileId: "amo", aliases: ["암"] },
    { name: "오바댜", testament: "ot", chapters: 1, fileId: "oba", aliases: ["오바댜서", "옵"] },
    { name: "요나", testament: "ot", chapters: 4, fileId: "jon", aliases: ["욘"] },
    { name: "미가", testament: "ot", chapters: 7, fileId: "mic", aliases: ["미"] },
    { name: "나훔", testament: "ot", chapters: 3, fileId: "nam", aliases: ["나"] },
    { name: "하박국", testament: "ot", chapters: 3, fileId: "hab", aliases: ["합"] },
    { name: "스바냐", testament: "ot", chapters: 3, fileId: "zep", aliases: ["습"] },
    { name: "학개", testament: "ot", chapters: 2, fileId: "hag", aliases: ["학"] },
    { name: "스가랴", testament: "ot", chapters: 14, fileId: "zec", aliases: ["슥"] },
    { name: "말라기", testament: "ot", chapters: 4, fileId: "mal", aliases: ["말"] },
    { name: "마태복음", testament: "nt", chapters: 28, fileId: "mat", aliases: ["마태", "마"] },
    { name: "마가복음", testament: "nt", chapters: 16, fileId: "mrk", aliases: ["마가", "막"] },
    { name: "누가복음", testament: "nt", chapters: 24, fileId: "luk", aliases: ["누가", "눅"] },
    { name: "요한복음", testament: "nt", chapters: 21, fileId: "jhn", aliases: ["요한복음서", "요한", "요"] },
    { name: "사도행전", testament: "nt", chapters: 28, fileId: "act", aliases: ["사도", "행"] },
    { name: "로마서", testament: "nt", chapters: 16, fileId: "rom", aliases: ["로마", "롬"] },
    { name: "고린도전서", testament: "nt", chapters: 16, fileId: "1co", aliases: ["고린도전", "고전"] },
    { name: "고린도후서", testament: "nt", chapters: 13, fileId: "2co", aliases: ["고린도후", "고후"] },
    { name: "갈라디아서", testament: "nt", chapters: 6, fileId: "gal", aliases: ["갈라디아", "갈"] },
    { name: "에베소서", testament: "nt", chapters: 6, fileId: "eph", aliases: ["에베소", "엡"] },
    { name: "빌립보서", testament: "nt", chapters: 4, fileId: "php", aliases: ["빌립보", "빌"] },
    { name: "골로새서", testament: "nt", chapters: 4, fileId: "col", aliases: ["골로새", "골"] },
    { name: "데살로니가전서", testament: "nt", chapters: 5, fileId: "1th", aliases: ["데살로니가전", "살전"] },
    { name: "데살로니가후서", testament: "nt", chapters: 3, fileId: "2th", aliases: ["데살로니가후", "살후"] },
    { name: "디모데전서", testament: "nt", chapters: 6, fileId: "1ti", aliases: ["디모데전", "딤전"] },
    { name: "디모데후서", testament: "nt", chapters: 4, fileId: "2ti", aliases: ["디모데후", "딤후"] },
    { name: "디도서", testament: "nt", chapters: 3, fileId: "tit", aliases: ["디도", "딛"] },
    { name: "빌레몬서", testament: "nt", chapters: 1, fileId: "phm", aliases: ["빌레몬", "몬"] },
    { name: "히브리서", testament: "nt", chapters: 13, fileId: "heb", aliases: ["히브리", "히"] },
    { name: "야고보서", testament: "nt", chapters: 5, fileId: "jas", aliases: ["야고보", "약"] },
    { name: "베드로전서", testament: "nt", chapters: 5, fileId: "1pe", aliases: ["베드로전", "벧전", "베전"] },
    { name: "베드로후서", testament: "nt", chapters: 3, fileId: "2pe", aliases: ["베드로후", "벧후", "베후"] },
    { name: "요한1서", testament: "nt", chapters: 5, fileId: "1jn", aliases: ["요한일서", "요일", "요1서"] },
    { name: "요한2서", testament: "nt", chapters: 1, fileId: "2jn", aliases: ["요한이서", "요이", "요2서"] },
    { name: "요한3서", testament: "nt", chapters: 1, fileId: "3jn", aliases: ["요한삼서", "요삼", "요3서"] },
    { name: "유다서", testament: "nt", chapters: 1, fileId: "jud", aliases: ["유다", "유"] },
    { name: "요한계시록", testament: "nt", chapters: 22, fileId: "rev", aliases: ["계시록", "계"] }
  ];

  const MAX_VERSE = 176;
  const PAGE_SIZE = 100;

  const aliasIndex = [];
  BOOKS.forEach((book) => {
    const seen = new Set();
    [book.name, ...book.aliases].forEach((alias) => {
      if (!alias || seen.has(alias)) return;
      seen.add(alias);
      aliasIndex.push({ alias, book });
    });
  });
  aliasIndex.sort((a, b) => b.alias.length - a.alias.length);

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[m]));
  }

  function normalizeQueryText(raw) {
    return String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  }

  function prepareQuery(raw) {
    const text = normalizeQueryText(raw);
    const compact = text.replace(/\s+/g, "");
    let korean = 0;
    for (let i = 0; i < compact.length; i++) {
      const code = compact.charCodeAt(i);
      if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x1100 && code <= 0x11ff) || (code >= 0x3130 && code <= 0x318f)) korean++;
    }
    return { text, compact, ok: korean >= 1 };
  }

  function parseChapterVerse(rest) {
    let m = rest.match(/^(\d{1,3})[:：](\d{1,3})절?$/);
    if (m) return { chapter: Number(m[1]), verse: Number(m[2]) };
    m = rest.match(/^(\d{1,3})(?:장|편)(\d{1,3})절?$/);
    if (m) return { chapter: Number(m[1]), verse: Number(m[2]) };
    m = rest.match(/^(\d{1,3})(?:장|편)?$/);
    if (m) return { chapter: Number(m[1]), verse: null };
    return null;
  }

  function parseReference(raw) {
    const compact = normalizeQueryText(raw).replace(/\s+/g, "");
    if (!compact) return null;
    for (let i = 0; i < aliasIndex.length; i++) {
      const row = aliasIndex[i];
      if (!compact.startsWith(row.alias)) continue;
      const rest = compact.slice(row.alias.length);
      if (!/^\d/.test(rest)) continue;
      const parsed = parseChapterVerse(rest);
      if (!parsed) continue;
      if (parsed.chapter < 1 || parsed.chapter > row.book.chapters) continue;
      if (parsed.verse != null && (parsed.verse < 1 || parsed.verse > MAX_VERSE)) continue;
      return {
        book: row.book.name,
        chapter: parsed.chapter,
        verse: parsed.verse,
        fileId: row.book.fileId
      };
    }
    return null;
  }

  function isSpace(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u00a0" || ch === "\u3000";
  }

  function mergeRanges(ranges) {
    if (!ranges || !ranges.length) return [];
    const sorted = ranges.slice().sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i][0];
      const end = sorted[i][1];
      if (end <= start) continue;
      const last = out[out.length - 1];
      if (!last || start >= last[1]) out.push([start, end]);
      else if (end > last[1]) last[1] = end;
    }
    return out;
  }

  function findMatchRanges(text, query) {
    const src = String(text == null ? "" : text);
    const q = normalizeQueryText(query);
    const qCompact = q.replace(/\s+/g, "");
    if (!qCompact) return [];
    const ranges = [];
    if (q) {
      let from = 0;
      while (from <= src.length - q.length) {
        const at = src.indexOf(q, from);
        if (at < 0) break;
        ranges.push([at, at + q.length]);
        from = at + q.length;
      }
    }
    const map = [];
    let compact = "";
    for (let i = 0; i < src.length; i++) {
      if (isSpace(src.charAt(i))) continue;
      map.push(i);
      compact += src.charAt(i);
    }
    let cfrom = 0;
    while (cfrom <= compact.length - qCompact.length) {
      const at = compact.indexOf(qCompact, cfrom);
      if (at < 0) break;
      const start = map[at];
      const end = map[at + qCompact.length - 1] + 1;
      ranges.push([start, end]);
      cfrom = at + qCompact.length;
    }
    return mergeRanges(ranges);
  }

  function highlightHtml(text, ranges) {
    const src = String(text == null ? "" : text);
    const merged = mergeRanges(ranges);
    let html = "";
    let cursor = 0;
    for (let i = 0; i < merged.length; i++) {
      const start = Math.max(cursor, Math.min(src.length, merged[i][0]));
      const end = Math.max(start, Math.min(src.length, merged[i][1]));
      if (end <= start) continue;
      html += escapeHtml(src.slice(cursor, start));
      html += '<mark class="bible-hit">' + escapeHtml(src.slice(start, end)) + "</mark>";
      cursor = end;
    }
    html += escapeHtml(src.slice(cursor));
    return html;
  }

  function searchBooks(books, query) {
    const prepared = prepareQuery(query);
    if (!prepared.ok) return [];
    const hits = [];
    const list = books || [];
    for (let b = 0; b < list.length; b++) {
      const book = list[b];
      const chapters = book && book.chapters ? book.chapters : [];
      for (let c = 0; c < chapters.length; c++) {
        const verses = chapters[c] || [];
        for (let v = 0; v < verses.length; v++) {
          const verseText = verses[v];
          if (typeof verseText !== "string" || !verseText) continue;
          const ranges = findMatchRanges(verseText, prepared.text);
          if (!ranges.length) continue;
          hits.push({
            kind: "verse",
            book: book.name,
            chapter: c + 1,
            verse: v + 1,
            text: verseText,
            ranges
          });
        }
      }
    }
    return hits;
  }

  function jumpHit(ref, chapters) {
    if (!ref) return null;
    if (chapters) {
      const ch = chapters[ref.chapter - 1];
      if (!Array.isArray(ch)) return null;
      if (ref.verse != null && (ref.verse < 1 || ref.verse > ch.length)) return null;
    }
    const label = ref.verse != null ? ref.book + " " + ref.chapter + ":" + ref.verse : ref.book + " " + ref.chapter + "장";
    return {
      kind: "jump",
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse == null ? null : ref.verse,
      label
    };
  }

  function bookNamesForScope(scope) {
    if (scope === "ot" || scope === "nt") {
      return BOOKS.filter((b) => b.testament === scope).map((b) => b.name);
    }
    if (scope && scope !== "all") {
      const one = BOOKS.find((b) => b.name === scope);
      return one ? [one.name] : [];
    }
    return BOOKS.map((b) => b.name);
  }

  function bookByName(name) {
    return BOOKS.find((b) => b.name === name) || null;
  }

  return {
    books: BOOKS,
    PAGE_SIZE,
    escapeHtml,
    prepareQuery,
    parseReference,
    findMatchRanges,
    highlightHtml,
    searchBooks,
    jumpHit,
    bookNamesForScope,
    bookByName
  };
});
