import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
export const researchRoot = resolve(process.env.PRISM_RESEARCH_ROOT || resolve(appRoot, '../..'), 'competition_round1');
export const dataDir = resolve(appRoot, '.data');
export const databasePath = resolve(dataDir, 'prism.sqlite');
export const schemaVersion = 2;

export const stateFields = [
  'source_row', 'match_source_row', 'innings', 'sequence', 'overid', 'over_ball_num', 'striker_id',
  'non_striker_id', 'bowler_id', 'batting_team_id', 'bowling_team_id', 'source_runs', 'extras_type', 'source_extras1',
  'source_extras2', 'team_runs_event_exact', 'bowler_runs_exact', 'batter_runs_source', 'legal_delivery',
  'runs_before_exact', 'legal_balls_before', 'wickets_before', 'balls_remaining', 'credited_wicket',
  'striker_dismissed', 'phase', 'exact_pre_score_supported', 'target_before', 'runs_required_before', 'required_run_rate_before',
  'exact_chase_state_supported', 'ordering_supported',
];

export const labelFields = [
  'prior12_wickets', 'training_latest', 'urgency', 'required_pace', 'capacity_pace', 'median_pace', 'fragility',
  'capacity_sample_matches', 'first_objective', 'first_mean', 'unsupported_reason',
  'attainable', 'late_urgent', 'fragile_region', 'recovery_region', 'acceleration_region',
];

export const eventFields = [
  'source_row', 'match_id', 'pid', 'innings', 'component', 'state', 'phase', 'Y', 'expected', 'residual',
  'sign', 'selected_model', 'history_latest', 'policy_status', 'free_hit', 'legal_delivery',
];

export function packRow(fields, row) {
  return JSON.stringify(fields.map(key => row[key] === '' ? null : row[key] ?? null));
}

export function unpackRow(fields, payload) {
  if (payload == null) return null;
  const values = JSON.parse(payload);
  return Object.fromEntries(fields.map((key, index) => [key, values[index]]));
}
