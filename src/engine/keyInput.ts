import type { KeyToken } from './types';

const SPECIAL: Record<string, KeyToken> = {
  Enter: 'Enter', Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End'
};
const MODS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

const CTRL_ARROW: Record<string, KeyToken> = {
  ArrowUp: 'C-Up', ArrowDown: 'C-Down', ArrowLeft: 'C-Left', ArrowRight: 'C-Right'
};
const ALT_ARROW: Record<string, KeyToken> = {
  ArrowUp: 'M-Up', ArrowDown: 'M-Down', ArrowLeft: 'M-Left', ArrowRight: 'M-Right'
};

export function tokenize(e: KeyboardEvent): KeyToken | null {
  if (MODS.has(e.key)) return null;
  if (e.ctrlKey && e.key in CTRL_ARROW) return CTRL_ARROW[e.key]!;
  if (e.altKey && e.key in ALT_ARROW) return ALT_ARROW[e.key]!;
  if (e.ctrlKey && e.key.length === 1) return `C-${e.key.toLowerCase()}`;
  if (e.altKey && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
    return `M-${e.key.toLowerCase()}`;
  }
  if (e.shiftKey && e.key === 'Tab') return 'S-Tab';
  if (e.key in SPECIAL) return SPECIAL[e.key]!;
  if (e.key.length === 1) return e.key;
  return null;
}

export function attachKeyInput(
  target: Window | HTMLElement,
  handler: (t: KeyToken) => void
): () => void {
  const listener = (ev: Event) => {
    const t = tokenize(ev as KeyboardEvent);
    if (t === null) return;
    ev.preventDefault();
    handler(t);
  };
  target.addEventListener('keydown', listener);
  return () => target.removeEventListener('keydown', listener);
}
