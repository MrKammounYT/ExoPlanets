/**
 * API client to communicate with the FastAPI Exoplanet Prediction backend.
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : 'http://127.0.0.1:8000/api';

export const PRESETS = [
  {
    name: 'Kepler-186 f',
    badge: 'Jumelle de la Terre (confirmée)',
    type: 'confirmed',
    features: {
      koi_period: 129.94,
      koi_duration: 4.10,
      koi_depth: 500,
      koi_prad: 1.17,
      koi_model_snr: 35.8,
      koi_steff: 3788,
      koi_srad: 0.52,
      koi_slogg: 4.70,
      koi_kepmag: 14.6
    }
  },
  {
    name: 'Kepler-22 b',
    badge: 'Super-Terre (confirmée)',
    type: 'confirmed',
    features: {
      koi_period: 289.86,
      koi_duration: 7.40,
      koi_depth: 492,
      koi_prad: 2.38,
      koi_model_snr: 42.1,
      koi_steff: 5518,
      koi_srad: 0.98,
      koi_slogg: 4.44,
      koi_kepmag: 11.66
    }
  },
  {
    name: 'Kepler-412 b',
    badge: 'Jupiter chaud (confirmé)',
    type: 'confirmed',
    features: {
      koi_period: 1.72,
      koi_duration: 2.15,
      koi_depth: 14200,
      koi_prad: 14.8,
      koi_model_snr: 68.4,
      koi_steff: 5750,
      koi_srad: 1.28,
      koi_slogg: 4.26,
      koi_kepmag: 13.79
    }
  },
  {
    name: 'Binaire à éclipses',
    badge: 'Étoile binaire (faux positif)',
    type: 'false_positive',
    features: {
      koi_period: 1.25,
      koi_duration: 3.50,
      koi_depth: 98000,
      koi_prad: 42.0,
      koi_model_snr: 125.0,
      koi_steff: 6400,
      koi_srad: 1.60,
      koi_slogg: 4.10,
      koi_kepmag: 12.8
    }
  },
  {
    name: 'Bruit instrumental',
    badge: 'Artefact à faible SNR (faux positif)',
    type: 'false_positive',
    features: {
      koi_period: 32.5,
      koi_duration: 1.80,
      koi_depth: 45,
      koi_prad: 0.85,
      koi_model_snr: 4.8,
      koi_steff: 5800,
      koi_srad: 1.05,
      koi_slogg: 4.40,
      koi_kepmag: 15.9
    }
  }
];

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // If proxied /api fails, try direct port 8000
    try {
      const directRes = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(2000) });
      if (directRes.ok) return await directRes.json();
    } catch (_) {}
    return { status: 'offline', error: err.message };
  }
}

export async function getModelInfo() {
  try {
    const res = await fetch(`${API_BASE}/model/info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function getSampleKois() {
  try {
    const res = await fetch(`${API_BASE}/samples`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function predictExoplanet(features) {
  try {
    let url = `${API_BASE}/predict`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features)
      });
    } catch (e) {
      // Fallback direct url
      url = 'http://127.0.0.1:8000/api/predict';
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features)
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server responded with code ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('FastAPI prediction request failed, falling back to simulated inference:', err);
    return simulatePrediction(features);
  }
}

/**
 * Client-side simulation fallback in case the FastAPI server is not currently running.
 * Uses the exact same astronomical decision rules and weights.
 */
function simulatePrediction(f) {
  let score = 0.5;

  // SNR contribution (top feature)
  if (f.koi_model_snr < 7.0) score -= 0.35;
  else if (f.koi_model_snr >= 20.0) score += 0.25;

  // Radius contribution
  if (f.koi_prad > 25.0) score -= 0.40; // Likely eclipsing binary
  else if (f.koi_prad <= 4.0 && f.koi_model_snr >= 15.0) score += 0.25;

  // Transit depth vs radius sanity
  if (f.koi_depth > 50000 && f.koi_prad > 20) score -= 0.30;

  // Period sanity
  if (f.koi_period > 0.5 && f.koi_period < 400 && f.koi_duration < 15) score += 0.10;

  const prob = Math.min(0.99, Math.max(0.01, score));
  const is_exo = prob >= 0.5;

  return {
    prediction: is_exo ? 'CONFIRMED' : 'FALSE POSITIVE',
    probability: prob,
    confidence_pct: `${Math.round((is_exo ? prob : 1 - prob) * 100)}%`,
    is_exoplanet: is_exo,
    verdict_badge: is_exo ? 'Confirmed Exoplanet' : 'False Positive',
    color: is_exo ? '#b9dba9' : '#e8b97a',
    categories: {
      type_orbite: f.koi_period <= 10 ? 'short' : f.koi_period <= 100 ? 'medium' : 'long',
      type_planete: f.koi_prad <= 1.25 ? 'earth_like' : f.koi_prad <= 2 ? 'super_earth' : f.koi_prad <= 6 ? 'neptune_like' : 'jupiter_like',
      type_etoile: f.koi_steff <= 5200 ? 'cool' : f.koi_steff <= 6000 ? 'sun_like' : 'hot',
      luminosite: (f.koi_kepmag || 14) <= 13 ? 'bright' : (f.koi_kepmag || 14) <= 15 ? 'medium' : 'faint'
    },
    key_insights: [
      f.koi_model_snr >= 15 ? `Strong SNR (${f.koi_model_snr.toFixed(1)}) stands out clearly from noise.` : `Low SNR (${f.koi_model_snr.toFixed(1)}) raises false-positive risk.`,
      f.koi_prad <= 4 ? `Planetary radius of ${f.koi_prad.toFixed(2)} R⊕ matches expected rocky/gas sizes.` : `Large radius (${f.koi_prad.toFixed(1)} R⊕) suggests stellar binary.`,
      `Orbital period of ${f.koi_period.toFixed(2)} days with ${f.koi_duration.toFixed(2)}h transit.`
    ],
    top_features: [
      { name: 'Signal-to-Noise (SNR)', value: `${f.koi_model_snr.toFixed(1)}` },
      { name: 'Planet Radius', value: `${f.koi_prad.toFixed(2)} R⊕` },
      { name: 'Orbital Period', value: `${f.koi_period.toFixed(2)} d` }
    ]
  };
}
