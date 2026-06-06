<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    header,
    children,
    overlay,
  }: {
    header?: Snippet;
    children?: Snippet;
    overlay?: Snippet;
  } = $props();
</script>

<div class="shell">
  {#if header}
    <div class="shell-header bleed">
      {@render header()}
    </div>
  {/if}
  <div class="shell-stage">
    {#if children}
      <div class="shell-body">
        <div class="shell-inner shell-inner-body">{@render children()}</div>
      </div>
    {/if}
    {#if overlay}
      <div class="shell-overlay">{@render overlay()}</div>
    {/if}
  </div>
</div>
