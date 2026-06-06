import type { TmuxState, Segment, SegmentStyle, Window, Session } from './types';
import { paneOrder } from './layout';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG  = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;

export const TRAINER_HOST = 'tmuxquest';

export const TRAINER_PANE_COMMAND = 'zsh';

export function formatTime(d: Date, fmt: string): string {
  let out = '';
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i]!;
    if (ch !== '%') { out += ch; continue; }
    const next = fmt[i + 1];
    if (next === undefined) { out += '%'; continue; }
    switch (next) {
      case 'H': out += pad2(d.getHours()); break;
      case 'M': out += pad2(d.getMinutes()); break;
      case 'S': out += pad2(d.getSeconds()); break;
      case 'd': out += pad2(d.getDate()); break;
      case 'm': out += pad2(d.getMonth() + 1); break;
      case 'b': out += MONTHS_SHORT[d.getMonth()]; break;
      case 'B': out += MONTHS_LONG[d.getMonth()]; break;
      case 'y': out += pad2(d.getFullYear() % 100); break;
      case 'Y': out += String(d.getFullYear()); break;
      case '%': out += '%'; break;
      default:  out += '%' + next; break;
    }
    i++;
  }
  return out;
}

export interface EvaluateFormatOpts {
  now?: Date;
  pin?: {
    session?: Session;
    window?: Window;
    windowIndex?: number;
    flag?: string;
  };
}

function activeRefs(state: TmuxState): {
  session?: Session;
  window?: Window;
  windowIndex?: number;
  activePaneId?: string;
  paneIndex?: number;
} {
  const session =
    state.sessions.find(s => s.id === state.attachedSessionId) ??
    state.sessions.find(s => s.id === state.activeSessionId) ??
    state.sessions[0];
  if (!session) return {};
  const windowIndex = session.windows.findIndex(w => w.id === session.activeWindowId);
  const window = windowIndex >= 0 ? session.windows[windowIndex] : undefined;
  if (!window) return { session };
  const order = paneOrder(window.layout);
  const paneIndex = order.indexOf(window.activePaneId);
  return {
    session,
    window,
    windowIndex,
    activePaneId: window.activePaneId,
    paneIndex: paneIndex >= 0 ? paneIndex : undefined,
  };
}

function resolveVar(
  name: string,
  state: TmuxState,
  pin?: EvaluateFormatOpts['pin'],
): string | undefined {
  const r = activeRefs(state);
  const session = pin?.session ?? r.session;
  const window = pin?.window ?? r.window;
  const windowIndex = pin?.windowIndex ?? r.windowIndex;
  switch (name) {
    case 'session_name':
    case 'S':
      return session?.name ?? '';
    case 'window_name':
    case 'W':
      return window?.name ?? '';
    case 'window_index':
    case 'I':
      return windowIndex !== undefined ? String(windowIndex) : '';
    case 'pane_index':
    case 'P':
      return r.paneIndex !== undefined ? String(r.paneIndex) : '';
    case 'window_flags':
    case 'F':
      return pin?.flag ?? '';
    case 'host':
    case 'H':
      return TRAINER_HOST;
    case 'host_short':
    case 'h':
      return TRAINER_HOST;
    case 'pane_current_command':
      return TRAINER_PANE_COMMAND;
    case 'client_prefix':
      return state.mode === 'prefix' ? '1' : '0';
    default:
      return undefined;
  }
}

function pushText(out: Segment[], text: string, style: SegmentStyle | undefined): void {
  if (text === '') return;
  const last = out[out.length - 1];
  if (last && last.style === style) {
    last.text += text;
    return;
  }
  out.push(style ? { text, style } : { text });
}

type BoolStyleKey = 'bold' | 'italic' | 'underscore' | 'reverse';

const STYLE_FLAGS: Record<string, BoolStyleKey> = {
  bold: 'bold',
  italic: 'italic',
  underscore: 'underscore',
  reverse: 'reverse',
};

function applyStyleBody(
  prev: SegmentStyle | undefined,
  body: string,
): SegmentStyle | undefined {
  const trimmed = body.trim();
  if (trimmed === '' || trimmed === 'default') return undefined;

  const next: SegmentStyle = prev ? { ...prev } : {};
  for (const rawAttr of trimmed.split(',')) {
    const attr = rawAttr.trim();
    if (attr === '') continue;
    if (attr === 'default') {
      for (const k of Object.keys(next) as (keyof SegmentStyle)[]) delete next[k];
      continue;
    }
    const eq = attr.indexOf('=');
    if (eq >= 0) {
      const key = attr.slice(0, eq).trim();
      const val = attr.slice(eq + 1).trim();
      if (key === 'fg' || key === 'bg') {
        if (val === 'default' || val === '') delete next[key];
        else next[key] = val;
      }
      continue;
    }
    if (attr.startsWith('no')) {
      const k = STYLE_FLAGS[attr.slice(2)];
      if (k) delete next[k];
      continue;
    }
    const k = STYLE_FLAGS[attr];
    if (k) next[k] = true;
  }
  if (Object.keys(next).length === 0) return undefined;
  return next;
}

