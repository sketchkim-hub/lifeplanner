/* 성경 본문을 음성으로 읽을 때, 화면에 보이는 글은 그대로 두고
   음성 엔진에 넘길 조각만 나눕니다.
   문장·절이 끝나면 TTS_SENTENCE_PAUSE_MS 만큼 쉬고,
   세미콜론·콜론 뒤에는 TTS_CLAUSE_PAUSE_MS 만큼만 쉽니다.
   한 조각이 너무 길면(모바일 크롬이 약 15초 뒤에 음성을 끊는 문제) 띄어쓰기에서 나눠
   TTS_BREATH_PAUSE_MS 만큼만 쉽니다. 쉬고 싶은 길이는 이 상수만 바꾸면 됩니다. */
const TTS_SENTENCE_PAUSE_MS = 500;
const TTS_CLAUSE_PAUSE_MS = 250;
const TTS_BREATH_PAUSE_MS = 250;
const TTS_MAX_CHUNK_CHARS = 80;
const TTS_CHUNK_SLACK = 8;

const SENTENCE_PUNCT = new Set([".", "?", "!", "…", "。", "？", "！"]);
const CLAUSE_PUNCT = new Set([";", ":", "；", "："]);

function ttsIsDigit(ch){
  return !!ch && ch >= "0" && ch <= "9";
}
function ttsIsSentencePunct(ch, prev, next){
  if(!SENTENCE_PUNCT.has(ch)) return false;
  if((ch === "." || ch === "。") && ttsIsDigit(prev) && ttsIsDigit(next)) return false;
  return true;
}
function ttsIsClausePunct(ch, prev, next){
  if(!CLAUSE_PUNCT.has(ch)) return false;
  if((ch === ":" || ch === "：") && ttsIsDigit(prev) && ttsIsDigit(next)) return false;
  return true;
}

function splitLineOnPunctuation(line){
  const out = [];
  const chars = [...line];
  let start = 0;
  for(let i = 0; i < chars.length; i++){
    const ch = chars[i];
    const prev = i > 0 ? chars[i - 1] : "";
    const next = i + 1 < chars.length ? chars[i + 1] : "";
    const sentence = ttsIsSentencePunct(ch, prev, next);
    const clause = !sentence && ttsIsClausePunct(ch, prev, next);
    if(!sentence && !clause) continue;
    let end = i + 1;
    while(end < chars.length){
      const c2 = chars[end];
      const p2 = chars[end - 1];
      const n2 = end + 1 < chars.length ? chars[end + 1] : "";
      if(sentence && ttsIsSentencePunct(c2, p2, n2)){ end++; continue; }
      if(clause && ttsIsClausePunct(c2, p2, n2)){ end++; continue; }
      break;
    }
    const text = chars.slice(start, end).join("").trim();
    if(text) out.push({ text, pauseMs: sentence ? TTS_SENTENCE_PAUSE_MS : TTS_CLAUSE_PAUSE_MS });
    while(end < chars.length && /\s/.test(chars[end])) end++;
    start = end;
    i = end - 1;
  }
  const rest = chars.slice(start).join("").trim();
  if(rest) out.push({ text: rest, pauseMs: TTS_SENTENCE_PAUSE_MS });
  return out;
}

function splitLongChunk(text){
  const chars = [...text.trim()];
  const limit = TTS_MAX_CHUNK_CHARS;
  const out = [];
  let i = 0;
  while(chars.length - i > limit){
    const end = i + limit;
    let cut = -1;
    for(let k = end - 1; k > i; k--){
      if(chars[k] === " "){ cut = k; break; }
    }
    if(cut <= i){
      if(chars.length - i <= limit + TTS_CHUNK_SLACK) break;
      const left = chars.slice(i, end).join("").trim();
      if(left) out.push(left);
      i = end;
      while(chars[i] === " ") i++;
      continue;
    }
    const rightLen = chars.length - (cut + 1);
    if(rightLen < TTS_CHUNK_SLACK) break;
    const left = chars.slice(i, cut).join("").trim();
    if(left) out.push(left);
    i = cut + 1;
    while(chars[i] === " ") i++;
  }
  const rest = chars.slice(i).join("").trim();
  if(rest) out.push(rest);
  return out;
}

function splitTextForSpeech(text){
  const raw = text == null ? "" : String(text);
  const lines = raw.split(/\r?\n/);
  const chunks = [];
  lines.forEach(line=>{
    const trimmed = line.trim();
    if(!trimmed) return;
    const pieces = splitLineOnPunctuation(trimmed);
    pieces.forEach((piece, pi)=>{
      const atLineEnd = pi === pieces.length - 1;
      const pause = atLineEnd ? TTS_SENTENCE_PAUSE_MS : piece.pauseMs;
      const parts = splitLongChunk(piece.text);
      parts.forEach((part, j)=>{
        chunks.push({
          text: part,
          pauseMs: j === parts.length - 1 ? pause : TTS_BREATH_PAUSE_MS
        });
      });
    });
  });
  return chunks;
}

globalThis.TTS_SENTENCE_PAUSE_MS = TTS_SENTENCE_PAUSE_MS;
globalThis.TTS_CLAUSE_PAUSE_MS = TTS_CLAUSE_PAUSE_MS;
globalThis.TTS_BREATH_PAUSE_MS = TTS_BREATH_PAUSE_MS;
globalThis.TTS_MAX_CHUNK_CHARS = TTS_MAX_CHUNK_CHARS;
globalThis.splitTextForSpeech = splitTextForSpeech;
