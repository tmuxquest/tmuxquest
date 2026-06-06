<script lang="ts">
  import type { Mission } from '../missions/schema';
  import { focusReturn } from './focusReturn';
  import type { Stars } from '../store/stars';
  import { formatStopwatch } from '../store/stopwatch';

  let { next, onNext, onReplay, onToMap, onFinish = () => {}, finalClear = false, replay = false, runTimeMs = 0, runStars = 1, prevBestMs = null, isNewBest = false }: {
    mission: Mission;
    next: Mission | null;
    onNext: () => void;
    onReplay: () => void;
    onToMap: () => void;
    onFinish?: () => void;
    finalClear?: boolean;
    replay?: boolean;
    runTimeMs?: number;
    runStars?: Stars;
    prevBestMs?: number | null;
    isNewBest?: boolean;
  } = $props();

  const buttons = $derived([
    { label: 'restart', cls: '', action: onReplay },
    ...(next && !finalClear ? [{ label: 'menu', cls: '', action: onToMap }] : []),
    finalClear
      ? { label: 'finish', cls: 'confirm-btn-primary', action: onFinish }
      : next
        ? { label: 'next', cls: 'confirm-btn-primary', action: onNext }
        : { label: 'menu', cls: 'confirm-btn-primary', action: onToMap },
  ]);

  let btnEls: (HTMLButtonElement | undefined)[] = $state([]);
  let focusIdx = $state(-1);

  function focusBtn(i: number): void {
    const n = buttons.length;
    if (n === 0) return;
    focusIdx = ((i % n) + n) % n;
    btnEls[focusIdx]?.focus();
  }

  $effect(() => {
    focusBtn(focusIdx);
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        onToMap(); return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault(); e.stopImmediatePropagation();
        onReplay(); return;
      }
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        btnEls[focusIdx]?.click(); return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault(); e.stopImmediatePropagation();
        focusBtn(focusIdx + 1); return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault(); e.stopImmediatePropagation();
        focusBtn(focusIdx - 1); return;
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
</script>

<div
  use:focusReturn
  class="help-pane success-overlay"
  role="presentation"
>
  <div class="help-pane-doc success-pane-doc" role="dialog" aria-modal="true" aria-label="level cleared">
    <div class="help-pane-head">
      <span>level cleared</span>
      <button class="help-pane-x" onclick={onToMap} aria-label="back to menu">esc</button>
    </div>
    <div class="help-pane-body success-pane-body">
      <div class="success-hero">
        <div class="success-result medal-tier-{runStars}" aria-label="run result">
          <div class="success-stars" aria-label="{runStars} of 3 stars">
            {#each [0, 1, 2] as i (i)}
              <span class="ss-star {i < runStars ? 'on' : 'off'}" aria-hidden="true">{i < runStars ? '★' : '☆'}</span>
            {/each}
          </div>
          <div class="success-run">
            <span class="success-time">{formatStopwatch(runTimeMs)}</span>
            {#if replay && isNewBest}<span class="success-pr">new best!</span>
            {:else if replay && prevBestMs != null}<span class="success-best dim">best {formatStopwatch(prevBestMs)}</span>{/if}
          </div>
        </div>
      </div>

      <div class="overlay-actions">
        {#each buttons as b, i (b.label)}
          <button
            bind:this={btnEls[i]}
            class="confirm-btn {b.cls}"
            class:is-active={i === focusIdx}
            tabindex={i === focusIdx ? 0 : -1}
            onclick={b.action}
          >{b.label}</button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .help-pane-head span { color: var(--accent); font-weight: 500; }

  .success-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin: 8px 0 0;
  }
  .overlay-actions {
    margin-top: 24px;
    justify-content: center;
  }
  .success-result { margin: 0; display: flex; flex-direction: column; align-items: center; }
  .success-stars { display: flex; gap: 16px; font-size: var(--fs-display); line-height: 1; margin-bottom: 24px; }
  .ss-star.on { color: var(--medal, var(--star)); }
  .ss-star.off { color: var(--star-track); }

  .success-run {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 56px;
    font-variant-numeric: tabular-nums;
  }
  .success-time { font-size: var(--fs-xl); font-weight: 500; line-height: 1; letter-spacing: .02em; color: var(--ink-bright); }
  .success-best { font-size: var(--fs-sm); letter-spacing: .02em; color: var(--star); }
  .dim { color: var(--ink-dim); }

  .success-pr { font-size: var(--fs-md); font-weight: 500; letter-spacing: .02em; line-height: 1; color: var(--accent); }
</style>
