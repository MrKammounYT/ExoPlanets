// Scroll choreography for the 3D planet (docs/04-3d-scroll-plan.md, "Scroll choreography").
// One GSAP timeline scrubbed across the whole page. Its time axis is scroll distance in px,
// so each keyframe sits at the scroll position where its section arrives.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

function keyframes() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw < 760;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);

  const results = document.querySelector('.results');
  const method = document.querySelector('#method');
  const ctaImg = document.querySelector('.cta > img');

  // Top / Analyzer: positioned in the upper right
  const hero = { x: vw * (narrow ? 0.68 : 0.78), y: vh * 0.24, r: Math.min(vw * 0.22, 160), opacity: 1, moons: 1, graze: 0, spinBoost: 1, turn: 0 };

  // Closing call to action: the planet takes the place of the moon image, with its moons back.
  const ir = ctaImg ? ctaImg.getBoundingClientRect() : { width: 140, left: vw * 0.7 };
  const end = {
    x: ir.left + ir.width / 2,
    y: (ctaImg ? docTop(ctaImg) : maxScroll) - maxScroll + (ir.width ? ir.width * 0.46 : 70),
    r: Math.max(44, (ir.width ? ir.width * 0.46 : 65)),
    opacity: 1, moons: 1, graze: 0, spinBoost: 1, turn: 3.2
  };

  const frames = [
    { at: 0, ...hero },
    // Result cards: drifts down and left, smaller, spins faster
    { at: results ? docTop(results) - vh * 0.35 : maxScroll * 0.35, x: vw * (narrow ? 0.62 : 0.72), y: vh * 0.75, r: 120, opacity: 0.22, moons: 0.3, graze: 0, spinBoost: 1.6, turn: 1.2 },
    // What counts: pushed in close, low sun from the side so the relief shows
    { at: method ? docTop(method) - vh * 0.15 : maxScroll * 0.75, x: vw * (narrow ? 0.5 : 0.06), y: vh * 0.62, r: narrow ? vw * 0.62 : vh * 0.54, opacity: narrow ? 0.20 : 0.24, moons: 0, graze: 1, spinBoost: 0.6, turn: 2.2 },
    { at: maxScroll, ...end }
  ];

  for (let i = 1; i < frames.length; i++) frames[i].at = Math.min(Math.max(frames[i].at, frames[i - 1].at + 1), maxScroll + i);
  return { frames, maxScroll };
}

export function initScroll(api) {
  const state = api.state;
  let tl = null;

  function build() {
    const progress = tl ? tl.scrollTrigger.progress : 0;
    if (tl) { tl.scrollTrigger.kill(); tl.kill(); }
    const { frames, maxScroll } = keyframes();
    const { at: _a, ...first } = frames[0];
    Object.assign(state, first);

    tl = gsap.timeline({
      defaults: { ease: 'sine.inOut' },
      scrollTrigger: { start: 0, end: maxScroll, scrub: 1 }
    });
    for (let i = 0; i < frames.length - 1; i++) {
      const { at: a, ...from } = frames[i];
      const { at: b, ...to } = frames[i + 1];
      tl.fromTo(state, from, { ...to, duration: b - a, immediateRender: false }, a);
    }
    tl.progress(progress);
  }

  build();

  // Result and criteria cards rise a little as they enter (transform only, so no layout shift).
  for (const el of gsap.utils.toArray('.results .card, .criterion')) {
    gsap.fromTo(el, { y: 36 }, { y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 65%', scrub: true } });
  }

  let t = 0;
  const rebuild = () => { clearTimeout(t); t = setTimeout(() => { build(); ScrollTrigger.refresh(); }, 150); };
  window.addEventListener('resize', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  window.addEventListener('load', rebuild);
}
