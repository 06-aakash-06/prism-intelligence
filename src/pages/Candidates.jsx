import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { num, sensitivityOrder } from '../analytics.mjs';
import { useApi, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { GateChecks, metric } from '../player-evidence.jsx';
import { ApiState, Export, Field, PageHead, Pager, Panel, Pill, PlayerName, SectionHead, Select, Table, TextLink, Toggle,
  count, disciplines, sortRows } from '../ui.jsx';

const highlighted = {
  batting: [47370, 6819, 4736, 2417, 6059],
  bowling: [6628, 1071, 6515, 3174],
};
const evidenceName = {
  ALL_NATIVE_POINT_COMPONENTS_ESTIMABLE: 'Complete native estimates',
  PARTIALLY_OBSERVED_OR_SHRINKAGE_UNDEFINED: 'Partial or undefined estimates',
  NO_CERTIFIED_SCORED_OBSERVATIONS: 'No certified scores',
};

function status(row) {
  return row.rank ? row.rank <= 10 ? 'Final ten' : 'D.1 eligible' : evidenceName[row.evidence_status] || 'Outside gate';
}

function AuditView({ rows, discipline, eligible, total, complete }) {
  const [params, patch] = useParamsState();
  const [sort, setSort] = useState({ key: 'rank', direction: 'asc' });
  const search = params.get('q')?.toLowerCase().trim() || '';
  const filter = params.get('filter') || 'all';
  const minMatches = discipline === 'batting' ? 10 : 5;
  const limits = {
    pressure: Number(params.get('minP') || 60),
    ordinary: Number(params.get('minO') || 60),
    matches: Number(params.get('minM') || minMatches),
  };
  const valid = Object.values(limits).every(value => Number.isInteger(value) && value > 0 && value <= 10000);
  const scenario = valid ? sensitivityOrder(rows, discipline, limits) : [];
  const baseline = eligible.slice(0, 10).map(row => row.pid);
  const scenarioIds = scenario.slice(0, 10).map(row => row.pid);
  const gained = scenario.slice(0, 10).filter(row => !baseline.includes(row.pid));
  const lost = eligible.slice(0, 10).filter(row => !scenarioIds.includes(row.pid));
  const matchHighlights = highlighted[discipline].map(id => rows.find(row => row.pid === id)).filter(Boolean);
  const matching = rows.filter(row => (!search || [row.player_name, row.pid].some(value => String(value).toLowerCase().includes(search))) &&
    (filter === 'all' || (filter === 'final' && row.rank <= 10 && row.rank != null) || (filter === 'eligible' && row.rank != null) ||
      (filter === 'excluded' && row.rank == null) || (filter === row.evidence_status)));
  const pageSize = 25;
  const page = Math.max(1, Math.min(Number(params.get('page')) || 1, Math.max(1, Math.ceil(matching.length / pageSize))));
  const columns = [
    { key: 'player_name', label: 'Player', render: row => <PlayerName row={row} discipline={discipline} showId /> },
    { key: 'rank', label: 'D.1 rank', numeric: true }, { key: 'tier', label: 'D.1 tier', numeric: true, render: row => row.rank ? row.tier : '—' },
    metric('p_pressure_n', 'Pressure attempts', count), metric('p_pressure_matches', 'Pressure matches', count),
    metric('p_ordinary_n', 'Ordinary attempts', count), metric('p_ordinary_matches', 'Ordinary matches', count),
    { key: 'decision', label: 'Audit status', value: status, render: row => <Pill tone={row.rank ? 'green' : 'amber'}>{status(row)}</Pill> },
    { key: 'original_gate_failure_reasons', label: 'Admission evidence', sortable: false, render: row => row.rank ? 'Satisfied on both components' :
      <details><summary>Show missing requirements</summary><div className="min-w-64"><GateChecks row={row} discipline={discipline} /></div></details> },
  ];
  const visible = sortRows(matching, columns, sort).slice((page - 1) * pageSize, page * pageSize);
  return <>
    <div className="grid-main selection-landscape">
      <Panel title="From registry to selection" subtitle="Discipline-level counts · several players appear in both disciplines">
        <div className="funnel">{[
          ['Official IDs', total], ['Complete native estimates', complete], ['D.1 eligible', eligible.length],
          ...[1, 2, 3, 4].map(tier => ['Eligible · Tier ' + tier, eligible.filter(row => row.tier === tier).length]),
          ['Final ten', eligible.slice(0, 10).length],
        ].map(([label, value], index) => <div className="funnel-row" key={label}><span>{label}</span>
          <div className="funnel-track"><i style={{ width: value ? (Number(value) / total * 100) + '%' : '0', minWidth: value ? undefined : 0,
            background: index > 2 && index < 7 ? 'var(--violet)' : discipline === 'bowling' ? 'var(--blue)' : 'var(--pink)' }} /></div>
          <strong className="mono text-right">{count(value)}</strong>
        </div>)}</div>
      </Panel>
      <Panel className="boundary-line" title="Near the boundary" subtitle="Open a player to see both-component support and the native estimates.">
        {matchHighlights.map(row => <div className="match-card" key={row.pid}>
          <PlayerName row={row} discipline={discipline} showId />
          <div className="text-right"><Pill tone={row.rank ? 'green' : 'amber'}>{row.rank ? 'Rank #' + row.rank : 'Outside gate'}</Pill>
            <small>{count(row.p_pressure_n)} attempts · {count(row.p_pressure_matches)} matches</small></div>
        </div>)}
      </Panel>
    </div>
    <section className="block">
      <SectionHead title="Eligibility sensitivity" description="Explore exact Policy A gate changes using the saved native estimates, original tiers and fixed tie-breaks. No model is refitted." />
      <Panel className="threshold-instrument" title="Change the support requirements" subtitle="Both components and both states must meet their respective thresholds."
        action={<Pill tone="amber">Exploratory ordering</Pill>}>
        <div className="controls">
          <Field label="Pressure attempts (min.)" value={params.get('minP') || 60} type="number" min={1} max={10000} onChange={minP => patch({ minP }, true)} />
          <Field label="Ordinary attempts (min.)" value={params.get('minO') || 60} type="number" min={1} max={10000} onChange={minO => patch({ minO }, true)} />
          <Field label="Independent matches (min.)" value={params.get('minM') || minMatches} type="number" min={1} max={10000} onChange={minM => patch({ minM }, true)} />
          <button className="button" onClick={() => patch({ minP: '', minO: '', minM: '' })}>Reset to D.1</button>
          {discipline === 'batting' && <button className="button" onClick={() => patch({ minP: 60, minO: 120, minM: 10 })}>Set ordinary attempts to 120</button>}
        </div>
        <p className="chart-subtitle mb-2">{valid ? count(scenario.length) + ' pass the selected thresholds' : 'Enter whole-number thresholds from 1 to 10,000.'}
          {valid && gained.length > 0 && ' · In: ' + gained.map(row => row.player_name).join(', ')}
          {valid && lost.length > 0 && ' · Out: ' + lost.map(row => row.player_name).join(', ')}</p>
        <Table label="Exploratory sensitivity order" rows={scenario.slice(0, 10)}
          columns={[{ key: 'scenarioRank', label: 'Scenario position', numeric: true }, columns[0], columns[1],
            metric('p_pressure_shrunk', 'Frozen shrunken primary / 100'), columns[3], columns[5]]} />
        <p className="footnote">The official D.1 table retains its original ranks. Below-gate exposure can leave the original shrinkage unstable.</p>
      </Panel>
    </section>
    <section className="block">
      <SectionHead title="Full candidate audit" description="All official IDs remain visible. Missing exposure limits admission and says nothing by itself about player ability." />
      <Panel title="Population ledger" action={<Export name={'prism-' + discipline + '-candidate-audit-page-' + page} columns={[columns[0], { key: 'pid', label: 'Official ID' }, ...columns.slice(1)]} rows={visible} />}>
        <div className="controls">
          <Field label="By name or numeric ID" value={params.get('q') || ''} onChange={q => patch({ q, page: '' }, true)} />
          <Select label="Evidence status" value={filter} onChange={filter => patch({ filter, page: '' })} options={[
            { value: 'all', label: 'All official IDs' }, { value: 'final', label: 'Final ten' }, { value: 'eligible', label: 'D.1 eligible' },
            { value: 'excluded', label: 'Outside D.1 gate' }, ...Object.entries(evidenceName).map(([value, label]) => ({ value, label })),
          ]} />
        </div>
        <Table label="Full population audit" rows={visible} columns={columns} sort={sort} setSort={setSort} scroll />
        <Pager page={page} total={matching.length} pageSize={pageSize} onChange={page => patch({ page })} />
      </Panel>
    </section>
  </>;
}

export default function Candidates() {
  const { population, rankings, kpis } = useSnapshot();
  const [discipline, setDiscipline] = useDiscipline();
  const result = useApi('/research/' + discipline);
  const complete = num(population.find(row => row.discipline === discipline && row.status === 'ALL_NATIVE_POINT_COMPONENTS_ESTIMABLE')?.players);
  return <>
    <PageHead kicker="D.1 · Full-population audit" title="Candidate pool"
      description="Inspect which of the organiser’s numeric IDs had sufficient evidence, who sat near the final cut and how the selection responds to different support thresholds."
      actions={<Toggle value={discipline} options={disciplines} label="Candidate pool discipline"
        onChange={next => setDiscipline(next, { page: '', minP: '', minO: '', minM: '' })} />} />
    <ApiState result={result}>{rows => <AuditView rows={rows} discipline={discipline} eligible={rankings[discipline]} total={kpis.players} complete={complete} />}</ApiState>
    <div className="insight-banner"><LockKeyhole size={16} /><p>D.1 admits players for historical evidence review using support in both native components.</p>
      <TextLink to={'/rankings?d=' + discipline}>Open the frozen order</TextLink></div>
  </>;
}
