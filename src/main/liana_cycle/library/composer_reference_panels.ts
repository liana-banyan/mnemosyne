// composer_reference_panels.ts -- D-BP154-025/BISHOP-SEG/S25/seg-handproof
//
// TWO READ-ONLY REFERENCE SURFACES for the Composer, per Founder's own request, verbatim:
// "Give me my hand-written proof, in the composer, as well as the THREE QUESTIONS that we know
// get the right answer." He wants his own derivation and the machine's known-good questions
// VISIBLE, side by side with the current run, so he can compare -- not a new derivation, a reading
// surface only. This file adds NO elimination/verdict/ranking logic; every export below is a pure,
// read-only disk read, or a mechanical (never model-judged) extraction of a specific note or
// section already on disk.
//
// VERBATIM FROM DISK, NOTHING GENERATED (Founder's own hard rule, this ticket). Every function
// below either returns text read byte-for-byte from a named file, or reports MISSING with the path
// -- it never fills a gap with generated prose. Locating WHICH slice of a file to show (a byte
// range inside a 53KB file, a specific note inside a 450-line JSON receipt) is done by searching
// for the file's OWN structural markers (its own "## EXCERPT N of 8" headings; a note's own text
// prefix, e.g. "FRAME: draw 2 result --") -- exact, structural substring search, computed fresh
// against the real file content every call, never a hardcoded copy of what those markers say.
//
// classify_cascade.ts is FORBIDDEN, unused here. Nothing here writes to any file.

import { existsSync, readFileSync } from 'node:fs';

// ─────────────────────────── 1. THE FOUNDER'S HAND-WRITTEN PROOF ───────────────────────────

export interface FounderProofSlice {
  path: string;
  ok: boolean;
  /** Total size of the file on disk, bytes -- so the panel can say "you are seeing N of M bytes". */
  totalBytes?: number;
  /** 1-indexed, inclusive line range of what `text` contains within the full file. */
  lineRange?: [number, number];
  /** 0-indexed, inclusive-exclusive byte offset range of what `text` contains within the full file. */
  byteOffsetRange?: [number, number];
  /** The verbatim slice itself -- byte-for-byte from disk, no reformatting. */
  text?: string;
  /** Present only when ok is false: 'MISSING: <path>', never a guess at what would have been there. */
  error?: string;
}

const FOUNDER_CASCADE_PATH = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\'
  + 'FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md';
const BP153_DERIVATION_PATH = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\'
  + 'BP153_QID98_DERIVATION_FROM_EVIDENCE.md';

function missingSlice(path: string): FounderProofSlice {
  return { path, ok: false, error: `MISSING: ${path}` };
}

/** THE BP153 DERIVATION FILE -- shown in full (128 lines / 6,605 bytes measured this ticket, small
 *  enough that "the qid-98-relevant portion" IS the whole file; every line concerns qid 98). */
function readBp153Derivation(): FounderProofSlice {
  if (!existsSync(BP153_DERIVATION_PATH)) return missingSlice(BP153_DERIVATION_PATH);
  const raw = readFileSync(BP153_DERIVATION_PATH, 'utf8');
  const totalBytes = Buffer.byteLength(raw, 'utf8');
  const lines = raw.split('\n');
  return {
    path: BP153_DERIVATION_PATH,
    ok: true,
    totalBytes,
    lineRange: [1, lines.length],
    byteOffsetRange: [0, totalBytes],
    text: raw,
  };
}

/** THE FOUNDER CASCADE FILE (53,200 bytes measured this ticket, 8 excerpts total, most unrelated
 *  to qid 98). The qid-98-relevant slice is located structurally: EXCERPT 1 (the mis-answered
 *  receipt he was reacting to) through the end of EXCERPT 2 (his own words: "the full hand-solved
 *  walkthrough of the world-regions population-density question ... the question underlying qid
 *  89/98/85 discussion below") -- found by searching the file's OWN "## EXCERPT N of 8" headings,
 *  never a hardcoded line number. DISCLOSED, not hidden: EXCERPT 2's own option list (South
 *  America/Western Europe/South Asia/East Asia/Southeast Asia/Northeastern United
 *  States/Nile Valley/Java/Ganges Valley) differs from the live Composer run's own qid 98 draw
 *  (South America/South Asia/North Africa/Northeast United States/Europe/Central
 *  Asia/Arctic Circle/Amazon Rainforest/Sahara Desert) -- same question STEM, a different random
 *  option draw. The panel must show this plainly, not paper over it. */
