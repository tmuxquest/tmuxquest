import type {
  TmuxState, Window, Session, GameEvent, LayoutNode, HookName, PresetName, KeyToken,
} from '../types';
import {
  paneOrder, computeRects, paneInDirection, resizeActive, resizeActiveAbsolute,
  canSplitPane, WINDOW_COLS, WINDOW_ROWS,
} from '../layout';
import {
  attached, activeWin, cleanupPaneRoles, REPEAT_TIME_MS,
} from './primitives';
import { applyPreset, replaceLeafWithSplit, removeLeaf } from './paneTree';
import {
  removeWindowAdjacent, killWindow, killSession, newWindow,
  swapWindows, moveWindowAt, swapPaneByDelta,
} from './window';
import { unquote } from './sendKeys';

export function splitActive(
  s: TmuxState, w: Window, dir: 'v' | 'h', events: GameEvent[], opts?: ApplyOpts,
): boolean {
  if (!canSplitPane(w.layout, w.activePaneId, dir)) {
    s.statusMessage = 'no space for new pane';
    return false;
  }
  const oldId = w.activePaneId;
  const newId = `p${s.nextId++}`;
  w.layout = replaceLeafWithSplit(w.layout, oldId, newId, dir);
  setActivePane(s, w, newId, events, opts);
  w.zoomedPaneId = null;
  w.currentLayout = undefined;
  if (!w.paneContent) w.paneContent = {};
  w.paneContent[newId] = [];
  return true;
}

export function closeActive(
  s: TmuxState, se: Session, w: Window, e?: GameEvent[], opts?: ApplyOpts,
): void {
  const order = paneOrder(w.layout);
  if (order.length === 1) {
    if (se.windows.length > 1) {
      removeWindowAdjacent(se, w.id);
    }
    return;
  }
  const closedPid = w.activePaneId;
  const removed = removeLeaf(w.layout, closedPid);
  if (!removed.layout || !removed.neighbor) return;
  w.layout = removed.layout;
  setActivePane(s, w, removed.neighbor, e ?? [], opts, { clearLast: true });
  w.zoomedPaneId = null;
  w.currentLayout = undefined;
  cleanupPaneRoles(w, closedPid);
}

export function breakPane(s: TmuxState, e: GameEvent[], opts?: ApplyOpts): void {
  const se = attached(s);
  if (!se) return;
  const w = activeWin(se);
  const paneId = w.activePaneId;
  if (paneOrder(w.layout).length === 1) {
    s.statusMessage = "can't break-pane: only pane in window";
    return;
  }
  const removed = removeLeaf(w.layout, paneId);
  if (!removed.layout || !removed.neighbor) return;
  let content: string[] | undefined;
  if (w.paneContent && paneId in w.paneContent) {
    content = w.paneContent[paneId];
    delete w.paneContent[paneId];
  }
  let cwd: string | undefined;
  if (w.paneCwd && paneId in w.paneCwd) {
    cwd = w.paneCwd[paneId];
    delete w.paneCwd[paneId];
  }
  w.layout = removed.layout;
  setActivePane(s, w, removed.neighbor, e, opts, { clearLast: true });
  w.zoomedPaneId = null;
  w.currentLayout = undefined;
  cleanupPaneRoles(w, paneId);
  const newId = `w${s.nextId++}`;
  const newW: Window = {
    id: newId, name: 'bash', createdAt: Date.now(),
    layout: { kind: 'leaf', paneId },
    activePaneId: paneId, zoomedPaneId: null,
    paneContent: { [paneId]: content ?? [] },
    ...(cwd ? { paneCwd: { [paneId]: cwd } } : {}),
  };
  se.lastWindowId = se.activeWindowId;
  se.windows.push(newW);
  se.activeWindowId = newId;
  e.push({ type: 'pane-broken', windowId: newId });
}

