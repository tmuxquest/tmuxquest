<script lang="ts">
  import { createGame, firstUnclearedIndex, nextInTrackIndex, shouldOfferFinale, spineGoldGap } from './store/gameStore.svelte';
  import { createSettings } from './store/settings.svelte';
  import { MISSIONS, SPINE_COUNT, ANNEX_COUNT } from './missions/missions';
  import { loadProgress, recordResult } from './store/progress';
  import { storageAvailable } from './store/storageHealth';
  import { tokenize } from './engine/keyInput';
  import type { Session } from './engine/types';
  import Shell from './ui/Shell.svelte';
  import MenuOverlay from './ui/MenuOverlay.svelte';
  import Hud from './ui/Hud.svelte';
  import Terminal from './ui/Terminal.svelte';
  import PreGameShell from './ui/PreGameShell.svelte';
  import ConfirmExitOverlay from './ui/ConfirmExitOverlay.svelte';
  import SuccessOverlay from './ui/SuccessOverlay.svelte';
  import FinaleOverlay from './ui/FinaleOverlay.svelte';
  import BriefOverlay from './ui/BriefOverlay.svelte';

  const g = createGame();
  const settings = createSettings();
  const storageOk = storageAvailable();
  if (typeof window !== 'undefined') (window as Record<string, unknown>).__game = g;

  const mission = $derived(MISSIONS[g.index]!);
  let progress = $state(loadProgress());

  const inAnnex = $derived(mission.optional ?? false);
  const hudIndex = $derived(inAnnex ? g.index - SPINE_COUNT : g.index);
  const hudTotal = $derived(inAnnex ? ANNEX_COUNT : SPINE_COUNT);
  const hudLabel = $derived(inAnnex ? 'POWER TOOL' : 'LVL');
  let confirmExitOpen = $state(false);

  let menuAnchor = $state<{ x: number; y: number } | null>(null);

  function requestExit() {
    if (g.menuOpen) return;
    if (!g.engine || g.engine.complete) { g.closeMissionToMenu(); return; }
    confirmExitOpen = true;
  }

  const SUCCESS_GRACE_MS = 350;
  let successOpen = $state(false);
  let finaleOpen = $state(false);
  $effect(() => {
    if (g.engine && g.engineComplete) {
      const id = setTimeout(() => { successOpen = true; }, SUCCESS_GRACE_MS);
      return () => clearTimeout(id);
    }
    successOpen = false;
    finaleOpen = false;
  });
  const DISPLAY_TIME_MS = 750;
  $effect(() => {
    const st = g.engineState;
    if (st?.statusMessage != null && st.mode === 'normal') {
      const id = setTimeout(() => g.clearStatusMessage(), DISPLAY_TIME_MS);
      return () => clearTimeout(id);
    }
  });

  const nextIdx = $derived(nextInTrackIndex(g.index));
  const nextMission = $derived(nextIdx >= 0 ? MISSIONS[nextIdx]! : null);

  const skipIndex = $derived(MISSIONS.findIndex((m) => !progress.results[m.id]));
  const skipMission = $derived(skipIndex >= 0 ? MISSIONS[skipIndex]! : null);

  function handleSkip() {
    if (skipIndex < 0) return;
    recordResult(MISSIONS[skipIndex]!.id);
    progress = loadProgress();
  }

  const briefToggleBlocked = $derived(g.menuOpen || confirmExitOpen || successOpen);

  $effect(() => {
    if (g.menuOpen) progress = loadProgress();
  });
  $effect(() => {
    if (g.engineComplete) progress = loadProgress();
  });

  $effect(() => {
    document.documentElement.setAttribute('data-theme', settings.resolvedTheme);
  });

  $effect(() => {
    const on = g.engineState?.options?.mouse === 'on';
    document.body.dataset.mouse = on ? 'on' : 'off';
  });

  $effect(() => {
    g.setOverlayActive(
      confirmExitOpen || successOpen
    );
  });

  function isFormTarget(e: Event): boolean {
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key === '/') {
        if (!g.engine) return;
        if (briefToggleBlocked) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (g.pendingBrief) g.dismissBrief();
        else g.showBrief();
        return;
      }
      if (e.key === 'Escape') {
        if (confirmExitOpen) return;
        if (successOpen) return;
        if (g.pendingBrief) return;
        if (g.menuOpen) return;
        if (g.engineState && (
            g.engineState.mode === 'tree' ||
            g.engineState.mode === 'command' ||
            g.engineState.mode === 'rename' ||
            g.engineState.mode === 'prefix' ||
            g.engineState.mode === 'repeat' ||
            g.engineState.mode === 'confirm' ||
            g.engineState.mode === 'find' ||
            g.engineState.mode === 'menu' ||
            g.engineState.statusMessage != null)) {
          e.preventDefault();
          g.press('Esc');
          return;
        }
        if (g.engineState?.mode === 'copy') {
          const cp = g.engineState.copy;
          if (cp && (cp.anchor != null || cp.searchActive)) {
            e.preventDefault();
            g.press('Esc');
            return;
          }
        }
        if (g.engineState?.mode === 'popup') {
          e.preventDefault();
          g.press('Esc');
          return;
        }
        if (g.engine) {
          e.preventDefault();
          if (g.engine.complete) g.closeMissionToMenu();
          else confirmExitOpen = true;
        }
        return;
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  });

  $effect(() => {
    if (!g.engine) return;
    function onKey(e: KeyboardEvent) {
      if (g.menuOpen) return;
      if (confirmExitOpen || successOpen || g.pendingBrief || !g.booted) return;
      if (g.engine?.complete) return;
      if (isFormTarget(e)) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === '/') return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'i' || e.key === 'I')) return;
      const t = tokenize(e);
      if (!t || t === 'Esc' || t === '?') return;
      e.preventDefault();
      g.press(t);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function handleLaunchMission(i: number) {
    if (i === g.index && g.engine && !g.engine.complete) {
      g.closeMenu();
      return;
    }
    g.openMission(i);
  }

  const emptyEngineState: { sessions: Session[]; attachedSessionId: string | null } = {
    sessions: [], attachedSessionId: null,
  };
  const preState = $derived(
    g.booted && g.engineState ? g.engineState : emptyEngineState
  );
  const inTmux = $derived(g.booted && !!g.engineState?.attachedSessionId);

