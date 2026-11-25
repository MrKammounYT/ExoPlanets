import { PRESETS, predictExoplanet } from './ml-client.js';
import planetUrl from '../../assets/tasa-planet.png';
import moonUrl from '../../assets/tasa-moon.png';

// Populate 2D fallback images
const IMAGES = { planet: planetUrl, moon: moonUrl };
for (const img of document.querySelectorAll('img[data-img]')) img.src = IMAGES[img.dataset.img];

let planet = null; // 3D planet instance

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SAGE = '#b9dba9';
const AMBER = '#e8b97a';

// ---- French display text ----------------------------------------------------
// The backend (and the offline estimate) return English labels and sentences.
// All visible text is built here from the numbers, so the page stays French either way.
const num = (v, digits = 0) =>
  Number(v).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (p) => `${num(p * 100, 1)} %`;

const FR = {
  type_planete: { earth_like: 'Type Terre', super_earth: 'Super-Terre', neptune_like: 'Type Neptune', jupiter_like: 'Type Jupiter' },
  type_orbite: { short: 'Courte', medium: 'Moyenne', long: 'Longue' },
  type_etoile: { cool: 'Froide', sun_like: 'Type Soleil', hot: 'Chaude' },
  luminosite: { bright: 'Brillante', medium: 'Moyenne', faint: 'Faible' }
};
const frLabel = (group, key) => FR[group][key] ?? String(key ?? '—').replace(/_/g, ' ');
const verdictLabel = (isExo) => (isExo ? 'Exoplanète confirmée' : 'Faux positif');

// Same thresholds as generate_insights() in backend/main.py.
function insightsFr(f) {
  const out = [];
  const snr = num(f.koi_model_snr, 1);
  if (f.koi_model_snr >= 20) out.push(`Rapport signal/bruit élevé (SNR ${snr}), bien au-dessus du seuil de détection.`);
  else if (f.koi_model_snr >= 10) out.push(`Rapport signal/bruit modéré (SNR ${snr}) : le transit est net.`);
  else out.push(`Rapport signal/bruit faible (SNR ${snr}) : signal très sensible au bruit de fond.`);

  const r = num(f.koi_prad, 2);
  if (f.koi_prad <= 2) out.push(`Taille terrestre (${r} R⊕), compatible avec une planète rocheuse ou une super-Terre.`);
  else if (f.koi_prad <= 6) out.push(`Taille de mini-Neptune ou de Neptune (${r} R⊕), fréquente chez les exoplanètes.`);
  else if (f.koi_prad <= 15) out.push(`Rayon de géante gazeuse (${r} R⊕), comparable à Jupiter.`);
  else out.push(`Rayon inhabituellement grand (${num(f.koi_prad, 1)} R⊕), typique d’une binaire à éclipses.`);

  const d = num(f.koi_depth);
  if (f.koi_depth > 10000) out.push(`Transit profond (${d} ppm) : un creux aussi grand indique souvent une éclipse stellaire ou une planète géante.`);
  else out.push(`Une profondeur de transit de ${d} ppm correspond au passage d’une planète.`);

  // French uses the singular below 2 (« 1,25 jour »).
  const days = `${num(f.koi_period, 2)} ${f.koi_period < 2 ? 'jour' : 'jours'}`;
  if (f.koi_period < 1) out.push(`Période orbitale ultra-courte (${days}), orbite très serrée.`);
  else out.push(`Période orbitale de ${days}.`);
  return out;
}

// Two-way synchronization between number inputs and sliders
const inputPairs = [
  { num: '#f-snr', range: '#f-snr-range' },
  { num: '#f-prad', range: '#f-prad-range' },
  { num: '#f-period', range: '#f-period-range' },
  { num: '#f-duration', range: '#f-duration-range' },
  { num: '#f-depth', range: '#f-depth-range' },
  { num: '#f-steff', range: '#f-steff-range' },
];

function setupInputSync() {
  inputPairs.forEach(({ num, range }) => {
    const numEl = $(num);
    const rangeEl = $(range);
    if (!numEl || !rangeEl) return;

    numEl.addEventListener('input', () => {
      rangeEl.value = numEl.value;
    });

    rangeEl.addEventListener('input', () => {
      numEl.value = rangeEl.value;
    });
  });
}

