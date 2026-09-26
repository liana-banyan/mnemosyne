// categories.ts -- D-BP223-BM04-X033S3-009 STEP 1d
//
// Categories IPC support: the 14 seed categories + a local "suggest a category" queue.
//
// [RULING NEEDED, see REPORT.md]: spec Section 7's Harper Guild ruling flow (a Guild member
// accepts/merges/declines a suggestion, stamped, published on the category's page) needs Guild
// membership + a ruling function -- 007's own draft migration for this
// (apply_harper_guild_category_ruling()) is NOT applied to production and this dispatch does not
// touch the database. This module therefore only RECORDS suggestions (so nothing submitted is
// lost) and always reports them back as status 'pending' -- it does not invent a ruling backend.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { categorySuggestionsPath } from './userdata_paths';
import { PROVEIT_CATEGORIES, PROVEIT_CATEGORY_LABELS } from '../../shared/proveit_contract';

export interface CategorySuggestion {
  text: string;
  suggestedAt: string;
  status: 'pending';
}

export function listSeedCategories(): Array<{ slug: (typeof PROVEIT_CATEGORIES)[number]; label: string }> {
  return PROVEIT_CATEGORIES.map((slug) => ({ slug, label: PROVEIT_CATEGORY_LABELS[slug] }));
}

export function suggestCategory(text: string, path: string = categorySuggestionsPath()): CategorySuggestion {
  const suggestion: CategorySuggestion = { text: text.trim().slice(0, 200), suggestedAt: new Date().toISOString(), status: 'pending' };
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(path, JSON.stringify(suggestion) + '\n', 'utf-8');
  return suggestion;
}

export function listCategorySuggestions(path: string = categorySuggestionsPath()): CategorySuggestion[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as CategorySuggestion;
        } catch {
          return null;
        }
      })
      .filter((s): s is CategorySuggestion => s !== null);
  } catch {
    return [];
  }
}
