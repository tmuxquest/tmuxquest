export const TMUX_COMMANDS: readonly string[] = [
  'attach', 'attach-session',
  'break-pane', 'breakp',
  'detach', 'detach-client',
  'display-popup', 'popup',
  'join-pane', 'joinp',
  'kill-pane', 'killp',
  'kill-session', 'kills',
  'kill-window',
  'move-window', 'movew',
  'new', 'new-session',
  'new-window', 'neww',
  'paste-buffer', 'pasteb',
  'rename-session',
  'rename-window',
  'resize-pane', 'resizep',
  'select-layout', 'selectl',
  'select-pane', 'selectp',
  'select-window', 'selectw',
  'split-window',
  'swap-pane', 'swapp',
  'swap-window', 'swapw',
  'switch-client', 'switchc',
];

export function commandMatches(q: string): string[] {
  if (q === '') return [...TMUX_COMMANDS].sort();
  return TMUX_COMMANDS.filter(c => c.startsWith(q)).sort();
}

export function visibleCompletionItems(buffer: string): string[] {
  if (buffer === '') return [];
  if (buffer.indexOf(' ') >= 0) return [];
  const all = commandMatches(buffer);
  if (all.length === 1 && all[0] === buffer) return [];
  return all.slice(0, 10);
}

export function longestCommonPrefix(xs: string[]): string {
  if (xs.length === 0) return '';
  let p = xs[0]!;
  for (let i = 1; i < xs.length; i++) {
    while (!xs[i]!.startsWith(p)) p = p.slice(0, -1);
    if (p === '') return '';
  }
  return p;
}
