import type {
  TmuxState, KeyToken, DispatchResult, GameEvent, Session, PaneMenuItem,
} from '../types';
import { paneOrder, resizeActive } from '../layout';
import { clone, attached, activeWin, pushBuffer, reconcileCopy, clearActivePaneCopy, REPEAT_TIME_MS } from './primitives';
import {
  type Pos,
  clampCol, clampRow, colForGoal, copyLines, moveH, nextWordStart, prevWordStart, wordEnd,
  yankSelection,
} from './copyMode';
import { commandMatches, visibleCompletionItems, longestCommonPrefix } from './completion';
import { unquote } from './sendKeys';
import { openWindowTree, rowKey, visibleRows } from './tree';
import { killWindow, killSession, newWindow, findMatch, swapPaneByDelta } from './window';
import { PRESET_CYCLE, applyPreset } from './paneTree';
import { stepMenuCursor } from './mouse';
import {
  applyCommand, fireHook, setActivePane, closeActive, breakPane,
  windowStep, paneCommand, type ApplyOpts,
} from './commands';

export function dispatch(state: TmuxState, key: KeyToken, opts?: ApplyOpts): DispatchResult {
  const s = clone(state);
  const events: GameEvent[] = [];
  delete s.statusMessage;

  const result = routeKey(s, key, events, opts);
  reconcileCopy(result.state);
  return result;
}

function routeKey(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'rename' || s.mode === 'command') return handleCommandMode(s, key, events, opts);

  if (s.mode === 'find') return handleFind(s, key, events, opts);

  if (s.mode === 'confirm') return handleConfirm(s, key, events, opts);

  if (s.mode === 'repeat') return handleRepeat(s, key, events, opts);

  if (s.mode === 'copy') return handleCopy(s, key, events, opts);

  if (s.mode === 'tree' && s.tree) return handleTree(s, key, events, opts);

  if (s.mode === 'display-panes') return handleDisplayPanes(s, key, events, opts);

  if (s.mode === 'popup') return handlePopup(s, key, events, opts);

  if (s.mode === 'menu') return handleMenu(s, key, events, opts);

  if (s.attachedSessionId === null) {
    if (key === 'Enter') {
      s.attachedSessionId = s.activeSessionId;
      events.push({ type: 'attached', sessionId: s.activeSessionId });
      fireHook(s, 'client-attached', events, opts);
    }
    return { state: s, events };
  }

  if (s.mode === 'normal') {
    if (key === s.prefixKey) s.mode = 'prefix';
    return { state: s, events };
  }

  return handlePrefix(s, key, events, opts);
}

