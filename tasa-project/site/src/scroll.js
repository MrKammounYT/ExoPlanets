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

  const stage = document.querySelector('.stage');
  const method = document.querySelector('#method');
  const ctaImg = document.querySelector('.cta > img');

  // Top / Analyzer: centred in the .stage grid cell, left of the prediction badge.
  // Moons orbit at ~1.32 r, so r is kept small enough for them to stay inside the cell.
  const sr = stage ? stage.getBoundingClientRect() : { left: vw * 0.6, width: vw * 0.3, height: 320 };
  const sTop = stage ? docTop(stage) : 120;
  const heroR = Math.min(sr.height * 0.36, sr.width * 0.3);
  const hero = {
    x: sr.left + sr.width * (sr.width > 500 ? 0.4 : 0.42),
    // On phones the badge spans most of the cell's width, so lift the planet above it.
    y: sTop + sr.height * (sr.width < 520 ? 0.34 : 0.42),
    r: heroR, opacity: 1, moons: 1, graze: 0, spinBoost: 1, turn: 0
  };

  // The planet scrolls up with the content (linear, so it stays pinned to the stage)
  // and has left the viewport before the input panel reaches it.
  const exitAt = Math.max(1, Math.min(hero.y + heroR * 1.5, maxScroll * 0.4));
  const exit = { ...hero, y: hero.y - exitAt, opacity: 0, turn: 0.6, ease: 'none' };

  // Closing call to action: the planet takes the place of the moon image, with its moons back.
  const ir = ctaImg ? ctaImg.getBoundingClientRect() : { width: 140, left: vw * 0.7 };
  const end = {
    x: ir.left + ir.width / 2,
    y: (ctaImg ? docTop(ctaImg) : maxScroll) - maxScroll + (ir.width ? ir.width * 0.46 : 70),
    r: Math.max(44, (ir.width ? ir.width * 0.46 : 65)),
    opacity: 1, moons: 1, graze: 0, spinBoost: 1, turn: 3.2
  };

  // What counts: pushed in close behind the section, low sun from the side so the relief shows.
  const methodAt = method ? docTop(method) - vh * 0.15 : maxScroll * 0.75;
  const backdrop = { x: vw * (narrow ? 0.5 : 0.06), y: vh * 0.62, r: narrow ? vw * 0.62 : vh * 0.54, opacity: narrow ? 0.16 : 0.2, moons: 0, graze: 1, spinBoost: 0.6, turn: 2.2 };

  const frames = [
    { at: 0, ...hero },
    { at: exitAt, ...exit },
    // Hidden over the inputs and result cards; it moves into place while invisible.
    { at: methodAt - vh * 0.35, ...backdrop, opacity: 0 },
    { at: methodAt, ...backdrop },
    { at: maxScroll, ...end }
  ];

  for (let i = 1; i < frames.length; i++) frames[i].at = Math.max(frames[i].at, frames[i - 1].at + 1);
  return { frames, maxScroll };
}

export function initScroll(api) {
  const state = api.state;
  let tl = null;

  function build() {
    const progress = tl ? tl.scrollTrigger.progress : 0;
    if (tl) { tl.scrollTrigger.kill(); tl.kill(); }
    const { frames, maxScroll } = keyframes();
    const { at: _a, ease: _e, ...first } = frames[0];
    Object.assign(state, first);

    const lastAt = frames[frames.length - 1].at;
    tl = gsap.timeline({
      defaults: { ease: 'sine.inOut' },
      // Short scrub: a long one makes the planet lag behind the content it is pinned to.
      scrollTrigger: { start: 0, end: Math.max(maxScroll, lastAt), scrub: 0.2 }
    });
    for (let i = 0; i < frames.length - 1; i++) {
      const { at: a, ease: _e, ...from } = frames[i];
      const { at: b, ease = 'sine.inOut', ...to } = frames[i + 1];
      tl.fromTo(state, from, { ...to, ease, duration: b - a, immediateRender: false }, a);
    }
    tl.progress(progress);
  }

  build();

  // Criteria cards rise a little as they enter (transform only, so no layout shift).
  for (const el of gsap.utils.toArray('.criterion')) {
    gsap.fromTo(el, { y: 36 }, { y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 65%', scrub: true } });
  }

  let t = 0;
  const rebuild = () => { clearTimeout(t); t = setTimeout(() => { build(); ScrollTrigger.refresh(); }, 150); };
  window.addEventListener('resize', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  window.addEventListener('load', rebuild);
}
