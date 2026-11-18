import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CircleHelp } from 'lucide-react';
import { componentNames, components, num, residualEquation, truth } from '../analytics.mjs';
import { axis, Chart, GroupBars, palette } from '../charts.jsx';
import { matchLink, playerLink, query, useApi, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { EventTable, eventUnit, metric, StatePill } from '../player-evidence.jsx';
import { ApiState, Empty, Export, Field, Metric, PageHead, Pager, Panel, Pill, PlayerPicker, SectionHead, Select, Table, TextLink,
  Toggle, count, disciplines, fixed, signed, titleCase } from '../ui.jsx';

const stateOptions = [{ value: '', label: 'Any state' }, { value: 'pressure', label: 'Pressure' }, { value: 'ordinary', label: 'Ordinary' },
  { value: 'unsupported', label: 'Unsupported' }];
const inningsOptions = [{ value: '', label: 'All innings' }, { value: '1', label: 'First innings' }, { value: '2', label: 'Chase' }];
const componentOptions = [ { value: '', label: 'All components' }, ...Object.entries(componentNames).map(([value, label]) => ({ value, label })) ];

function MatchList() {
  const [params, patch] = useParamsState();
  const [discipline, setDiscipline] = useDiscipline();
  const { domains, years } = useSnapshot();
  const filters = Object.fromEntries(['q', 'player', 'domain', 'year', 'innings', 'state', 'component', 'page'].map(key => [key, params.get(key) || '']));
  const result = useApi('/matches?' + query({ ...filters, discipline }));
  const update = (key, value, replace = false) => patch({ [key]: value, page: '' }, replace);
  const columns = [
    { key: 'match_id', label: 'Match ID', numeric: true, render: row => <Link className="text-link mono"
      to={matchLink(row.match_id, { player: filters.player, component: filters.component, innings: filters.innings, state: filters.state, d: discipline })}>#{row.match_id} <ArrowUpRight size={12} /></Link> },
    { key: 'match_date', label: 'Date', className: 'nowrap' }, { key: 'fixture', label: 'Fixture', value: row => row.home_team + ' v ' + row.away_team,
      render: row => <Link className="player-link" to={matchLink(row.match_id, { player: filters.player, component: filters.component,
        innings: filters.innings, state: filters.state, d: discipline })}>{row.home_team} v {row.away_team}</Link> },
    { key: 'domain', label: 'Domain' }, { key: 'competition', label: 'Competition' },
    { key: 'status', label: 'Reconstruction', value: row => titleCase(row.status),
      render: row => <Pill tone={row.status === 'fully_usable' ? 'green' : 'amber'}>{titleCase(row.status)}</Pill> },
    metric('raw_rows', 'Delivery rows', count),
  ];
  return <>
    <PageHead kicker="Original organiser data" title="Match explorer"
      description="Find a fixture, inspect the innings state before each delivery, and trace supported player observations to their source rows."
      actions={<Toggle label="Match state discipline" value={discipline} onChange={next => setDiscipline(next, { page: '' })} options={disciplines} />} />
    <Panel title="Fixture index" subtitle="Filters query the local organiser fixture and delivery indexes.">
      <div className="controls">
        <Field label="Match, team or competition" value={filters.q} onChange={value => update('q', value, true)} placeholder="e.g. 20202 or Mumbai" />
        <PlayerPicker label="Player in fixture" value={filters.player} onChange={value => update('player', value)} />
        <Select label="Competition type" value={filters.domain} options={[{ value: '', label: 'All competitions' }, ...domains]} onChange={value => update('domain', value)} />
        <Select label="Year" value={filters.year} options={[{ value: '', label: 'All years' }, ...years.map(String)]} onChange={value => update('year', value)} />
        <Select label="Innings" value={filters.innings} options={inningsOptions} onChange={value => update('innings', value)} />
        <Select label="V2 classification" value={filters.state} options={stateOptions} onChange={value => update('state', value)} />
        <Select label="Scored component" value={filters.component} options={componentOptions} onChange={value => update('component', value)} />
      </div>
      {filters.component && filters.state === 'unsupported' && <p className="footnote mb-2">Unsupported labels have no scored component. Select all components to search unscored V2 rows.</p>}
      <ApiState result={result}>{data => <>
        <div className="flex justify-end mb-2"><Export name={'prism-fixtures-page-' + data.page} columns={columns} rows={data.rows} /></div>
        <Table label="Organiser match results" rows={data.rows} columns={columns} rowKey={row => row.match_id} />
        <Pager page={data.page} total={data.total} pageSize={data.pageSize} onChange={page => patch({ page })} />
      </>}</ApiState>
    </Panel>
  </>;
}

function InningsTimeline({ data, selected, onSelect, player, discipline, innings }) {
  const [focusPlayer, setFocusPlayer] = useState(false);
  const key = discipline === 'batting' ? 'bat' : 'bowl';
  const traces = Object.entries(Object.groupBy(data.filter(row => !innings || row.innings === Number(innings)), row => row.innings));
  const filterTrace = trace => trace.filter(row => !focusPlayer || row[discipline === 'batting' ? 'striker' : 'bowler'] === Number(player));
  return <>
    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
      <div className="chips"><StatePill state="pressure" /><StatePill state="ordinary" /><StatePill state="unsupported" /></div>
      {player && <label className="flex items-center gap-2 text-xs muted"><input type="checkbox" checked={focusPlayer}
        onChange={event => setFocusPlayer(event.target.checked)} /> Isolate selected player’s deliveries</label>}
    </div>
    {traces.map(([number, input]) => {
      const trace = filterTrace(input);
      if (!trace.length) return <Empty key={number} title={'No selected player deliveries in innings ' + number} />;
      return <div key={number} className="mb-3">
        <div className="matchline"><span>Innings {number}</span><div className="matchline-balls">
          {trace.map((row, index) => <button key={row.row} className={row[key]} aria-label={'CSV row ' + row.row + ', ' + row[key]}
            title={'Over ' + row.over + ' · CSV row ' + row.row + ' · ' + row[key]}
            tabIndex={row.row === Number(selected) || index === 0 ? 0 : -1} aria-pressed={row.row === Number(selected)}
            onClick={() => onSelect(row.row)}
            onKeyDown={event => {
              if (event.key === 'ArrowRight') event.currentTarget.nextElementSibling?.focus();
              if (event.key === 'ArrowLeft') event.currentTarget.previousElementSibling?.focus();
            }} />)}
        </div></div>
        <Chart height={188} label={'Innings ' + number + ' pre-delivery score and pressure'} onClick={event => onSelect(trace[event.dataIndex].row)}
          option={{
            grid: { left: 8, right: 12, top: 11, bottom: 24, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
            xAxis: { ...axis, type: 'category', data: trace.map(row => row.over), axisLabel: { ...axis.axisLabel, hideOverlap: true } },
            yAxis: { ...axis, type: 'value' },
            tooltip: { formatter: ({ dataIndex }) => {
              const row = trace[dataIndex];
              return 'Over ' + row.over + ' · row ' + row.row + '\nPre-delivery: ' + count(row.score) + '/' + count(row.wickets) +
                ' · ' + titleCase(row[key]) + (row.required == null ? '' : '\nRequired: ' + count(row.required) + ' runs');
            } },
            series: [{ name: 'Pre-delivery runs', type: 'line', showSymbol: true, symbolSize: 4,
              lineStyle: { color: palette[discipline], width: 1.5 }, itemStyle: { color: palette[discipline] },
              data: trace.map(row => ({ value: row.score, itemStyle: { color: row[key] === 'pressure' ? palette.batting : palette.raw } })) }],
          }} />
      </div>;
    })}
    {!traces.length && <Empty title="No deliveries in this innings" />}
    <p className="footnote">Each strip mark is a source delivery entry in reconstruction order. The chart shows runs before the delivery. Hover for wickets and chase demand.</p>
  </>;
}

function DeliveryInspector({ row, match, selectedComponent, player }) {
  const info = useApi(row ? '/delivery/' + row : null);
  const { registry } = useSnapshot();
  const name = id => registry.find(player => player.pid === num(id))?.name;
  if (!row) return <Empty title="Select a delivery" detail="Click a timeline mark or a CSV row in the supported-events table." />;
  return <ApiState result={info}>{detail => {
    if (Number(match) !== detail.match_id) return <Empty title="This row belongs to another fixture" />;
    const source = detail.payload, label = detail.label;
    const events = detail.events.filter(event => (!selectedComponent || selectedComponent === event.component) && (!player || Number(player) === Number(event.pid)));
    return <>
      <div className="chips mb-2"><Pill>ball_by_ball.csv · row {count(detail.row)}</Pill>
        <Pill>Innings {detail.innings} · Over {source.overid}.{source.over_ball_num}</Pill></div>
      <div className="grid-2 mb-2">
        <div><span className="muted text-xs">Batting state </span><StatePill state={detail.bat} /></div>
        <div><span className="muted text-xs">Bowling state </span><StatePill state={detail.bowl} /></div>
      </div>
      <div className="metrics-grid">
        <Metric label="Pre-delivery runs / wickets" value={count(source.runs_before_exact) + ' / ' + count(source.wickets_before)} />
        <Metric label="Legal balls left" value={count(source.balls_remaining)} detail={'Legal delivery: ' + (truth(source.legal_delivery) ? 'yes' : 'no')} />
        <Metric label="Target / required" value={count(source.target_before) + ' / ' + count(source.runs_required_before)} />
        <Metric label="Demand / median / ceiling" tone="compact" value={[label?.required_pace, label?.median_pace, label?.capacity_pace].map(value => fixed(value, 1)).join(' / ')} detail="Runs per ball" />
      </div>
      <div className="chips mt-3">
        {num(source.striker_id) && <TextLink to={playerLink(source.striker_id, 'batting')}>{name(source.striker_id) || '#' + source.striker_id}</TextLink>}
        {num(source.bowler_id) && <TextLink to={playerLink(source.bowler_id, 'bowling')}>{name(source.bowler_id) || '#' + source.bowler_id}</TextLink>}
      </div>
      {detail.bat === 'unsupported' ? <p className="footnote">{label?.unsupported_reason || 'No row is present in the primary V2 label export for this delivery.'}</p> :
        <div className="mt-3">
          <div className="chips">{[
            ['Plausibility', truth(label?.attainable)], ['Start gate', num(source.legal_balls_before) >= 6 || num(source.wickets_before) >= 2],
            ...(detail.innings === 2 ? [['Late urgency', truth(label?.late_urgent)], ['Fragility', truth(label?.fragile_region)]]
              : [['Recovery', truth(label?.recovery_region)], ['Acceleration', truth(label?.acceleration_region)],
                ['Bowling platform', num(source.legal_balls_before) >= 60 &&
                  num(source.runs_before_exact) >= Number(label?.first_mean) * Number(source.legal_balls_before) / 120 &&
                  (num(label?.urgency) >= 1 || num(source.wickets_before) >= 7)]]),
          ].map(([name, pass]) => <Pill key={name} tone={pass ? 'green' : ''}>{name} · {pass ? 'Pass' : 'Fail'}</Pill>)}</div>
          <p className="footnote">Historical reference latest {label?.training_latest || '—'} · Relative urgency {fixed(label?.urgency)} · Prior 12-legal-ball wickets {count(label?.prior12_wickets)}.</p>
        </div>}
      <div className="detail-stack mt-3" data-tour={events.length ? "event-outcome" : undefined}>
        {events.map(event => <details key={event.component} className="disclosure" open={events.length === 1 ? true : undefined}>
          <summary>{componentNames[event.component]} · {signed(event.residual)} {eventUnit(event.component)}</summary>
          <div className="detail-body">
            <p className="mono">{residualEquation(event.component)} = {signed(event.residual)} {eventUnit(event.component)}</p>
            <p>Frozen model {event.selected_model} · History latest {event.history_latest} · {truth(event.free_hit) ? 'Incoming free hit' : 'No incoming free hit'}</p>
            <GroupBars label="Observed and expected outcome" rows={[{ name: 'Outcome', observed: event.Y, expected: event.expected }]}
              fields={[{ key: 'observed', color: palette.batting, label: 'Observed' }, { key: 'expected', color: palette.raw, label: 'Expected' }]}
              unit={eventUnit(event.component)} height={107} />
            <div className="code-path">Observed {event.Y} · Expected {event.expected} · Residual {event.residual}</div>
          </div>
        </details>)}
        {!events.length && <p className="footnote">No stored scored event matches the selected player and component on this delivery.</p>}
      </div>
    </>;
  }}</ApiState>;
}

function MatchDetail({ id }) {
  const [params, patch] = useParamsState();
  const [discipline, setDiscipline] = useDiscipline();
  const { registry } = useSnapshot();
  const player = params.get('player') || '';
  const state = params.get('state') || '';
  const innings = params.get('innings') || '';
  const component = params.get('component') || '';
  const detail = useApi('/match/' + id + '?' + query({ player }));
  const update = (key, value) => patch({ [key]: value, page: '' });
  const back = '/matches?' + query({ player, d: discipline, state, component });
  return <ApiState result={detail}>{data => {
    const { match } = data;
    const selected = params.get('row') || data.timeline.find(row => row[discipline === 'batting' ? 'bat' : 'bowl'] === 'pressure' &&
      (!player || row[discipline === 'batting' ? 'striker' : 'bowler'] === Number(player)) && (!innings || row.innings === Number(innings)))?.row;
    const searchPlayer = registry.find(entry => entry.pid === num(player));
    return <>
      <Link className="text-link mb-2" to={back}><ArrowLeft size={15} /> Fixture search</Link>
      <PageHead kicker={'Match #' + id + ' · ' + match.domain + ' · ' + match.match_date} title={match.home_team + ' v ' + match.away_team}
        description={match.competition + ' · ' + match.result}
        actions={<Toggle label="Innings timeline discipline" value={discipline} onChange={next => setDiscipline(next, { row: '' })} options={disciplines} />} />
      <div className="metrics-grid match-metadata">
        <Metric label="Organiser match row" value={count(match.match_source_row)} detail="matches.csv" />
        <Metric label="Delivery rows" value={count(match.raw_rows)} detail={count(match.exact_pre_score_rows) + ' exact pre-score states'} />
        <Metric label="Exact chase states" value={count(match.exact_chase_rows)} detail={titleCase(match.status)} />
        {data.innings.map(item => <Metric key={item.innings} label={'Innings ' + item.innings + ' reconstructed runs'}
          value={count(item.total_runs_exact)} detail={count(item.observed_legal_balls) + ' legal balls'} />)}
      </div>
      <section className="block">
        <SectionHead title="Innings and delivery evidence" description={match.reasons} />
        <div className="grid-main timeline-canvas">
          <Panel className="innings-instrument" title="Innings progression" subtitle="Pre-delivery runs with Frozen V2 pressure strips">
            <a className="text-link inspector-jump" href="#delivery-inspector">Inspect selected delivery <ArrowDownRight size={14} /></a>
            <InningsTimeline data={data.timeline} selected={selected} innings={innings} player={player} discipline={discipline} onSelect={row => patch({ row })} />
          </Panel>
          <div className="delivery-inspection" id="delivery-inspector" tabIndex={-1}>
            <Panel title="Delivery inspector" action={<CircleHelp size={16} className="muted" />}>
              <DeliveryInspector row={selected} match={id} selectedComponent={component} player={player} />
            </Panel>
          </div>
        </div>
      </section>
      <section className="block">
        <SectionHead title="Scored player events" description={searchPlayer ? 'Filtered to ' + searchPlayer.name + ' · #' + searchPlayer.pid : 'All supported player events in this fixture.'} />
        <Panel title="Event ledger" subtitle={data.componentCounts.map(item => componentNames[item.component] + ' ' + count(item.n)).join(' · ') || 'No supported component evidence in this scope'}>
          <div className="controls">
            <PlayerPicker value={player} onChange={value => update('player', value)} label="Filter player" />
            <Select label="Innings" value={innings} onChange={value => update('innings', value)} options={inningsOptions} />
            <Select label="V2 classification" value={state} onChange={value => update('state', value)} options={stateOptions} />
            <Select label="Component" value={component} onChange={value => update('component', value)} options={componentOptions} />
            <Field label="CSV row" type="number" min={2} value={params.get('findRow') || ''} onChange={value => patch({ findRow: value, page: '' }, true)} />
          </div>
          <EventTable filters={{ match: id, player, state, innings, component, row: params.get('findRow') }}
            page={params.get('page')} onPage={page => patch({ page })}
            onRow={event => patch({ row: event.source_row, d: components.batting.includes(event.component) ? 'batting' : 'bowling' })}
            discipline={discipline} />
        </Panel>
      </section>
    </>;
  }}</ApiState>;
}

export default function Matches() {
  const { id } = useParams();
  return id ? <MatchDetail id={id} /> : <MatchList />;
}
