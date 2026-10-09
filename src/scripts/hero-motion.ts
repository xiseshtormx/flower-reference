// Every element is visible by default. Cancelling motion restores that state.
let disposeHero: (() => void) | undefined;
let activeHero: HTMLElement | undefined;

function initialiseFlowerHero() {
  const hero = document.querySelector<HTMLElement>('[data-flower-hero]');
  // Astro also dispatches page-load on the first visit: do not replay the intro.
  if (hero && hero === activeHero) return;
  disposeHero?.();
  if (!hero) return;
  activeHero = hero;

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 951px)');
  const drift = hero.querySelector<HTMLElement>('[data-hero-drift]');
  const photo = hero.querySelector<HTMLElement>('[data-hero-photo]');
  const frameElement = hero.querySelector<HTMLElement>('[data-hero-frame]');
  const flower = hero.querySelector<SVGSVGElement>('[data-hero-flower]');
  const animations = new Set<Animation>();
  const ease = 'cubic-bezier(.22,1,.36,1)';
  let frame = 0;
  let visible = hero.getBoundingClientRect().bottom > 0;

  function animate(element: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    if (!element || typeof element.animate !== 'function') return;
    const animation = element.animate(keyframes, { easing: ease, fill: 'backwards', ...options });
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  }
  function cancelAnimations() {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  }

  if (!reducedMotion.matches && !document.hidden && window.scrollY < 80) {
    const compact = !desktop.matches;
    animate(hero.querySelector('[data-hero-eyebrow]'), [
      { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 400 });
    hero.querySelectorAll('[data-hero-line]').forEach((line, index) => animate(line, [
      { transform: 'translateY(105%)' }, { transform: 'translateY(0)' },
    ], { duration: compact ? 550 : 780, delay: 60 + index * 100 }));
    // Supporting text and actions enter together, rather than a long queue.
    hero.querySelectorAll('[data-hero-detail]').forEach((detail) => animate(detail, [
      { opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 450, delay: 180 }));

    if (photo) {
      const radius = window.getComputedStyle(photo).borderTopRightRadius;
      const openingRadius = Math.min(160, parseFloat(radius) + 48) + 'px';
      animate(photo, [
        { clipPath: `inset(0 0 100% 0 round 4px ${openingRadius} 4px 4px)` },
        { clipPath: `inset(0 0 0% 0 round 4px ${radius} 4px 4px)` },
      ], { duration: compact ? 600 : 850, delay: 40 });
      animate(hero.querySelector('[data-hero-photo-entry]'), [
        { transform: 'scale(1.08)' }, { transform: 'scale(1)' },
      ], { duration: compact ? 700 : 1100, delay: 40 });
    }
    animate(frameElement, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 180 });

    // Hidden botanical artwork does not animate on narrow screens.
    if (flower && flower.getBoundingClientRect().width > 0) {
      flower.querySelectorAll<SVGPathElement>('[data-flower-delay]').forEach((path) => {
        const length = path.getTotalLength();
        animate(path, [
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: '0' },
        ], { duration: Number(path.dataset.flowerDuration), delay: Number(path.dataset.flowerDelay) });
      });
      animate(flower.querySelector('[data-hero-sway]'), [
        { transform: 'rotate(0deg)', offset: 0 },
        { transform: 'rotate(-2deg)', offset: .45 },
        { transform: 'rotate(0deg)', offset: 1 },
      ], { duration: 950, delay: 1050, easing: 'ease-in-out' });
    }
  }

  function updateDrift() {
    frame = 0;
    const bounds = hero!.getBoundingClientRect();
    const progress = reducedMotion.matches || !desktop.matches || !visible ? 0 :
      Math.min(1, Math.max(0, -bounds.top / Math.max(1, bounds.height)));
    drift?.style.setProperty('--flower-drift', (progress * 18).toFixed(2) + 'px');
    frameElement?.style.setProperty('--flower-frame-drift', (-progress * 6).toFixed(2) + 'px');
  }
  function queueDrift() {
    if (!visible || reducedMotion.matches || !desktop.matches || frame) return;
    frame = window.requestAnimationFrame(updateDrift);
  }
  function refreshMotion() {
    if (reducedMotion.matches) cancelAnimations();
    updateDrift();
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateDrift();
  }) : undefined;
  observer?.observe(hero);
  window.addEventListener('scroll', queueDrift, { passive: true, signal });
  window.addEventListener('resize', queueDrift, { passive: true, signal });
  reducedMotion.addEventListener('change', refreshMotion, { signal });
  desktop.addEventListener('change', () => { cancelAnimations(); updateDrift(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimations(); }, { signal });
  updateDrift();

  disposeHero = () => {
    controller.abort();
    observer?.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
    cancelAnimations();
    activeHero = undefined;
    disposeHero = undefined;
  };
}

initialiseFlowerHero();
document.addEventListener('astro:before-swap', () => disposeHero?.());
document.addEventListener('astro:page-load', initialiseFlowerHero);
