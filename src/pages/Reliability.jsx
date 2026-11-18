import { useWalkthrough } from '../walkthrough/context.jsx';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { components, num } from '../analytics.mjs';
import { GroupBars, Intervals, palette, PlayerBars, Scatter } from '../charts.jsx';
import { playerLink, useApi, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { GateChecks, metric } from '../player-evidence.jsx';
import { ApiState, Metric, PageHead, Panel, Pill, PlayerName, PlayerPicker, SectionHead, Select, Table, TextLink, Toggle,
  count, disciplines, fixed, percent, signed } from '../ui.jsx';

const views = [
  { value: 'matches', label: 'Independent vs effective matches', x: 'p_pressure_matches', y: 'p_pressure_effective_matches', xl: 'Independent matches', yl: 'Effective matches', xUnit: 'matches', yUnit: 'matches' },
  { value: 'shrink', label: 'Raw vs shrunken pressure', x: 'p_pressure_quality', y: 'p_pressure_shrunk', xl: 'Raw pressure quality', yl: 'Shrunken pressure', xUnit: 'runs / 100', yUnit: 'runs / 100' },
  { value: 'removed', label: 'Best match influence', x: 'p_pressure_quality', y: 'p_best_removed_pressure_quality', xl: 'Raw pressure quality', yl: 'After best match removal', xUnit: 'runs / 100', yUnit: 'runs / 100' },
  { value: 'uplift', label: 'Quality vs uplift', x: 'p_pressure_quality', y: 'p_pressure_uplift', xl: 'Raw pressure quality', yl: 'Native uplift', xUnit: 'runs / 100', yUnit: 'runs / 100' },
  { value: 'concentration', label: 'Exposure concentration', x: 'p_pressure_matches', y: 'p_pressure_exposure_hhi', xl: 'Independent matches', yl: 'Exposure HHI', xUnit: 'matches', yUnit: 'fraction' },
  { value: 'repetition', label: 'Positive vs adverse match share', x: 'p_consistency_positive_frequency', y: 'p_consistency_materially_adverse_frequency',
    xl: 'Positive fraction', yl: 'Materially adverse fraction', xUnit: 'of qualifying matches', yUnit: 'of qualifying matches' },
];

function ReliabilityCase({ row, discipline }) {
  const { rankings } = useSnapshot();
  const reference = rankings[discipline].slice(0, 10);
  return <>
    <div className="grid-2 reliability-case">
      <Panel tourTarget="reliability-case" title={<PlayerName row={row} discipline={discipline} showId />}
        action={<Pill tone={row.rank ? 'green' : 'amber'}>{row.rank ? 'D.1 #' + row.rank + ' · Tier ' + row.tier : 'Outside D.1 gate'}</Pill>}>
        <div className="metrics-grid">
          <Metric label="Pressure attempts" value={count(row.p_pressure_n)} detail="Supported primary attempts" />
          <Metric label="Best match removed" value={signed(row.p_best_removed_pressure_quality)} detail="Raw primary runs / 100 attempts" />
          <Metric label="Effective matches" value={fixed(row.p_pressure_effective_matches)} detail={count(row.p_pressure_matches) + ' independent'} />
          <Metric label="Positive matches" value={percent(row.p_consistency_positive_frequency)} detail={count(row.p_consistency_matches) + ' qualifying matches'} />
          <Metric label="Materially adverse" value={percent(row.p_consistency_materially_adverse_frequency)} detail="Below −10 runs / 100 attempts" />
        </div>
        <p className="footnote">Exposure HHI {fixed(row.p_pressure_exposure_hhi, 4)} · Raw pressure variance {fixed(row.p_pressure_variance)} · Pressure shrinkage weight {fixed(row.p_pressure_shrinkage_weight, 3)}</p>
        {num(row.p_best_match_id) != null && <TextLink to={'/matches/' + num(row.p_best_match_id) + '?player=' + row.pid + '&component=' + components[discipline][0] + '&d=' + discipline}>Open strongest match</TextLink>}
      </Panel>
      <Panel title="D.1 eligibility checks" subtitle="Every cell must meet both minimums."><GateChecks row={row} discipline={discipline} /></Panel>
      <Panel title="Tier requirements" subtitle="Policy A applies the first tier a player satisfies after admission.">
        <Table label="Reliability tier requirements" rows={[
          { tier: 1, rule: 'Positive shrinkage estimate, positive best-removed rate, ≥5 qualifying matches, ≥50% positive' },
          { tier: 2, rule: 'Positive shrinkage estimate and positive best-removed rate' },
          { tier: 3, rule: 'Positive shrunken pressure estimate' },
          { tier: 4, rule: 'Remaining eligible candidates' },
        ]} columns={[{ key: 'tier', label: 'Tier' }, { key: 'rule', label: 'Requirement' }]} />
        <p className="footnote">A qualifying pressure match has at least six supported primary attempts. Current player: {count(row.p_consistency_matches)} qualifying matches.</p>
        <GroupBars label="Selected case raw and best-removed pressure contribution" rows={[{ ...row, player_name: 'Selected player' }]}
          fields={[{ key: 'p_pressure_quality', label: 'Raw pressure', color: palette.raw },
            { key: 'p_best_removed_pressure_quality', label: 'After removal', color: palette[discipline] }]}
          unit="runs / 100 attempts" height={124} />
      </Panel>
      <Panel title="Uncertainty in raw rates" subtitle="Selected player and leading D.1 cases · conditional 95% intervals">
        <Intervals rows={[row, ...reference.filter(item => item.pid !== row.pid).slice(0, 4)]} discipline={discipline} />
        <p className="footnote">Intervals resample whole matches and hold the pressure labels and expectation fits fixed. Overlap does not settle rank differences.</p>
      </Panel>
    </div>
  </>;
}

export default function Reliability() {
  const { highlight } = useWalkthrough();
  const [discipline, setDiscipline] = useDiscipline();
  const [params, patch] = useParamsState();
  const { finalists, registry } = useSnapshot();
  const pool = useApi('/research/' + discipline);
  const audit = useApi('/research/reliability');
  const id = num(params.get('player')) || finalists[discipline][0].pid;
  const view = views.find(item => item.value === params.get('chart')) || views[0];
  return <>
    <PageHead kicker="Evidence strength" title="Reliability lab" description="Inspect independent repetition, sample concentration, raw-rate uncertainty and how one match can affect an estimate."
      actions={<Toggle value={discipline} options={disciplines} label="Reliability discipline" onChange={next => setDiscipline(next, { player: '' })} />} />
    <ApiState result={pool}>{rows => {
      const row = rows.find(item => item.pid === id) || finalists[discipline][0];
      const plotted = params.get('cohort') === 'eligible' ? rows.filter(item => item.rank) : rows;
      return <>
        <div className="controls"><PlayerPicker label="Inspect an official ID" value={row.pid} players={registry} onChange={player => patch({ player })} clearable={false} /></div>
        <section className="reliability-distribution">
          <SectionHead title="Distribution of match evidence" description="Each point represents an organiser ID with a stored value on both axes." />
          <div className="grid-2 reliability-field">
            <Panel tourTarget="reliability-distribution" title={view.label}>
              <div className="controls">
                <Select label="Measure pair" value={view.value} options={views} onChange={chart => patch({ chart })} />
                <Select label="Population" value={params.get('cohort') || 'all'} onChange={cohort => patch({ cohort })}
                  options={[{ value: 'all', label: 'All observed candidates' }, { value: 'eligible', label: 'D.1 eligible' }]} />
              </div>
              <Scatter selectedPid={highlight === "selected-player" ? row.pid : undefined} rows={plotted} discipline={discipline} x={view.x} y={view.y} xLabel={view.xl} yLabel={view.yl} xUnit={view.xUnit} yUnit={view.yUnit} />
            </Panel>
            <Panel title="Match repetition by finalist" subtitle="Independent and effective primary pressure matches">
              <PlayerBars rows={finalists[discipline]} discipline={discipline} label="Independent and effective primary pressure matches" unit="matches"
                height={336} fields={[{ key: 'p_pressure_matches', label: 'Independent', color: palette.raw },
                  { key: 'p_pressure_effective_matches', label: 'Effective', color: palette[discipline] }]} />
            </Panel>
          </div>
        </section>
        <section className="block"><SectionHead title="Player reliability case" /><ReliabilityCase row={row} discipline={discipline} /></section>
      </>;
    }}</ApiState>
    <section className="block">
      <SectionHead title="When one match looks certain" description="A single pressure match has zero deviation from its own pooled rate. This can collapse estimated pressure variance even when true match variability is unknown." />
      <ApiState result={audit}>{data => <div className="grid-2">
        <Panel title="Near-zero variance cases" subtitle="One pressure match · original estimator"
          action={<ShieldAlert size={17} className="violet" />}>
          <div className="metrics-grid mb-2"><Metric label="Batting cases" value={count(data.sparseCounts.batting)} /><Metric label="Bowling cases" value={count(data.sparseCounts.bowling)} /></div>
          <Table label="One-match variance examples" rows={data.examples.filter(row => row.discipline === discipline).slice(0, 6)}
            columns={[{ key: 'player_name', label: 'Player', render: row => <Link className="text-link" to={playerLink(row.pid, discipline)}>{row.player_name}</Link> },
              metric('p_pressure_n', 'Attempts', count), metric('p_pressure_quality', 'Raw'), metric('p_pressure_shrunk', 'Shrunken')]} />
        </Panel>
        <Panel title="Original D.1 and the covariance experiment">
          <p className="muted text-sm">D.1 uses player-specific match-cluster variance for separate pressure, ordinary and uplift shrinkage. The admission gate excludes one-pressure-match entries. The later experiment estimates shared within-player match variability and pressure–ordinary covariance, then scales them by each player’s exposure.</p>
          <p className="muted text-sm">The covariance estimator improved some forecast errors. The historical comparison left the selection advantage unresolved, so D.1 uses its original estimator.</p>
          <TextLink to="/policies">Inspect the retrospective evidence</TextLink>
        </Panel>
      </div>}</ApiState>
    </section>
  </>;
}
