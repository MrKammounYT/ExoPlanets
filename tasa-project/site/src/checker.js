// Checker logic, ported from design/Main.dc.html and docs/03-checker-logic-and-data.md.
// Pure functions only, so they can be tested in Node without a browser.

export const SAGE = '#b9dba9';
export const AMBER = '#e8b97a';
export const MUTED = '#99a3b1';

export const CHECK_LABELS = [
  'Orbits a star other than the Sun',
  'Under the 13 Jupiter-mass limit',
  'Signal from a detection method',
  'Confirmed in the archive'
];

const ICONS = {
  pass: { d: 'M5 12.5l4.5 4.5L19 7.5', color: SAGE, word: 'Passed' },
  fail: { d: 'M7 7l10 10M17 7L7 17', color: AMBER, word: 'Failed' },
  pending: { d: 'M7 12h10', color: MUTED, word: 'Not checked' }
};

const CAPTIONS = {
  transit: 'Brightness dips each time the planet crosses its star.',
  rv: 'The star’s speed wobbles toward and away from us as the planet pulls on it.',
  lensing: 'A brief spike in a background star’s light reveals the planet’s gravity.',
  none: 'No exoplanet signal to show for this object.'
};

// catalog.json writes "x" for multiplication and ">=" for "at least"; the page shows the real symbols.
export function display(s) {
  return String(s ?? '')
    .replace(/>=\s?/g, '≥ ')
    .replace(/(\d)\s+x\s+/g, '$1 × ')
    .replace(/^~(\d)/, '≈ $1')
    .replace(/^-$/, '—');
}

export function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function find(objects, q) {
  const n = norm(q);
  if (!n) return null;
  return objects.find((e) => norm(e.name) === n || (e.aliases || []).some((a) => norm(a) === n)) || null;
}

export function signalPath(kind) {
  const pts = (f) => {
    let d = '';
    for (let x = 0; x <= 260; x += 4) d += (x === 0 ? 'M' : 'L') + x + ' ' + f(x).toFixed(1) + ' ';
    return d.trim();
  };
  if (kind === 'transit') return 'M0 34 H62 C69 34 69 90 78 90 H100 C109 90 109 34 116 34 H168 C175 34 175 90 184 90 H206 C215 90 215 34 222 34 H260';
  if (kind === 'rv') return pts((x) => 60 - 34 * Math.sin((x / 260) * Math.PI * 4));
  if (kind === 'lensing') return pts((x) => 100 - 70 * Math.exp(-Math.pow((x - 110) / 38, 2)) - 24 * Math.exp(-Math.pow((x - 172) / 9, 2)));
  return 'M0 60 H260';
}

// Everything the page shows for one state. entry = catalog object, or null for "not found".
export function buildView(entry, missedText = '', total = 14) {
  if (!entry) {
    const q = String(missedText || '').trim();
    return {
      found: false,
      name: q || 'No object',
      distanceLabel: 'Distance unknown',
      tone: MUTED,
      title: 'Not in the demo catalog',
      tag: 'Exoplanet: unknown',
      line: q
        ? `TASA can’t confirm or rule out “${q}” here. The demo holds ${total} objects; pick one from the catalog below.`
        : 'Type an object name above, or pick one from the catalog below.',
      orbitOpacity: 0.25,
      orbitLabel: 'No object selected',
      facts: ['Host star', 'Discovered', 'Distance', 'Size', 'Orbit'].map((k) => ({ k, v: '—' })),
      methodLabel: 'No data',
      signalPath: signalPath('none'),
      signalCaption: 'Run a check on a catalog object to see its signal.',
      signalAlt: 'Flat line, no signal',
      passCount: 'Not run',
      checks: CHECK_LABELS.map((label) => ({ label, detail: 'Not checked', ...ICONS.pending }))
    };
  }

  const exo = entry.kind === 'exo';
  const passes = entry.checks.filter((c) => c.result === 'pass').length;
  return {
    found: true,
    name: entry.name,
    distanceLabel: entry.kind === 'solar' ? 'In our solar system' : 'Distance ' + entry.distance,
    tone: exo ? SAGE : AMBER,
    title: exo ? 'Confirmed exoplanet' : 'Not an exoplanet',
    tag: exo ? 'Exoplanet: yes' : 'Exoplanet: no',
    line: entry.line,
    orbitOpacity: entry.kind === 'star' ? 0 : 1,
    orbitLabel: entry.kind === 'star' ? entry.name + ', a star' : entry.name + ' orbiting ' + (entry.kind === 'solar' ? 'the Sun' : entry.host),
    facts: [
      { k: 'Host star', v: display(entry.host) },
      { k: 'Discovered', v: display(entry.discovered) },
      { k: 'Distance', v: display(entry.distance) },
      { k: 'Size', v: display(entry.size) },
      { k: 'Orbit', v: display(entry.orbit_period) }
    ],
    methodLabel: entry.method_label,
    signalPath: signalPath(entry.method),
    signalCaption: CAPTIONS[entry.method] || CAPTIONS.none,
    signalAlt: exo ? entry.method_label + ' signal for ' + entry.name : 'Flat line, no exoplanet signal',
    passCount: passes + ' of 4 passed',
    checks: entry.checks.map((c, i) => ({ label: CHECK_LABELS[i], detail: c.detail, ...(ICONS[c.result] || ICONS.pending) }))
  };
}
