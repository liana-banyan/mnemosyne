// Soccerball Registry — Liana Banyan indexing primitive stub
// Manages the reference-pyramid: a hierarchical knowledge structure built
// from the local substrate. On fresh install, initializes to a valid empty
// state rather than crashing or emitting missing-reference warnings.

export interface SoccerballPyramid {
  version: number;
  initialized_at: string;
  levels: Record<string, unknown[]>;
}

let _pyramidState: SoccerballPyramid | null = null;

/**
 * Initialize the soccerball/reference-pyramid structure.
 * On first run (or any run where the state is missing) this returns a
 * valid empty pyramid — never throws.
 */
export async function initSoccerball(): Promise<SoccerballPyramid> {
  if (_pyramidState) return _pyramidState;

  _pyramidState = {
    version: 1,
    initialized_at: new Date().toISOString(),
    levels: {},
  };

  console.log('[soccerball] Pyramid initialized (fresh install)');
  return _pyramidState;
}

/** Returns the current pyramid state, or null if not yet initialized. */
export function getPyramidState(): SoccerballPyramid | null {
  return _pyramidState;
}