function readFounderCascadeExcerpt(): FounderProofSlice {
  if (!existsSync(FOUNDER_CASCADE_PATH)) return missingSlice(FOUNDER_CASCADE_PATH);
  const raw = readFileSync(FOUNDER_CASCADE_PATH, 'utf8');
  const totalBytes = Buffer.byteLength(raw, 'utf8');
  const startMarker = '## EXCERPT 1 of 8';
  const endMarker = '## EXCERPT 3 of 8';
  const startIdx = raw.indexOf(startMarker);
  const endIdx = raw.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    // The file's own structure changed since this was written -- report the file whole rather than
    // guess at a slice that no longer exists in it.
    const lines = raw.split('\n');
    return {
      path: FOUNDER_CASCADE_PATH,
      ok: true,
      totalBytes,
      lineRange: [1, lines.length],
      byteOffsetRange: [0, totalBytes],
      text: raw,
      error: 'EXCERPT markers not found at their expected shape -- showing the whole file instead of a guessed slice',
    };
  }
  const slice = raw.slice(startIdx, endIdx);
  const lines = raw.split('\n');
  const startLine = raw.slice(0, startIdx).split('\n').length;
  const endLine = raw.slice(0, endIdx).split('\n').length - 1;
  return {
    path: FOUNDER_CASCADE_PATH,
    ok: true,
    totalBytes,
    lineRange: [startLine, endLine],
    byteOffsetRange: [startIdx, endIdx],
    text: slice,
  };
}

export function readFounderProof(): { bp153: FounderProofSlice; founderCascade: FounderProofSlice } {
  return { bp153: readBp153Derivation(), founderCascade: readFounderCascadeExcerpt() };
}

/** "Show the qid-98-relevant portion ... with a way to see the whole file" (Founder, this
 *  ticket). Separate, on-demand read (the panel default is the excerpt above) -- the whole 53,200-
 *  byte file, verbatim, or MISSING. */
export function readFounderCascadeWhole(): FounderProofSlice {
  if (!existsSync(FOUNDER_CASCADE_PATH)) return missingSlice(FOUNDER_CASCADE_PATH);
  const raw = readFileSync(FOUNDER_CASCADE_PATH, 'utf8');
  const totalBytes = Buffer.byteLength(raw, 'utf8');
  const lines = raw.split('\n');
  return {
    path: FOUNDER_CASCADE_PATH, ok: true, totalBytes, lineRange: [1, lines.length], byteOffsetRange: [0, totalBytes], text: raw,
  };
}

// ─────────────────────────── 2. THE THREE KNOWN-GOOD QUESTIONS ───────────────────────────

export interface KnownGoodQuery {
  label: string;
  receiptPath: string;
  ok: boolean;
  queryText?: string;
  resultText?: string;
  ts?: string;
  error?: string;
}

interface ReceiptNote {
  kind: string;
  text: string;
  ts: string;
}

function readReceiptNotes(path: string): ReceiptNote[] | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const transcript = (parsed as { transcript?: unknown })?.transcript;
    if (Array.isArray(transcript)) return transcript as ReceiptNote[];
    // Some receipts carry the note array under a different top-level key; fall back to scanning
    // the whole parsed object's own arrays for note-shaped entries (structural, not a guess at
    // content) rather than assuming one fixed shape.
    if (Array.isArray(parsed)) return parsed as ReceiptNote[];
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length && typeof (v[0] as { text?: unknown })?.text === 'string') {
        return v as ReceiptNote[];
      }
    }
    return [];
  } catch {
    return null;
  }
}

/** Finds the first note whose text starts with `prefix`, searching AFTER `afterIndex` (exclusive)
 *  when given -- structural prefix match only, exactly the discipline this whole ticket's own
 *  reducer fix (D-BP154-024, computeFrameMatchBuckets) applies to option matching: exact, never
 *  fuzzy, never judged. */
function findNoteByPrefix(notes: ReceiptNote[], prefix: string, afterIndex = -1): { note: ReceiptNote; index: number } | null {
  for (let i = afterIndex + 1; i < notes.length; i += 1) {
    // trimStart() only -- every note in this transcript convention is indented with leading
    // spaces for readability ("   FRAME: ...", "   PARSER INSTRUMENT..."); the indentation is
    // cosmetic, not part of the content, so matching against it would make the search fragile to
    // a purely visual convention rather than the note's actual text.
    if (notes[i].text.trimStart().startsWith(prefix)) return { note: notes[i], index: i };
  }
  return null;
}

const FRAME_RECEIPT_PATH = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\LIANA_RUNS\\'
  + 'LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json';
const OPERATION_RECEIPT_PATH = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\LIANA_RUNS\\'
  + 'LIANA_RUN_qid98_2026-08-12T16-04-38-125Z.json';

