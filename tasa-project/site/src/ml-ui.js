/**
 * Interactive UI Controller for the Machine Learning Discovery Lab.
 */

import { checkApiHealth, predictExoplanet, PRESETS, getSampleKois } from './ml-client.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function initMlLab() {
  const form = $('#ml-form');
  if (!form) return;

  const presetsContainer = $('#ml-presets');
  const serverStatus = $('#ml-server-status');
  const serverDot = $('#ml-server-dot');
  const probabilityBar = $('#ml-prob-bar');
  const probabilityVal = $('#ml-prob-val');
  const verdictBadge = $('#ml-verdict-badge');
  const verdictDesc = $('#ml-verdict-desc');
  const categoriesList = $('#ml-categories');
  const insightsList = $('#ml-insights');
  const featuresList = $('#ml-features-summary');
  const submitBtn = $('#ml-submit-btn');

  // Pair number inputs and sliders
  const pairs = [
    { num: '#ml-snr', range: '#ml-snr-range' },
    { num: '#ml-prad', range: '#ml-prad-range' },
    { num: '#ml-period', range: '#ml-period-range' },
    { num: '#ml-duration', range: '#ml-duration-range' },
    { num: '#ml-depth', range: '#ml-depth-range' },
    { num: '#ml-steff', range: '#ml-steff-range' },
  ];

  pairs.forEach(({ num, range }) => {
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

  // Render Preset buttons
  if (presetsContainer) {
    presetsContainer.replaceChildren(...PRESETS.map((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = p.name;
      btn.title = p.badge;
      btn.addEventListener('click', () => {
        applyFeatures(p.features);
        runPrediction();
      });
      return btn;
    }));
  }

  // Populate form with features
  function applyFeatures(f) {
    if (f.koi_model_snr !== undefined) {
      $('#ml-snr').value = f.koi_model_snr;
      $('#ml-snr-range').value = f.koi_model_snr;
    }
    if (f.koi_prad !== undefined) {
      $('#ml-prad').value = f.koi_prad;
      $('#ml-prad-range').value = f.koi_prad;
    }
    if (f.koi_period !== undefined) {
      $('#ml-period').value = f.koi_period;
      $('#ml-period-range').value = f.koi_period;
    }
    if (f.koi_duration !== undefined) {
      $('#ml-duration').value = f.koi_duration;
      $('#ml-duration-range').value = f.koi_duration;
    }
    if (f.koi_depth !== undefined) {
      $('#ml-depth').value = f.koi_depth;
      $('#ml-depth-range').value = f.koi_depth;
    }
    if (f.koi_steff !== undefined) {
      $('#ml-steff').value = f.koi_steff;
      $('#ml-steff-range').value = f.koi_steff;
    }
  }

  // Collect features from form
  function getFormData() {
    return {
      koi_model_snr: parseFloat($('#ml-snr').value) || 20.0,
      koi_prad: parseFloat($('#ml-prad').value) || 1.2,
      koi_period: parseFloat($('#ml-period').value) || 15.0,
      koi_duration: parseFloat($('#ml-duration').value) || 3.5,
      koi_depth: parseFloat($('#ml-depth').value) || 500,
      koi_steff: parseFloat($('#ml-steff').value) || 5500,
      koi_srad: 1.0,
      koi_slogg: 4.4,
      koi_kepmag: 14.0
    };
  }

  // Run prediction
  async function runPrediction() {
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    const features = getFormData();
    const result = await predictExoplanet(features);

    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');

    // Update Result UI
    const probPct = (result.probability * 100).toFixed(1);
    if (probabilityBar) {
      probabilityBar.style.width = `${probPct}%`;
      probabilityBar.style.backgroundColor = result.color;
    }
    if (probabilityVal) {
      probabilityVal.textContent = `${probPct}%`;
      probabilityVal.style.color = result.color;
    }

    if (verdictBadge) {
      verdictBadge.textContent = result.verdict_badge;
      verdictBadge.style.color = result.color;
      verdictBadge.style.borderColor = result.color;
    }

    if (verdictDesc) {
      verdictDesc.textContent = result.is_exoplanet
        ? `The Gradient Boosting model classifies this transit signal as a CONFIRMED EXOPLANET with ${result.confidence_pct} model confidence.`
        : `The model flags this signal as a FALSE POSITIVE (e.g. eclipsing binary or noise artifact) with ${result.confidence_pct} confidence.`;
    }

    // Update category pills
    if (categoriesList && result.categories) {
      const cats = result.categories;
      const pills = [
        `Orbit: ${cats.type_orbite || '—'}`,
        `Planet: ${(cats.type_planete || '—').replace('_', ' ')}`,
        `Star: ${cats.type_etoile || '—'}`,
        `Luminosity: ${cats.luminosite || '—'}`
      ];
      categoriesList.replaceChildren(...pills.map((label) => {
        const span = document.createElement('span');
        span.className = 'pill-cat glass';
        span.textContent = label;
        return span;
      }));
    }

    // Update AI Insights
    if (insightsList && result.key_insights) {
      insightsList.replaceChildren(...result.key_insights.map((insight) => {
        const li = document.createElement('li');
        li.textContent = insight;
        return li;
      }));
    }

    // Update top features summary
    if (featuresList && result.top_features) {
      featuresList.replaceChildren(...result.top_features.map((f) => {
        const item = document.createElement('div');
        item.className = 'ml-feat-item';
        const k = document.createElement('span');
        k.className = 'label';
        k.textContent = f.name;
        const v = document.createElement('strong');
        v.textContent = f.value;
        item.append(k, v);
        return item;
      }));
    }
  }

  // Health check
  async function refreshHealth() {
    const health = await checkApiHealth();
    if (health.status === 'healthy') {
      if (serverStatus) serverStatus.textContent = 'FastAPI: Online (Port 8000)';
      if (serverDot) serverDot.style.backgroundColor = 'var(--sage)';
    } else {
      if (serverStatus) serverStatus.textContent = 'FastAPI: Standby (Fallback ready)';
      if (serverDot) serverDot.style.backgroundColor = 'var(--amber)';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runPrediction();
  });

  // Initial setup
  applyFeatures(PRESETS[0].features);
  runPrediction();
  refreshHealth();
  setInterval(refreshHealth, 15000);
}
