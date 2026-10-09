// Progressive motion: HTML stays visible when JavaScript is unavailable.
let disposeMotion: (() => void) | undefined;
function initialiseMotion() {
  disposeMotion?.();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet<Element>();
  const animations = new Set<Animation>();
  const controller = new AbortController();
  function track(animation: Animation) {
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  }
  function reveal(element: Element) {
    if (seen.has(element)) return;
    seen.add(element);
    observer?.unobserve(element);
    if (motion.matches || !element.isConnected || typeof element.animate !== 'function') return;
    if (element.matches('[data-botanical]')) {
      element.querySelectorAll<SVGPathElement>('path').forEach((path, index) => {
        const length = path.getTotalLength();
        track(path.animate([{ strokeDasharray: `${length}`, strokeDashoffset: `${length}`, opacity: 0 }, { strokeDasharray: `${length}`, strokeDashoffset: '0', opacity: 1 }], { duration: 820, delay: index * 38, easing: 'cubic-bezier(.2,.7,.3,1)' }));
      });
      return;
    }
    const siblings = Array.from(element.parentElement?.children ?? []);
    const delay = element.matches('.product-card,.gift-card,.delivery-grid article,.related-grid>a') ? Math.max(0, siblings.indexOf(element) % 4) * 45 : 0;
    track(element.animate([{ opacity: .12, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 470, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }));
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) reveal(entry.target); });
  }, { threshold: .08, rootMargin: '0px 0px -24px 0px' }) : undefined;
  const selector = '[data-reveal],[data-botanical]';
  function discover(root: ParentNode) {
    if (root instanceof Element && root.matches(selector) && !seen.has(root)) observer?.observe(root);
    root.querySelectorAll(selector).forEach((element) => { if (!seen.has(element)) observer?.observe(element); });
  }
  discover(document);
  // React inserts new cards after hydration/filter changes. Existing cards never replay.
  const mutations = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => { if (node instanceof Element) discover(node); }));
  });
  mutations.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });
  motion.addEventListener('change', () => { if (motion.matches) animations.forEach((animation) => animation.cancel()); }, { signal: controller.signal });
  disposeMotion = () => {
    controller.abort();observer?.disconnect();mutations.disconnect();animations.forEach((animation) => animation.cancel());animations.clear();
  };
}
initialiseMotion();
document.addEventListener('astro:before-swap', () => disposeMotion?.());
document.addEventListener('astro:page-load', initialiseMotion);
