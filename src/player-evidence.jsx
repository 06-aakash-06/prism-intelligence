import { Link } from 'react-router-dom';
import { Check, Minus, X } from 'lucide-react';
import { componentNames, components, num, supportChecks } from './analytics.mjs';
import { matchLink, playerLink, query, useApi, useSnapshot } from './data.jsx';
import { ApiState, Empty, Export, Pager, Pill, Table, count, deltaClass, fixed, signed, titleCase } from './ui.jsx';

export const metric = (key, label, format = signed) => ({
  key, label, numeric: true, render: row => <span className={format === signed ? deltaClass(row[key]) : ''}>{format(row[key])}</span>,
});

export const unitFor = component => ['dismissal_avoidance', 'credited_wickets'].includes(component) ? 'events / 100 attempts' : 'runs / 100 attempts';
export const eventUnit = component => ['dismissal_avoidance', 'credited_wickets'].includes(component) ? 'events' : 'runs';

export function StatePill({ state }) {
  return <Pill tone={state === 'pressure' ? 'pink' : state === 'unsupported' ? 'amber' : 'blue'}>{titleCase(state)}</Pill>;
}

export function GateChecks({ row, discipline, options }) {
  const checks = supportChecks(row, discipline, options);
  return <div className="checklist">{checks.map(check => <div key={check.prefix + check.state + check.metric} className="check">
    <div className="check-head">{check.pass ? <Check size={15} className="positive" /> : check.value == null ? <Minus size={15} /> : <X size={15} className="negative" />}
      <span>{componentNames[components[discipline][check.prefix === 'p' ? 0 : 1]]} · {check.state} {check.metric}</span></div>
    <span className={'gate-metric ' + (check.pass ? 'positive' : 'muted')}>{count(check.value)} / ≥{check.minimum}</span>
  </div>)}</div>;
}

export function describePlayer(row, discipline) {
  const raw = num(row.p_pressure_quality), ordinary = num(row.p_ordinary_quality);
  const lower = num(row.p_pressure_low), upper = num(row.p_pressure_high);
  const ipl = num(row.IPL_p_pressure_n), t20i = num(row.T20I_p_pressure_n);
  const rawText = raw == null || ordinary == null ? 'A full pressure-versus-ordinary contrast is unavailable.'
    : 'Raw pressure quality is ' + signed(raw) + ' and ordinary quality is ' + signed(ordinary) + ' ' + unitFor(components[discipline][0]) +
      '. ' + (raw < ordinary ? 'The ordinary rate is higher, producing negative uplift.' : raw > 0
        ? (ordinary < 0 ? 'Pressure quality is above expectation and the ordinary rate is below expectation, widening uplift.' : 'The pressure rate exceeds a baseline that is already at or above expectation.')
        : 'The pressure rate stays at or below expectation even with a lower ordinary baseline.');
  return [
    row.rank ? 'Policy A places this player at #' + row.rank + ' in tier ' + row.tier + '. The order prioritizes tier, then shrunken primary pressure contribution.'
      : 'This player has no eligible D.1 rank in this discipline. The support checks show which requirements lack evidence.',
    rawText,
    num(row.p_pressure_matches) > 0 ? count(row.p_pressure_matches) + ' independent pressure matches represent ' + fixed(row.p_pressure_effective_matches) +
      ' effective matches. ' + (num(row.p_consistency_matches) > 0 ? count(row.p_consistency_matches) + ' matches qualify for the repetition check at six or more primary pressure attempts.' : 'The repetition check has no qualifying match evidence.') : 'Independent pressure-match evidence is unavailable.',
    lower !== null && upper !== null ? 'The raw pressure interval ' + (lower <= 0 && upper >= 0 ? 'includes zero' : 'excludes zero') +
      ' with fitted expectations and labels held fixed.' : 'A raw pressure interval is unavailable for this sample.',
    (ipl ?? 0) + (t20i ?? 0) > 0 ? 'Primary pressure evidence includes ' + count(ipl ?? 0) + ' IPL and ' + count(t20i ?? 0) +
      ' T20I attempts. ' + ((ipl ?? 0) < (t20i ?? 0) ? 'Most observations come from T20Is, limiting direct IPL interpretation.' : 'Direct IPL observations are visible in the competition breakdown.') : 'No scored primary pressure exposure appears in either competition.',
  ];
}

export function EventTable({ filters, page, onPage, onRow, discipline = 'batting', title = 'Supported component events' }) {
  const result = useApi(filters.match || filters.player ? '/events?' + query({ ...filters, page }) : null);
  const { registry } = useSnapshot();
  const names = new Map(registry.map(player => [player.pid, player.name]));
  const columns = [
    { key: 'source_row', label: 'CSV row', numeric: true, render: row => onRow
      ? <button className="text-link mono" onClick={() => onRow(row)}>#{row.source_row}</button>
      : <Link className="text-link mono" to={matchLink(row.match_id, { player: row.pid, row: row.source_row, component: row.component })}>#{row.source_row}</Link> },
    { key: 'match_id', label: 'Match ID', numeric: true, render: row => <Link className="text-link mono" to={matchLink(row.match_id, { player: row.pid, component: row.component })}>{row.match_id}</Link> },
    { key: 'pid', label: 'Player ID', numeric: true, render: row => <Link className="player-link" title={names.get(Number(row.pid))}
      to={playerLink(row.pid, ['batting_runs', 'dismissal_avoidance'].includes(row.component) ? 'batting' : 'bowling')}>#{row.pid}</Link> },
    { key: 'domain', label: 'Competition' },
    { key: 'innings', label: 'Innings', numeric: true },
    { key: 'component', label: 'Component', value: row => componentNames[row.component], render: row => componentNames[row.component] },
    { key: 'state', label: 'V2 state', render: row => <StatePill state={row.state} /> },
    metric('Y', 'Observed', fixed), metric('expected', 'Expected', fixed), metric('residual', 'Contribution'),
  ];
  return <ApiState result={result}>{data => <>
    {data.total === 0 ? <Empty title="No scored events for these filters" detail="The selected rows may have V2 labels but lack supported component attribution or model expectations." />
      : <>
        <div className="flex items-center justify-between gap-2 mb-2"><p className="chart-subtitle">Native runs or events per attempt, according to component.</p>
          <Export name={'prism-' + discipline + '-deliveries-page-' + data.page} columns={columns} rows={data.rows} /></div>
        <Table label={title} columns={columns} rows={data.rows} rowKey={row => row.source_row + ':' + row.component} />
        <Pager page={data.page} total={data.total} pageSize={data.pageSize} onChange={onPage} />
      </>}
  </>}</ApiState>;
}
