export function fitScale(available: number, natural: number): number {
  if (!(available > 0) || !(natural > 0)) return 1;
  return Math.min(1, available / natural);
}

const FIT_MARGIN = 0.98;

export function fitWidth(node: HTMLElement): { destroy: () => void } {
  const box = node.parentElement;
  if (!box || typeof ResizeObserver === 'undefined') {
    return { destroy() {} };
  }

  const apply = () => {
    node.style.transform = 'none';
    const natural = node.getBoundingClientRect().width;
    const avail = box.getBoundingClientRect().width * FIT_MARGIN;
    const s = fitScale(avail, natural);
    node.style.transformOrigin = '50% 50%';
    node.style.transform = s < 1 ? `scale(${s})` : '';
  };

  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(box);
  const onResize = () => apply();
  window.addEventListener('resize', onResize, { passive: true });
  window.visualViewport?.addEventListener('resize', onResize, { passive: true });
  void document.fonts?.ready?.then(apply).catch(() => {});

  return {
    destroy() {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    },
  };
}
