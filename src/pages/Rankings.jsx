import { useState } from 'react';
import { LockKeyhole, SlidersHorizontal } from 'lucide-react';
import { competitionShare, componentNames, components } from '../analytics.mjs';
import { Coverage, Intervals, palette, PlayerBars, Scatter } from '../charts.jsx';
import { comparisonLink, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { Stamp } from '../instruments.jsx';
import { metric } from '../player-evidence.jsx';
import { Empty, Export, Field, PageHead, Panel, Pill, PlayerName, SectionHead, Select, Table, TextLink, Toggle, count,
  disciplines, fixed, interval, percent, signed, sortRows } from '../ui.jsx';

export default function Rankings() {
  const { rankings } = useSnapshot();
  const [discipline, setDiscipline] = useDiscipline();
  const [params, patch] = useParamsState();
  const [sort, setSort] = useState({ key: 'rank', direction: 'asc' });
  const [extras, setExtras] = useState(['p_pressure_quality', 'p_pressure_uplift', 'p_pressure_matches', 'p_pressure_effective_matches', 'tier']);
  const [comparison, setComparison] = useState([]);
  const view = params.get('pool') === 'eligible' ? 'eligible' : 'finalists';
  const finder = params.get('q') || '';
  const tier = params.get('tier') || '';
  const chartView = params.get('chart') || 'quality';
  const eligible = rankings[discipline];
  const primaryUnit = 'runs / 100 attempts';
  const rows = eligible.filter(row => (view === 'eligible' || row.rank <= 10) && (!tier || row.tier === Number(tier)) &&
    (row.player_name.toLowerCase().includes(finder.toLowerCase().trim()) || String(row.pid).includes(finder.trim())));
  const display = rows.slice(0, 10);
  const options = [
    metric('p_pressure_quality', 'Raw pressure'), metric('p_ordinary_quality', 'Raw ordinary'), metric('p_pressure_uplift', 'Native uplift'),
    metric('s_pressure_shrunk', 'Secondary shrunk (events/100)'), metric('p_pressure_n', 'Pressure attempts', count),
    metric('p_ordinary_n', 'Ordinary attempts', count), metric('p_pressure_matches', 'Independent matches', count),
    metric('p_pressure_effective_matches', 'Effective matches', fixed), metric('p_consistency_positive_frequency', 'Positive match %', percent),
    metric('p_best_removed_pressure_quality', 'Raw best removed'), metric('p_consistency_materially_adverse_frequency', 'Adverse match %', percent),
    { key: 'tier', label: 'Reliability tier', numeric: true, render: row => <Pill tone={row.tier === 1 ? 'green' : ''}>Tier {row.tier}</Pill> },
    { key: 'ipl', label: 'IPL / T20I attempts', numeric: true, value: competitionShare,
      exportValue: row => (row.IPL_p_pressure_n ?? 0) + ' / ' + (row.T20I_p_pressure_n ?? 0),
      render: row => count(row.IPL_p_pressure_n ?? 0) + ' / ' + count(row.T20I_p_pressure_n ?? 0) },
    { key: 'iplShare', label: 'IPL evidence share', numeric: true, value: competitionShare, render: row => percent(competitionShare(row)) },
    { key: 'raw_interval', label: 'Raw pressure 95% interval', sortable: false, value: row => interval(row.p_pressure_low, row.p_pressure_high),
      render: row => interval(row.p_pressure_low, row.p_pressure_high) },
  ];
  const columns = [
    { key: 'rank', label: 'Rank', numeric: true, className: 'rank-col' },
    { key: 'player_name', label: 'Player', render: row => <PlayerName row={row} discipline={discipline} /> },
    { key: 'pid', label: 'Official ID', numeric: true },
    metric('p_pressure_shrunk', 'Shrunken pressure'),
    ...options.filter(column => extras.includes(column.key)),
    { key: 'compare', label: 'Compare', sortable: false, render: row => <input type="checkbox" aria-label={'Compare ' + row.player_name}
      checked={comparison.includes(row.pid)} disabled={comparison.length >= 4 && !comparison.includes(row.pid)}
      onChange={event => setComparison(ids => event.target.checked ? [...ids, row.pid] : ids.filter(id => id !== row.pid))} /> },
  ];
  const chartOptions = [{ value: 'quality', label: 'Quality & uplift' }, { value: 'shrinkage', label: 'Raw & shrunken' },
    { value: 'support', label: 'Sample support' }, { value: 'coverage', label: 'IPL share' }, { value: 'intervals', label: 'Raw intervals' }];
  return <>
    <PageHead kicker={<Stamp tone="pink">D.1 · Frozen Policy A</Stamp>} title="Player rankings" description="Explore the original organiser-only pooled order. Table sorting and filters leave each player’s official rank intact."
      actions={<Toggle value={discipline} onChange={next => { setComparison([]); setDiscipline(next, { tier: '', q: '' }); }}
        options={disciplines} label="Ranking discipline" />} />
      <div className="controls ranking-tools">
        <Select label="Population" value={view} onChange={pool => patch({ pool })} options={[
          { value: 'finalists', label: 'Final ten' }, { value: 'eligible', label: 'All ' + eligible.length + ' eligible' },
        ]} />
        <Field label="Find player" value={finder} placeholder="Name or official ID" onChange={q => patch({ q }, true)} />
        <Select label="Tier" value={tier} onChange={tier => patch({ tier })} options={[{ value: '', label: 'All tiers' },
          ...[1, 2, 3, 4].map(value => ({ value, label: 'Tier ' + value }))]} />
        {comparison.length >= 2 && <TextLink primary to={comparisonLink(discipline, comparison)}>Compare {comparison.length} players</TextLink>}
      </div>
    <section className="ranking-stage">
      <SectionHead title="What drives the order" description="Marks open player profiles. Charts with ten rows use the first ten matching players in frozen rank order." />
      <div className="grid-2 ranking-spread">
        <Panel tourTarget="ranking-order" title="Shrunken pressure contribution" subtitle={primaryUnit} className="ranking-signal">
          {display[0] && <div className="ranking-lead">
            <span className="ranking-lead-number">{String(display[0].rank).padStart(2, '0')}</span>
            <div><span className="chart-subtitle">Leading result in view</span><PlayerName row={display[0]} discipline={discipline} /></div>
            <strong className={discipline === 'batting' ? 'pink' : 'blue'}>{signed(display[0].p_pressure_shrunk)}</strong>
          </div>}
          <PlayerBars rows={display} fields={[{ key: 'p_pressure_shrunk', color: palette[discipline], label: 'Shrunken pressure' }]}
            discipline={discipline} label="Frozen ranking bars" height={Math.max(224, display.length * 30 + 47)} />
        </Panel>
        <Panel title="Ranking evidence" subtitle="Choose an analytical view">
          <div className="mb-2"><Toggle value={chartView} onChange={chart => patch({ chart })} options={chartOptions} label="Ranking evidence chart" /></div>
          {!display.length ? <Empty /> : chartView === 'intervals' ? <Intervals rows={display} discipline={discipline} />
            : chartView === 'coverage' ? <Coverage rows={display} discipline={discipline} />
              : chartView === 'shrinkage' ? <PlayerBars rows={display} discipline={discipline} label="Raw and shrunken pressure contribution"
                fields={[{ key: 'p_pressure_quality', color: palette.raw, label: 'Raw pressure' },
                  { key: 'p_pressure_shrunk', color: palette[discipline], label: 'Shrunken pressure' }]} />
                : chartView === 'support' ? <Scatter rows={rows} discipline={discipline} x="p_pressure_effective_matches" y="p_pressure_shrunk"
                  xLabel="Effective matches" yLabel="Shrunken pressure" xUnit="matches" yUnit={primaryUnit} />
                  : <Scatter rows={rows} discipline={discipline} x="p_pressure_quality" y="p_pressure_uplift"
                    xLabel="Raw pressure quality" yLabel="Native uplift" xUnit={primaryUnit} yUnit={primaryUnit} />}
          {chartView === 'intervals' && <p className="footnote">Intervals describe raw pressure quality conditional on the fitted expectations and V2 labels.</p>}
        </Panel>
      </div>
    </section>
    <section className="block rankings-ledger">
    <Panel title={discipline === 'batting' ? 'Batting order' : 'Bowling order'}
      subtitle={'Primary ' + primaryUnit + ' · secondary ' + componentNames[components[discipline][1]].toLowerCase() + ' per 100 attempts'}
      action={<Pill tone="green"><LockKeyhole size={12} /> IPL + T20I</Pill>}>
      <details className="disclosure mb-3">
        <summary><SlidersHorizontal size={13} className="inline mr-1" /> Table columns</summary>
        <div className="detail-body choice-list">{options.map(column => <label key={column.key}><input type="checkbox" checked={extras.includes(column.key)}
          onChange={event => setExtras(keys => event.target.checked ? [...keys, column.key] : keys.filter(key => key !== column.key))} />{column.label}</label>)}</div>
      </details>
      <Table label="Frozen D.1 rankings" columns={columns} rows={sortRows(rows, columns, sort)} sort={sort} setSort={setSort} scroll />
      <div className="flex items-center justify-between gap-2 mt-2"><p className="chart-subtitle">{rows.length} displayed · Select 2–4 players to compare.</p>
        <Export name={'prism-d1-' + discipline} columns={columns.filter(column => column.key !== 'compare')} rows={sortRows(rows, columns, sort)} /></div>
    </Panel>
    </section>
  </>;
}