export function evaluateFormat(
  state: TmuxState,
  fmt: string,
  opts: EvaluateFormatOpts = {},
): Segment[] {
  const out: Segment[] = [];
  const now = opts.now ?? new Date();
  let style: SegmentStyle | undefined = undefined;

  let i = 0;
  while (i < fmt.length) {
    const ch = fmt[i]!;

    if (ch === '%' && i + 1 < fmt.length) {
      let j = i;
      while (j < fmt.length && fmt[j] === '%') {
        j += (j + 1 < fmt.length) ? 2 : 1;
        while (j < fmt.length && fmt[j] !== '%' && fmt[j] !== '#') j++;
      }
      const chunk = fmt.slice(i, j);
      pushText(out, formatTime(now, chunk), style);
      i = j;
      continue;
    }
    if (ch === '%') {
      pushText(out, '%', style);
      i += 1;
      continue;
    }

    if (ch === '#') {
      const next = fmt[i + 1];
      if (next === '#') { pushText(out, '#', style); i += 2; continue; }
      if (next === '[') {
        const close = fmt.indexOf(']', i + 2);
        if (close < 0) {
          pushText(out, '#', style); i += 1; continue;
        }
        const body = fmt.slice(i + 2, close);
        style = applyStyleBody(style, body);
        i = close + 1;
        continue;
      }
      if (next === '{') {
        const end = findMatchingBrace(fmt, i + 1);
        if (end < 0) {
          pushText(out, '#', style); i += 1; continue;
        }
        const body = fmt.slice(i + 2, end);

        if (body.startsWith('?')) {
          const parts = splitTopLevelCommas(body.slice(1));
          const condFmt = parts[0] ?? '';
          const truePart = parts[1] ?? '';
          const falsePart = parts[2] ?? '';
          const trimmed = condFmt.trim();
          const asVar = resolveVar(trimmed, state, opts.pin);
          const condText =
            asVar !== undefined
              ? asVar
              : evaluateFormat(state, condFmt, opts).map(s => s.text).join('');
          const branch = isTruthy(condText) ? truePart : falsePart;
          const branchSegs = evaluateFormat(state, branch, opts);
          for (const seg of branchSegs) {
            const merged = mergeStyle(style, seg.style);
            pushText(out, seg.text, merged);
          }
          i = end + 1;
          continue;
        }

        const cmp = matchComparator(body);
        if (cmp) {
          const aTxt = evaluateFormat(state, cmp.a, opts).map(s => s.text).join('');
          const bTxt = evaluateFormat(state, cmp.b, opts).map(s => s.text).join('');
          const equal = aTxt === bTxt;
          pushText(out, (cmp.op === '==' ? equal : !equal) ? '1' : '0', style);
          i = end + 1;
          continue;
        }

        const resolved = resolveVar(body, state, opts.pin);
        if (resolved !== undefined) {
          pushText(out, resolved, style);
        } else {
          pushText(out, fmt.slice(i, end + 1), style);
        }
        i = end + 1;
        continue;
      }
      if (next !== undefined && /[A-Za-z]/.test(next)) {
        const resolved = resolveVar(next, state, opts.pin);
        if (resolved !== undefined) {
          pushText(out, resolved, style);
        } else {
          pushText(out, '#' + next, style);
        }
        i += 2;
        continue;
      }
      pushText(out, '#', style); i += 1; continue;
    }

    let j = i;
    while (j < fmt.length && fmt[j] !== '#' && fmt[j] !== '%') j++;
    pushText(out, fmt.slice(i, j), style);
    i = j;
  }

  return out;
}

function findMatchingBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function splitTopLevelCommas(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out;
}

function isTruthy(s: string): boolean {
  return s !== '' && s !== '0';
}

interface Comparator { op: '==' | '!='; a: string; b: string; }

function matchComparator(body: string): Comparator | undefined {
  let op: '==' | '!=' | null = null;
  let rest = '';
  if (body.startsWith('==:')) { op = '=='; rest = body.slice(3); }
  else if (body.startsWith('!=:')) { op = '!='; rest = body.slice(3); }
  if (!op) return undefined;
  const parts = splitTopLevelCommas(rest);
  if (parts.length < 2) return undefined;
  return { op, a: parts[0] ?? '', b: parts.slice(1).join(',') };
}

function mergeStyle(
  outer: SegmentStyle | undefined,
  inner: SegmentStyle | undefined,
): SegmentStyle | undefined {
  if (!outer && !inner) return undefined;
  if (!outer) return inner;
  if (!inner) return outer;
  return { ...outer, ...inner };
}
