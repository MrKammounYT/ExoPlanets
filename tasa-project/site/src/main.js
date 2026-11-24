import { PRESETS, predictExoplanet, checkApiHealth } from './ml-client.js';
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

function applyFeatures(f, name = 'Observation Signal') {
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
  $('#depth-disp').textContent = Math.round(depth).toLocaleString();
}

async function runClassification() {
  const checkBtn = $('#check-btn');
  if (checkBtn) {
    checkBtn.disabled = true;
    checkBtn.style.opacity = '0.7';
  }

  const features = getFormFeatures();
  const res = await predictExoplanet(features);

  if (checkBtn) {
    checkBtn.disabled = false;
    checkBtn.style.opacity = '1';
  }

  const tone = res.color;
  const probPct = (res.probability * 100).toFixed(1);

  // 1. Update Target Pill on 3D Planet
  $('#target-prob').textContent = `${probPct}% Exoplanet Probability`;
  $('#target-badge').textContent = res.verdict_badge;
  $('#target-badge').style.color = tone;
  $('#target-dot').style.backgroundColor = tone;
  $('#target-pill').style.color = tone;

  // 2. Update Verdict Card
  $('#verdict-tag').textContent = res.verdict_badge;
  $('#verdict-tag').style.color = tone;
  $('#prob-value').textContent = `${probPct}%`;
  $('#prob-value').style.color = tone;
  $('#prob-bar').style.width = `${probPct}%`;
  $('#prob-bar').style.backgroundColor = tone;

  $('#verdict-title').textContent = res.verdict_badge;
  $('#verdict-title').style.color = tone;
  $('#verdict-desc').textContent = res.is_exoplanet
    ? `The Gradient Boosting model confirms this signal as a genuine exoplanet with ${res.confidence_pct} model confidence.`
    : `The model flags this signal as a FALSE POSITIVE (${res.confidence_pct} confidence), consistent with an eclipsing binary or noise artifact.`;

  // 3. Draw light curve
  drawTransitCurve(features.koi_duration, features.koi_depth, res.is_exoplanet);
  $('#signal-caption').textContent = res.is_exoplanet
    ? `Periodic brightness dip of ${Math.round(features.koi_depth).toLocaleString()} ppm consistent with planetary transit.`
    : `Anomalous transit profile: depth of ${Math.round(features.koi_depth).toLocaleString()} ppm and SNR of ${features.koi_model_snr} indicates stellar binary or false signal.`;

  // 4. Update Astronomical Profile
  if (res.categories) {
    $('#cat-planet').textContent = `${res.categories.type_planete.replace('_', ' ')} (${features.koi_prad.toFixed(2)} R⊕)`;
    $('#cat-orbit').textContent = `${res.categories.type_orbite} (${features.koi_period.toFixed(1)} d)`;
    $('#cat-star').textContent = `${res.categories.type_etoile} (${Math.round(features.koi_steff).toLocaleString()} K)`;
    $('#cat-lum').textContent = `${res.categories.luminosite} (14.0 mag)`;
    $('#disp-snr').textContent = features.koi_model_snr.toFixed(1);
  }

  // 5. Update Insights
  if (res.key_insights) {
    $('#insights-list').replaceChildren(...res.key_insights.map((msg) => {
      const li = document.createElement('li');
      li.textContent = msg;
      return li;
    }));
  }

  // 6. Tint 3D Planet
  tintPlanet(tone);
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
      runClassification();
    });
    return btn;
  }));
}

async function refreshHealth() {
  const health = await checkApiHealth();
  const dot = $('#server-dot');
  const status = $('#server-status');
  if (health.status === 'healthy') {
    if (dot) dot.style.backgroundColor = SAGE;
    if (status) status.textContent = 'ML Engine: FastAPI Connected (Port 8000)';
  } else {
    if (dot) dot.style.backgroundColor = AMBER;
    if (status) status.textContent = 'ML Engine: Offline Fallback Ready';
  }
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
  $('#target-name').textContent = 'Custom Observation';
  runClassification();
});

for (const btn of $$('[data-focus-input]')) {
  btn.addEventListener('click', () => {
    setTimeout(() => $('#f-snr')?.focus(), 50);
  });
}

// Initial classification run with default preset
applyFeatures(PRESETS[0].features, PRESETS[0].name);
runClassification();
refreshHealth();
setInterval(refreshHealth, 15000);

startPlanet();
