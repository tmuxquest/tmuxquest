<script lang="ts">
  import type { TmuxState } from '../engine/types';
  import type { Progress } from '../store/progress';
  import type { Line } from './shellFs';
  import TerminalShell from './TerminalShell.svelte';

  let {
    state,
    progress,
    dispatchTmuxKey,
  }: {
    state: TmuxState;
    progress: Progress;
    dispatchTmuxKey: (token: string) => void;
  } = $props();

  const popup = $derived(state.popup!);
  const widthPct  = $derived(popup.width  ?? 50);
  const heightPct = $derived(popup.height ?? 50);

  const seed = $derived(
    popup.cmd
      ? [{
          cwd: popup.cwd,
          cmd: popup.cmd,
          output: popup.content.map((text): Line => ({ text })),
        }]
      : []
  );
</script>

<div
  class="popup-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="popup"
>
  <div
    class="popup-box"
    style="width:{widthPct}%;height:{heightPct}%"
  >
    <div class="popup-body">
      <TerminalShell
        {progress}
        initialCwd={popup.cwd}
        isActive={true}
        tmuxState={state}
        {dispatchTmuxKey}
        seedHistory={seed}
        ariaLabel={'popup shell'}
        containerClass={'popup-shell'}
      />
    </div>
  </div>
</div>

<style>
  .popup-backdrop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  .popup-box {
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--accent);
    overflow: hidden;
  }
  .popup-body {
    flex: 1;
    overflow-y: auto;
    padding: .35rem .5rem;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink);
  }
</style>
