import { test } from 'node:test';
import assert from 'node:assert/strict';
import { competitionShare, num, policyTier, policyVerdict, pressureState, sensitivityOrder, supportChecks } from '../src/analytics.mjs';

const ref = { median: 1.5, upper: 4, mean: 175, objective: 190, n: 120 };
const chase = { innings: 2, S: 168, W: 3, L: 114, target: 180, prior12: 0 };

test('Frozen V2 chase distinguishes attainable urgency, implausible demand, and fragility', () => {
  assert.equal(pressureState(chase, ref).batting, 'Pressure');
  const impossible = pressureState({ ...chase, S: 120 }, ref);
  assert.equal(impossible.bowling, 'Ordinary');
  assert.equal(impossible.gates.attainable, false);
  assert.equal(pressureState({ ...chase, S: 178, W: 9, L: 96 }, ref).bowling, 'Pressure');
  assert.equal(pressureState({ ...chase, S: 178, W: 3, L: 96 }, ref).bowling, 'Ordinary');
});

test('Frozen V2 uses different first-innings rules and preserves unsupported scope', () => {
  const first = { innings: 1, S: 45, W: 4, L: 36, target: null };
  assert.equal(pressureState(first, ref).batting, 'Pressure');
  assert.equal(pressureState(first, ref).bowling, 'Ordinary');
  assert.equal(pressureState({ ...first, S: 190, L: 100 }, ref).bowling, 'Ordinary');
  assert.equal(pressureState(chase, null).bowling, 'Unsupported');
  assert.equal(pressureState({ ...chase, L: 120 }, ref).batting, 'Unsupported');
  assert.equal(pressureState({ ...chase, target: null }, ref).bowling, 'Unsupported');
});

const example = {
  pid: 12, p_pressure_shrunk: '12.4', p_best_removed_pressure_quality: '5',
  p_consistency_matches: '6', p_consistency_positive_frequency: '.5', s_pressure_shrunk: '2',
  p_pressure_n: '70', p_ordinary_n: '130', s_pressure_n: '80', s_ordinary_n: '132',
  p_pressure_matches: '11', p_ordinary_matches: '12', s_pressure_matches: '11', s_ordinary_matches: '12',
};

test('D.1 gating covers both states and components using attempts and independent matches', () => {
  assert.equal(supportChecks(example, 'batting').filter(check => check.pass).length, 8);
  const a = { ...example, s_ordinary_matches: '9' };
  assert.deepEqual(supportChecks(a, 'batting').filter(check => !check.pass), [
    { prefix: 's', state: 'ordinary', metric: 'matches', value: 9, minimum: 10, pass: false },
  ]);
  assert.ok(supportChecks(a, 'bowling').every(check => check.pass));
  assert.equal(sensitivityOrder([example], 'batting', { ordinary: 131 }).length, 0);
});

test('Eligibility sensitivity orders by tier, rounded pressure, secondary and numeric ID', () => {
  const other = { ...example, pid: 13, p_pressure_shrunk: '12.40000000001' };
  const higherSecondary = { ...example, pid: 17, s_pressure_shrunk: '3' };
  const lowerTier = { ...example, pid: 1, p_pressure_shrunk: 99, p_consistency_matches: 4 };
  assert.equal(policyTier(lowerTier), 2);
  assert.deepEqual(sensitivityOrder([other, lowerTier, example, higherSecondary], 'batting').map(row => row.pid), [17, 12, 13, 1]);
});

test('Missing rates and unobserved competition support retain an unavailable state', () => {
  assert.equal(num(null), null);
  assert.equal(num(''), null);
  assert.equal(num('0'), 0);
  assert.equal(competitionShare({ IPL_p_pressure_n: null, T20I_p_pressure_n: null }), null);
  assert.equal(competitionShare({ IPL_p_pressure_n: null, T20I_p_pressure_n: '10' }), 0);
  assert.equal(policyVerdict({ low: '', high: '' }), 'Insufficient interval evidence');
  assert.equal(policyVerdict({ low: '-11', high: '0' }), 'Inconclusive');
});
