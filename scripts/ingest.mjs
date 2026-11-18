import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createGunzip } from 'node:zlib';
import { parse } from 'csv-parse';
import { components, num, policyTier, sensitivityOrder, truth, pressureState, policyVerdict } from '../src/analytics.mjs';
import { databasePath, dataDir, eventFields, labelFields, packRow, researchRoot, schemaVersion, stateFields } from './storage.mjs';
import { sources } from './sources.mjs';

const pathFor = key => resolve(researchRoot, sources[key][0]);
const json = async key => JSON.parse(await readFile(pathFor(key), 'utf8'));
function csvParser() {
  return parse({ columns: true, bom: true, skip_empty_lines: true, relax_quotes: true, max_record_size: 1_000_000 });
}
async function* csvFile(path) {
  const file = createReadStream(path);
  const input = path.endsWith('.gz') ? file.pipe(createGunzip()) : file;
  const parser = csvParser();
  file.on('error', error => parser.destroy(error));
  input.on('error', error => parser.destroy(error));
  yield* input.pipe(parser);
}
async function csv(key) {
  const records = [];
  for await (const row of csvFile(pathFor(key))) records.push(row);
  return records;
}
async function sha(path) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest('hex');
}
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] === '' ? null : (row[key] ?? null)]));
const rowsCompact = (rows, keys) => rows.map(row => pick(row, keys));
const candidateMetrics = Object.keys({
  pressure_n: 1, ordinary_n: 1, pressure_matches: 1, ordinary_matches: 1, pressure_effective_matches: 1,
  ordinary_effective_matches: 1, pressure_quality: 1, ordinary_quality: 1, pressure_uplift: 1, pressure_shrunk: 1,
  ordinary_shrunk: 1, uplift_shrunk: 1, pressure_low: 1, pressure_high: 1, ordinary_low: 1, ordinary_high: 1,
  uplift_low: 1, uplift_high: 1, consistency_matches: 1, consistency_positive_frequency: 1,
  consistency_materially_adverse_frequency: 1, best_match_id: 1, best_removed_pressure_quality: 1,
  pressure_variance: 1, pressure_shrinkage_weight: 1, pressure_exposure_hhi: 1,
});
const candidateKeys = ['pid', 'player_name', 'evidence_status', 'original_support_pass', 'original_gate_failure_reasons',
  'original_policy_rank', 'rank_status', 'tier', 'unrestricted_rank', 'matched_pressure_coverage',
  'matched_standardized_uplift', 'IPL_p_pressure_n', 'T20I_p_pressure_n', 'IPL_p_pressure_matches', 'T20I_p_pressure_matches',
  ...['p_', 's_'].flatMap(prefix => candidateMetrics.map(metric => prefix + metric))];

