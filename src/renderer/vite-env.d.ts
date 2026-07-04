/// <reference types="vite/client" />

// SEG-3: Vite raw import support for .md files — used by LocFaqPanel.tsx and others
declare module '*.md?raw' {
  const content: string;
  export default content;
}
