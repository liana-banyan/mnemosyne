// teaching_notes.ts -- D-BP150-002/BISHOP/S02/seg-notesrecall
//
// READING BACK WHAT THE OPERATOR ALREADY WROTE. Founder, BP150: "I'd like to start the Call an
// Audible, and then post whichever of my notes I want into the textbox I'm typing in, so I don't
// have to go read it, or do it from memory."
//
// The notes he wrote walking qid 85 are the specification for a method that does not exist yet
// (a SURVEY pre-phase, Catalyst Words, the Substitution Test). Asking him to retype them from
// memory at the exact moment they apply is how a plan gets lost. This module carries them back.
//
// WHY A PARSER AND NOT A DATABASE. index.ts's 'liana-teach-submit' handler is the ONLY writer of
// these files, so their shape is deterministic and parsing them is reading our own format, not
// scraping someone else's. That matters for one specific reason: he wants THE NOTES HE WROTE AN
// HOUR AGO. A structured sidecar written from here on would be tidier and would not contain a
// single word he has actually typed. The four files already on disk are the asset.
//
// EVERY NOTE IS RETURNED VERBATIM. Blank lines at the edges of a block are stripped because the
// writer's own template put them there; nothing inside a note is touched -- no reflow, no trim of
// internal whitespace, no summarization. HARDWIRE, and Founder BP149: "I DESPISE SUMMARIES."

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LianaTeachingFile, LianaTeachingNote } from '../../shared/liana_cycle/liana_terminal_types';

/** The one directory 'liana-teach-submit' writes to. Kept in sync with that handler by hand --
 *  if it ever moves, this moves with it and the mismatch is a one-line fix, not a silent empty
 *  list. An empty result here is reported to the operator as "none found", never as "none exist". */
const DROPZONE_DIR = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE';

const FILE_PREFIX = 'METHOD_TEACHING_';
const STEP_MARKER = '### STEP ';
const RESPONSE_MARKER = "**Operator's response at this step, verbatim:**";
const NO_RESPONSE = '(no response -- advanced without annotation)';
const TEACH_MARKER = "## THE OPERATOR'S TEACHING, VERBATIM";
const QUESTION_MARKER = '## THE QUESTION THAT TRIGGERED THIS';

/** Strips only the blank lines the template itself introduced around a block. */
function trimBlankEdges(s: string): string {
  return s.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
}

/** Pulls `label` and the UTC stamp back out of METHOD_TEACHING_<label>_<stamp>.md. Returns null
 *  for anything that does not match, so an unrelated file dropped in the directory is ignored
 *  rather than half-parsed. */
function parseFileName(fileName: string): { label: string; writtenAt: string } | null {
  if (!fileName.startsWith(FILE_PREFIX) || !fileName.endsWith('.md')) return null;
  const middle = fileName.slice(FILE_PREFIX.length, -'.md'.length);
  const lastUnderscore = middle.lastIndexOf('_');
  if (lastUnderscore <= 0) return null;
  const label = middle.slice(0, lastUnderscore);
  const stamp = middle.slice(lastUnderscore + 1);
  // 20260808T195930Z -> 2026-08-08T19:59:30Z, for display. A stamp that does not match this shape
  // is passed through unchanged rather than guessed at.
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(stamp);
  const writtenAt = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : stamp;
  return { label, writtenAt };
}

function extractSection(content: string, marker: string): string {
  const start = content.indexOf(marker);
  if (start < 0) return '';
  const after = content.slice(start + marker.length);
  const nextHeading = after.search(/\n##[^#]/);
  return trimBlankEdges(nextHeading >= 0 ? after.slice(0, nextHeading) : after);
}

function parseSteppedNotes(content: string): LianaTeachingNote[] {
  const notes: LianaTeachingNote[] = [];
  const blocks = content.split(STEP_MARKER).slice(1); // [0] is everything before the first step
  for (const block of blocks) {
    const newline = block.indexOf('\n');
    if (newline < 0) continue;
    const counts = /^(\d+)\s+of\s+(\d+)/.exec(block.slice(0, newline).trim());
    const responseAt = block.indexOf(RESPONSE_MARKER);
    if (responseAt < 0) continue;

    // The step's own transcript lines sit between the "N of M" line and the response marker; the
    // FIRST of them is the boundary event that opened the step, which is what makes a note
    // recognizable at a glance ("[stage] -> STAGE 1 ask the inverse...").
    const eventBlock = trimBlankEdges(block.slice(newline + 1, responseAt));
    const heading = eventBlock.split('\n')[0]?.trim() ?? '';

    let text = block.slice(responseAt + RESPONSE_MARKER.length);
    // Notes are separated by a horizontal rule the template writes on its own line.
    const rule = text.indexOf('\n---');
    if (rule >= 0) text = text.slice(0, rule);
    text = trimBlankEdges(text);

    if (!text || text === NO_RESPONSE) continue;   // an unannotated step is not a note
    notes.push({
      stepIndex: counts ? Number(counts[1]) : null,
      stepTotal: counts ? Number(counts[2]) : null,
      heading,
      text,
    });
  }
  return notes;
}

/**
 * Reads every teaching file on disk and returns the ones that contain at least one real note.
 *
 * `labelFilter` (e.g. "qid85") narrows to one question. Passing nothing returns everything, which
 * is deliberate: a method note written while walking one question is frequently the note he wants
 * while walking a different one, because the notes are about the METHOD, not the question.
 */
export function listTeachingFiles(labelFilter?: string): LianaTeachingFile[] {
  let entries: string[];
  try {
    entries = readdirSync(DROPZONE_DIR);
  } catch {
    return [];   // reported to the operator as "none found"; never as proof none exist
  }

  const out: LianaTeachingFile[] = [];
  for (const fileName of entries) {
    const meta = parseFileName(fileName);
    if (!meta) continue;
    if (labelFilter && meta.label !== labelFilter) continue;

    const filePath = join(DROPZONE_DIR, fileName);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;   // an unreadable file is skipped, never reported as an empty one
    }

    // Two shapes, one writer: a stepped walk (per-step annotations) or a plain Teach box (one
    // undivided block). Both are real teaching; neither is preferred.
    let notes = parseSteppedNotes(content);
    if (notes.length === 0) {
      const teaching = extractSection(content, TEACH_MARKER);
      if (teaching) notes = [{ stepIndex: null, stepTotal: null, heading: 'Teach box', text: teaching }];
    }
    if (notes.length === 0) continue;

    out.push({
      filePath,
      fileName,
      label: meta.label,
      question: extractSection(content, QUESTION_MARKER).split('\n')[0] ?? '',
      writtenAt: meta.writtenAt,
      abandoned: content.includes('ABANDONED at step'),
      notes,
    });
  }

  // Newest first: the most recent pass is the one whose thinking is freshest in his head.
  out.sort((a, b) => (a.writtenAt < b.writtenAt ? 1 : a.writtenAt > b.writtenAt ? -1 : 0));
  return out;
}
