// little_red_hen.ts — LRH contextual narration · BP067 Phase 3C
// "Who will help?" — the Little Red Hen is the cooperative narrator.
// Returns context-appropriate motivational quotes for cue cards.

export type HenContext = 'dispatch' | 'broadcast' | 'schedule' | 'join' | 'folder_added';

const narrations: Record<HenContext, string[]> = {
  dispatch: [
    'Every hour you dispatch feeds the cooperative. 🐓',
    "The Little Red Hen didn't wait for help — but she shared the bread. 🐓",
    'Your time is your contribution. The cooperative remembers.',
    'Dispatch by dispatch, the cooperative grows stronger.',
  ],
  broadcast: [
    'Who will help spread the word? The Little Red Hen always did her part. 🐓',
    'Your broadcast plants a seed. Others will harvest.',
    'Say it clearly. Say it often. The cooperative listens. 🐓',
    'One message, many ears. The Frontier amplifies. 🐓',
  ],
  schedule: [
    'A meal planned is a meal shared. 🐓',
    'The Little Red Hen always knew: preparation is cooperation.',
    'Plan it. Share it. The cooperative benefits.',
    'Coordination is the cooperative advantage. 🐓',
  ],
  join: [
    'Who will help build the cooperative? 🐓 Now you will.',
    'Five dollars. One stake. The Little Red Hen approves.',
    'Free to use. Better to join. The hen agrees. 🐓',
    'The cooperative is only as strong as its members. Welcome.',
  ],
  folder_added: [
    'More knowledge shared, more wisdom gained. 🐓',
    "The cooperative's memory grows with yours.",
    'Your files become shared context. The Frontier remembers. 🐓',
    'Index it. Share it. The substrate compounds. 🐓',
  ],
};

/**
 * Returns a random narration string for the given context.
 * Guaranteed non-empty and contextually relevant.
 */
export function getHenNarration(context: HenContext): string {
  const pool = narrations[context];
  return pool[Math.floor(Math.random() * pool.length)];
}
