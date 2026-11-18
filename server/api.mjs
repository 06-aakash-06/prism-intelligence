import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { components, num } from '../src/analytics.mjs';
import { databasePath, eventFields, labelFields, researchRoot, stateFields, unpackRow } from '../scripts/storage.mjs';
import { sources } from '../scripts/sources.mjs';

const unpack = row => row ? JSON.parse(row.payload) : null;
const decode = rows => rows.map(unpack);
const allComponents = Object.values(components).flat();
const positiveId = value => /^\d{1,9}$/.test(value ?? '') && Number(value) > 0 ? Number(value) : null;
const safeString = value => typeof value === 'string' ? value.slice(0, 120) : '';
const pageSize = 25;

export function createApi(database = databasePath) {
  const db = new DatabaseSync(database, { readOnly: true });
  const api = express.Router();
  const packetQuery = db.prepare('SELECT payload FROM packets WHERE key = ?');
  const snapshot = unpack(packetQuery.get('snapshot'));
  const registry = new Map(snapshot.registry.map(player => [player.pid, player]));
  const candidateMaps = Object.fromEntries(Object.keys(components).map(key => [key,
    new Map(unpack(packetQuery.get(key)).map(row => [row.pid, row])),
  ]));
  const readMatch = db.prepare('SELECT payload FROM matches WHERE id = ?');
  api.get('/snapshot', (_req, res) => res.json(snapshot));
  api.get('/research/:key', (req, res) => {
    const { key } = req.params;
    if (!['batting', 'bowling', 'methods', 'reliability', 'policies', 'audit'].includes(key)) return res.sendStatus(404);
    res.type('json').send(packetQuery.get(key).payload);
  });
  api.get('/methodology-report', (_req, res) => {
    res.type('pdf').send(readFileSync(resolve(researchRoot, sources.report[0])));
  });
  api.get('/pressure', (req, res) => {
    const dates = db.prepare('SELECT domain, date, payload != \'null\' AS supported FROM references_v2 ORDER BY date').all();
    const { domain, date } = req.query;
    if (typeof domain === 'string' && typeof date === 'string') {
      const ref = unpack(db.prepare('SELECT payload FROM references_v2 WHERE domain = ? AND date = ?').get(domain, date));
      return res.json({ reference: ref });
    }
    res.json({ dates });
  });
  api.get('/player/:id', (req, res) => {
    const id = positiveId(req.params.id);
    if (!registry.has(id)) return res.status(404).json({ error: 'This numeric ID is absent from the organiser registry.' });
    const data = Object.fromEntries(db.prepare('SELECT kind, payload FROM player_data WHERE player = ? AND kind IN (\'componentEvidence\', \'yearEvidence\')').all(id)
      .map(row => [row.kind, unpack(row)]));
    const disciplines = Object.fromEntries(Object.entries(candidateMaps).map(([key, map]) => [key, map.get(id)]));
    res.json({ player: registry.get(id), disciplines, ...data });
  });
  api.get('/player/:id/matches', (req, res) => {
    const id = positiveId(req.params.id);
    const component = safeString(req.query.component);
    if (!id || !allComponents.includes(component)) return res.status(400).json({ error: 'Select an official player and native component.' });
    res.json(decode(db.prepare('SELECT payload FROM player_matches WHERE player = ? AND component = ?').all(id, component)));
  });
  api.get('/matches', (req, res) => {
    const conditions = [], args = [];
    const search = safeString(req.query.q).toLowerCase().trim();
    const player = positiveId(req.query.player);
    const component = safeString(req.query.component);
    const domain = safeString(req.query.domain);
    const year = positiveId(req.query.year);
    const innings = positiveId(req.query.innings);
    const state = safeString(req.query.state);
    const discipline = req.query.discipline === 'bowling' ? 'bowling' : 'batting';
    if (search) { conditions.push('instr(m.search, ?) > 0'); args.push(search); }
    if (domain) { conditions.push('m.domain = ?'); args.push(domain); }
    if (year) { conditions.push('m.year = ?'); args.push(year); }
    if (allComponents.includes(component)) {
      const eventConditions = ['e.match_id = m.id', 'e.component = ?'];
      args.push(component);
      if (player) { eventConditions.push('e.player = ?'); args.push(player); }
      if (innings) { eventConditions.push('e.innings = ?'); args.push(innings); }
      if (state) { eventConditions.push('e.state = ?'); args.push(state); }
      conditions.push('EXISTS (SELECT 1 FROM events e WHERE ' + eventConditions.join(' AND ') + ')');
    } else {
      if (player) { conditions.push('EXISTS (SELECT 1 FROM participants p WHERE p.player = ? AND p.match_id = m.id)'); args.push(player); }
      if (innings || state) {
        const deliveryConditions = ['d.match_id = m.id'];
        if (innings) { deliveryConditions.push('d.innings = ?'); args.push(innings); }
        if (state) { deliveryConditions.push((discipline === 'bowling' ? 'd.bowl' : 'd.bat') + ' = ?'); args.push(state); }
        conditions.push('EXISTS (SELECT 1 FROM deliveries d WHERE ' + deliveryConditions.join(' AND ') + ')');
      }
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare('SELECT COUNT(*) AS n FROM matches m' + where).get(...args).n;
    const page = Math.min(positiveId(req.query.page) || 1, Math.max(1, Math.ceil(total / pageSize)));
    const rows = decode(db.prepare('SELECT payload FROM matches m' + where + ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?')
      .all(...args, pageSize, (page - 1) * pageSize));
    res.json({ rows, total, page, pageSize });
  });
  api.get('/match/:id', (req, res) => {
    const id = positiveId(req.params.id);
    const match = id && unpack(readMatch.get(id));
    if (!match) return res.status(404).json({ error: 'No fixture matches that official match ID.' });
    const innings = decode(db.prepare('SELECT payload FROM player_data WHERE player = ? AND kind LIKE \'innings:%\' ORDER BY kind').all(id));
    const player = positiveId(req.query.player);
    const timeline = db.prepare('SELECT row, innings, seq, bat, bowl, payload FROM deliveries WHERE match_id = ? ORDER BY innings, seq, row').all(id)
      .map(({ payload, ...row }) => {
        const state = unpackRow(stateFields, payload);
        return { ...row, balls: num(state.legal_balls_before), score: num(state.runs_before_exact), wickets: num(state.wickets_before),
          required: num(state.runs_required_before), teamRuns: num(state.team_runs_event_exact),
          striker: num(state.striker_id), bowler: num(state.bowler_id), over: state.overid + '.' + state.over_ball_num };
      });
    const sql = player
      ? 'SELECT component, COUNT(*) AS n FROM events WHERE match_id = ? AND player = ? GROUP BY component'
      : 'SELECT component, COUNT(*) AS n FROM events WHERE match_id = ? GROUP BY component';
    const componentCounts = db.prepare(sql).all(...(player ? [id, player] : [id]));
    res.json({ match, innings, timeline, componentCounts });
  });
  api.get('/delivery/:row', (req, res) => {
    const id = positiveId(req.params.row);
    const row = id && db.prepare('SELECT * FROM deliveries WHERE row = ?').get(id);
    if (!row) return res.status(404).json({ error: 'No delivery matches that official CSV row.' });
    const events = db.prepare('SELECT payload FROM events WHERE row = ? ORDER BY component').all(id)
      .map(event => unpackRow(eventFields, event.payload));
    res.json({ ...row, payload: unpackRow(stateFields, row.payload), label: unpackRow(labelFields, row.label), events });
  });
  api.get('/events', (req, res) => {
    const match = positiveId(req.query.match), player = positiveId(req.query.player);
    if (!match && !player) return res.status(400).json({ error: 'Select a match or player to query delivery evidence.' });
    const component = safeString(req.query.component), state = safeString(req.query.state);
    const domain = safeString(req.query.domain), year = positiveId(req.query.year), innings = positiveId(req.query.innings);
    const source = positiveId(req.query.row);
    const conditions = [], args = [];
    for (const [field, value] of [['e.match_id', match], ['e.player', player], ['e.component', component],
      ['e.state', state], ['m.domain', domain], ['m.year', year], ['e.innings', innings], ['e.row', source]]) {
      if (value) { conditions.push(field + ' = ?'); args.push(value); }
    }
    const where = ' FROM events e JOIN matches m ON e.match_id = m.id WHERE ' + conditions.join(' AND ');
    const total = db.prepare('SELECT COUNT(*) AS n' + where).get(...args).n;
    const page = Math.min(positiveId(req.query.page) || 1, Math.max(1, Math.ceil(total / pageSize)));
    const rows = db.prepare('SELECT e.payload, m.date, m.domain' + where + ' ORDER BY m.date DESC, e.match_id, e.row, e.component LIMIT ? OFFSET ?')
      .all(...args, pageSize, (page - 1) * pageSize)
      .map(row => ({ ...unpackRow(eventFields, row.payload), date: row.date, domain: row.domain }));
    res.json({ rows, total, page, pageSize });
  });
  api.use((_req, res) => res.status(404).json({ error: 'Unknown PRISM data route.' }));
  api.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'The local evidence query failed. Check the terminal for details.' });
  });
  return { api, close: () => db.isOpen && db.close() };
}