await mkdir(dataDir, { recursive: true });
const temporary = databasePath + '.' + process.pid + '.tmp';
const db = new DatabaseSync(temporary);
try {
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA user_version = ${schemaVersion};
    CREATE TABLE packets (key TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE matches (id INTEGER PRIMARY KEY, domain TEXT, year INTEGER, date TEXT, search TEXT, payload TEXT);
    CREATE TABLE deliveries (row INTEGER PRIMARY KEY, match_id INTEGER NOT NULL, innings INTEGER NOT NULL,
      seq INTEGER, bat TEXT NOT NULL DEFAULT 'unsupported', bowl TEXT NOT NULL DEFAULT 'unsupported', payload TEXT, label TEXT);
    CREATE TABLE participants (player INTEGER, match_id INTEGER, PRIMARY KEY (player, match_id)) WITHOUT ROWID;
    CREATE TABLE events (row INTEGER, match_id INTEGER, innings INTEGER, player INTEGER, component TEXT, state TEXT, payload TEXT,
      PRIMARY KEY (row, component)) WITHOUT ROWID;
    CREATE TABLE player_matches (player INTEGER, component TEXT, match_id INTEGER, state TEXT, payload TEXT,
      PRIMARY KEY (player, component, match_id, state)) WITHOUT ROWID;
    CREATE TABLE player_data (player INTEGER, kind TEXT, payload TEXT, PRIMARY KEY (player, kind)) WITHOUT ROWID;
    CREATE TABLE references_v2 (domain TEXT, date TEXT, payload TEXT, PRIMARY KEY (domain, date)) WITHOUT ROWID;
    BEGIN;
  `);
  const packet = db.prepare('INSERT INTO packets VALUES (?, ?)');
  const save = (key, data) => packet.run(key, JSON.stringify(data));

  const inputManifest = await json('inputs');
  const baseline = await json('reportHashes');
  const inventory = await Promise.all(Object.entries(sources).map(async ([key, [file, purpose]]) => {
    const sha256 = await sha(pathFor(key));
    const expected = baseline['competition_round1/' + file];
    if (expected) assert.equal(sha256, expected, 'Report baseline mismatch: ' + file);
    return { key, file: 'competition_round1/' + file, purpose, sha256, reportBaseline: Boolean(expected) };
  }));
  for (const input of inputManifest.inputs) {
    const path = resolve(researchRoot, 'official_inputs', input.file);
    assert.equal(await sha(path), input.sha256, 'Organiser input hash mismatch: ' + input.file);
    let count = 0;
    for await (const _row of csvFile(path)) count++;
    assert.equal(count, input.rows, 'Organiser input row count: ' + input.file);
  }

  const candidates = {};
  const rankings = {};
  const finalists = {};
  const [identityRows, foundationReceipt, populationRows, fixtureRows] = await Promise.all(
    [csv('identity'), json('foundation'), csv('population'), csv('fixtures')],
  );
  const registry = new Map(identityRows.map(row => [Number(row.player_id), JSON.parse(row.aliases)]));
  assert.equal(registry.size, 1217);
  for (const discipline of Object.keys(components)) {
    const [all, eligible, final] = await Promise.all([csv(discipline), csv(discipline + 'Eligible'), csv(discipline + 'Final')]);
    const officialOrder = [...eligible].sort((a, b) => Number(a.original_policy_rank) - Number(b.original_policy_rank));
    const frozen = [...final].sort((a, b) => Number(a.rank) - Number(b.rank));
    const checkOrder = sensitivityOrder(all, discipline);
    assert.equal(all.length, registry.size);
    assert.equal(new Set(all.map(row => row.pid)).size, registry.size);
    assert.ok(all.every(row => registry.has(Number(row.pid))));
    assert.deepEqual(checkOrder.map(row => row.pid), officialOrder.map(row => row.pid), discipline + ' eligible order');
    assert.equal(frozen.length, 10);
    assert.deepEqual(frozen.map(row => row.official_player_id), officialOrder.slice(0, 10).map(row => row.pid));
    for (const [index, row] of frozen.entries()) {
      assert.equal(Number(row.rank), index + 1);
      assert.equal(row.scenario, 'official');
      assert.equal(row.official_name, officialOrder[index].player_name);
      assert.equal(row.p_pressure_shrunk, officialOrder[index].p_pressure_shrunk, 'Frozen score precision');
    }
    const finalById = new Map(frozen.map(row => [row.official_player_id, row]));
    candidates[discipline] = all.map(row => ({
      ...pick(row, candidateKeys), pid: Number(row.pid), rank: num(row.original_policy_rank),
      tier: row.tier ? Number(row.tier) : null,
    }));
    const byId = new Map(candidates[discipline].map(row => [row.pid, row]));
    rankings[discipline] = officialOrder.map(source => {
      const row = byId.get(Number(source.pid));
      assert.ok(truth(row.original_support_pass));
      assert.equal(row.rank, num(source.original_policy_rank), 'Frozen eligible position');
      assert.equal(row.p_pressure_shrunk, source.p_pressure_shrunk, 'Frozen eligible pressure precision');
      assert.equal(row.tier, policyTier(row));
      const selected = finalById.get(source.pid);
      return selected ? {
        ...row, ...pick(selected, Object.keys(selected).filter(key => /^(p_|s_|conditional_|IPL_official_|T20I_official_)/.test(key))),
        rank: Number(selected.rank), player_name: selected.official_name,
      } : row;
    });
    candidates[discipline] = candidates[discipline].map(row => rankings[discipline][(row.rank ?? 0) - 1] ?? row);
    finalists[discipline] = rankings[discipline].slice(0, 10);
    assert.equal(rankings[discipline].length, discipline === 'batting' ? 103 : 80);
  }
  assert.ok(!sensitivityOrder(candidates.batting, 'batting', { ordinary: 120 }).slice(0, 10).some(row => row.pid === 2417));
  assert.ok(sensitivityOrder(candidates.batting, 'batting', { ordinary: 120 }).slice(0, 10).some(row => row.pid === 6059));

  console.log('Verified all organiser hashes and both complete frozen D.1 orders.');
  const official = new Map((await csv('matches')).map(row => [Number(row.match_id), row]));
  assert.equal(official.size, fixtureRows.length);
  const fixture = new Map();
  const insertMatch = db.prepare('INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?)');
  for (const row of fixtureRows) {
    const id = Number(row.match_id);
    const detail = { ...official.get(id), ...row, match_id: id };
    assert.ok(detail.comp_id, 'Fixture without organiser match: ' + id);
    fixture.set(id, detail);
    insertMatch.run(id, row.domain, Number(row.match_date.slice(0, 4)), row.match_date,
      [id, detail.home_team, detail.away_team, detail.competition].join(' ').toLowerCase(), JSON.stringify(detail));
  }
  const insertPlayerData = db.prepare('INSERT INTO player_data VALUES (?, ?, ?)');
  for (const key of ['yearEvidence', 'componentEvidence']) {
    const groups = Map.groupBy(await csv(key), row => row.pid);
    for (const [id, values] of groups) insertPlayerData.run(Number(id), key, JSON.stringify(values));
  }
  const insertBank = db.prepare('INSERT INTO player_matches VALUES (?, ?, ?, ?, ?)');
  for await (const row of csvFile(pathFor('matchEvidence'))) {
    if (row.scope !== 'IPL_T20I') continue;
    const match = fixture.get(Number(row.match_id));
    assert.ok(match);
    insertBank.run(Number(row.pid), row.component, Number(row.match_id), row.state, JSON.stringify({
      ...row, date: match.match_date, domain: match.domain, home: match.home_team, away: match.away_team,
      source_rows: JSON.parse(row.source_rows),
    }));
  }
  const insertDelivery = db.prepare('INSERT INTO deliveries (row, match_id, innings, seq, payload) VALUES (?, ?, ?, ?, ?)');
  const participant = db.prepare('INSERT OR IGNORE INTO participants VALUES (?, ?)');
  let stateCount = 0;
  for await (const row of csvFile(pathFor('state'))) {
    const matchId = Number(row.match_id);
    assert.ok(fixture.has(matchId), 'Unresolved match for delivery ' + row.source_row);
    insertDelivery.run(Number(row.source_row), matchId, Number(row.innings), num(row.sequence), packRow(stateFields, row));
    for (const player of [row.striker_id, row.non_striker_id, row.bowler_id]) {
      if (num(player)) participant.run(Number(player), matchId);
    }
    stateCount++;
  }
  assert.equal(stateCount, foundationReceipt.deliveries);

  const capacity = await json('capacity');
  const models = new Map(capacity.map(model => [[model.domain, model.latest, model.matches].join('|'), model]));
  const insertReference = db.prepare('INSERT INTO references_v2 VALUES (?, ?, ?)');
  const byDate = new Map();
  for (const cutoff of await csv('cutoffs')) {
    if (cutoff.policy !== 'prior_date') continue;
    const model = models.get([cutoff.domain, cutoff.training_latest, cutoff.training_matches].join('|'));
    assert.equal(Boolean(model), truth(cutoff.supported), 'Prior-date reference coverage');
    let reference = null;
    if (model) {
      assert.ok(model.latest < cutoff.cutoff, 'Frozen date leakage');
      const totals = [...model.totals].sort((a, b) => a - b);
      const index = (totals.length - 1) * 0.75;
      const lo = Math.floor(index), hi = Math.ceil(index);
      reference = {
        domain: cutoff.domain, date: cutoff.cutoff, latest: model.latest, matches: model.matches, mean: model.mean,
        objective: totals[lo] + (totals[hi] - totals[lo]) * (index - lo),
        duration: Object.fromEntries(model.duration_parameters.map(record => [record.B,
          { median: record.median, upper: record.capacity99, n: record.n }])),
      };
    }
    byDate.set(cutoff.domain + '|' + cutoff.cutoff, reference);
    insertReference.run(cutoff.domain, cutoff.cutoff, JSON.stringify(reference));
  }
  const applyLabel = db.prepare('UPDATE deliveries SET bat = ?, bowl = ?, label = ? WHERE row = ? AND match_id = ?');
  let newLabels = 0, supportedLabels = 0;
  for await (const row of csvFile(pathFor('labels'))) {
    const supported = truth(row.supported);
    const bat = supported ? truth(row.bat_pressure) ? 'pressure' : 'ordinary' : 'unsupported';
    const bowl = supported ? truth(row.bowl_pressure) ? 'pressure' : 'ordinary' : 'unsupported';
    if (supported) {
      const reference = byDate.get(row.domain + '|' + row.match_date);
      const duration = reference?.duration[num(row.B)];
      assert.ok(duration, 'Stored label lacked matching frozen reference');
      for (const [key, value] of [['median_pace', duration.median], ['capacity_pace', duration.upper],
        ['first_mean', reference.mean], ['first_objective', reference.objective]]) {
        assert.ok(Math.abs(Number(row[key]) - value) < 1e-9, key + ' differs at official row ' + row.source_row);
      }
      const replayed = pressureState({
        innings: Number(row.innings), S: Number(row.S), W: Number(row.W), L: 120 - Number(row.B),
        target: num(row.target), prior12: Number(row.prior12_wickets),
      }, { ...duration, mean: reference.mean, objective: reference.objective });
      assert.equal(replayed.batting.toLowerCase(), bat, 'Batting V2 mismatch at official row ' + row.source_row);
      assert.equal(replayed.bowling.toLowerCase(), bowl, 'Bowling V2 mismatch at official row ' + row.source_row);
      supportedLabels++;
    }
    assert.equal(applyLabel.run(bat, bowl, packRow(labelFields, row), Number(row.source_row), Number(row.match_id)).changes, 1);
    newLabels++;
  }
  assert.ok(newLabels <= stateCount);
  console.log('Verified V2 classifier against ' + supportedLabels + ' supported historical labels.');

  const insertEvent = db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?)');
  let eventCount = 0;
  for await (const row of csvFile(pathFor('events'))) {
    assert.ok(registry.has(Number(row.pid)) && fixture.has(Number(row.match_id)));
    assert.ok(num(row.Y) !== null && num(row.expected) !== null && num(row.residual) !== null);
    assert.ok(row.history_latest.slice(0, 4) < row.year, 'Expectation history must precede the scoring year');
    assert.ok(Math.abs(Number(row.residual) - Number(row.sign) * (Number(row.Y) - Number(row.expected))) < 1e-10);
    insertEvent.run(Number(row.source_row), Number(row.match_id), Number(row.innings), Number(row.pid), row.component, row.state,
      packRow(eventFields, row));
    eventCount++;
  }

  const [degeneracy, policyRows, paired, replayRows, forecast, calibration, selected25, selected26, earlierReplay, examples,
    chronology, shrinkage, attribution, lockReceipt, pressureReceipt, rules, freeze, pressureProtocol, policyDecision, inningsRows, boundaries] = await Promise.all([
    csv('degeneracy'), csv('policies'), csv('paired'), csv('replays'), csv('forecast'), csv('calibration'), csv('selected25'),
    csv('selected26'), csv('earlierReplay'), csv('examples'), csv('chronology'), csv('shrinkage'), csv('attribution'),
    json('lockReceipt'), json('pressureReceipt'), json('rules'), json('freeze'), json('pressureProtocol'), json('policyDecision'),
    csv('innings'), csv('boundaries'),
  ]);
  for (const row of inningsRows) insertPlayerData.run(Number(row.match_id), 'innings:' + row.innings, JSON.stringify(row));
  const p3 = paired.filter(row => row.policy === 'P3' && ['pressure', 'uplift'].includes(row.metric));
  const p3Counts = Object.fromEntries([...Map.groupBy(p3, policyVerdict)].map(([key, rows]) => [key, rows.length]));
  assert.deepEqual(p3Counts, { 'Inconclusive': 5, 'Insufficient interval evidence': 8, 'Favors D.1': 3 });
  const sparseCounts = Object.fromEntries([...Map.groupBy(degeneracy, row => row.discipline)].map(([key, rows]) => [key, rows.length]));
  assert.deepEqual(sparseCounts, { batting: 133, bowling: 99 });
  const unjoined = db.prepare('SELECT COUNT(*) AS n FROM events e LEFT JOIN deliveries d ON d.row=e.row AND d.match_id=e.match_id AND d.innings=e.innings WHERE d.row IS NULL OR e.state != CASE WHEN e.component IN (\'batting_runs\', \'dismissal_avoidance\') THEN d.bat ELSE d.bowl END').get();
  assert.equal(unjoined.n, 0, 'Scored events must match Frozen V2 labels and original source rows');

  const fixtureGroups = [...Map.groupBy(fixtureRows, row => row.domain + '|' + row.status)].map(([key, rows]) => ({
    domain: key.split('|')[0], status: key.split('|')[1], matches: rows.length,
    deliveries: rows.reduce((total, row) => total + Number(row.raw_rows), 0),
  }));
  const { tests, ...checks } = foundationReceipt;
  save('snapshot', {
    finalists, rankings,
    registry: [...registry].map(([pid, aliases]) => ({
      pid, aliases, name: candidates.batting.find(row => row.pid === pid)?.player_name ?? aliases[0] ?? 'ID ' + pid,
    })),
    kpis: { matches: official.size, deliveries: stateCount, players: registry.size,
      preScore: checks.pre_score_supported, chase: checks.chase_states_supported, eventCount, supportedLabels, labelsAbsent: stateCount - newLabels },
    population: populationRows,
    domains: [...new Set(fixtureRows.map(row => row.domain))].sort(),
    years: [...new Set(fixtureRows.map(row => Number(row.match_date.slice(0, 4))))].sort(),
  });
  for (const discipline of Object.keys(components)) save(discipline, candidates[discipline]);
  const policyKeys = ['pid', 'rank', 'tier', 'discipline', 'policy', 'player_name', 'D1_rank_or_exclusion',
    'p_pressure_n', 'p_pressure_matches', 'p_pressure_quality', 'p_pressure_shrunk', '_primary_order', 'evaluation_year'];
  save('policies', { rankings: rowsCompact(policyRows, policyKeys), replays: rowsCompact(replayRows.filter(row => Number(row.rank) <= 10), policyKeys),
    paired, forecast, calibration, p3Counts, selected: [...selected25, ...selected26], earlierReplay, policyDecision });
  const reportVerification = await json('reportVerification');
  assert.equal(inventory.find(item => item.key === 'report').sha256, reportVerification.report_sha256);
  save('audit', { inputs: inputManifest.inputs, inventory, fixtureGroups, chronology, shrinkage, attribution, rules, freeze, pressureProtocol,
    checks, foundationTestCount: Number(tests.match(/Ran (\d+) tests?/)?.[1]), lockReceipt,
    pressureReceipt: pick(pressureReceipt, ['hard_scenario_checks', 'hard_scenario_total', 'all_prior_files_unchanged', 'protocol_sha256']),
    reportVerification,
    differences: [
      'Use competition_round1/official_inputs. The separate shared competition pack belongs to an earlier repository workflow.',
      'Phase A exact-state counts cover supplied competitions. Phase C scoring covers supported IPL and T20I evidence in 2023–2026.',
      'The organiser lists players using numeric IDs. Names and aliases are labels for those IDs.',
      'The V2 delivery-label export omits '+(stateCount - newLabels)+' Phase A rows. The dashboard shows these as unsupported with no label record.',
      'Match 20190 retains the documented wicket-margin mismatch. Revised targets are used only where source reconstruction supports them.',
    ],
  });
  save('methods', { examples, shrinkage, freeze, chronology });
  save('reliability', { sparseCounts, boundaries, examples: rowsCompact(degeneracy, ['pid', 'discipline', 'player_name',
    'p_pressure_n', 'p_pressure_matches', 'p_pressure_quality', 'p_pressure_shrunk', 'p_pressure_variance']) });
  db.exec(`
    CREATE INDEX matches_scope ON matches(domain, year, date);
    CREATE INDEX participants_match ON participants(match_id, player);
    CREATE INDEX deliveries_match ON deliveries(match_id, innings, seq, row);
    CREATE INDEX events_player ON events(player, component, state, match_id, row);
    CREATE INDEX events_match ON events(match_id, component, innings, row);
    COMMIT;
    VACUUM;
  `);
  db.close();
  await rename(temporary, databasePath);
  console.log('Indexed ' + stateCount + ' delivery entries and ' + eventCount + ' scored component events.');
} catch (error) {
  if (db.isOpen) db.close();
  await rm(temporary, { force: true });
  throw error;
}
