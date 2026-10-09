// Only the header surface changes height; its reserved space stays constant.
// This avoids moving the page or flickering around the scroll threshold.
let dispose: (() => void) | undefined;

function initialiseHeader() {
  dispose?.();
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;

  const controller = new AbortController();
  const { signal } = controller;
  const menu = header.querySelector<HTMLDetailsElement>('.mobile-menu');
  const summary = menu?.querySelector<HTMLElement>('summary');
  const desktop = window.matchMedia('(min-width: 951px)');
  let compact = window.scrollY >= 80;
  let frame = 0;

  function updateSurface() {
    frame = 0;
    const scroll = Math.max(0, window.scrollY);
    if (scroll >= 80) compact = true;
    else if (scroll <= 24) compact = false;
    header!.classList.toggle('is-scrolled', compact);
  }
  function scheduleSurface() {
    if (!frame) frame = window.requestAnimationFrame(updateSurface);
  }
  function closeMenu(restoreFocus = false) {
    if (!menu?.open) return;
    menu.open = false;
    if (restoreFocus) summary?.focus();
  }

  updateSurface();
  window.addEventListener('scroll', scheduleSurface, { passive: true, signal });
  window.addEventListener('pageshow', scheduleSurface, { signal });
  menu?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu(), { signal });
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !menu?.contains(event.target)) closeMenu();
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu?.open) {
      event.preventDefault();
      closeMenu(true);
    }
  }, { signal });
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof Node && !menu?.contains(event.target)) closeMenu();
  }, { signal });
  desktop.addEventListener('change', () => {
    if (desktop.matches) closeMenu();
  }, { signal });

  dispose = () => {
    controller.abort();
    if (frame) window.cancelAnimationFrame(frame);
  };
}

initialiseHeader();
document.addEventListener('astro:before-swap', () => dispose?.());
document.addEventListener('astro:page-load', initialiseHeader);
