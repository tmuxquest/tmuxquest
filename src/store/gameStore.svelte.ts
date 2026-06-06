import { MissionEngine } from '../engine/missionEngine';
import { reconcileCopy } from '../engine/tmuxModel';
import type { MouseAction } from '../engine/tmuxModel';
import { MISSIONS, SPINE, ANNEX, SPINE_COUNT } from '../missions/missions';
import { recordResult, loadProgress, type Progress } from './progress';
import { Stopwatch, shouldPause } from './stopwatch';
import { thresholdsFor, starsFor, type Stars } from './stars';
import { loadSession, saveSession, clearSession } from './session';
import { paneShellState } from './paneShellState.svelte';
import { paneOrder } from '../engine/layout';
import type { TmuxState, GameEvent } from '../engine/types';
import { SHELL_HOME } from '../ui/shellFs';
import { buildPromptLine } from '../ui/promptLine';

function makeEngineOpts(): import('../engine/missionEngine').MissionEngineOpts {
  return {
    promptLineFor: (paneId) => {
      const st = paneShellState.get(paneId, SHELL_HOME);
      return buildPromptLine(st.cwd, st.input);
    },
  };
}

function livePanes(state: TmuxState): Set<string> {
  const out = new Set<string>();
  for (const se of state.sessions) {
    for (const w of se.windows) {
      for (const pid of paneOrder(w.layout)) out.add(pid);
    }
  }
  return out;
}

export function firstUnclearedIndex(): number {
  const prog = loadProgress();
  for (let i = 0; i < MISSIONS.length; i++) {
    if (!prog.results[MISSIONS[i]!.id]) return i;
  }
  return -1;
}

export function spineClearedCount(p: Progress): number {
  return SPINE.reduce((n, m) => n + (p.results[m.id] ? 1 : 0), 0);
}

export function annexClearedCount(p: Progress): number {
  return ANNEX.reduce((n, m) => n + (p.results[m.id] ? 1 : 0), 0);
}

export function campaignComplete(p: Progress): boolean {
  return spineClearedCount(p) >= SPINE_COUNT;
}

export function spineGoldGap(p: Progress): number {
  return SPINE.reduce((n, m) => n + (p.results[m.id]?.bestStars === 3 ? 0 : 1), 0);
}

export function shouldOfferFinale(campaignJustCompleted: boolean, nextIdx: number, p: Progress): boolean {
  return campaignJustCompleted || (nextIdx < 0 && campaignComplete(p));
}

export function nextInTrackIndex(after: number): number {
  const cur = MISSIONS[after];
  if (!cur) return -1;
  const wantOptional = !!cur.optional;
  for (let i = after + 1; i < MISSIONS.length; i++) {
    if (!!MISSIONS[i]!.optional === wantOptional) return i;
  }
  return -1;
}

