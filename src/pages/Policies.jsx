import { Link, useNavigate } from 'react-router-dom';
import { componentNames, components, num, policyVerdict, truth } from '../analytics.mjs';
import { axis, Chart, GroupBars, palette } from '../charts.jsx';
import { playerLink, useApi, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { metric, unitFor } from '../player-evidence.jsx';
import { ApiState, Empty, Export, Metric, PageHead, Panel, Pill, PlayerName, SectionHead, Select, Table, Toggle, count,
  disciplines, fixed, interval, percent, signed } from '../ui.jsx';

const labels = {
  P0: 'Original D.1',
  P1: 'Corrected, pressure-first',
  P2: 'Pressure and uplift',
  P3: 'Conservative lower bound',
};
const policies = Object.keys(labels);
const descriptions = {
  P0: 'Original admission gates, tiers and shrunken primary pressure contribution.',
  P1: 'Corrected uncertainty and original tier structure with the D.1 admission gates removed.',
  P2: 'Joint evidence for positive pressure quality and positive uplift, with secondary tie-breaks.',
  P3: 'The weaker one-sided 95% pressure lower bound before and after best-match removal.',
};
const verdicts = [
  ['Favors D.1', palette.batting], ['Favors P3', palette.mint], ['Inconclusive', palette.violet], ['Insufficient interval evidence', '#63718e'],
];
const metricLabel = { pressure: 'Pressure quality', uplift: 'Native uplift', ordinary: 'Ordinary quality',
  positive_frequency: 'Positive-match frequency', adverse_frequency: 'Adverse-match frequency' };

function RankingPolicyView({ data, discipline }) {
  const [params, patch] = useParamsState();
  const { finalists } = useSnapshot();
  const navigate = useNavigate();
  const scenario = ['P1', 'P2', 'P3'].includes(params.get('policy')) ? params.get('policy') : 'P3';
  const reference = finalists[discipline];
  const scope = data.rankings.filter(row => row.discipline === discipline && row.policy === scenario);
  const alternative = scope.filter(row => Number(row.rank) <= 10).sort((a, b) => Number(a.rank) - Number(b.rank));
  const overlap = alternative.filter(row => reference.some(item => item.pid === Number(row.pid))).length;
  const names = new Map(data.rankings.map(row => [Number(row.pid), row.player_name]));
  const entries = [...new Set([...reference.map(row => row.pid), ...alternative.map(row => Number(row.pid))])].map(pid => ({
    pid, player_name: names.get(pid), p0: reference.find(row => row.pid === pid)?.rank ?? null,
    original: data.rankings.find(row => row.policy === 'P0' && row.discipline === discipline && Number(row.pid) === pid)?.rank ?? null,
    alternate: scope.find(row => Number(row.pid) === pid)?.rank ?? null,
  }));
  const drawn = entries.filter(row => [row.original, row.alternate].some(rank => num(rank) != null && num(rank) <= 20));
  const topColumns = d => [
    { key: 'rank', label: 'Position', numeric: true, render: row => <span className={d === 'P0' ? 'pink' : 'violet'}>{row.rank}</span> },
    { key: 'player_name', label: 'Player', render: row => <PlayerName row={row} discipline={discipline} showId /> },
    metric('p_pressure_n', 'Pressure attempts', count), metric('p_pressure_matches', 'Pressure matches', count),
  ];

  return <>
    <div className="grid-2 policy-orders">
      <Panel title="P0 · Original D.1" subtitle="Frozen reference" action={<Pill tone="green">Retained</Pill>}>
        <Table label="Original P0 selection" rows={reference} columns={topColumns('P0')} />
      </Panel>
      <Panel title={scenario + ' · ' + labels[scenario]} subtitle={descriptions[scenario]}
        action={<Pill tone="amber">Experimental</Pill>}>
        <div className="controls">
          <Select label="Policy" value={scenario} options={policies.slice(1).map(value => ({ value, label: value + ' · ' + labels[value] }))}
            onChange={policy => patch({ policy })} />
          <div className="mono text-xs muted">{overlap} / 10 overlap</div>
        </div>
        <Table label="Experimental selection" rows={alternative} columns={topColumns(scenario)} />
      </Panel>
    </div>
    <section className="block">
      <SectionHead title="Rank movement" description="The columns use original rank values. An absent rank means the player is unranked in that ordering or outside the chart’s first twenty." />
      <div className="grid-main policy-motion">
        <Panel title={'P0 → ' + scenario} subtitle="Lines connect players ranked in the first 20 on both sides. The ledger includes all rank values for either top ten.">
          <Chart label="Rank movement from P0 to the selected policy" height={325}
            onClick={event => { if (drawn[event.seriesIndex]) navigate(playerLink(drawn[event.seriesIndex].pid, discipline)); }} option={{
            grid: { left: 43, right: 27, top: 15, bottom: 26, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
            xAxis: { ...axis, type: 'category', data: ['P0 · D.1', scenario + ' · experimental'], boundaryGap: true },
            yAxis: { ...axis, type: 'value', name: 'Rank', inverse: true, min: 1, max: 20, minInterval: 1, splitNumber: 5 },
            tooltip: { formatter: params => params.seriesName + '\n' + params.name + ' · rank #' + params.value },
            series: drawn.map(row => ({ name: row.player_name, type: 'line', symbolSize: 6,
                itemStyle: { color: row.p0 && row.alternate <= 10 && row.alternate != null ? palette.mint : palette.violet },
                data: [row.original <= 20 ? num(row.original) : null, row.alternate <= 20 ? num(row.alternate) : null] })),
          }} />
        </Panel>
        <Panel title="Top-ten movement ledger">
          <Table label="Policy rank movement" rows={entries} scroll
            columns={[{ key: 'player_name', label: 'Player', render: row => <PlayerName row={row} discipline={discipline} /> },
              { key: 'original', label: 'P0 rank', numeric: true }, { key: 'alternate', label: scenario + ' rank', numeric: true },
              { key: 'movement', label: 'Places gained', numeric: true, render: row => row.original && row.alternate ? signed(row.original - row.alternate, 0) : '—' }]} />
        </Panel>
      </div>
    </section>
  </>;
}

function Historical({ data, discipline }) {
  const [params, patch] = useParamsState();
  const { registry } = useSnapshot();
  const year = params.get('replayYear') === '2026' ? '2026' : '2025';
  const component = components[discipline].includes(params.get('evalComponent')) ? params.get('evalComponent') : components[discipline][0];
  const evalPolicy = policies.includes(params.get('replayPolicy')) ? params.get('replayPolicy') : 'P0';
  const cohort = params.get('support') || 'all';
  const selected = data.selected.filter(row => row.evaluation_year === year && row.discipline === discipline && row.component === component &&
    ['pressure', 'uplift', 'ordinary'].includes(row.metric));
  const replay = data.replays.filter(row => row.evaluation_year === year && row.discipline === discipline && row.policy === evalPolicy)
    .sort((a, b) => Number(a.rank) - Number(b.rank)).map(row => ({ ...row, player_name: registry.find(player => player.pid === Number(row.pid))?.name || '#' + row.pid }));
  const evidence = data.paired.filter(row => row.component === component && row.evaluation_year === year && ['pressure', 'uplift'].includes(row.metric));
  const errors = data.forecast.filter(row => row.component === component && row.evaluation_year === year);
  const calibrations = data.calibration.filter(row => row.component === component && row.evaluation_year === year && row.training_support === cohort);
  const old = data.earlierReplay.filter(row => row.evaluation_year === year && row.component === component);
  const columns = [
    { key: 'policy', label: 'Policy' }, { key: 'metric', label: 'Outcome', render: row => metricLabel[row.metric] || row.metric },
    metric('future_players', 'Observed later', count), metric('selected_players', 'Selected', count),
    metric('mean', 'Mean / 100'), { key: 'bounds', label: '95% interval', numeric: true, value: row => interval(row.low, row.high), render: row => interval(row.low, row.high) },
  ];
  return <>
    <section className="block">
      <SectionHead title="Historical replay" description="Fit and rank on earlier seasons, then evaluate the observed later outcomes. Both retrospective windows have been inspected." />
      <div className="controls">
        <Select label="Evaluation season" value={year} options={['2025', '2026']} onChange={replayYear => patch({ replayYear })} />
        <Select label="Evaluation component" value={component} options={components[discipline].map(value => ({ value, label: componentNames[value] }))}
          onChange={evalComponent => patch({ evalComponent })} />
        <Select label="Replay order" value={evalPolicy} options={policies.map(value => ({ value, label: value + ' · ' + labels[value] }))}
          onChange={replayPolicy => patch({ replayPolicy })} />
      </div>
      <div className="grid-main">
        <Panel title={'Observed selected-set outcomes in ' + year}
          subtitle={unitFor(component) + ' · Missing later observations reduce observed support.'}
          action={<Export columns={columns} rows={selected} name={'prism-retrospective-' + year + '-' + component} />}>
          <Table label="Retrospective observed results" columns={columns} rows={selected} scroll />
        </Panel>
        <Panel title={'Replay ' + evalPolicy + ' top ten'} subtitle={'Training through ' + (Number(year) - 1) + ' · historical replay'}>
          <Table label="Replay selection" rows={replay} columns={[{ key: 'rank', label: 'Position', numeric: true },
            { key: 'player_name', label: 'Player', render: row => <Link className="player-link" to={playerLink(row.pid, discipline)}>{row.player_name}</Link> },
            metric('p_pressure_n', 'Pressure attempts', count)]} />
        </Panel>
      </div>
      <Panel className="mt-3" title="Paired contrasts versus P0" subtitle={'Unadjusted · ' + unitFor(component)}>
        <Table label="Paired experimental contrasts" rows={evidence} columns={[
          { key: 'policy', label: 'Policy' }, { key: 'metric', label: 'Outcome', render: row => metricLabel[row.metric] },
          metric('mean_difference', 'Difference'), { key: 'interval', label: 'Paired 95% interval', numeric: true, render: row => interval(row.low, row.high) },
          metric('valid_draws', 'Defined draws', count),
          { key: 'support', label: 'Interval', render: row => <Pill tone={num(row.low) == null ? 'amber' : ''}>{num(row.low) == null ? 'Insufficient evidence' : 'Available'}</Pill> },
        ]} />
      </Panel>
    </section>
    <section className="block">
      <SectionHead title="Prediction and calibration" description="Forecast error measures later rate prediction. Player selection depends on the ranking and the availability of later evidence." />
      <div className="grid-2">
        <Panel title="Forecast mean squared error" subtitle={componentNames[component] + ' · squared rate per 100 attempts · lower is better'}>
          <GroupBars rows={errors.map(row => ({ ...row, name: metricLabel[row.state] }))} label="Mean squared forecast error" unit="squared rate / 100"
            height={222} fields={[{ key: 'legacy_MSE', label: 'Original', color: palette.raw },
              { key: 'corrected_MSE', label: 'Corrected', color: palette.violet }, { key: 'zero_MSE', label: 'Zero baseline', color: palette.mint }]} />
          <Table label="Point error differences and paired intervals" rows={errors}
            columns={[{ key: 'state', label: 'State' }, metric('corrected_minus_legacy', 'Corrected − original'),
              { key: 'interval', label: '95% interval', render: row => interval(row.difference_low, row.difference_high) }]} />
        </Panel>
        <Panel title="Predictive 95% coverage" subtitle="Archived calibration by training support">
          <div className="controls"><Select label="Training matches" value={cohort} onChange={support => patch({ support })}
            options={[{ value: 'all', label: 'All support levels' }, { value: 'one_training_match', label: 'One match' },
              { value: '2_4_training_matches', label: '2–4 matches' }, { value: '5_9_training_matches', label: '5–9 matches' },
              { value: '10plus_training_matches', label: '10+ matches' }]} /></div>
          <Table label="Predictive coverage calibration" rows={calibrations}
            columns={[{ key: 'state', label: 'State' }, metric('coverage95', 'Coverage', percent), metric('independent_matches', 'Matches', count),
              { key: 'nominal95_in_CI', label: '95% in interval?', render: row => num(row.low) == null ? 'Unavailable' : truth(row.nominal95_in_CI) ? 'Yes' : 'No' }]} />
          <p className="footnote">Across all four components, two states and both seasons, {data.calibration.filter(row =>
            row.training_support === 'all' && num(row.low) != null && !truth(row.nominal95_in_CI)).length} of 16 overall coverage intervals exclude nominal 95%.</p>
        </Panel>
      </div>
      <details className="disclosure mt-3">
        <summary>Earlier A/B/C retrospective sensitivity</summary>
        <div className="detail-body">
          <p>The earlier policy study used a separate A/B/C grid and simultaneous interval diagnostics. These are archived exploratory contrasts.</p>
          {old.length ? <Table label="Earlier policy replay" rows={old} scroll columns={[
            { key: 'policy_a', label: 'Policy A' }, { key: 'policy_b', label: 'Policy B' }, { key: 'metric', label: 'Metric' },
            metric('point_difference', 'Difference'), { key: 'interval', label: 'Simultaneous interval', render: row => interval(row.simultaneous_low, row.simultaneous_high) },
          ]} /> : <Empty />}
        </div>
      </details>
    </section>
  </>;
}

export default function Policies() {
  const [discipline, setDiscipline] = useDiscipline();
  const result = useApi('/research/policies');
  return <>
    <PageHead kicker="D.1 reference · Experimental alternatives" title="Policies & validation"
      description="Compare archived ordering rules and retrospective results. The evidence retained the original D.1 reference for both disciplines."
      actions={<Toggle value={discipline} options={disciplines} label="Policy discipline" onChange={next => setDiscipline(next, { evalComponent: '' })} />} />
    <ApiState result={result}>{data => {
      const core = data.paired.filter(row => row.policy === 'P3' && ['pressure', 'uplift'].includes(row.metric));
      return <>
        <Panel className="policy-replay" title="P3 versus D.1 in retrospective replay" subtitle="16 exploratory, unadjusted pressure and uplift contrasts across both disciplines and years">
          <div className="verdict-bar" role="img" aria-label={verdicts.map(([label]) => (data.p3Counts[label] || 0) + ' ' + label).join(', ')}>
            {verdicts.map(([label, color]) => <div key={label} style={{ width: ((data.p3Counts[label] || 0) / core.length * 100) + '%', background: color }} />)}
          </div>
          <div className="metrics-grid replay-counts mt-3">{verdicts.map(([label, color]) => <div key={label} style={{ borderLeft: '2px solid ' + color }}>
            <Metric label={label} value={count(data.p3Counts[label] || 0)} />
          </div>)}</div>
          <details className="disclosure mt-3">
            <summary>See the 16 comparisons</summary>
            <div className="detail-body"><Table label="P3 versus D.1 core contrasts" rows={core} columns={[
              { key: 'evaluation_year', label: 'Evaluation' }, { key: 'component', label: 'Component', render: row => componentNames[row.component] },
              { key: 'metric', label: 'Outcome', render: row => metricLabel[row.metric] },
              { key: 'estimate', label: 'P3 − P0 / 100', render: row => fixed(row.mean_difference) },
              { key: 'bounds', label: '95% interval', render: row => interval(row.low, row.high) }, { key: 'result', label: 'Result', render: policyVerdict },
            ]} /></div>
          </details>
        </Panel>
        <section className="block"><SectionHead title="Archived orders" description="Compare retained Policy A with the archived alternatives. Experimental proposals remain separate from the final reference." />
          <RankingPolicyView data={data} discipline={discipline} />
        </section>
        <Historical data={data} discipline={discipline} />
      </>;
    }}</ApiState>
  </>;
}