function applyFeatures(f, name = 'Signal observé') {
  if (f.koi_model_snr !== undefined) {
    $('#f-snr').value = f.koi_model_snr;
    $('#f-snr-range').value = f.koi_model_snr;
  }
  if (f.koi_prad !== undefined) {
    $('#f-prad').value = f.koi_prad;
    $('#f-prad-range').value = f.koi_prad;
  }
  if (f.koi_period !== undefined) {
    $('#f-period').value = f.koi_period;
    $('#f-period-range').value = f.koi_period;
  }
  if (f.koi_duration !== undefined) {
    $('#f-duration').value = f.koi_duration;
    $('#f-duration-range').value = f.koi_duration;
  }
  if (f.koi_depth !== undefined) {
    $('#f-depth').value = f.koi_depth;
    $('#f-depth-range').value = f.koi_depth;
  }
  if (f.koi_steff !== undefined) {
    $('#f-steff').value = f.koi_steff;
    $('#f-steff-range').value = f.koi_steff;
  }
  $('#target-name').textContent = name;
}

function getFormFeatures() {
  return {
    koi_model_snr: parseFloat($('#f-snr').value) || 20.0,
    koi_prad: parseFloat($('#f-prad').value) || 1.17,
    koi_period: parseFloat($('#f-period').value) || 129.9,
    koi_duration: parseFloat($('#f-duration').value) || 4.1,
    koi_depth: parseFloat($('#f-depth').value) || 500,
    koi_steff: parseFloat($('#f-steff').value) || 3788,
    koi_srad: 1.0,
    koi_slogg: 4.4,
    koi_kepmag: 14.0
  };
}

function drawTransitCurve(duration, depth, isExo) {
  const signalPath = $('#signal-path');
  if (!signalPath) return;

  const baselineY = 32;
  const cx = 130;
  
  // Normalized width (duration 0.5h to 24h -> 20px to 100px total width)
  const halfW = Math.max(16, Math.min(65, (duration / 12) * 45));
  
  // Normalized depth (depth 10 to 50000 ppm -> 15px to 65px dip)
  const dipDepth = Math.max(16, Math.min(65, Math.log10(Math.max(10, depth)) * 14));
  const bottomY = baselineY + dipDepth;

  const x1 = Math.max(10, cx - halfW - 25);
  const x2 = cx - halfW;
  const x3 = cx + halfW;
  const x4 = Math.min(250, cx + halfW + 25);

  let d = '';
  if (!isExo && depth > 30000) {
    // Eclipsing binary: sharp deep V-shape
    d = `M0 ${baselineY} H${x1} L${cx} ${bottomY + 12} L${x4} ${baselineY} H260`;
  } else if (!isExo && (parseFloat($('#f-snr').value) || 0) < 6.0) {
    // Noisy jittery line
    d = `M0 ${baselineY} Q30 ${baselineY - 5} 60 ${baselineY + 4} T120 ${baselineY - 6} T180 ${baselineY + 5} T260 ${baselineY}`;
  } else {
    // Planetary U-shaped box transit with rounded shoulders
    d = `M0 ${baselineY} H${x1} C${x2} ${baselineY} ${x2} ${bottomY} ${cx - halfW * 0.5} ${bottomY} H${cx + halfW * 0.5} C${x3} ${bottomY} ${x3} ${baselineY} ${x4} ${baselineY} H260`;
  }

  signalPath.setAttribute('d', d);
  signalPath.setAttribute('stroke', isExo ? SAGE : AMBER);
  $('#depth-disp').textContent = num(depth);
}

// ---- Run feedback: loading state, scroll to results, staggered reveal ----------
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_LOADING_MS = 650; // the offline estimate is instant; keep the loading state readable
let runId = 0;
let shownProb = 0; // probability currently displayed, the count-up starts from it

function setLoading(on) {
  const btn = $('#check-btn');
  const label = $('#check-btn span');
  btn.classList.toggle('is-loading', on);
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
  label.textContent = on ? 'Analyse en cours…' : 'Lancer la classification';
  $('#results').classList.toggle('is-computing', on);
  $('#results').setAttribute('aria-busy', String(on));
}

