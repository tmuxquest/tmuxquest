<script lang="ts">
  import type { Mission } from '../missions/schema';
  import { evaluateMissionSteps } from '../engine/goals';
  import type { MissionEngine } from '../engine/missionEngine';
  import type { TmuxState, GameEvent } from '../engine/types';
  import { thresholdsFor, nextMedal } from '../store/stars';
  import { formatStopwatch } from '../store/stopwatch';

  let {
    mission,
    engine = null,
    engineState = null,
    index = null,
    total = null,
    label = 'LVL',
    briefOpen = false,
    onToggleBrief = null,
    onRequestExit = null,
    stopwatchMs = 0,
  }: {
    mission: Mission;
    engine?: MissionEngine | null;
    engineState?: TmuxState | null;
    index?: number | null;
    total?: number | null;
    label?: string;
    briefOpen?: boolean;
    onToggleBrief?: (() => void) | null;
    onRequestExit?: (() => void) | null;
    stopwatchMs?: number;
  } = $props();

  const numLabel = $derived.by(() => {
    if (index == null || total == null) return null;
    const pad = String(total).length;
    return `${label} ${String(index + 1).padStart(pad, '0')}/${total}`;
  });

  const briefShortcut = 'Ctrl+/';

  const stepDone = $derived.by<boolean[]>(() => {
    void engineState;
    const s = engineState;
    if (!s) return mission.steps.map(() => false);
    const evs: GameEvent[] = engine?.events ?? [];
    return evaluateMissionSteps(mission.steps, s, evs);
  });

  const currentStep = $derived(stepDone.findIndex(d => !d));

  const swText = $derived(formatStopwatch(stopwatchMs));
  const swThresholds = $derived(thresholdsFor(mission));
  const swMedal = $derived(nextMedal(stopwatchMs, swThresholds));
  const swZone = $derived(swMedal.stars === 3 ? 'gold' : 'silver');
  const swTarget = $derived(swMedal.threshold != null ? formatStopwatch(swMedal.threshold) : null);
</script>

<div class="hud" onmousedown={(e) => e.preventDefault()}>
  {#if mission.steps.length > 0}
    <ul class="hud-checklist" aria-label="objective steps">
      {#each mission.steps as st, i (i)}
        <li class="hud-check-item {stepDone[i] ? 'done' : i === currentStep ? 'current' : 'todo'}">
          <span class="hud-check-box" aria-hidden="true">{stepDone[i] ? '✓' : i === currentStep ? '→' : '·'}</span>
          <span class="hud-check-label">{st.label}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <span class="hud-spacer"></span>
  {/if}
  <div class="hud-right">
    {#if engine && swMedal.stars >= 2}
      <span class="hud-stopwatch zone-{swZone}" aria-label="stopwatch">
        <span class="hud-sw-time" aria-hidden="true">{swText}</span>
        <span class="hud-sw-target" aria-hidden="true"><span class="hud-sw-goal">{#each [0, 1, 2] as i (i)}{i < swMedal.stars ? '★' : '☆'}{/each}</span>{#if swTarget}<span class="hud-sw-cut">{swTarget}</span>{/if}</span>
      </span>
    {/if}
    {#if onToggleBrief}
      <button
        type="button"
        class="hud-brief-toggle"
        aria-expanded={briefOpen}
        title="Toggle level brief ({briefShortcut})"
        onclick={onToggleBrief}
      >
        <span class="hud-brief-glyph" aria-hidden="true">{briefOpen ? '▾' : '▸'}</span>
        brief.md
      </button>
    {/if}
    {#if numLabel}
      <span class="hud-title-num" aria-label="current level">{numLabel}</span>
    {/if}
    {#if onRequestExit}
      <button
        type="button"
        class="hud-menu-btn"
        title="Back to menu (Esc)"
        onclick={onRequestExit}
      >
        <span class="hud-menu-glyph" aria-hidden="true">☰</span>
        menu
      </button>
    {/if}
  </div>
</div>

<style>
  .hud-title-num {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    text-transform: lowercase;
    color: var(--accent);
    border: 1px solid var(--line);
    border-radius: 2px;
    padding: 0 6px;
    font-size: 11px;
    letter-spacing: .04em;
  }
  .hud-brief-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 2px;
    padding: 0 6px;
    color: var(--ink-dim);
    font: inherit;
    font-size: 11px;
    letter-spacing: .04em;
    cursor: pointer;
    transition: color .12s, border-color .12s;
  }
  .hud-brief-toggle:hover { color: var(--ink-bright); border-color: var(--ink-dim); }
  .hud-brief-toggle[aria-expanded="true"] { color: var(--ink-bright); }
  .hud-brief-glyph { color: var(--accent); }
  .hud-menu-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 2px;
    padding: 0 8px;
    color: var(--ink-dim);
    font: inherit;
    font-size: 11px;
    letter-spacing: .04em;
    text-transform: lowercase;
    cursor: pointer;
    transition: color .12s, border-color .12s;
  }
  .hud-menu-btn:hover { color: var(--ink-bright); border-color: var(--ink-dim); }
  .hud-menu-glyph { color: var(--accent); font-size: 12px; line-height: 1; }
  .hud-checklist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: wrap;
    gap: 6px 22px;
    font-size: 12px;
  }
  .hud-spacer { flex: 1 1 auto; }
  .hud-check-item {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .hud-check-box {
    width: 1ch;
    text-align: center;
    color: var(--ink-faint);
  }
  .hud-check-label { text-transform: lowercase; }
  .hud-check-item.todo .hud-check-label { color: var(--ink-faint); }
  .hud-check-item.current .hud-check-label { color: var(--ink-bright); }
  .hud-check-item.done .hud-check-label {
    color: var(--accent);
    text-decoration: line-through;
    text-decoration-color: var(--ink-faint);
  }
  .hud-check-item.done .hud-check-box { color: var(--accent); }
  .hud-stopwatch {
    --zone: var(--ink-dim);
    display: inline-flex; align-items: baseline; gap: 8px;
    font-variant-numeric: tabular-nums;
    border: 1px solid color-mix(in srgb, var(--zone) 50%, var(--line));
    background: color-mix(in srgb, var(--zone) 12%, transparent);
    border-radius: 2px;
    padding: 1px 8px; letter-spacing: .04em;
    transition: border-color .25s ease, background-color .25s ease;
  }
  .hud-stopwatch.zone-gold   { --zone: var(--medal-gold); }
  .hud-stopwatch.zone-silver { --zone: var(--medal-silver); }
  .hud-sw-time { color: var(--zone); font-size: 11px; font-weight: 600; }
  .hud-sw-target { display: inline-flex; align-items: baseline; gap: 5px; color: var(--ink-faint); font-size: 11px; }
  .hud-sw-goal { color: var(--zone); letter-spacing: 0; }
</style>
