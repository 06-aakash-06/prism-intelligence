import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { componentNames, components, num } from '../analytics.mjs';
import { axis, Chart, Coverage, GroupBars, Intervals, palette } from '../charts.jsx';
import { comparisonLink, matchLink, useApi, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { describePlayer, EventTable, eventUnit, GateChecks, metric, StatePill, unitFor } from '../player-evidence.jsx';
import { Stamp } from '../instruments.jsx';
import { ApiState, Empty, Export, Field, Metric, PageHead, Panel, Pill, SectionHead, Select, Table, TextLink, Toggle,
  count, disciplines, fixed, interval, percent, signed } from '../ui.jsx';

const scopeChoices = [{ value: 'IPL_T20I', label: 'Pooled IPL + T20I' }, { value: 'IPL', label: 'IPL only' }, { value: 'T20I', label: 'T20I only' }];
const states = [{ value: 'pressure', label: 'Pressure' }, { value: 'ordinary', label: 'Ordinary' }];

function MatchEvidence({ id, component, row, discipline, domain, year, state }) {
  const result = useApi('/player/' + id + '/matches?component=' + component);
  const navigate = useNavigate();
  return <ApiState result={result}>{data => {
    const rows = data.filter(item => item.state === state && (!domain || item.domain === domain) && (!year || item.year === year))
      .sort((a, b) => a.date.localeCompare(b.date) || Number(a.match_id) - Number(b.match_id));
    const cutoff = ['batting_runs', 'bowling_runs_prevented'].includes(component) ? -10 : -2;
    const derived = rows.map(item => {
      const rate = 100 * Number(item.R) / Number(item.n);
      const outcome = item.n < 6 ? 'Below repetition minimum'
        : rate > 0 ? 'Positive' : rate < cutoff ? 'Materially adverse' : 'Neutral / mild negative';
      return { ...item, rate, outcome };
    });
    const url = item => matchLink(item.match_id, { player: id, component, row: item.first_source_row, state });
    const columns = [
      { key: 'date', label: 'Date' }, { key: 'match_id', label: 'Match ID', numeric: true,
        render: item => <Link className="text-link mono" to={url(item)}>#{item.match_id}</Link> },
      { key: 'domain', label: 'Domain' }, { key: 'opposition', label: 'Fixture', value: item => item.home + ' v ' + item.away,
        render: item => item.home + ' v ' + item.away }, metric('n', 'Attempts', count), metric('Y', 'Observed', fixed),
      metric('E', 'Expected', fixed), metric('R', 'Total residual'), metric('rate', 'Residual / 100'),
      { key: 'outcome', label: 'Repetition outcome' }, { key: 'first_source_row', label: 'First CSV row', numeric: true },
    ];
    return <>
      {!rows.length ? <Empty title="No supported match observations" detail="Try the other state, a wider date scope or the other native component." /> :
        <div className="grid-main profile-timeline">
          <Panel title="Match contribution timeline" subtitle={'Total residual per match · ' + eventUnit(component) + ' · one mark per match'}
            action={<StatePill state={state} />}>
            <Chart height={270} label="Player contextual contribution by match" onClick={event => navigate(url(derived[event.dataIndex]))}
              option={{
                grid: { left: 18, right: 12, top: 14, bottom: 27, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
                tooltip: { formatter: ({ dataIndex }) => {
                  const item = derived[dataIndex];
                  return item.date + ' · #' + item.match_id + ' · ' + item.domain + '\n' + item.home + ' v ' + item.away +
                    '\n' + item.n + ' supported attempts\nTotal: ' + signed(item.R) + ' ' + eventUnit(component) + '\n' +
                    signed(item.rate) + ' / 100 attempts\n' + item.outcome;
                } },
                xAxis: { ...axis, type: 'category', data: derived.map(item => item.date), axisLabel: { ...axis.axisLabel, hideOverlap: true } },
                yAxis: { ...axis, type: 'value' },
                series: [{ type: 'bar', barMaxWidth: 19, data: derived.map(item => ({ value: num(item.R),
                  itemStyle: { color: item.outcome === 'Materially adverse' ? '#ff999f' : item.outcome === 'Positive' ? palette[discipline] : '#74829d' } })) }],
              }} />
          </Panel>
          <Panel title="Match reliability" subtitle="Frozen pooled primary sample">
            <Metric label="Raw pressure without strongest match" value={signed(row.p_best_removed_pressure_quality)}
              detail="Remove the entire largest total pressure contributor" />
            {num(row.p_best_match_id) != null && <TextLink to={matchLink(num(row.p_best_match_id), { player: id, component: components[discipline][0], state: 'pressure' })}>
              Inspect strongest match #{num(row.p_best_match_id)}
            </TextLink>}
            <Metric label="Positive / materially adverse" value={percent(row.p_consistency_positive_frequency) + ' / ' + percent(row.p_consistency_materially_adverse_frequency)}
              detail={count(row.p_consistency_matches) + ' matches at ≥6 primary pressure attempts'} />
          </Panel>
        </div>}
      {rows.length > 0 && <Panel className="mt-3" title="Match evidence ledger" subtitle="Outcomes use the per-100 rate in matches with at least six attempts."
        action={<Export name={'player-' + id + '-' + component + '-' + state} columns={columns} rows={derived} />}>
        <Table label="Player match evidence" rows={[...derived].reverse()} columns={columns} rowKey={item => item.match_id} scroll />
      </Panel>}
    </>;
  }}</ApiState>;
}

export default function Profile() {
  const { id } = useParams();
  const [discipline, setDiscipline] = useDiscipline();
  const [params, patch] = useParamsState();
  const result = useApi('/player/' + id);
  const { finalists, years } = useSnapshot();
  const [primary, secondary] = components[discipline];
  const component = params.get('component') === secondary ? secondary : primary;
  const domain = ['IPL', 'T20I'].includes(params.get('domain')) ? params.get('domain') : '';
  const year = params.get('year') || '';
  const state = params.get('state') === 'ordinary' ? 'ordinary' : 'pressure';
  const compareId = finalists[discipline].find(row => row.pid !== Number(id))?.pid;
  const scope = domain || 'IPL_T20I';
  return <ApiState result={result}>{data => {
    const row = data.disciplines[discipline];
    const competitionRows = (data.componentEvidence || []).filter(item => item.component === component);
    const yearRows = (data.yearEvidence || []).filter(item => item.component === component && item.scope === scope && (!year || item.year === year));
    const unit = unitFor(primary);
    return <>
      <PageHead kicker={<Stamp>{'Official ID #' + id + ' · Player intelligence'}</Stamp>} title={data.player.name}
        description={row.rank ? 'D.1 ' + discipline + ' rank #' + row.rank + ' · Tier ' + row.tier + ' · Frozen pooled IPL + T20I' : 'Organiser registry · Available ' + discipline + ' evidence'}
        actions={<>
          <Toggle value={discipline} options={disciplines} label="Profile discipline" onChange={next => setDiscipline(next, { component: '', page: '' })} />
          <Link className="button" to={comparisonLink(discipline, [Number(id), compareId])}><ArrowLeftRight size={15} /> Compare player</Link>
        </>} />
      <div className="metrics-grid dossier-metrics">
        <Metric label="Shrunken pressure" value={signed(row.p_pressure_shrunk)} detail={unit} tone={discipline === 'batting' ? 'pink' : 'blue'} />
        <Metric label="Raw pressure / ordinary" value={signed(row.p_pressure_quality) + ' / ' + signed(row.p_ordinary_quality)} detail={unit} />
        <Metric label="Native uplift" value={signed(row.p_pressure_uplift)} detail={unit} />
        <Metric label="Secondary shrunken pressure" value={signed(row.s_pressure_shrunk)} detail={componentNames[secondary] + ' / 100 attempts'} />
        <Metric label="Pressure / ordinary attempts" value={count(row.p_pressure_n) + ' / ' + count(row.p_ordinary_n)} detail="Primary component support" />
        <Metric label="Independent / effective" value={count(row.p_pressure_matches) + ' / ' + fixed(row.p_pressure_effective_matches)} detail="Primary pressure matches" />
      </div>
      <section className="block">
        <SectionHead title="Performance and reliability" description="Pooled estimates reference the 2023–2026 scoring window." action={
          <TextLink to={'/reliability?d=' + discipline + '&player=' + id}>Open reliability lab</TextLink>} />
        <div className="grid-2 dossier-evidence">
          <Panel title="Contextual rates" subtitle={unit}>
            <GroupBars label="Raw and shrunken rates by pressure state" unit={unit}
              rows={[{ name: 'Pressure', raw: row.p_pressure_quality, shrunk: row.p_pressure_shrunk },
                { name: 'Ordinary', raw: row.p_ordinary_quality, shrunk: row.p_ordinary_shrunk },
                { name: 'Uplift', raw: row.p_pressure_uplift, shrunk: row.p_uplift_shrunk }]}
              fields={[{ key: 'raw', label: 'Raw', color: palette.raw }, { key: 'shrunk', label: 'Separately shrunken', color: palette[discipline] }]} height={218} />
          </Panel>
          <Panel title="Raw pressure and uplift uncertainty" subtitle={'Conditional 95% intervals · ' + unit}>
            <Intervals discipline={discipline} rows={[
              { ...row, player_name: 'Pressure' }, { ...row, player_name: 'Uplift', p_pressure_quality: row.p_pressure_uplift,
                p_pressure_low: row.p_uplift_low, p_pressure_high: row.p_uplift_high },
            ]} label="Raw contextual rate" />
            <p className="footnote">Raw pressure: {interval(row.p_pressure_low, row.p_pressure_high)} · Native uplift: {interval(row.p_uplift_low, row.p_uplift_high)}</p>
          </Panel>
          <Panel className="dossier-note" title="What the evidence supports" action={<ShieldCheck size={17} className="violet" />}>
            <ul className="detail-stack pl-4 list-disc text-sm text-slate-300">{describePlayer(row, discipline).map(item => <li key={item}>{item}</li>)}</ul>
          </Panel>
          <Panel title="D.1 admission checks" action={<Pill tone={row.rank ? 'green' : 'amber'}>{row.rank ? 'Eligible' : 'Outside gate'}</Pill>}>
            <GateChecks row={row} discipline={discipline} />
          </Panel>
        </div>
      </section>

      <section className="block" id="matches">
        <SectionHead title="Match and season evidence" description="Filters apply to the archived native evidence below. D.1 ranks and pooled scores above stay fixed." />
        <div className="controls">
          <Select label="Native component" value={component} onChange={component => patch({ component, page: '' })}
            options={components[discipline].map(value => ({ value, label: componentNames[value] }))} />
          <Select label="Competition" options={scopeChoices.map(option => ({ ...option, value: option.value === 'IPL_T20I' ? '' : option.value }))}
            value={domain} onChange={domain => patch({ domain, page: '' })} />
          <Select label="Year" options={[{ value: '', label: 'All scored seasons' }, ...years.filter(value => value >= 2023).map(String)]}
            value={year} onChange={year => patch({ year, page: '' })} />
          <Toggle value={state} onChange={state => patch({ state, page: '' })} options={states} label="Player evidence state" />
        </div>
        <MatchEvidence id={id} row={row} component={component} discipline={discipline} domain={domain} year={year} state={state} />
        <div className="grid-2 mt-3">
          <Panel title="Competition split" subtitle="Primary pressure evidence by supported attempt">
            <Coverage rows={[row]} discipline={discipline} />
            <Table label="Competition component estimates" rows={competitionRows}
              columns={[{ key: 'scope', label: 'Scope' }, metric('pressure_n', 'Pressure attempts', count), metric('pressure_quality', 'Raw pressure / 100'),
                metric('ordinary_quality', 'Raw ordinary / 100'), metric('pressure_uplift', 'Native uplift / 100')]} />
            <p className="footnote">{unitFor(component)} · Competition-specific rows are historical evidence views.</p>
          </Panel>
          <Panel title="Year-by-year evidence" subtitle={titleCaseScope(scope) + ' · ' + unitFor(component)}>
            <Table label="Season evidence" rows={yearRows} rowKey={item => item.year + item.state}
              columns={[metric('year', 'Year', count), { key: 'state', label: 'State', render: item => <StatePill state={item.state} /> },
                metric('n', 'Attempts', count), metric('matches', 'Matches', count), metric('contextual_per100', 'Raw / 100')]} />
          </Panel>
        </div>
      </section>

      <section className="block">
        <SectionHead title="Delivery evidence" description="Open an original organiser CSV row to see its pre-delivery V2 state and contextual residual."
          action={<TextLink to={'/matches?player=' + id + '&d=' + discipline}>Find player fixtures</TextLink>} />
        <Panel title="Supported events" action={<Activity size={17} className="muted" />}>
          <div className="controls"><Field label="Original CSV row" type="number" min="2" value={params.get('row') || ''} onChange={row => patch({ row, page: '' }, true)} /></div>
          <EventTable filters={{ player: id, component, domain, year, state, row: params.get('row') }} discipline={discipline}
            page={params.get('page')} onPage={page => patch({ page })} />
        </Panel>
      </section>
    </>;
  }}</ApiState>;
}

function titleCaseScope(scope) {
  return scope === 'IPL_T20I' ? 'Pooled IPL + T20I' : scope;
}
