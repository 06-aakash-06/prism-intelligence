import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';
import { parse } from 'csv-parse/sync';
import { createApi } from '../server/api.mjs';
import { researchRoot } from '../scripts/storage.mjs';
import { sources } from '../scripts/sources.mjs';
import { num, pressureState, sensitivityOrder } from '../src/analytics.mjs';

let server;
let close;

before(async () => {
  const api = createApi();
  close = api.close;
  const app = express();
  app.use('/api', api.api);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  close?.();
});

async function request(path, status = 200) {
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + path);
  assert.equal(response.status, status, path);
  return response.json();
}

test('API dashboard and candidate packets match canonical ranks and exact source scores', async () => {
  const snapshot = await request('/snapshot');
  assert.deepEqual([snapshot.kpis.matches, snapshot.kpis.deliveries, snapshot.kpis.players, snapshot.kpis.preScore, snapshot.kpis.chase],
    [883, 200999, 1217, 194776, 92436]);
  for (const [discipline, expectedCount] of [['batting', 103], ['bowling', 80]]) {
    const file = resolve(researchRoot, sources[discipline + 'Final'][0]);
    const official = parse(await readFile(file, 'utf8'), { columns: true }).sort((a, b) => Number(a.rank) - Number(b.rank));
    const displayed = snapshot.finalists[discipline];
    assert.deepEqual(displayed.map(row => [row.rank, row.pid, row.player_name, row.p_pressure_shrunk, row.p_pressure_quality]),
      official.map(row => [Number(row.rank), Number(row.official_player_id), row.official_name, row.p_pressure_shrunk, row.p_pressure_quality]));
    const pool = await request('/research/' + discipline);
    assert.equal(pool.length, 1217);
    assert.equal(new Set(pool.map(row => row.pid)).size, 1217);
    assert.equal(snapshot.rankings[discipline].length, expectedCount);
    assert.deepEqual(sensitivityOrder(pool, discipline).map(row => row.pid), snapshot.rankings[discipline].map(row => row.pid));
    if (discipline === 'batting') {
      const stricter = sensitivityOrder(pool, discipline, { ordinary: 120 }).slice(0, 10);
      assert.ok(!stricter.some(row => row.pid === 2417) && stricter.some(row => row.pid === 6059));
    }
  }
});

test('Profile, player match evidence and pressure source rows link by official numeric IDs', async () => {
  const player = await request('/player/2933');
  assert.equal(player.player.name, 'Jasprit Bumrah');
  assert.equal(player.disciplines.bowling.rank, 1);
  const matches = await request('/player/2933/matches?component=bowling_runs_prevented');
  const first = matches.find(row => row.state === 'pressure');
  assert.ok(first.source_rows.includes(Number(first.first_source_row)));
  const delivery = await request('/delivery/' + first.first_source_row);
  assert.equal(delivery.match_id, Number(first.match_id));
  assert.equal(delivery.bowl, 'pressure');
  assert.ok(delivery.events.some(row => Number(row.pid) === 2933 && row.component === 'bowling_runs_prevented'));
  await request('/player/999999999', 404);
});

test('Delivery pagination, exact residual provenance, and historical pressure references agree', async () => {
  const page = await request('/events?match=20202&player=1318&component=batting_runs');
  assert.ok(page.rows.length > 0 && page.rows.length <= 25);
  await request('/events', 400);
  const fixture = await request('/match/20202?player=1318');
  const delivery = await request('/delivery/51236');
  const event = delivery.events.find(row => row.component === 'batting_runs');
  assert.equal(Number(event.pid), 1318);
  assert.equal(num(event.Y), 4);
  assert.ok(Math.abs(num(event.Y) - num(event.expected) - num(event.residual)) < 1e-12);
  assert.ok(fixture.timeline.some(row => row.row === 51236));
  const { reference } = await request('/pressure?domain=IPL&date=' + fixture.match.match_date);
  const state = delivery.payload;
  const match = pressureState({ innings: delivery.innings, S: num(state.runs_before_exact), W: num(state.wickets_before),
    L: num(state.legal_balls_before), target: num(state.target_before), prior12: num(delivery.label.prior12_wickets) },
  { ...reference.duration[num(state.balls_remaining)], mean: reference.mean, objective: reference.objective });
  assert.equal(match.batting.toLowerCase(), delivery.bat);
  assert.ok(reference.latest < fixture.match.match_date);
  const listings = await request('/matches?q=20202&player=1318&component=batting_runs&state=pressure');
  assert.equal(listings.rows[0].match_id, 20202);
});

