export const components = {
  batting: ['batting_runs', 'dismissal_avoidance'],
  bowling: ['bowling_runs_prevented', 'credited_wickets'],
};

export const componentNames = {
  batting_runs: 'Batting runs',
  dismissal_avoidance: 'Dismissal avoidance',
  bowling_runs_prevented: 'Runs prevented',
  credited_wickets: 'Credited wickets',
};

export function num(value) {
  if (value === '' || value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export const truth = (value) => value === true || value === 'True' || value === 'true' || value === 1;

export function supportChecks(row, discipline, options = {}) {
  const matches = options.matches ?? (discipline === 'batting' ? 10 : 5);
  return ['p', 's'].flatMap(prefix => ['pressure', 'ordinary'].flatMap(state => {
    const attempts = options[state] ?? 60;
    return [
      { prefix, state, metric: 'attempts', value: num(row?.[prefix + '_' + state + '_n']), minimum: attempts },
      { prefix, state, metric: 'matches', value: num(row?.[prefix + '_' + state + '_matches']), minimum: matches },
    ];
  })).map(check => ({ ...check, pass: check.value !== null && check.value >= check.minimum }));
}

export function policyTier(row) {
  if (!(num(row.p_pressure_shrunk) > 0)) return 4;
  if (!(num(row.p_best_removed_pressure_quality) > 0)) return 3;
  return num(row.p_consistency_matches) >= 5 && num(row.p_consistency_positive_frequency) >= 0.5 ? 1 : 2;
}

function compareDesc(a, b) {
  if (a == null) return b == null ? 0 : 1;
  return b == null ? -1 : b - a;
}

function orderKeys(row) {
  const primary = num(row.p_pressure_shrunk);
  return [
    primary == null ? null : Number(primary.toFixed(9)),
    num(row.s_pressure_shrunk),
    num(row.matched_pressure_coverage) >= 0.8 ? num(row.matched_standardized_uplift) : null,
    num(row.p_uplift_shrunk),
    num(row.p_pressure_effective_matches),
    num(row.p_pressure_matches),
    num(row.p_pressure_n),
  ];
}

export function sensitivityOrder(rows, discipline, options) {
  return rows.filter(row => supportChecks(row, discipline, options).every(check => check.pass))
    .map(row => ({ row, tier: policyTier(row), keys: orderKeys(row) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      for (let i = 0; i < a.keys.length; i++) {
        const order = compareDesc(a.keys[i], b.keys[i]);
        if (order) return order;
      }
      return Number(a.row.pid) - Number(b.row.pid);
    })
    .map(({ row, tier }, index) => ({ ...row, tier, scenarioRank: index + 1 }));
}

export function pressureState(state, reference) {
  const { innings, S, W, L, target, prior12 = 0 } = state;
  const B = Number.isFinite(L) ? 120 - L : null;
  const K = Number.isFinite(W) ? 10 - W : null;
  const chase = innings === 2;
  const valid = [S, W, L, prior12].every(Number.isInteger)
    && S >= 0 && W >= 0 && W <= 9 && B >= 1 && B <= 120
    && prior12 >= 0 && prior12 <= W && (chase ? Number.isInteger(target) && target > S : innings === 1);
  const enoughHistory = reference && [reference.median, reference.upper, reference.mean, reference.objective].every(Number.isFinite);
  const demand = !Number.isFinite(S) ? null : chase ? (target == null ? null : target - S)
    : enoughHistory ? Math.max(reference.objective - S, 0) : null;
  if (!valid || !enoughHistory) {
    return { B, K, demand, batting: 'Unsupported', bowling: 'Unsupported', gates: {},
      reason: !valid ? 'State requires a live standard innings and a supported positive chase demand.' : 'No qualifying earlier-date reference for this scope.' };
  }
  const pace = demand / B;
  const urgency = pace / Math.max(reference.median, 0.25);
  const par = reference.mean * L / 120;
  const attainable = demand > 0 && pace <= reference.upper;
  const start = L >= 6 || W >= 2;
  const late = B <= 30 && urgency >= 1;
  const fragile = K <= 3 && (B <= 30 || pace >= 0.5);
  const recovery = ((W >= 3 && L <= 48) || (W >= 5 && L < 90) || prior12 >= 2) && S < par;
  const acceleration = L >= 60 && urgency >= 1;
  const platform = L >= 60 && S >= par && (urgency >= 1 || K <= 3);
  return {
    B, K, demand, pace, urgency, par,
    batting: attainable && start && (chase ? late || fragile : recovery || acceleration) ? 'Pressure' : 'Ordinary',
    bowling: attainable && start && (chase ? late || fragile : platform) ? 'Pressure' : 'Ordinary',
    gates: { attainable, start, late, fragile, recovery, acceleration, platform },
  };
}

export function policyVerdict(row) {
  const lo = num(row.low), hi = num(row.high);
  if (lo == null || hi == null) return 'Insufficient interval evidence';
  if (hi < 0) return 'Favors D.1';
  if (lo > 0) return 'Favors P3';
  return 'Inconclusive';
}

export function competitionShare(row) {
  const ipl = num(row?.IPL_p_pressure_n);
  const t20i = num(row?.T20I_p_pressure_n);
  if ((ipl ?? 0) + (t20i ?? 0) <= 0) return null;
  return (ipl ?? 0) / ((ipl ?? 0) + (t20i ?? 0));
}

export function residualEquation(component) {
  return ['bowling_runs_prevented', 'dismissal_avoidance'].includes(component)
    ? 'Expected − observed' : 'Observed − expected';
}
