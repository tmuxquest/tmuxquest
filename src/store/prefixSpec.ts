export const DEFAULT_PREFIX = 'C-b';

export const RESERVED_CTRL = new Set(['w', 't', 'n', 'q', 'r', 'l']);

function altBaseFromCode(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!.toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1]!;
  return null;
}

function tokenForEvent(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === 'Control' || k === 'Shift' || k === 'Alt' || k === 'Meta') return null;
  if (e.metaKey) return null;
  if (e.ctrlKey && k.length === 1) return `C-${k.toLowerCase()}`;
  if (e.altKey) {
    if (k.length === 1 && /[a-z0-9]/i.test(k)) return `M-${k.toLowerCase()}`;
    const base = altBaseFromCode(e.code);
    return base ? `M-${base}` : null;
  }
  if (k.length === 1) return k;
  return null;
}

export function prefixFromEvent(e: KeyboardEvent): { token: string } | { error: string } | null {
  if (e.metaKey && e.key.length === 1) return { error: "can't be a prefix" };
  const tok = tokenForEvent(e);
  if (tok === null) return null;
  const m = /^C-([a-z])$/.exec(tok);
  if (m && RESERVED_CTRL.has(m[1]!)) return { error: 'taken by the browser' };
  if (!isValidPrefixToken(tok)) return { error: "can't be a prefix" };
  return { token: tok };
}

export function eventMatchesPrefix(e: KeyboardEvent, prefixKey: string): string | null {
  const tok = tokenForEvent(e);
  return tok !== null && tok === prefixKey ? tok : null;
}

export function describeChord(e: KeyboardEvent): string {
  const tok = tokenForEvent(e);
  if (tok !== null) return formatPrefixLong(tok);
  const mods: string[] = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.metaKey) mods.push('Cmd');
  if (e.shiftKey) mods.push('Shift');
  const k = e.key;
  if (k.length === 1) mods.push(k === ' ' ? 'Space' : k.toUpperCase());
  return mods.join(' + ');
}

export function formatPrefix(token: string): string {
  if (token === 'C- ') return 'C-Space';
  if (token.startsWith('C-')) return '^' + token.slice(2).toUpperCase();
  if (token.startsWith('M-')) return 'M-' + token.slice(2).toUpperCase();
  return token;
}

export function formatPrefixLong(token: string): string {
  if (token === 'C- ') return 'Ctrl + Space';
  if (token.startsWith('C-')) return 'Ctrl + ' + token.slice(2).toUpperCase();
  if (token.startsWith('M-')) return 'Alt + ' + token.slice(2).toUpperCase();
  return token;
}

export function isValidPrefixToken(t: unknown): t is string {
  if (typeof t !== 'string' || t.length === 0) return false;
  const m = /^C-([a-z])$/.exec(t);
  if (m) return !RESERVED_CTRL.has(m[1]!);
  if (t === 'C- ') return true;
  if (/^M-[a-z0-9]$/.test(t)) return true;
  if (t.length === 1) return true;
  return false;
}