</script>

<div class="app">
  {#if !storageOk}
    <div class="storage-banner" role="alert">
      Progress won't be saved this session - storage unavailable.
    </div>
  {/if}
  <Shell>
    {#snippet header()}
      <Hud
        {mission}
        engine={g.engine}
        engineState={g.engineState}
        index={hudIndex}
        total={hudTotal}
        label={hudLabel}
        briefOpen={g.pendingBrief}
        onToggleBrief={() => {
          if (briefToggleBlocked) return;
          if (g.pendingBrief) g.dismissBrief();
          else g.showBrief();
        }}
        onRequestExit={requestExit}
        stopwatchMs={g.stopwatchMs}
      />
    {/snippet}

    {#snippet overlay()}
      <div class="play-host" class:inert={g.menuOpen} inert={g.menuOpen || undefined}>
        {#if inTmux && g.engineState}
          <Terminal
            state={g.engineState}
            dispatchTmuxKey={(t) => g.press(t)}
            dispatchMouseAction={(a) => g.dispatchAction(a)}
            {progress}
            onRequestExit={requestExit}
            onContextMenuAt={(x, y) => (menuAnchor = { x, y })}
            {menuAnchor}
          />
        {:else if g.engine}
          <PreGameShell
            engineState={preState}
            {progress}
            onAttachTmux={(target) => g.reattachByName(target)}
            onRequestExit={requestExit}
          />
        {/if}
      </div>
    {/snippet}
  </Shell>

  <MenuOverlay
    {progress}
    engineAlive={!!g.engine}
    visible={g.menuOpen}
    onPlay={() => {
      const i = firstUnclearedIndex();
      if (i < 0) return; // all cleared - MenuOverlay flips Play→Browse internally
      handleLaunchMission(i);
    }}
    onLaunchMission={handleLaunchMission}
    onSkip={handleSkip}
    skipTitle={skipMission?.title ?? null}
    onToggleTheme={() => settings.cycleTheme()}
    {settings}
    onClose={() => g.closeMenu()}
  />

  {#if confirmExitOpen}
    <ConfirmExitOverlay
      onConfirm={() => { confirmExitOpen = false; g.closeMissionToMenu(); }}
      onCancel={() => (confirmExitOpen = false)}
      onRestart={() => { confirmExitOpen = false; g.resetMission(); }}
    />
  {/if}
  {#if successOpen && g.engine && g.engine.complete && !g.pendingBrief}
    {#if finaleOpen}
      <FinaleOverlay onClose={() => { g.closeMissionToMenu(); }} goldGap={spineGoldGap(progress)} />
    {:else}
      <SuccessOverlay
        mission={g.engine.mission}
        next={nextMission}
        onNext={() => { if (nextIdx >= 0) g.openMission(nextIdx); }}
        onReplay={() => { g.resetMission(); successOpen = false; }}
        onToMap={() => { g.closeMissionToMenu(); }}
        onFinish={() => { finaleOpen = true; }}
        finalClear={shouldOfferFinale(g.campaignJustCompleted, nextIdx, progress)}
        replay={g.lastRun?.replay ?? false}
        runTimeMs={g.lastRun?.timeMs ?? 0}
        runStars={g.lastRun?.stars ?? 1}
        prevBestMs={g.lastRun?.prevBestMs ?? null}
        isNewBest={g.lastRun?.isNewBest ?? false}
      />
    {/if}
  {/if}
  {#if g.pendingBrief && g.engine}
    <BriefOverlay
      {mission}
      isEntry={g.briefIsEntry}
      onStart={() => g.dismissBrief()}
    />
  {/if}
</div>

<style>
  .play-host { display: contents; }
  .play-host.inert { pointer-events: none; opacity: 0.4; }
</style>