function handleCommandMode(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'rename' || s.mode === 'command') {
    if (s.mode === 'command' && s.cmdMenuOpen) {
      const items = visibleCompletionItems(s.buffer);
      const cur = Math.min(Math.max(s.cmdMenuCursor ?? 0, 0), Math.max(items.length - 1, 0));
      const close = () => { s.cmdMenuCursor = 0; delete s.cmdMenuOpen; };
      const select = (i: number) => { if (i >= 0 && i < items.length) { s.buffer = items[i]!; s.bufferCursor = s.buffer.length; } close(); };
      if (key === 'Esc' || key === 'q' || key === 'C-c' || key === 'C-g') {
        close(); return { state: s, events };
      }
      if (key === 'Up' || key === 'k' || key === 'S-Tab') {
        if (items.length > 1) s.cmdMenuCursor = cur <= 0 ? items.length - 1 : cur - 1;
        return { state: s, events };
      }
      if (key === 'Down' || key === 'j') {
        if (items.length > 1) s.cmdMenuCursor = cur >= items.length - 1 ? 0 : cur + 1;
        return { state: s, events };
      }
      if (key === 'Tab') {
        if (cur >= items.length - 1) close(); else s.cmdMenuCursor = cur + 1;
        return { state: s, events };
      }
      if (key === 'Enter') { select(cur); return { state: s, events }; }
      if (key.length === 1 && key >= '0' && key <= '9') {
        const idx = key.charCodeAt(0) - 48;
        if (idx < items.length) select(idx);
        return { state: s, events };
      }
      return { state: s, events };
    }
    if (key === 'Esc') {
      s.mode = 'normal'; s.buffer = '';
      delete s.cmdMenuCursor; delete s.cmdMenuOpen;
      delete s.renameTarget; delete s.bufferCursor;
      return { state: s, events };
    }
    if (key === 'C-c' || key === 'C-g') {
      s.mode = 'normal'; s.buffer = '';
      delete s.cmdMenuCursor; delete s.cmdMenuOpen;
      delete s.renameTarget; delete s.bufferCursor;
      s.statusMessage = 'cancelled';
      return { state: s, events };
    }
    const at = Math.min(Math.max(s.bufferCursor ?? s.buffer.length, 0), s.buffer.length);
    if (key === 'C-u') {
      s.buffer = ''; s.bufferCursor = 0;
      if (s.mode === 'command') s.cmdMenuCursor = 0;
      return { state: s, events };
    }
    if (key === 'C-a') { s.bufferCursor = 0; return { state: s, events }; }
    if (key === 'C-e') { s.bufferCursor = s.buffer.length; return { state: s, events }; }
    if (key === 'Left' || key === 'C-b') { s.bufferCursor = Math.max(0, at - 1); return { state: s, events }; }
    if (key === 'Right' || key === 'C-f') { s.bufferCursor = Math.min(s.buffer.length, at + 1); return { state: s, events }; }
    if (key === 'Tab' && s.mode === 'command') {
      const buf = s.buffer;
      if (buf !== '' && buf.indexOf(' ') < 0) {
        const all = commandMatches(buf);
        if (all.length === 1) {
          s.buffer = all[0]! + ' ';
          s.bufferCursor = s.buffer.length;
          s.cmdMenuCursor = 0; delete s.cmdMenuOpen;
        } else if (all.length > 1) {
          const lcp = longestCommonPrefix(all);
          if (lcp.length > buf.length) {
            s.buffer = lcp;
            s.bufferCursor = s.buffer.length;
            s.cmdMenuCursor = 0; delete s.cmdMenuOpen;
          } else {
            s.cmdMenuOpen = true;
            s.cmdMenuCursor = 0;
          }
        }
      }
      return { state: s, events };
    }
    if (key === 'Enter') {
      const text = s.buffer.trim(); const mode = s.mode;
      s.mode = 'normal'; s.buffer = '';
      delete s.cmdMenuCursor; delete s.cmdMenuOpen; delete s.bufferCursor;
      if (mode === 'rename') {
        const target = s.renameTarget ?? 'window';
        delete s.renameTarget;
        const se = attached(s);
        if (se && text) {
          const nm = unquote(text);
          if (target === 'session') {
            se.name = nm;
            events.push({ type: 'session-renamed', name: nm });
            fireHook(s, 'session-renamed', events, opts);
          } else {
            const w = activeWin(se);
            w.name = nm;
            events.push({ type: 'window-renamed', name: nm });
            fireHook(s, 'window-renamed', events, opts);
          }
        } else {
          s.statusMessage = 'name required';
        }
      } else { applyCommand(s, text, events, opts); }
      return { state: s, events };
    }
    if (key === 'Backspace') {
      if (at > 0) {
        s.buffer = s.buffer.slice(0, at - 1) + s.buffer.slice(at);
        s.bufferCursor = at - 1;
      }
      if (s.mode === 'command') s.cmdMenuCursor = 0;
      return { state: s, events };
    }
    if (key.length === 1) {
      s.buffer = s.buffer.slice(0, at) + key + s.buffer.slice(at);
      s.bufferCursor = at + 1;
      if (s.mode === 'command') s.cmdMenuCursor = 0;
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handleFind(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'find') {
    if (key === 'Esc' || key === 'C-c' || key === 'C-g') {
      s.mode = 'normal'; s.buffer = '';
      s.statusMessage = 'cancelled';
      return { state: s, events };
    }
    if (key === 'Backspace') {
      s.buffer = s.buffer.slice(0, -1);
      return { state: s, events };
    }
    if (key === 'Enter') {
      const q = s.buffer.trim();
      s.mode = 'normal'; s.buffer = '';
      if (!q) {
        s.statusMessage = 'cancelled';
        return { state: s, events };
      }
      const m = findMatch(s, q);
      if (!m) {
        s.statusMessage = `no window matching ${q}`;
        return { state: s, events };
      }
      if (s.attachedSessionId !== m.sessionId) {
        s.attachedSessionId = m.sessionId;
        s.activeSessionId = m.sessionId;
        events.push({ type: 'session-switched', sessionId: m.sessionId });
      }
      const se = s.sessions.find(x => x.id === m.sessionId)!;
      if (se.activeWindowId !== m.windowId) {
        se.lastWindowId = se.activeWindowId;
        se.activeWindowId = m.windowId;
        events.push({ type: 'window-switched', windowId: m.windowId });
      }
      return { state: s, events };
    }
    if (key.length === 1) s.buffer += key;
    return { state: s, events };
  }
  return { state: s, events };
}

function handleConfirm(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'confirm') {
    const c = s.confirm;
    const returnTo = c?.returnTo ?? 'normal';
    delete s.confirm;
    s.mode = returnTo;
    if ((key === 'y' || key === 'Y') && c) {
      if (c.kind === 'kill-window') {
        const se = attached(s);
        if (se) killWindow(s, se, se.activeWindowId, events);
      } else if (c.kind === 'kill-pane') {
        const se = attached(s);
        if (se) {
          const w = activeWin(se);
          const single = paneOrder(w.layout).length === 1;
          if (!(single && se.windows.length === 1)) {
            closeActive(s, se, w, events, opts);
            events.push({ type: 'pane-closed' });
            if (single) events.push({ type: 'window-killed' });
            fireHook(s, 'pane-died', events, opts);
            fireHook(s, 'pane-exited', events, opts);
          }
        }
      } else if (c.kind === 'tree-kill' && c.target) {
        const sess = s.sessions.find(x => x.id === c.target!.sessionId);
        if (sess) {
          if (c.target.windowId) {
            killWindow(s, sess, c.target.windowId, events);
          } else {
            killSession(s, sess.id, events);
          }
        }
      } else if (c.kind === 'tree-kill-tagged' && c.targets) {
        const windowTargets = c.targets.filter(t => t.windowId);
        const sessionTargets = c.targets.filter(t => !t.windowId);
        for (const t of windowTargets) {
          const sess = s.sessions.find(x => x.id === t.sessionId);
          if (!sess) continue;
          if (sess.windows.length <= 1) continue;
          if (!sess.windows.some(w => w.id === t.windowId)) continue;
          killWindow(s, sess, t.windowId!, events);
        }
        for (const t of sessionTargets) {
          if (s.sessions.length <= 1) break;
          if (!s.sessions.some(x => x.id === t.sessionId)) continue;
          killSession(s, t.sessionId, events);
        }
        if (s.tree) s.tree.tagged = {};
      }
    } else {
      s.statusMessage = 'cancelled';
    }
    if (s.mode === 'tree' && s.tree) {
      const newRows = visibleRows(s, s.tree);
      if (newRows.length === 0) {
        s.mode = 'normal';
        delete s.tree;
      } else {
        s.tree.cursor = Math.min(s.tree.cursor, newRows.length - 1);
      }
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handleRepeat(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'repeat') {
    if (s.repeatDeadline != null && Date.now() > s.repeatDeadline) {
      s.mode = 'normal';
      delete s.repeatDeadline;
      return dispatch(s, key);
    }
    if (key === 'Up' || key === 'Down' || key === 'Left' || key === 'Right') {
      s.mode = 'normal';
      const se = attached(s);
      if (se) paneCommand(s, se, key, events, opts);
      return { state: s, events };
    }
    const repeatKeys = new Set([
      'C-Up', 'C-Down', 'C-Left', 'C-Right',
      'M-Up', 'M-Down', 'M-Left', 'M-Right',
    ]);
    if (repeatKeys.has(key)) {
      s.mode = 'normal';
      const se = attached(s);
      if (se) {
        const w = activeWin(se);
        const isMeta = (key as string).startsWith('M-');
        const amount = isMeta ? 5 : 1;
        const ratio = isMeta ? 0.5 : 0.1;
        w.layout = resizeActive(w.layout, w.activePaneId, key, ratio);
        const dirMap = {
          'C-Left': 'L', 'C-Right': 'R', 'C-Up': 'U', 'C-Down': 'D',
          'M-Left': 'L', 'M-Right': 'R', 'M-Up': 'U', 'M-Down': 'D',
        } as const;
        const rDir = dirMap[key as keyof typeof dirMap];
        events.push({ type: 'pane-resized', paneId: w.activePaneId, dir: rDir, amount });
        s.mode = 'repeat';
        s.repeatDeadline = Date.now() + REPEAT_TIME_MS;
      }
      return { state: s, events };
    }
    s.mode = 'normal';
    delete s.repeatDeadline;
    return dispatch(s, key);
  }
  return { state: s, events };
}

function handleCopy(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'copy') {
    const cp = s.copy;
    const se0 = attached(s);
    if (!cp || !se0) { s.mode = 'normal'; return { state: s, events }; }
    const w = activeWin(se0);
    const lines = copyLines(w.paneContent?.[cp.paneId] ?? [], cp);

    const exit = () => {
      if (s.copyByPane) delete s.copyByPane[cp.paneId];
      s.buffer = '';
      events.push({ type: 'copy-mode-exited' });
    };

    const nextMatch = (
      query: string,
      from: Pos,
      includeFrom: boolean,
      dir: 'fwd' | 'bwd' = 'fwd',
    ): Pos | null => {
      if (!query) return null;
      const nLines = lines.length;
      if (dir === 'fwd') {
        for (let step = 0; step < nLines; step++) {
          const idx = (from.row + step) % nLines;
          const startCol = step === 0
            ? (includeFrom ? from.col : from.col + query.length)
            : 0;
          const found = lines[idx]!.indexOf(query, startCol);
          if (found >= 0) return { row: idx, col: found };
        }
        const wrapFound = lines[from.row]!.indexOf(query, 0);
        if (wrapFound >= 0 && wrapFound < from.col) {
          return { row: from.row, col: wrapFound };
        }
        return null;
      } else {
        for (let step = 0; step < nLines; step++) {
          const idx = ((from.row - step) % nLines + nLines) % nLines;
          let limitCol: number;
          if (step === 0) {
            limitCol = includeFrom ? from.col + query.length : from.col;
          } else {
            limitCol = lines[idx]!.length;
          }
          const rowStr = lines[idx]!.substring(0, limitCol);
          const found = rowStr.lastIndexOf(query);
          if (found >= 0) return { row: idx, col: found };
        }
        const wrapStr = lines[from.row]!;
        const wrapFound = wrapStr.lastIndexOf(query);
        if (wrapFound >= 0 && wrapFound >= from.col) {
          return { row: from.row, col: wrapFound };
        }
        return null;
      }
    };

    if (cp.searchActive) {
      if (key === 'Esc' || key === 'C-c' || key === 'C-g') {
        cp.searchActive = false; s.buffer = '';
      } else if (key === 'Backspace') {
        s.buffer = s.buffer.slice(0, -1);
      } else if (key === 'Enter') {
        cp.searchActive = false;
        cp.search = s.buffer;
        const dir = cp.searchDir ?? 'fwd';
        const hit = nextMatch(cp.search, cp.cursor, true, dir);
        if (hit) { cp.cursor = hit; cp.goalCol = cp.cursor.col; }
        else if (cp.search) s.statusMessage = `search failed: ${cp.search}`;
        s.buffer = '';
        events.push({ type: 'copy-searched' });
      } else if (key.length === 1) {
        s.buffer += key;
      }
      if (s.copy) {
        s.minCopyCursorRow = Math.min(s.minCopyCursorRow ?? s.copy.cursor.row, s.copy.cursor.row);
      }
      return { state: s, events };
    }

    if (key === s.prefixKey) { s.mode = 'prefix'; return { state: s, events }; }

    switch (key) {
      case 'q': case 'C-c': exit(); break;
      case 'Esc': case 'C-[': cp.anchor = null; break;
      case 'h': case 'Left': case 'Backspace':
        cp.cursor = moveH(lines, cp.cursor, -1); cp.goalCol = cp.cursor.col; break;
      case 'l': case 'Right':
        cp.cursor = moveH(lines, cp.cursor, +1); cp.goalCol = cp.cursor.col; break;
      case 'j': case 'Down': {
        const row = clampRow(lines, cp.cursor.row + 1);
        cp.cursor = { row, col: colForGoal(lines, row, cp.goalCol) };
        break;
      }
      case 'k': case 'Up': {
        const row = clampRow(lines, cp.cursor.row - 1);
        cp.cursor = { row, col: colForGoal(lines, row, cp.goalCol) };
        break;
      }
      case 'g': cp.cursor = { row: 0, col: 0 }; cp.goalCol = 0; break;
      case 'G': {
        const row = clampRow(lines, lines.length - 1);
        cp.cursor = { row, col: lines[row]?.length ?? 0 };
        cp.goalCol = null;
        break;
      }
      case '0': case 'Home':
        cp.cursor = { row: cp.cursor.row, col: 0 }; cp.goalCol = 0; break;
      case '$': case 'End':
        cp.cursor = {
          row: cp.cursor.row,
          col: lines[cp.cursor.row]!.length,
        };
        cp.goalCol = null;
        break;
      case '^': {
        const line = lines[cp.cursor.row] ?? '';
        let c = 0;
        while (c < line.length && /\s/.test(line[c]!)) c++;
        cp.cursor = { row: cp.cursor.row, col: c < line.length ? c : 0 };
        cp.goalCol = cp.cursor.col;
        break;
      }
      case 'w': cp.cursor = nextWordStart(lines, cp.cursor); cp.goalCol = cp.cursor.col; break;
      case 'b': cp.cursor = prevWordStart(lines, cp.cursor); cp.goalCol = cp.cursor.col; break;
      case 'e': cp.cursor = wordEnd(lines, cp.cursor); cp.goalCol = cp.cursor.col; break;
      case 'C-d': {
        const row = clampRow(lines, cp.cursor.row + 10);
        cp.cursor = { row, col: colForGoal(lines, row, cp.goalCol) };
        break;
      }
      case 'C-u': {
        const row = clampRow(lines, cp.cursor.row - 10);
        cp.cursor = { row, col: colForGoal(lines, row, cp.goalCol) };
        break;
      }
      case '/': cp.searchActive = true; cp.searchDir = 'fwd'; s.buffer = ''; break;
      case '?': cp.searchActive = true; cp.searchDir = 'bwd'; s.buffer = ''; break;
      case 'n':
        if (cp.search) {
          const dir = cp.searchDir ?? 'fwd';
          const hit = nextMatch(cp.search, cp.cursor, false, dir);
          if (hit) { cp.cursor = hit; cp.goalCol = cp.cursor.col; }
          else s.statusMessage = `search failed: ${cp.search}`;
          events.push({ type: 'copy-searched' });
        }
        break;
      case 'N':
        if (cp.search) {
          const dir: 'fwd' | 'bwd' = (cp.searchDir ?? 'fwd') === 'fwd' ? 'bwd' : 'fwd';
          const hit = nextMatch(cp.search, cp.cursor, false, dir);
          if (hit) { cp.cursor = hit; cp.goalCol = cp.cursor.col; }
          else s.statusMessage = `search failed: ${cp.search}`;
          events.push({ type: 'copy-searched' });
        }
        break;
      case ' ':
        cp.anchor = { row: cp.cursor.row, col: cp.cursor.col };
        cp.selectMode = 'char';
        break;
      case 'V':
        cp.anchor = { row: cp.cursor.row, col: cp.cursor.col };
        cp.selectMode = 'line';
        break;
      case 'Enter':
        if (cp.anchor !== null) {
          const lines = copyLines(w.paneContent?.[cp.paneId] ?? [], cp);
          const text = yankSelection(lines, cp.selectMode, cp.anchor, cp.cursor);
          pushBuffer(s, text);
          events.push({ type: 'text-copied', text });
          exit();
        } else {
          exit();
        }
        break;
      default: break;
    }
    if (s.copy) {
      s.minCopyCursorRow = Math.min(s.minCopyCursorRow ?? s.copy.cursor.row, s.copy.cursor.row);
      const bottom = lines.length - 1;
      if (s.minCopyCursorRow < bottom && s.copy.cursor.row >= bottom) {
        s.copyReturnedToBottom = true;
      }
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handleTree(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'tree' && s.tree) {
    const t = s.tree;
    let rows = visibleRows(s, t);

    const exit = (): DispatchResult => {
      s.mode = 'normal';
      delete s.tree;
      return { state: s, events };
    };

    if (t.filterMode) {
      if (key === 'C-c' || key === 'C-g') return exit();
      if (key === 'Esc') {
        t.filter = '';
        t.filterMode = false;
        const fresh = visibleRows(s, t);
        t.cursor = Math.min(t.cursor, Math.max(0, fresh.length - 1));
        return { state: s, events };
      }
      if (key === 'Enter') {
        t.filterMode = false;
        const fresh = visibleRows(s, t);
        if (fresh.length === 0) {
          s.statusMessage = 'no matches';
          t.cursor = 0;
        } else {
          t.cursor = Math.min(t.cursor, fresh.length - 1);
        }
        return { state: s, events };
      }
      if (key === 'Backspace') {
        t.filter = t.filter.slice(0, -1);
        return { state: s, events };
      }
      if (key.length === 1) {
        t.filter += key;
        return { state: s, events };
      }
      return { state: s, events };
    }

    if (key === 'q' || key === 'C-c' || key === 'C-g') {
      return exit();
    }

    if (key === 'Esc') {
      if (t.filter) {
        t.filter = '';
        rows = visibleRows(s, t);
        t.cursor = Math.min(t.cursor, Math.max(0, rows.length - 1));
        return { state: s, events };
      }
      return exit();
    }

    if (key === '/') {
      t.filterMode = true;
      return { state: s, events };
    }

    if ((key === 'n' || key === 'N') && t.filter) {
      const q = t.filter.toLowerCase();
      const labelOf = (r: typeof rows[number]): string => {
        if (r.kind === 'session') {
          return (s.sessions.find(x => x.id === r.sessionId)?.name ?? '').toLowerCase();
        }
        const se = s.sessions.find(x => x.id === r.sessionId);
        return (se?.windows.find(w => w.id === r.windowId)?.name ?? '').toLowerCase();
      };
      const isMatch = (i: number): boolean => {
        const r = rows[i];
        return !!r && labelOf(r).includes(q);
      };
      const len = rows.length;
      if (len > 0) {
        const step = key === 'n' ? 1 : -1;
        let i = t.cursor;
        for (let k = 1; k <= len; k++) {
          i = (i + step + len) % len;
          if (isMatch(i)) { t.cursor = i; break; }
        }
      }
      return { state: s, events };
    }
    if (key === 'j' || key === 'Down') {
      t.cursor = Math.min(rows.length - 1, t.cursor + 1);
      return { state: s, events };
    }
    if (key === 'k' || key === 'Up') {
      t.cursor = Math.max(0, t.cursor - 1);
      return { state: s, events };
    }
    if (key === 'g') { t.cursor = 0; return { state: s, events }; }
    if (key === 'G') {
      t.cursor = Math.max(0, rows.length - 1);
      return { state: s, events };
    }
    if (key === ' ' || key === 'Right' || key === 'Left' || key === 'h' || key === 'l') {
      const r = rows[t.cursor];
      const expand = key === 'Right' || key === 'l';
      const collapse = key === 'Left' || key === 'h';
      if (r?.kind === 'session') {
        if (expand) t.expanded[r.sessionId] = true;
        else if (collapse) delete t.expanded[r.sessionId];
        else t.expanded[r.sessionId] = !t.expanded[r.sessionId];
      } else if (r?.kind === 'window' && collapse) {
        delete t.expanded[r.sessionId];
        const newRows = visibleRows(s, t);
        const newIdx = newRows.findIndex(
          x => x.kind === 'session' && x.sessionId === r.sessionId);
        if (newIdx >= 0) t.cursor = newIdx;
      }
      return { state: s, events };
    }
    const selectRowAndExit = (idx: number): DispatchResult => {
      const r = rows[idx];
      if (!r) return exit();
      if (r.kind === 'session') {
        if (s.attachedSessionId !== r.sessionId) {
          s.attachedSessionId = r.sessionId;
          s.activeSessionId = r.sessionId;
          events.push({ type: 'session-switched', sessionId: r.sessionId });
        }
      } else {
        if (s.attachedSessionId !== r.sessionId) {
          s.attachedSessionId = r.sessionId;
          s.activeSessionId = r.sessionId;
          events.push({ type: 'session-switched', sessionId: r.sessionId });
        }
        const se = s.sessions.find(x => x.id === r.sessionId);
        if (se && se.activeWindowId !== r.windowId) {
          se.lastWindowId = se.activeWindowId;
          se.activeWindowId = r.windowId;
          events.push({ type: 'window-switched', windowId: r.windowId });
        }
      }
      return exit();
    };
    if (key === 'Enter') {
      return selectRowAndExit(t.cursor);
    }
    if (/^[0-9]$/.test(key)) {
      const idx = Number(key);
      if (idx < rows.length) return selectRowAndExit(idx);
      return { state: s, events };
    }
    if (key === '+') {
      for (const se of s.sessions) t.expanded[se.id] = true;
      return { state: s, events };
    }
    if (key === '-') {
      t.expanded = {};
      const fresh = visibleRows(s, t);
      t.cursor = Math.min(t.cursor, Math.max(0, fresh.length - 1));
      return { state: s, events };
    }
    if (key === 'R') {
      s.statusMessage = 'refreshed';
      return { state: s, events };
    }
    if (key === 'v') {
      t.showPreview = !t.showPreview;
      return { state: s, events };
    }
    if (key === 'x') {
      const r = rows[t.cursor];
      if (!r) return { state: s, events };
      if (r.kind === 'session') {
        if (s.sessions.length <= 1) {
          s.statusMessage = "can't kill the only session";
          return { state: s, events };
        }
        const se = s.sessions.find(x => x.id === r.sessionId);
        const sname = se?.name ?? r.sessionId;
        s.mode = 'confirm';
        s.confirm = {
          kind: 'tree-kill',
          prompt: `kill-session ${sname}? (y/n)`,
          returnTo: 'tree',
          target: { sessionId: r.sessionId },
        };
        s.statusMessage = s.confirm.prompt;
      } else {
        const sess = s.sessions.find(x => x.id === r.sessionId);
        if (!sess || sess.windows.length <= 1) {
          s.statusMessage = "can't kill the only window";
          return { state: s, events };
        }
        const w = sess.windows.find(x => x.id === r.windowId);
        const wname = w?.name ?? r.windowId;
        s.mode = 'confirm';
        s.confirm = {
          kind: 'tree-kill',
          prompt: `kill-window ${wname}? (y/n)`,
          returnTo: 'tree',
          target: { sessionId: r.sessionId, windowId: r.windowId },
        };
        s.statusMessage = s.confirm.prompt;
      }
      return { state: s, events };
    }
    if (key === 't') {
      const r = rows[t.cursor];
      if (r) {
        const k = rowKey(r);
        if (t.tagged[k]) delete t.tagged[k];
        else t.tagged[k] = true;
      }
      return { state: s, events };
    }
    if (key === 'T') {
      if (Object.keys(t.tagged).length > 0) {
        t.tagged = {};
      } else {
        for (const r of rows) t.tagged[rowKey(r)] = true;
      }
      return { state: s, events };
    }
    if (key === 'X') {
      const taggedKeys = Object.keys(t.tagged);
      if (taggedKeys.length === 0) {
        s.statusMessage = 'no tags';
        return { state: s, events };
      }
      const targets: { sessionId: string; windowId?: string }[] = [];
      for (const k of taggedKeys) {
        if (k.startsWith('s:')) {
          targets.push({ sessionId: k.slice(2) });
        } else if (k.startsWith('w:')) {
          const rest = k.slice(2);
          const sep = rest.indexOf('::');
          if (sep >= 0) {
            targets.push({ sessionId: rest.slice(0, sep), windowId: rest.slice(sep + 2) });
          }
        }
      }
      s.mode = 'confirm';
      s.confirm = {
        kind: 'tree-kill-tagged',
        prompt: `kill ${targets.length} tagged target${targets.length === 1 ? '' : 's'}? (y/n)`,
        returnTo: 'tree',
        targets,
      };
      s.statusMessage = s.confirm.prompt;
      return { state: s, events };
    }
    if (key === 'O' || key === 'r') {
      const curRow = rows[t.cursor];
      const curKey = curRow ? rowKey(curRow) : null;
      if (key === 'O') {
        const cycle: ('index' | 'name' | 'time')[] = ['index', 'name', 'time'];
        const i = cycle.indexOf(t.sortMode);
        t.sortMode = cycle[(i + 1) % cycle.length]!;
      } else {
        t.reverseSort = !t.reverseSort;
      }
      const newRows = visibleRows(s, t);
      if (curKey) {
        const newIdx = newRows.findIndex(r => rowKey(r) === curKey);
        if (newIdx >= 0) t.cursor = newIdx;
        else t.cursor = Math.min(t.cursor, Math.max(0, newRows.length - 1));
      }
      return { state: s, events };
    }
    if (key === '?') {
      s.statusMessage = 'j/k move  h/l fold  /filter  O sort  r reverse  v preview  t/T tag  x kill  X kill-tagged  +/- expand  0-9 jump  R refresh  Enter pick  q/Esc quit';
      return { state: s, events };
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handleDisplayPanes(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'display-panes') {
    s.mode = 'normal';
    delete s.displayPanesDeadline;
    if (/^[0-9]$/.test(key)) {
      const se = attached(s);
      if (se) {
        const w = activeWin(se);
        const order = paneOrder(w.layout);
        const idx = Number(key);
        if (idx < order.length && order[idx] !== w.activePaneId) {
          setActivePane(s, w, order[idx]!, events, opts);
          events.push({ type: 'pane-navigated', paneId: w.activePaneId });
        }
      }
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handlePopup(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'popup') {
    if (key === 'Esc') {
      s.mode = 'normal';
      delete s.popup;
      events.push({ type: 'popup-closed' });
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handleMenu(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  if (s.mode === 'menu') {
    const menu = s.menu;
    if (!menu) { s.mode = 'normal'; return { state: s, events }; }
    if (key === 'Esc' || key === 'q') {
      s.mode = 'normal';
      delete s.menu;
      events.push({ type: 'menu-closed' });
      return { state: s, events };
    }
    if (key === 'Up' || key === 'k') {
      s.menu = { ...menu, cursor: stepMenuCursor(menu.items, menu.cursor, -1) };
      return { state: s, events };
    }
    if (key === 'Down' || key === 'j') {
      s.menu = { ...menu, cursor: stepMenuCursor(menu.items, menu.cursor, 1) };
      return { state: s, events };
    }
    let pick: PaneMenuItem | undefined;
    if (key === 'Enter') {
      pick = menu.items[menu.cursor];
    } else if (key.length === 1) {
      pick = menu.items.find(it => it.key.toLowerCase() === key.toLowerCase());
    }
    if (pick && !pick.disabled) {
      s.mode = 'normal';
      delete s.menu;
      events.push({ type: 'menu-closed' });
      applyCommand(s, pick.command, events, opts);
    }
    return { state: s, events };
  }
  return { state: s, events };
}

function handlePrefix(s: TmuxState, key: KeyToken, events: GameEvent[], opts?: ApplyOpts): DispatchResult {
  s.mode = 'normal';
  const se = attached(s)!;
  switch (key) {
    case 'd':
      s.attachedSessionId = null;
      events.push({ type: 'detached' });
      fireHook(s, 'client-detached', events, opts);
      break;
    case 'c': {
      const w = newWindow(s, 'bash');
      se.lastWindowId = se.activeWindowId;
      se.windows.push(w); se.activeWindowId = w.id;
      events.push({ type: 'window-created', windowId: w.id }); break;
    }
    case 'n': case 'p':
      windowStep(s, se, key, events); break;
    case '{': swapPaneByDelta(s, -1, events); break;
    case '}': swapPaneByDelta(s, 1, events); break;
    case 'l': {
      const last = se.lastWindowId;
      if (last && last !== se.activeWindowId && se.windows.some(w => w.id === last)) {
        se.lastWindowId = se.activeWindowId;
        se.activeWindowId = last;
        events.push({ type: 'window-switched', windowId: se.activeWindowId });
      } else {
        s.statusMessage = 'no last window';
      }
      break;
    }
    case ';': {
      const w = activeWin(se);
      const last = w.lastPaneId;
      if (last && last !== w.activePaneId && paneOrder(w.layout).includes(last)) {
        setActivePane(s, w, last, events, opts);
        events.push({ type: 'pane-navigated', paneId: w.activePaneId });
      } else {
        s.statusMessage = 'no last pane';
      }
      break;
    }
    case 'w': {
      openWindowTree(s, se, events);
      break;
    }
    case 'f': {
      s.mode = 'find';
      s.buffer = '';
      events.push({ type: 'find-opened' });
      break;
    }
    case '!':
      breakPane(s, events, opts);
      break;
    case ' ': {
      const w = activeWin(se);
      const cur = w.currentLayout;
      const i = cur ? PRESET_CYCLE.indexOf(cur) : -1;
      const next = PRESET_CYCLE[(i + 1) % PRESET_CYCLE.length]!;
      applyPreset(w, next);
      events.push({ type: 'layout-applied', preset: next });
      break;
    }
    case 'q': {
      s.mode = 'display-panes';
      s.displayPanesDeadline = Date.now() + 1000;
      s.statusMessage = 'display-panes';
      events.push({ type: 'display-panes-entered' });
      break;
    }
    case '.':
      s.statusMessage = 'move-window prompt deferred - use :movew -t N';
      break;
    case '?':
      s.statusMessage = 'follow the step checklist below the bar';
      break;
    case '&': {
      const wn = activeWin(se).name;
      s.mode = 'confirm';
      s.confirm = { kind: 'kill-window', prompt: `kill-window ${wn}? (y/n)` };
      s.statusMessage = s.confirm.prompt;
      break;
    }
    case 'x': {
      const idx = paneOrder(activeWin(se).layout).indexOf(activeWin(se).activePaneId);
      s.mode = 'confirm';
      s.confirm = { kind: 'kill-pane', prompt: `kill-pane ${idx}? (y/n)` };
      s.statusMessage = s.confirm.prompt;
      break;
    }
    case ',':
      s.mode = 'rename'; s.buffer = activeWin(se).name;
      s.bufferCursor = s.buffer.length;
      s.renameTarget = 'window'; break;
    case '$':
      s.mode = 'rename'; s.buffer = se.name;
      s.bufferCursor = s.buffer.length;
      s.renameTarget = 'session'; break;
    case ':':
      s.mode = 'command'; s.buffer = ''; s.bufferCursor = 0; break;
    case '(': case ')': {
      const i = s.sessions.findIndex(x => x.id === s.attachedSessionId);
      const ni = key === ')'
        ? (i + 1) % s.sessions.length
        : (i - 1 + s.sessions.length) % s.sessions.length;
      s.attachedSessionId = s.sessions[ni]!.id;
      s.activeSessionId = s.attachedSessionId;
      events.push({ type: 'session-switched', sessionId: s.attachedSessionId });
      break;
    }
    case 's': {
      clearActivePaneCopy(s);
      const expanded: Record<string, boolean> = {};
      const i = s.sessions.findIndex(x => x.id === s.attachedSessionId);
      s.mode = 'tree';
      s.tree = {
        kind: 'session', cursor: Math.max(0, i), expanded,
        tagged: {}, filter: '', filterMode: false,
        sortMode: 'index', reverseSort: false, showPreview: true,
      };
      events.push({ type: 'tree-opened', kind: 'session' });
      break;
    }
    case '[': {
      const w = activeWin(se);
      const pid = w.activePaneId;
      const base = w.paneContent?.[pid] ?? [];
      const promptLine = opts?.promptLineFor?.(pid);
      const homeLines = copyLines(base, { promptLine });
      const home = Math.max(0, homeLines.length - 1);
      (s.copyByPane ??= {})[pid] = {
        paneId: pid,
        cursor: { row: home, col: Math.max(0, (homeLines[home] ?? '').length - 1) },
        anchor: null,
        selectMode: 'char',
        search: null,
        searchActive: false,
        goalCol: null,
        ...(promptLine != null ? { promptLine } : {}),
      };
      s.buffer = '';
      s.minCopyCursorRow = Math.min(s.minCopyCursorRow ?? home, home);
      events.push({ type: 'copy-mode-entered' });
      break;
    }
    case ']': {
      if (s.pasteBuffer != null) {
        s.lastPaste = s.pasteBuffer;
        events.push({ type: 'text-pasted', text: s.pasteBuffer });
      } else {
        s.statusMessage = 'paste buffer empty';
      }
      break;
    }
    case 'C-Up': case 'C-Down': case 'C-Left': case 'C-Right':
    case 'M-Up': case 'M-Down': case 'M-Left': case 'M-Right': {
      const w = activeWin(se);
      const isMeta = (key as string).startsWith('M-');
      const amount = isMeta ? 5 : 1;
      const ratio = isMeta ? 0.5 : 0.1;
      w.layout = resizeActive(w.layout, w.activePaneId, key, ratio);
      const dirMap = {
        'C-Left': 'L', 'C-Right': 'R', 'C-Up': 'U', 'C-Down': 'D',
        'M-Left': 'L', 'M-Right': 'R', 'M-Up': 'U', 'M-Down': 'D',
      } as const;
      const cDir = dirMap[key as keyof typeof dirMap];
      events.push({ type: 'pane-resized', paneId: w.activePaneId, dir: cDir, amount });
      s.mode = 'repeat';
      s.repeatDeadline = Date.now() + REPEAT_TIME_MS;
      break;
    }
    default:
      if (/^[0-9]$/.test(key)) {
        const idx = Number(key);
        if (idx < se.windows.length && se.windows[idx]!.id !== se.activeWindowId) {
          se.lastWindowId = se.activeWindowId;
          se.activeWindowId = se.windows[idx]!.id;
          events.push({ type: 'window-switched', windowId: se.activeWindowId });
        }
      } else if (paneCommand(s, se, key, events, opts)) {
      } else if (key === s.prefixKey) {
        s.statusMessage = `literal ${s.prefixKey} sent`;
      } else {
        s.statusMessage = `no binding: ${s.prefixKey} ${key}`;
      }
  }
  return { state: s, events };
}