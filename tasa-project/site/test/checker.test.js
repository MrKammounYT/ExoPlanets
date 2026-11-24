import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildView, display, find, norm } from '../src/checker.js';

const { objects } = JSON.parse(readFileSync(new URL('../../data/catalog.json', import.meta.url), 'utf8'));

test('normalizes names the way the spec says', () => {
  assert.equal(norm('Kepler-186 f'), 'kepler186f');
  assert.equal(norm('KEPLER 186F'), 'kepler186f');
});

test('matches names and aliases exactly', () => {
  assert.equal(find(objects, 'kepler186f').id, 'kepler-186-f');
  assert.equal(find(objects, 'Proxima b').id, 'proxima-b');
  assert.equal(find(objects, 'Proxima Centauri').id, 'proxima-star');
  assert.equal(find(objects, 'Dimidium').id, '51-peg-b');
  assert.equal(find(objects, ''), null);
  assert.equal(find(objects, 'Vulcan'), null);
});

test('verdicts follow the four checks', () => {
  for (const o of objects) {
    const allPass = o.checks.every((c) => c.result === 'pass');
    assert.equal(o.verdict, allPass ? 'Confirmed exoplanet' : 'Not an exoplanet', o.id);
    assert.equal(buildView(o).title, o.verdict, o.id);
    assert.equal(o.checks.length, 4, o.id);
  }
});

test('not-found state echoes the query and marks every check as not checked', () => {
  const v = buildView(null, 'Vulcan', objects.length);
  assert.equal(v.title, 'Not in the demo catalog');
  assert.match(v.line, /Vulcan/);
  assert.ok(v.checks.every((c) => c.word === 'Not checked'));
});

test('display strings use real symbols', () => {
  assert.equal(display('1.17 x Earth radius'), '1.17 × Earth radius');
  assert.equal(display('>= 1.06 x Earth mass'), '≥ 1.06 × Earth mass');
  assert.equal(display('-'), '—');
  assert.equal(display('1,800 ly'), '1,800 ly');
});

test('every object has a source or an explanation', () => {
  for (const o of objects) assert.ok(o.source || o.source_note, o.id);
});