export function joinPane(
  s: TmuxState, srcIdx: number, tgtIdx: number,
  dir: 'v' | 'h', e: GameEvent[], opts?: ApplyOpts,
): void {
  const se = attached(s);
  if (!se) return;
  if (srcIdx >= se.windows.length || tgtIdx >= se.windows.length ||
      srcIdx === tgtIdx || srcIdx < 0 || tgtIdx < 0) {
    s.statusMessage = 'join-pane: no such window';
    return;
  }
  const src = se.windows[srcIdx]!;
  const tgt = se.windows[tgtIdx]!;
  if (!canSplitPane(tgt.layout, tgt.activePaneId, dir)) {
    s.statusMessage = 'create pane failed: pane too small';
    return;
  }
  const paneId = src.activePaneId;
  let content: string[] | undefined;
  if (src.paneContent && paneId in src.paneContent) {
    content = src.paneContent[paneId];
    delete src.paneContent[paneId];
  }
  let cwd: string | undefined;
  if (src.paneCwd && paneId in src.paneCwd) {
    cwd = src.paneCwd[paneId];
    delete src.paneCwd[paneId];
  }
  const removed = removeLeaf(src.layout, paneId);
  if (!removed.layout) {
    removeWindowAdjacent(se, src.id);
    e.push({ type: 'window-killed' });
  } else {
    src.layout = removed.layout;
    setActivePane(s, src, removed.neighbor!, e, opts, { clearLast: true });
    src.zoomedPaneId = null;
    src.currentLayout = undefined;
    cleanupPaneRoles(src, paneId);
  }
  const oldId = tgt.activePaneId;
  tgt.layout = replaceLeafWithSplit(tgt.layout, oldId, paneId, dir);
  setActivePane(s, tgt, paneId, e, opts);
  tgt.zoomedPaneId = null;
  tgt.currentLayout = undefined;
  if (!tgt.paneContent) tgt.paneContent = {};
  tgt.paneContent[paneId] = content ?? [];
  if (cwd) {
    if (!tgt.paneCwd) tgt.paneCwd = {};
    tgt.paneCwd[paneId] = cwd;
  }
  se.lastWindowId = se.activeWindowId;
  se.activeWindowId = tgt.id;
  e.push({ type: 'pane-joined', fromWindowId: src.id, toWindowId: tgt.id });
}

export function windowStep(
  s: TmuxState, se: Session, key: KeyToken, e: GameEvent[]
): boolean {
  if (key !== 'n' && key !== 'p') return false;
  const i = se.windows.findIndex(w => w.id === se.activeWindowId);
  const ni = key === 'n'
    ? (i + 1) % se.windows.length
    : (i - 1 + se.windows.length) % se.windows.length;
  if (se.windows[ni]!.id !== se.activeWindowId) {
    se.lastWindowId = se.activeWindowId;
    se.activeWindowId = se.windows[ni]!.id;
    e.push({ type: 'window-switched', windowId: se.activeWindowId });
  }
  return true;
}

export function paneCommand(
  s: TmuxState, se: Session, key: KeyToken, e: GameEvent[], opts?: ApplyOpts,
): boolean {
  const w = se.windows.find(x => x.id === se.activeWindowId)!;
  switch (key) {
    case '%': {
      if (!splitActive(s, w, 'v', e, opts)) return true;
      e.push({ type: 'pane-split', dir: 'v' }); return true;
    }
    case '"': {
      if (!splitActive(s, w, 'h', e, opts)) return true;
      e.push({ type: 'pane-split', dir: 'h' }); return true;
    }
    case 'o': {
      const order = paneOrder(w.layout);
      const i = order.indexOf(w.activePaneId);
      const next = order[(i + 1) % order.length]!;
      setActivePane(s, w, next, e, opts);
      e.push({ type: 'pane-navigated', paneId: w.activePaneId }); return true;
    }
    case 'Up': case 'Down': case 'Left': case 'Right': {
      const rects = computeRects(w.layout, { x: 0, y: 0, w: WINDOW_COLS, h: WINDOW_ROWS });
      const target = paneInDirection(w.activePaneId, key, rects);
      if (target) {
        setActivePane(s, w, target, e, opts);
        e.push({ type: 'pane-navigated', paneId: target });
      }
      s.mode = 'repeat';
      s.repeatDeadline = Date.now() + REPEAT_TIME_MS;
      return true;
    }
    case 'z': {
      w.zoomedPaneId = w.zoomedPaneId ? null : w.activePaneId;
      e.push({ type: 'pane-zoom-toggled', zoomed: w.zoomedPaneId !== null }); return true;
    }
  }
  return false;
}
export interface ApplyOpts {
  depth?: number;
  promptLineFor?: (paneId: string) => string | undefined;
}