// Bring the verdict card into view when it is off screen (up on desktop, down on phones).
function scrollToResults() {
  const card = $('#results .card');
  const r = card.getBoundingClientRect();
  const visible = r.top >= 0 && r.top <= window.innerHeight * 0.55;
  if (!visible) $('#results').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function revealResults() {
  const results = $('#results');
  results.classList.remove('is-revealed');
  void results.offsetWidth; // restart the CSS animation
  results.classList.add('is-revealed');
}

// Probability counts from the value on screen to the new one.
function countProbability(to) {
  const el = $('#prob-value');
  const from = shownProb;
  shownProb = to;
  if (reducedMotion()) { el.textContent = pct(to); return; }
  const start = performance.now();
  const dur = 900;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = pct(from + (to - from) * eased);
    if (t < 1 && shownProb === to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function runClassification({ animate = false } = {}) {
  const id = ++runId;
  const features = getFormFeatures();
  let res;
  if (animate) {
    setLoading(true);
    scrollToResults();
    [res] = await Promise.all([predictExoplanet(features), wait(reducedMotion() ? 0 : MIN_LOADING_MS)]);
    if (id !== runId) return; // a newer run started; let it finish
    setLoading(false);
  } else {
    res = await predictExoplanet(features);
    if (id !== runId) return;
  }

  const tone = res.color;
  const isExo = res.is_exoplanet;
  const verdict = verdictLabel(isExo);
  const confidence = pct(isExo ? res.probability : 1 - res.probability);

  // 1. Update Target Pill on 3D Planet
  $('#target-prob').textContent = `Probabilité d’exoplanète : ${pct(res.probability)}`;
  $('#target-badge').textContent = verdict;
  $('#target-badge').style.color = tone;
  $('#target-dot').style.backgroundColor = tone;
  $('#target-pill').style.color = tone;

  // 2. Update Verdict Card
  $('#verdict-tag').textContent = verdict;
  $('#verdict-tag').style.color = tone;
  if (animate) countProbability(res.probability);
  else { shownProb = res.probability; $('#prob-value').textContent = pct(res.probability); }
  $('#prob-value').style.color = tone;
  $('#results').style.setProperty('--tone', tone);
  $('#prob-bar').style.width = `${(res.probability * 100).toFixed(1)}%`;
  $('#prob-bar').style.backgroundColor = tone;

  $('#verdict-title').textContent = verdict;
  $('#verdict-title').style.color = tone;
  $('#verdict-desc').textContent = isExo
    ? `Le modèle confirme ce signal comme une véritable exoplanète, avec une confiance de ${confidence}.`
    : `Le modèle classe ce signal comme un FAUX POSITIF (confiance de ${confidence}) : binaire à éclipses ou artefact de bruit.`;

  // 3. Draw light curve
  drawTransitCurve(features.koi_duration, features.koi_depth, isExo);
  $('#signal-caption').textContent = isExo
    ? `Baisse de luminosité périodique de ${num(features.koi_depth)} ppm, compatible avec le transit d’une planète.`
    : `Profil de transit anormal : une profondeur de ${num(features.koi_depth)} ppm et un SNR de ${num(features.koi_model_snr, 1)} indiquent une binaire stellaire ou un faux signal.`;

  // 4. Update Astronomical Profile
  if (res.categories) {
    const c = res.categories;
    $('#cat-planet').textContent = `${frLabel('type_planete', c.type_planete)} (${num(features.koi_prad, 2)} R⊕)`;
    $('#cat-orbit').textContent = `${frLabel('type_orbite', c.type_orbite)} (${num(features.koi_period, 1)} j)`;
    $('#cat-star').textContent = `${frLabel('type_etoile', c.type_etoile)} (${num(features.koi_steff)} K)`;
    $('#cat-lum').textContent = `${frLabel('luminosite', c.luminosite)} (${num(features.koi_kepmag, 1)} mag)`;
    $('#disp-snr').textContent = num(features.koi_model_snr, 1);
  }

  // 5. Update Insights
  $('#insights-list').replaceChildren(...insightsFr(features).map((msg) => {
    const li = document.createElement('li');
    li.textContent = msg;
    return li;
  }));

  // 6. Tint 3D Planet
  tintPlanet(tone);

  if (animate) revealResults();
}

function initPresets() {
  const container = $('#presets-chips');
  if (!container) return;

  container.replaceChildren(...PRESETS.map((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = p.name;
    btn.title = p.badge;
    btn.addEventListener('click', () => {
      applyFeatures(p.features, p.name);
      runClassification({ animate: true });
    });
    return btn;
  }));
}

// 3D Planet & GSAP Scroll initialization
async function startPlanet() {
  const host = $('#planet-3d');
  if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    const { canUseWebGL, mountPlanet } = await import('./planet3d.js');
    if (!canUseWebGL()) return;
    const api = await mountPlanet(host);
    const { initScroll } = await import('./scroll.js');
    initScroll(api);
    api.start();
    planet = api;
    document.documentElement.classList.add('has-3d');
  } catch (err) {
    console.warn('3D planet unavailable, showing static fallback.', err);
  }
}

async function tintPlanet(tone) {
  if (!planet) return;
  const { gsap } = await import('gsap');
  planet.setTint(tone);
  gsap.to(planet.state, { tint: 1, duration: 0.8, ease: 'sine.out', overwrite: 'auto' });
}

// Setup & initial run
setupInputSync();
initPresets();

$('#planet-form').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#target-name').textContent = 'Observation personnalisée';
  runClassification({ animate: true });
});

for (const btn of $$('[data-focus-input]')) {
  btn.addEventListener('click', () => {
    setTimeout(() => $('#f-snr')?.focus(), 50);
  });
}

// Initial classification run with default preset
applyFeatures(PRESETS[0].features, PRESETS[0].name);
runClassification();

startPlanet();
