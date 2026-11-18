# PRISM dashboard data inventory

All research paths below are relative to `competition_round1/`. The app uses the Round 1 archive-derived files in `official_inputs/`. The repository also has a separate competition pack under `shared/data/` for an older workflow. The dashboard uses the Round 1 pack named in the final methodology report.

## Organiser inputs

| File | Rows | Keys and purpose |
| --- | ---: | --- |
| `competitions.csv` | 141 | `comp_id` identifies each competition and season. |
| `teams.csv` | 353 | `comp_id + team_id` identifies teams in a competition. |
| `matches.csv` | 883 | `match_id` identifies a fixture. `comp_id` links the competition. Home and away IDs link team identities. |
| `ball_by_ball.csv` | 200,999 | `match_id` links the fixture. Innings and ordering fields reconstruct state. The exported `source_row` uses the original one-based CSV row number with the header as row 1. Participant IDs link the player registry. |
| `playing_eleven.csv` | 28,381 | `match_id + team_id + player_id` describes reported participation. Scoring evidence comes from supported component events. |
| `competition_team_player_mapping.csv` | 6,413 | `comp_id + team_id + player_id` describes player mappings and aliases. Identical names can refer to distinct IDs. |

The dashboard Data & Reproducibility page lists exact row counts, schemas via the manifest path, and SHA-256 values for all six files. The original hashes are checked during ingestion.

## Metric and feature lineage

| Feature | Authoritative exports and transformation |
| --- | --- |
| Coverage and identities | `artifacts/source_manifest.json`, `artifacts/validation.json` and `artifacts/player_identities.csv.gz`. Exact pre-score and chase-state support are Phase A counts spanning all organiser competitions. There are 1,217 distinct numeric IDs. |
| Fixture and innings states | `artifacts/fixture_accounting.csv.gz`, `artifacts/innings_evidence.csv.gz` and `artifacts/match_states.csv.gz`, joined to official matches by `match_id`. Original delivery row references are retained. |
| Frozen pressure | `pressure_refinement/artifacts/primary_delivery_labels.csv.gz`, joined by original delivery row and fixture. Per-cutoff history comes from `pressure_refinement/history_cutoffs.csv` and `pressure_refinement/artifacts/capacity_models.json`. Node derives the 75th percentile from the saved total sample using linear interpolation and applies the unchanged V2 rules. Ingestion checks classification of every supported exported state. |
| Event contribution | `player_performance/artifacts/primary_source_player_evidence.csv.gz`. Each `source_row + component` has the saved predicted mean, observed outcome, residual sign and model. Wides, no-balls, credited wickets and other support are inherited from the exported evidence. |
| Four components | `player_performance/artifacts/player_pressure_ordinary_evidence.csv` stores raw pressure, ordinary and native uplift, match variance and bootstrap intervals, exposure and shrunken estimates. Both batting and bowling primary rates are native runs per 100 supported attempts with favorable signs. Secondary rates are events per 100 supported attempts. |
| Final and eligible ranks | `final_adjudication/FINAL_BATTING_TOP10.csv` and `final_adjudication/FINAL_BOWLING_TOP10.csv` supply the twenty official rows. The `*_ORIGINAL_POLICY_A.csv` exports in `full_candidate_ranking_audit/` supply the complete eligible orders. The full `*_ALL_1217_IDS.csv` audits supply tier, exclusions, matched uplift and pressure exposure by competition. Joins use discipline and official numeric ID. |
| Candidate thresholds | Same full-ID frozen evidence, passed through the original two-state, two-component gates and tie-breaks from `ranking_adjudication/ranking.py`. The baseline is verified against both complete eligible orders. Exploratory positions have a separate column and never overwrite frozen ranks. |
| Profile splits and timelines | `player_performance/artifacts/player_match_evidence.csv.gz` provides pooled totals and original row arrays for each player, component, match and state. The timeline uses the residual sum. Repetition categories use the count and rate from each match. `player_year_evidence.csv` and `player_pressure_ordinary_evidence.csv` in the same folder provide stored year and competition summaries. |
| Reliability | Full candidate audits and Phase C player evidence supply independent/effective matches, exposure HHI, positive and materially adverse frequencies, best-match removal, and raw whole-match intervals. `full_candidate_ranking_audit/SINGLE_PRESSURE_MATCH_ZERO_NOISE_CASES.csv` records the 133 batting and 99 bowling cases. |
| Policies and validation | `final_ranking_revision/POLICY_RANKING_COMPARISON.csv` and `CHRONOLOGICAL_RANKING_REPLAYS.csv.gz` preserve archived P0–P3 orders and the historical replays. `SELECTED_SET_OUTCOMES_2025.csv`, `SELECTED_SET_OUTCOMES_2026.csv`, `PAIRED_POLICY_COMPARISON.csv`, `CHRONOLOGICAL_FORECAST_COMPARISON.csv`, and `PREDICTIVE_INTERVAL_CALIBRATION.csv` supply outcomes and uncertainty. The earlier A/B/C core replay comes from `ranking_policy_validation/CORE_POLICY_COMPARISONS.csv`. |
| Methodology and provenance | `report_assets/final_report/PRISM_Final_Report.pdf` guides presentation. The observed and expected Russell examples are the final report’s exported source rows. `EXPECTATION_POLICY_FREEZE.json`, `generic_fitted_models.json`, `expectation_chronology.csv`, `shrinkage_parameters.csv`, and the Phase A, V2, final lock and report receipts identify the research stages. Report-source checks compare observed hashes to `FIGURE_AND_TABLE_SOURCES.json`. |

## Coverage and interpretation

- Phase A has 200,999 deliveries, including 194,776 exact pre-score states and 92,436 supported chase states. The primary label file contains 194,014 rows, with 168,582 supported states. The remaining 6,985 Phase A rows absent from that export are visible as unsupported with an absent-label explanation. Explicitly unsupported exported labels keep their stored reason. Phase C’s 563,898 scored component events can include several native components per delivery.
- The score window is 2023–2026. The index retains 2022 fixtures and available V2 labels. Earlier history can be used for references while player-model observations remain unavailable.
- Match 20190 retains its documented wicket-margin exception. Unsupported or revised targets are never inferred from the result.
- Competition and year filters act on player evidence and fixture records. The original D.1 order is pooled, and the app provides no official per-year or IPL-only D.1 ranking.
- Blank estimates and interval bounds stay unavailable. Zero observed opportunities are exposure counts, not zero player performance. Raw intervals are conditional on fixed labels and expectations. The policy comparison page separately labels experimental replay and calibration.
- SQLite stores source decimal fields as strings. Chart encodings and display rounding use numbers. CSV exports preserve source precision where the column directly references a stored metric.

## Index and query boundaries

The Node ingestion command reads the exports without refitting models or writing into the research tree. It stages a SQLite database under `.data/`, verifies joins and exact order, compacts the database and atomically renames the result. The largest tables store compact field tuples, keyed by delivery row, fixture, player, component and state. The local API sends a compact overview snapshot, loads research packets by page, and caps match and scored-event results at 25 per page. Only an explicitly selected fixture’s timeline is sent to the browser. The organiser input pack and SQLite index stay out of browser bundles.