export function setActivePane(
  s: TmuxState, w: Window, newId: string, events: GameEvent[],
  opts?: ApplyOpts, mode?: { clearLast?: boolean },
): void {
  if (w.activePaneId === newId) return;
  const old = w.activePaneId;
  fireHook(s, 'pane-focus-out', events, opts);
  w.lastPaneId = mode?.clearLast ? undefined : old;
  w.activePaneId = newId;
  fireHook(s, 'window-pane-changed', events, opts);
  fireHook(s, 'pane-focus-in', events, opts);
}

export function fireHook(s: TmuxState, name: HookName, events: GameEvent[], opts?: ApplyOpts) {
  const cmd = s.hooks?.[name];
  if (!cmd) return;
  const depth = (opts?.depth ?? 0) + 1;
  if (depth > 3) {
    s.statusMessage = `hook recursion limit hit on ${name}`;
    return;
  }
  applyCommand(s, cmd, events, { ...opts, depth });
  events.push({ type: 'hook-fired', name });
}

export function applyCommand(s: TmuxState, raw: string, e: GameEvent[], opts?: ApplyOpts) {
  const depth = opts?.depth ?? 0;
  if (depth >= 3) {
    s.statusMessage = 'recursion limit reached';
    return;
  }

  const text = raw.trim().replace(/\s+/g, ' ');

  const m = text.match(
    /^(?:new-session|new)((?:\s+-d|\s+-s\s*\S+)*)\s*$/);
  if (m) {
    const flags = m[1] ?? '';
    const detached = /\s-d(?:\s|$)/.test(flags);
    const sMatch = flags.match(/\s-s\s*(\S+)/);
    const name = sMatch ? unquote(sMatch[1]!) : `s${s.nextId}`;
    const sid = `s${s.nextId++}`;
    const wid = `w${s.nextId++}`;
    const pid = `p${s.nextId++}`;
    s.sessions.push({
      id: sid, name, createdAt: Date.now(),
      windows: [{ id: wid, name: 'bash', createdAt: Date.now(),
        layout: { kind: 'leaf', paneId: pid }, activePaneId: pid, zoomedPaneId: null }],
      activeWindowId: wid
    });
    e.push({ type: 'session-created', sessionId: sid, name });
    fireHook(s, 'session-created', e, opts);
    if (!detached) {
      s.attachedSessionId = sid;
      s.activeSessionId = sid;
      e.push({ type: 'session-switched', sessionId: sid });
    }
    return;
  }

  const sc = text.match(/^(?:switch-client|switchc)\s+-t\s*(\S+)$/);
  if (sc) {
    const arg = unquote(sc[1]!);
    let target = s.sessions.find(x => x.name === arg);
    if (!target && /^\d+$/.test(arg)) target = s.sessions[Number(arg)];
    if (!target) {
      s.statusMessage = `no such session: ${arg}`;
      return;
    }
    if (target.id !== s.attachedSessionId) {
      s.attachedSessionId = target.id;
      s.activeSessionId = target.id;
      e.push({ type: 'session-switched', sessionId: target.id });
    }
    return;
  }

  const r = text.match(/^rename-session\s+(\S.*)$/);
  if (r) {
    const se = s.sessions.find(x => x.id === s.attachedSessionId);
    const nm = unquote(r[1]!);
    if (se) {
      se.name = nm;
      e.push({ type: 'session-renamed', name: nm });
      fireHook(s, 'session-renamed', e, opts);
    }
    return;
  }

  const rw = text.match(/^rename-window\s+(\S.*)$/);
  if (rw) {
    const se = attached(s);
    const nm = unquote(rw[1]!);
    if (se) {
      const w = activeWin(se);
      w.name = nm;
      e.push({ type: 'window-renamed', name: nm });
      fireHook(s, 'window-renamed', e, opts);
    }
    return;
  }

  const sw = text.match(/^split-window(?:\s+-([hv]))?$/);
  if (sw) {
    const se = attached(s);
    if (se) {
      const w = activeWin(se);
      const dir = sw[1] === 'h' ? 'v' : 'h';
      if (!splitActive(s, w, dir, e, opts)) return;
      e.push({ type: 'pane-split', dir });
    }
    return;
  }

  if (/^kill-window$/.test(text)) {
    const se = attached(s);
    if (se) killWindow(s, se, se.activeWindowId, e);
    return;
  }

  if (/^detach(?:-client)?$/.test(text)) {
    s.attachedSessionId = null;
    e.push({ type: 'detached' });
    fireHook(s, 'client-detached', e, opts);
    return;
  }

  const nw = text.match(/^(?:new-window|neww)(?:\s+-n\s*(\S+))?$/);
  if (nw) {
    const se = attached(s);
    if (se) {
      const w = newWindow(s, nw[1] ? unquote(nw[1]) : 'bash');
      se.lastWindowId = se.activeWindowId;
      se.windows.push(w);
      se.activeWindowId = w.id;
      e.push({ type: 'window-created', windowId: w.id });
    }
    return;
  }

  const selw = text.match(/^(?:select-window|selectw)\s+-t\s*(\d+)$/);
  if (selw) {
    const se = attached(s);
    if (se) {
      const idx = Number(selw[1]);
      if (idx >= se.windows.length) {
        s.statusMessage = `no such window: ${idx}`;
      } else if (se.windows[idx]!.id !== se.activeWindowId) {
        se.lastWindowId = se.activeWindowId;
        se.activeWindowId = se.windows[idx]!.id;
        e.push({ type: 'window-switched', windowId: se.activeWindowId });
      }
    }
    return;
  }

  const swpHead = text.match(/^(?:swap-window|swapw)((?:\s+-[st]\s*\d+)*)\s*$/);
  if (swpHead) {
    const flagsText = swpHead[1] ?? '';
    const sm = flagsText.match(/-s\s*(\d+)/);
    const tm = flagsText.match(/-t\s*(\d+)/);
    const se = attached(s);
    if (se) {
      const src = sm ? Number(sm[1])
                : se.windows.findIndex((w) => w.id === se.activeWindowId);
      const tgt = tm ? Number(tm[1])
                : (src + 1) % se.windows.length;
      if (src >= se.windows.length || tgt >= se.windows.length) {
        s.statusMessage = `no such window`;
      } else if (src !== tgt) {
        swapWindows(se, src, tgt);
        e.push({ type: 'window-swapped', aIdx: src, bIdx: tgt });
      }
    }
    return;
  }

  const mvwHead = text.match(/^(?:move-window|movew)((?:\s+-[st]\s*\d+)+)\s*$/);
  const mvw = mvwHead && /-t\s*\d+/.test(mvwHead[1] ?? '') ? mvwHead : null;
  if (mvw) {
    const flagsText = mvw[1] ?? '';
    const sm = flagsText.match(/-s\s*(\d+)/);
    const tm = flagsText.match(/-t\s*(\d+)/);
    if (!tm) return;
    const se = attached(s);
    if (se) {
      const src = sm ? Number(sm[1])
                : se.windows.findIndex((w) => w.id === se.activeWindowId);
      const rawTgt = Number(tm[1]);
      if (src >= se.windows.length) {
        s.statusMessage = `no such window: ${src}`;
      } else {
        const tgt = Math.min(rawTgt, se.windows.length - 1);
        if (src !== tgt) {
          moveWindowAt(se, src, tgt);
          e.push({ type: 'window-moved', fromIdx: src, toIdx: tgt });
        }
      }
    }
    return;
  }

  if (/^(?:resize-pane|resizep)\s+-Z$/.test(text)) {
    const se = attached(s);
    if (se) {
      const w = activeWin(se);
      w.zoomedPaneId = w.zoomedPaneId ? null : w.activePaneId;
      e.push({ type: 'pane-zoom-toggled', zoomed: w.zoomedPaneId !== null });
    }
    return;
  }

  const rpAbs = text.match(/^(?:resize-pane|resizep)\s+(-[xy])\s*(\d+)$/);
  if (rpAbs) {
    const axis = rpAbs[1]!;
    const n = Number(rpAbs[2]);
    const se = attached(s);
    if (se) {
      const w = activeWin(se);
      const want: 'v' | 'h' = axis === '-x' ? 'v' : 'h';
      const ref = axis === '-x' ? 80 : 24;
      const dir = axis === '-x' ? 'R' : 'D';
      const prevLayout = JSON.stringify(w.layout);
      w.layout = resizeActiveAbsolute(w.layout, w.activePaneId, want, n / ref);
      if (JSON.stringify(w.layout) !== prevLayout) {
        e.push({ type: 'pane-resized', paneId: w.activePaneId, dir, amount: n });
      } else {
        s.statusMessage = 'no adjacent pane to resize';
      }
    }
    return;
  }

  const rp = text.match(/^(?:resize-pane|resizep)\s+(-[LRUD])(?:\s+(\d+))?$/);
  if (rp) {
    const dir = (['L', 'R', 'U', 'D'] as const).find(d => rp[1] === `-${d}`)!;
    const amount = rp[2] != null ? Number(rp[2]) : 1;
    const se = attached(s);
    if (se) {
      const w = activeWin(se);
      const keyForDir = ({ L: 'C-Left', R: 'C-Right', U: 'C-Up', D: 'C-Down' } as const)[dir];
      const prevLayout = JSON.stringify(w.layout);
      w.layout = resizeActive(w.layout, w.activePaneId, keyForDir, amount * 0.05);
      if (JSON.stringify(w.layout) !== prevLayout) {
        e.push({ type: 'pane-resized', paneId: w.activePaneId, dir, amount });
      } else {
        s.statusMessage = 'no adjacent pane to resize';
      }
    }
    return;
  }

  if (/^(?:resize-pane|resizep)(?:\s+\d+)?$/.test(text)) {
    return;
  }

  const spc = text.match(/^(?:swap-pane|swapp)((?:\s+(?:-[dDUZ]|-s\s*\d+|-t\s*\d+))*)$/);
  if (spc) {
    const se = attached(s);
    if (!se) return;
    const w = activeWin(se);
    const flags = spc[1] || '';
    const dirMatch = flags.match(/\s-(D|U)\b/);
    const keepZoom = /\s-Z\b/.test(flags);
    const sFlag = flags.match(/-s\s*(\d+)/);
    const tFlag = flags.match(/-t\s*(\d+)/);
    if (dirMatch) {
      swapPaneByDelta(s, dirMatch[1] === 'U' ? -1 : 1, e);
      if (!keepZoom) w.zoomedPaneId = null;
      return;
    }
    const order = paneOrder(w.layout);
    let srcPane: string | undefined;
    let dstPane: string | undefined;
    if (sFlag) {
      const i = Number(sFlag[1]);
      srcPane = order[i];
      if (srcPane === undefined) {
        s.statusMessage = `no such pane: ${i}`;
        return;
      }
    }
    if (tFlag) {
      const i = Number(tFlag[1]);
      dstPane = order[i];
      if (dstPane === undefined) {
        s.statusMessage = `no such pane: ${i}`;
        return;
      }
    } else {
      dstPane = w.activePaneId;
    }
    if (!srcPane) {
      s.statusMessage = 'swap-pane: no source pane';
      return;
    }
    if (srcPane === dstPane) return;
    const a = srcPane, b = dstPane;
    const swap = (n: LayoutNode): LayoutNode => {
      if (n.kind === 'leaf') {
        if (n.paneId === a) return { ...n, paneId: b };
        if (n.paneId === b) return { ...n, paneId: a };
        return n;
      }
      return { ...n, a: swap(n.a), b: swap(n.b) };
    };
    w.layout = swap(w.layout);
    if (!keepZoom) w.zoomedPaneId = null;
    e.push({ type: 'pane-swapped', aPaneId: a, bPaneId: b });
    return;
  }

  const selp = text.match(/^(?:select-pane|selectp)\s+(?:-t\s*(\d+)|(-[UDLR]))$/);
  if (selp) {
    const se = attached(s);
    if (se) {
      const w = activeWin(se);
      if (selp[1] != null) {
        const order = paneOrder(w.layout);
        const i = Number(selp[1]);
        if (i >= order.length) {
          s.statusMessage = `no such pane: ${i}`;
        } else if (order[i] !== w.activePaneId) {
          setActivePane(s, w, order[i]!, e, opts);
          e.push({ type: 'pane-navigated', paneId: w.activePaneId });
        }
      } else {
        const dir = ({ '-U': 'Up', '-D': 'Down', '-L': 'Left', '-R': 'Right' } as const)[
          selp[2] as '-U' | '-D' | '-L' | '-R'
        ];
        const rects = computeRects(w.layout, { x: 0, y: 0, w: WINDOW_COLS, h: WINDOW_ROWS });
        const target = paneInDirection(w.activePaneId, dir, rects);
        if (target) {
          setActivePane(s, w, target, e, opts);
          e.push({ type: 'pane-navigated', paneId: target });
        }
      }
    }
    return;
  }

  if (/^(?:break-pane|breakp)$/.test(text)) {
    breakPane(s, e, opts);
    return;
  }

  const jp = text.match(
    /^(?:join-pane|joinp)((?:\s+(?:-[hv]|-s\s*\d+|-t\s*\d+))*)$/,
  );
  if (jp) {
    const se = attached(s);
    if (!se) return;
    const flags = jp[1]!;
    const sFlag = flags.match(/-s\s*(\d+)/);
    const tFlag = flags.match(/-t\s*(\d+)/);
    const hFlag = /\s-h(?:\s|$)/.test(flags);
    const vFlag = /\s-v(?:\s|$)/.test(flags);
    if (!sFlag) {
      s.statusMessage = 'join-pane: no source pane';
      return;
    }
    const srcIdx = Number(sFlag[1]);
    const tgtIdx = tFlag
      ? Number(tFlag[1])
      : se.windows.findIndex(w => w.id === se.activeWindowId);
    const dir: 'v' | 'h' = hFlag ? 'v' : vFlag ? 'h' : 'h';
    joinPane(s, srcIdx, tgtIdx, dir, e, opts);
    return;
  }

  const sl = text.match(/^(?:select-layout|selectl)\s+(\S+)$/);
  if (sl) {
    const raw = sl[1]!;
    const aliases: Record<string, PresetName> = {
      'even-horizontal': 'even-h',
      'even-vertical':   'even-v',
      'main-horizontal': 'main-h',
      'main-vertical':   'main-v',
      'tiled':           'tiled',
    };
    const preset = aliases[raw];
    if (!preset) {
      s.statusMessage = `unknown layout: ${raw}`;
      return;
    }
    const se = attached(s);
    if (se) {
      applyPreset(activeWin(se), preset);
      e.push({ type: 'layout-applied', preset });
    }
    return;
  }

  const pb = text.match(/^(?:paste-buffer|pasteb)(?:\s+-b\s*(\S+))?$/);
  if (pb) {
    const buf = pb[1] != null
      ? s.pasteBuffers?.find(b => b.name === pb[1])
      : s.pasteBuffers?.[0];
    if (!buf) {
      s.statusMessage = pb[1] != null
        ? `no buffer matching ${pb[1]}`
        : 'no paste buffer';
      return;
    }
    const se = attached(s);
    if (se) {
      s.lastPaste = buf.text;
      e.push({ type: 'text-pasted', text: buf.text });
    }
    return;
  }

  if (/^(?:kill-pane|killp)$/.test(text)) {
    const se = attached(s);
    if (se) {
      const w = activeWin(se);
      const single = paneOrder(w.layout).length === 1;
      if (!(single && se.windows.length === 1)) {
        closeActive(s, se, w, e, opts);
        e.push({ type: 'pane-closed' });
        if (single) e.push({ type: 'window-killed' });
        fireHook(s, 'pane-died', e, opts);
        fireHook(s, 'pane-exited', e, opts);
      }
    }
    return;
  }

  const ks = text.match(/^(?:kill-session|kills)(?:\s+-t\s*(\S+))?$/);
  if (ks) {
    const targetName = ks[1];
    const target = targetName
      ? s.sessions.find(x => x.name === targetName)
      : s.sessions.find(x => x.id === s.attachedSessionId);
    if (targetName && !target) {
      s.statusMessage = `no such session: ${targetName}`;
      return;
    }
    if (!target) return;
    fireHook(s, 'session-closed', e, opts);
    killSession(s, target.id, e);
    return;
  }

  const dpM = text.match(/^(?:display-popup|popup)(?:\s+(.+))?$/);
  if (dpM) {
    const args = dpM[1] ?? '';
    const closeOnExit = /(?:^|\s)-E(?:\s|$)/.test(args);
    const wFlag = args.match(/(?:^|\s)-w\s+(\d+)/);
    const hFlag = args.match(/(?:^|\s)-h\s+(\d+)/);
    const rest = args
      .replace(/(?:^|\s)-E(?=\s|$)/, ' ')
      .replace(/(?:^|\s)-w\s+\d+/, ' ')
      .replace(/(?:^|\s)-h\s+\d+/, ' ')
      .trim();
    const cmd = rest ? unquote(rest) : undefined;
    s.mode = 'popup';
    s.popup = {
      content: [],
      ...(cmd !== undefined ? { cmd } : {}),
      cwd: '~/tmuxquest',
      ...(closeOnExit ? { closeOnExit: true } : {}),
      ...(wFlag ? { width: parseInt(wFlag[1]!, 10) } : {}),
      ...(hFlag ? { height: parseInt(hFlag[1]!, 10) } : {}),
    };
    e.push({ type: 'popup-opened', ...(cmd !== undefined ? { cmd } : {}) });
    return;
  }

  const as_ = text.match(/^(?:attach-session|attach)(?:\s+-t\s*(\S+))?$/);
  if (as_) {
    const arg = as_[1] ? unquote(as_[1]) : null;
    let target = arg
      ? s.sessions.find(x => x.name === arg) ?? (
          /^\d+$/.test(arg) ? s.sessions[Number(arg)] : undefined)
      : s.sessions.find(x => x.id === s.activeSessionId);
    if (!target) {
      s.statusMessage = arg ? `no such session: ${arg}` : 'no sessions';
      return;
    }
    if (s.attachedSessionId !== target.id) {
      s.attachedSessionId = target.id;
      s.activeSessionId = target.id;
      e.push({ type: 'attached', sessionId: target.id });
      fireHook(s, 'client-attached', e, opts);
    }
    return;
  }

  if (text === '') return;

  s.statusMessage = `unknown command: ${text}`;
}