export function createGame() {
  let index = $state(0);
  let engine = $state<MissionEngine | null>(null);
  let engineState = $state<TmuxState | null>(null);
  let booted = $state(false);
  let engineComplete = $state(false);
  let campaignJustCompleted = $state(false);
  let pendingBrief = $state(false);
  let briefIsEntry = $state(false);
  let menuOpen = $state(false);
  let overlayActive = $state(false);

  const stopwatch = new Stopwatch();
  let replayMode = $state(false);
  let stopwatchMs = $state(0);
  let lastRun = $state<{ replay: boolean; timeMs: number; stars: Stars; prevBestMs: number | null; isNewBest: boolean } | null>(null);
  const SW_INTERVAL_MS = 100;
  let swHandle: ReturnType<typeof setInterval> | null = null;

  function startSw(): void {
    if (swHandle !== null) return;
    swHandle = setInterval(() => {
      const now = Date.now();
      stopwatch.setPaused(shouldPause({
        engineComplete, menuOpen, pendingBrief, overlayActive,
        hidden: typeof document !== 'undefined' && document.hidden,
      }), now);
      stopwatchMs = stopwatch.elapsed(now);
    }, SW_INTERVAL_MS);
  }
  function stopSw(): void {
    if (swHandle !== null) { clearInterval(swHandle); swHandle = null; }
  }
  function computeReplay(missionId: string): boolean {
    return loadProgress().results[missionId]?.cleared === true;
  }
  function armClock(): void { stopwatch.start(Date.now()); }

  const TICK_INTERVAL_MS = 250;
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  function startTick(): void {
    if (tickHandle !== null) return;
    tickHandle = setInterval(() => {
      if (!engine) return;
      if (engineComplete || menuOpen || pendingBrief || overlayActive) return;
      const r = engine.tick(TICK_INTERVAL_MS);
      if (r.events.length > 0) _handlePostAction();
      if (engine.state.mode === 'display-panes'
          && engine.state.displayPanesDeadline != null
          && engine.state.displayPanesDeadline <= Date.now()) {
        engine.state.mode = 'normal';
        delete engine.state.displayPanesDeadline;
        reconcileCopy(engine.state);
        engineState = { ...engine.state, sessions: [...engine.state.sessions] };
      }
      if (engine.state.mode === 'repeat'
          && engine.state.repeatDeadline != null
          && engine.state.repeatDeadline <= Date.now()) {
        engine.state.mode = 'normal';
        delete engine.state.repeatDeadline;
        reconcileCopy(engine.state);
        engineState = { ...engine.state, sessions: [...engine.state.sessions] };
      }
    }, TICK_INTERVAL_MS);
  }

  function stopTick(): void {
    if (tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function setOverlayActive(b: boolean) { overlayActive = b; }

  function _handlePostAction(): void {
    if (!engine) return;
    engineState = engine.state;
    if (engine.complete && !engineComplete) {
      engineComplete = true;
      const now = Date.now();
      stopwatch.stop(now);
      const wasComplete = campaignComplete(loadProgress());
      const prevBestMs = loadProgress().results[engine.mission.id]?.bestTimeMs ?? null;
      const final = stopwatch.elapsed(now);
      stopwatchMs = final;
      const stars = starsFor(final, thresholdsFor(engine.mission));
      recordResult(engine.mission.id, { timeMs: final, stars });
      lastRun = { replay: replayMode, timeMs: final, stars, prevBestMs, isNewBest: prevBestMs == null || final < prevBestMs };
      campaignJustCompleted = !wasComplete && campaignComplete(loadProgress());
      persist();
    } else if (!engine.complete) {
      persist();
    }
  }

  function persist() {
    if (!engine) return;
    saveSession({ v: 2, missionId: MISSIONS[index]!.id });
  }

  function restore(): boolean {
    const s = loadSession();
    if (!s) return false;
    const i = MISSIONS.findIndex((m) => m.id === s.missionId);
    if (i < 0) { clearSession(); return false; }
    openMission(i);
    return true;
  }

  function openMission(i: number) {
    index = i;
    const _missionDef = MISSIONS[i]!;
    engine = new MissionEngine(_missionDef, makeEngineOpts());
    engineState = engine.state;
    engineComplete = false;
    replayMode = computeReplay(_missionDef.id);
    stopwatch.reset(); stopwatchMs = 0; lastRun = null;
    campaignJustCompleted = false;
    booted = true;
    pendingBrief = true;
    briefIsEntry = true;
    menuOpen = false;
    paneShellState.reset();
    persist();
    startTick();
    startSw();
  }

  function dismissBrief() {
    pendingBrief = false; armClock();
    if (engine && !engine.complete && !briefIsEntry) {
      engine.recordBriefClosed();
      _handlePostAction();
    }
  }
  function showBrief() {
    pendingBrief = true; briefIsEntry = false;
    if (engine && !engine.complete) {
      engine.recordBriefOpened();
      _handlePostAction();
    }
  }
  function openMenu() { menuOpen = true; }
  function closeMenu() { menuOpen = false; }

  function press(key: string) {
    const eng = engine;
    if (!eng) return;
    if (eng.complete) return;
    const prevEventsLen = eng.events.length;
    eng.press(key);
    for (let i = prevEventsLen; i < eng.events.length; i++) {
      const ev = eng.events[i] as GameEvent;
      if (ev.type !== 'text-pasted') continue;
      const se = eng.state.sessions.find(x => x.id === eng.state.attachedSessionId);
      if (!se) continue;
      const w = se.windows.find(ww => ww.id === se.activeWindowId);
      if (!w) continue;
      paneShellState.get(w.activePaneId, SHELL_HOME).appendInput(ev.text);
    }
    paneShellState.retain(livePanes(eng.state));
    _handlePostAction();
  }

  function reattachByName(name?: string): void {
    const eng = engine;
    if (!eng) return;
    if (!name) { press('Enter'); return; }
    eng.attachByName(name);
    paneShellState.retain(livePanes(eng.state));
    _handlePostAction();
  }

  function dispatchAction(action: MouseAction): void {
    const eng = engine;
    if (!eng) return;
    if (eng.complete) return;
    eng.dispatchAction(action);
    paneShellState.retain(livePanes(eng.state));
    _handlePostAction();
  }

  function clearStatusMessage() {
    if (!engine || engine.state.statusMessage == null) return;
    if (engine.state.mode !== 'normal') return;
    delete engine.state.statusMessage;
    engineState = { ...engine.state, sessions: [...engine.state.sessions] };
  }

  function closeMissionToMenu() {
    stopTick();
    stopSw();
    engine = null;
    engineState = null;
    engineComplete = false;
    replayMode = false; stopwatch.reset(); stopwatchMs = 0; lastRun = null;
    campaignJustCompleted = false;
    booted = false;
    pendingBrief = false;
    clearSession();
    paneShellState.reset();
    menuOpen = true;
  }

  function resetMission() {
    if (!engine) return;
    stopTick();
    engine.reset();
    engineState = engine.state;
    engineComplete = false;
    replayMode = computeReplay(MISSIONS[index]!.id);
    stopwatch.reset(); stopwatchMs = 0; lastRun = null;
    armClock();
    campaignJustCompleted = false;
    booted = true;
    pendingBrief = false;
    paneShellState.reset();
    persist();
    startTick();
  }

  if (!restore()) {
    menuOpen = true;
  }

  return {
    get index() { return index; },
    get engine() { return engine; },
    get engineState() { return engineState; },
    get engineComplete() { return engineComplete; },
    get replayMode() { return replayMode; },
    get stopwatchMs() { return stopwatchMs; },
    get lastRun() { return lastRun; },
    get campaignJustCompleted() { return campaignJustCompleted; },
    get booted() { return booted; },
    get pendingBrief() { return pendingBrief; },
    get briefIsEntry() { return briefIsEntry; },
    get menuOpen() { return menuOpen; },
    get overlayActive() { return overlayActive; },
    openMission, press, reattachByName, dispatchAction, resetMission, dismissBrief, showBrief,
    openMenu, closeMenu, closeMissionToMenu,
    setOverlayActive, clearStatusMessage,
  };
}

