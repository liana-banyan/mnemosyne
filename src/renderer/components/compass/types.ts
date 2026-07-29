// compass/types.ts -- BP138 Yoke 0.9.14
// Shared types for the new 5-tab Compass nav (Ask/Proof/Library/Social/More). Split into its
// own file so CompassShell.tsx and the per-tab components below can both import the union
// types without a circular import between CompassShell.tsx and its own children.

export type CompassTab = 'ask' | 'proof' | 'library' | 'social' | 'more';

export type MoreSubView =
  | 'menu'
  | 'kitchen-table'
  | 'atlas'
  | 'diagnosis'
  | 'frame'
  | 'lb-account'
  | 'settings'
  | 'membership'
  | 'help'
  | 'power';

/** Single navigation callback threaded down through every Compass tab so the Ask home's
 *  quick-starts (Phase 3) can deep-link straight into a More sub-view instead of forcing a
 *  two-step "open More, then click Kitchen Table" -- while More itself still shows the exact
 *  same sub-view when reached by its own menu. */
export type CompassNavigate = (tab: CompassTab, moreSubView?: MoreSubView) => void;
