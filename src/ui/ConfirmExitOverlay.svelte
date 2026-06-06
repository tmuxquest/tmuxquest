<script lang="ts">
  import { focusReturn } from './focusReturn';

  let { onConfirm, onCancel, onRestart = null, headline = 'game paused', body = 'progress on this level will be lost unless you finish it.', confirmLabel = 'quit' }: {
    onConfirm: () => void;
    onCancel: () => void;
    onRestart?: (() => void) | null;
    headline?: string;
    body?: string;
    confirmLabel?: string;
  } = $props();

  const buttons = $derived([
    { label: 'resume', cls: 'confirm-btn-primary', action: onCancel },
    ...(onRestart ? [{ label: 'restart', cls: '', action: onRestart }] : []),
    { label: confirmLabel, cls: 'confirm-btn-danger', action: onConfirm },
  ]);

  let btnEls: (HTMLButtonElement | undefined)[] = $state([]);
  let focusIdx = $state(0);

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
      if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
        e.preventDefault(); e.stopImmediatePropagation();
        onCancel(); return;
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault(); e.stopImmediatePropagation();
        onConfirm(); return;
      }
      if (onRestart && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault(); e.stopImmediatePropagation();
        onRestart(); return;
      }
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        btnEls[focusIdx]?.click();
        return;
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
  class="help-pane confirm-exit"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
>
  <div class="help-pane-doc confirm-exit-doc" role="dialog" aria-modal="true"
       aria-labelledby="confirm-exit-title" aria-describedby="confirm-exit-desc">
    <div class="help-pane-head">
      <span id="confirm-exit-title">{headline}</span>
      <button class="help-pane-x" onclick={onCancel}>esc</button>
    </div>
    <div class="help-pane-body confirm-exit-body">
      <div class="line" id="confirm-exit-desc">{body}</div>
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