/** THE FRAME QUERY -- receipt LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json, DRAW 2 of 2 (draw 1
 *  named no option; draw 2 correctly classified all nine, per the receipt's own DISAGREEMENT
 *  note). Located structurally: find "FRAME: DRAW 2 of 2", then the next "FRAME: query SENT to
 *  conversational authority" note after it (the draw-2 query), then the next "FRAME: draw 2
 *  result --" note (the draw-2 answer). */
function readFrameQuery(): KnownGoodQuery {
  const notes = readReceiptNotes(FRAME_RECEIPT_PATH);
  if (notes === null) return { label: 'FRAME QUERY', receiptPath: FRAME_RECEIPT_PATH, ok: false, error: `MISSING: ${FRAME_RECEIPT_PATH}` };
  const draw2Marker = findNoteByPrefix(notes, 'FRAME: DRAW 2 of 2');
  if (!draw2Marker) return { label: 'FRAME QUERY', receiptPath: FRAME_RECEIPT_PATH, ok: false, error: 'MISSING: no "FRAME: DRAW 2 of 2" note found in this receipt' };
  const q = findNoteByPrefix(notes, 'FRAME: query SENT to conversational authority', draw2Marker.index);
  const r = q ? findNoteByPrefix(notes, 'FRAME: draw 2 result --', q.index) : null;
  if (!q || !r) return { label: 'FRAME QUERY', receiptPath: FRAME_RECEIPT_PATH, ok: false, error: 'MISSING: draw-2 query/result notes not found in this receipt' };
  return {
    label: 'FRAME QUERY', receiptPath: FRAME_RECEIPT_PATH, ok: true, queryText: q.note.text, resultText: r.note.text, ts: r.note.ts,
  };
}

/** THE DISCRIMINATOR/DENOTATION QUESTION -- Founder named this as a third, distinct known-good
 *  question, but gave no separate receipt path; discriminator_step.ts's own header (D-BP154-020)
 *  cites THIS SAME draw-2 result as "the KNOWN-WORKING phrasing on record" for the discriminator's
 *  own query wording (asking what each option's kind is AND which kind denotes the category, in
 *  one query -- the same shape the FRAME query above already carries). Rather than inventing a
 *  second receipt that was never named, this reuses the FRAME receipt's own draw-2 result and says
 *  so plainly, honoring "never fill the gap with your own words" over pretending a distinct file
 *  exists. */
function readDiscriminatorDenotationQuestion(): KnownGoodQuery {
  const frame = readFrameQuery();
  if (!frame.ok) return { label: 'DISCRIMINATOR/DENOTATION QUESTION', receiptPath: FRAME_RECEIPT_PATH, ok: false, error: frame.error };
  return {
    label: 'DISCRIMINATOR/DENOTATION QUESTION (same receipt as FRAME QUERY -- see note)',
    receiptPath: FRAME_RECEIPT_PATH,
    ok: true,
    queryText: frame.queryText,
    resultText: frame.resultText,
    ts: frame.ts,
  };
}

/** THE OPERATION QUERY -- receipt LIANA_RUN_qid98_2026-08-12T16-04-38-125Z.json. Located
 *  structurally: the "PARSER INSTRUMENT [operation] query SENT to conversational authority" note,
 *  and the passage note ("PARSER INSTRUMENT [operation] user_gemini passage handed to
 *  gemmaExtract()") that carries the answer this query produced, verbatim. */
function readOperationQuery(): KnownGoodQuery {
  const notes = readReceiptNotes(OPERATION_RECEIPT_PATH);
  if (notes === null) return { label: 'OPERATION QUERY', receiptPath: OPERATION_RECEIPT_PATH, ok: false, error: `MISSING: ${OPERATION_RECEIPT_PATH}` };
  const q = findNoteByPrefix(notes, 'PARSER INSTRUMENT [operation] query SENT to conversational authority');
  const r = q ? findNoteByPrefix(notes, 'PARSER INSTRUMENT [operation] user_gemini passage handed to gemmaExtract()', q.index) : null;
  if (!q || !r) return { label: 'OPERATION QUERY', receiptPath: OPERATION_RECEIPT_PATH, ok: false, error: 'MISSING: operation query/result notes not found in this receipt' };
  return {
    label: 'OPERATION QUERY', receiptPath: OPERATION_RECEIPT_PATH, ok: true, queryText: q.note.text, resultText: r.note.text, ts: r.note.ts,
  };
}

export function readKnownGoodQueries(): KnownGoodQuery[] {
  return [readFrameQuery(), readOperationQuery(), readDiscriminatorDenotationQuestion()];
}