test('Experimental policy results and the official reference remain separate', async () => {
  const { p3Counts, rankings, replays } = await request('/research/policies');
  assert.equal(p3Counts['Favors D.1'], 3);
  assert.equal(p3Counts['Favors P3'] || 0, 0);
  assert.equal(p3Counts.Inconclusive, 5);
  assert.equal(p3Counts['Insufficient interval evidence'], 8);
  const p0 = rankings.filter(row => row.policy === 'P0');
  assert.equal(p0.length, 183);
  assert.ok(replays.some(row => row.policy === 'P3' && row.evaluation_year === '2026'));
});

test('Walkthrough scenarios reconcile with the historical reference and frozen evidence', async () => {
  const { findStep, steps } = await import('../src/walkthrough/chapters.mjs');
  const demo = id => steps[findStep(id)].params;
  const { domain, date } = demo('readout');
  const [{ reference }, { examples }, batting, bowling] = await Promise.all([
    request('/pressure?' + new URLSearchParams({ domain, date })), request('/research/methods'),
    request('/research/batting'), request('/research/bowling'),
  ]);
  assert.ok(reference.latest < date);
  const labels = ['readout', 'ceiling'].map(id => pressureState(demo(id), {
    ...reference.duration[6], mean: reference.mean, objective: reference.objective,
  }));
  assert.deepEqual(labels.map(label => [label.batting, label.bowling, label.B, label.demand, label.pace]),
    [['Pressure', 'Pressure', 6, 12, 2], ['Ordinary', 'Ordinary', 6, 60, 10]]);
  assert.deepEqual([reference.duration[6].median, reference.duration[6].upper, labels[0].urgency].map(value => value.toFixed(2)),
    ['1.92', '4.62', '1.04']);

  const matchExample = examples.find(row => row.state === demo('ordinary-four').example);
  const original = await request('/delivery/' + demo('source-delivery').row);
  assert.equal(original.bat, matchExample.state);
  for (const row of examples) {
    assert.equal(Number(row.Y), 4);
    assert.ok(Math.abs(Number(row.Y) - Number(row.expected) - Number(row.residual)) < 1e-12);
  }
  const rates = (pool, id) => demo(id).ids.split(',').map(pid => pool.find(row => row.pid === Number(pid)))
    .map(row => [row.p_pressure_quality, row.p_pressure_shrunk].map(value => Number(value).toFixed(2)));
  assert.deepEqual(rates(batting, 'batting-reveal'), [['47.25', '31.36'], ['49.60', '18.24']]);
  assert.deepEqual(rates(bowling, 'bowling-reveal'), [['40.60', '19.91'], ['42.89', '11.87']]);
  const uplift = bowling.filter(row => demo('ordinary-baseline').ids.split(',').includes(String(row.pid)));
  assert.equal(uplift.length, 2);
  assert.ok(uplift.every(row => Number(row.p_pressure_quality) > 0 && Number(row.p_pressure_uplift) < 0));
  const coetzee = bowling.find(row => row.pid === 6628);
  assert.deepEqual([Number(coetzee.p_pressure_n), Number(coetzee.p_pressure_matches)], [55, 7]);
  const [mustafizur, henry] = demo('henry').ids.split(',').map(pid => bowling.find(row => row.pid === Number(pid)));
  assert.deepEqual([mustafizur.rank, henry.rank], [10, 11]);
  assert.equal((Number(mustafizur.p_pressure_shrunk) - Number(henry.p_pressure_shrunk)).toFixed(2), '0.24');
});
