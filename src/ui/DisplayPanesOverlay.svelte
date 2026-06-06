<script lang="ts">

  type PaneRect = { paneId: string; x: number; y: number; w: number; h: number };

  let {
    paneRects,
    activePaneId,
    paneOrder,
  }: {
    paneRects: PaneRect[];
    activePaneId: string;
    paneOrder: string[];
  } = $props();
</script>

<div class="dp-overlay">
  {#each paneRects as r (r.paneId)}
    {@const idx = paneOrder.indexOf(r.paneId)}
    {#if idx >= 0 && idx <= 9}
      <div
        class="dp-digit {r.paneId === activePaneId ? 'active' : ''}"
        style="left: {r.x}%; top: {r.y}%; width: {r.w}%; height: {r.h}%"
      >
        {idx}
      </div>
    {/if}
  {/each}
</div>
