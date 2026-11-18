export const foundation = 'artifacts/';
export const pressure = 'pressure_refinement/';
export const performance = 'player_performance/artifacts/';
export const lock = 'final_adjudication/';
export const population = 'full_candidate_ranking_audit/';
export const revision = 'final_ranking_revision/';
export const replay = 'ranking_policy_validation/';
export const report = 'report_assets/final_report/';
export const reportEvidence = report + 'overleaf/evidence/';

export const sources = {
  matches: ['official_inputs/matches.csv', 'Organiser fixture identity and result by match_id'],
  inputs: [foundation + 'source_manifest.json', 'Six-file organiser inventory, schemas, row counts and hashes'],
  state: [foundation + 'match_states.csv.gz', 'Original CSV row, ordered pre-delivery state, player IDs, event and reconstruction support'],
  identity: [foundation + 'player_identities.csv.gz', 'Official player ID and reported aliases'],
  fixtures: [foundation + 'fixture_accounting.csv.gz', 'Fixture domain, match date, source row and certification'],
  innings: [foundation + 'innings_evidence.csv.gz', 'Reconstructed innings totals and completion checks'],
  foundation: [foundation + 'validation.json', 'Reconstruction audit of exact states, targets, overs and result margins'],
  labels: [pressure + 'artifacts/primary_delivery_labels.csv.gz', 'Frozen batting/bowling V2 labels and pre-delivery classification inputs'],
  capacity: [pressure + 'artifacts/capacity_models.json', 'Frozen duration quantiles, total samples and historical reference counts'],
  cutoffs: [pressure + 'history_cutoffs.csv', 'Prior-date support, latest training date and earlier fixture count'],
  pressureProtocol: [pressure + 'protocol.json', 'Frozen pressure support and parameter specification'],
  pressureReceipt: [pressure + 'artifacts/validation.json', 'V2 hard-scenario checks and preservation receipt'],
  events: [performance + 'primary_source_player_evidence.csv.gz', 'Supported component prediction, observation, residual and source row'],
  matchEvidence: [performance + 'player_match_evidence.csv.gz', 'Native component match totals and source-row arrays'],
  yearEvidence: [performance + 'player_year_evidence.csv', 'Saved season/scope and component summaries'],
  componentEvidence: [performance + 'player_pressure_ordinary_evidence.csv', 'Native rates, raw intervals, concentration, and shrunken estimates by scope'],
  chronology: [performance + 'expectation_chronology.csv', 'Earlier-year model training support and cutoffs'],
  freeze: [performance + 'EXPECTATION_POLICY_FREEZE.json', 'Retained model for each domain and component'],
  fitted: [performance + 'generic_fitted_models.json', 'Saved fitted mean-model parameters'],
  shrinkage: [performance + 'shrinkage_parameters.csv', 'Frozen empirical-Bayes tau-squared reference values'],
  attribution: [performance + 'attribution_coverage.csv', 'Component-specific attribution coverage'],
  population: [population + 'POPULATION_AND_MISSINGNESS.csv', 'Full-population completeness, missingness and eligibility totals'],
  batting: [population + 'BATTING_ALL_1217_IDS.csv', 'Full batting audit, including rank, support gates and exclusions'],
  bowling: [population + 'BOWLING_ALL_1217_IDS.csv', 'Full bowling audit, including rank, support gates and exclusions'],
  battingFinal: [lock + 'FINAL_BATTING_TOP10.csv', 'Canonical frozen D.1 batting order and finalist evidence'],
  bowlingFinal: [lock + 'FINAL_BOWLING_TOP10.csv', 'Canonical frozen D.1 bowling order and finalist evidence'],
  battingEligible: [population + 'BATTING_ORIGINAL_POLICY_A.csv', 'Canonical entire eligible Policy A batting order'],
  bowlingEligible: [population + 'BOWLING_ORIGINAL_POLICY_A.csv', 'Canonical entire eligible Policy A bowling order'],
  rules: [lock + 'RANKING_LOCK_RULES.json', 'Frozen eligibility and ranking policy'],
  lockReceipt: [lock + 'FINAL_LOCK_VALIDATION.json', 'Final lock execution and ranking verification receipt'],
  boundaries: [lock + 'LOCK_BOUNDARY_PAIRED_EVIDENCE.csv', 'Exploratory paired finalist/reserve differences with fixed nuisance parameters'],
  degeneracy: [population + 'SINGLE_PRESSURE_MATCH_ZERO_NOISE_CASES.csv', 'Original one-pressure-match zero-noise cases'],
  policies: [revision + 'POLICY_RANKING_COMPARISON.csv', 'Archived P0–P3 ordering and corrected experimental evidence'],
  replays: [revision + 'CHRONOLOGICAL_RANKING_REPLAYS.csv.gz', 'P0–P3 original retrospective top tens'],
  policyDecision: [revision + 'ADOPTION_DECISION.json', 'D.1 retained and experimental selection decision'],
  forecast: [revision + 'CHRONOLOGICAL_FORECAST_COMPARISON.csv', 'Retrospective component forecast MSE and uncertainty'],
  calibration: [revision + 'PREDICTIVE_INTERVAL_CALIBRATION.csv', 'Predictive coverage by year/component/state/support'],
  paired: [revision + 'PAIRED_POLICY_COMPARISON.csv', 'Unadjusted paired draws for experimental policy comparisons'],
  selected25: [revision + 'SELECTED_SET_OUTCOMES_2025.csv', 'Observed 2025 outcomes and future-player support'],
  selected26: [revision + 'SELECTED_SET_OUTCOMES_2026.csv', 'Observed 2026 outcomes and future-player support'],
  earlierReplay: [replay + 'CORE_POLICY_COMPARISONS.csv', 'Earlier exploratory A/B/C core replay and multiplicity diagnostics'],
  examples: [reportEvidence + 'observed_expected_examples.csv', 'Actual Russell observed-versus-expected figure inputs'],
  report: [report + 'PRISM_Final_Report.pdf', 'Final presentation and methodological context'],
  reportHashes: [report + 'FIGURE_AND_TABLE_SOURCES.json', 'Report-stage source hash baseline'],
  reportVerification: [report + 'REPORT_VERIFICATION.json', 'Publication checks and narrative claim verification'],
};
