import { useWalkthrough } from '../walkthrough/context.jsx';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Minus, Plus } from 'lucide-react';
import { components, componentNames, competitionShare, num } from '../analytics.mjs';
import { Coverage, Intervals, palette, PlayerBars } from '../charts.jsx';
import { comparisonLink, playerLink, useApi, useDiscipline, useParamsState, useSnapshot } from '../data.jsx';
import { Stamp } from '../instruments.jsx';
import { ApiState, Empty, Metric, PageHead, Panel, Pill, PlayerName, PlayerPicker, SectionHead, Table, Toggle, count, disciplines,
  fixed, interval, percent, signed } from '../ui.jsx';

const presets = [
  ['batting', 1318, 4117, 'Russell / Kishan'], ['bowling', 2933, 781, 'Bumrah / Narine'],
  ['batting', 3647, 37052, 'Iyer / Dhir'], ['batting', 4117, 5039, 'Kishan / Patidar'],
  ['bowling', 6355, 6256, 'Afridi / Chakravarthy'], ['bowling', 8661, 4373, 'Pathirana / Mustafizur'],
  ['batting', 7544, 6059, 'Venkatesh / Gaikwad'], ['bowling', 4373, 3174, 'Mustafizur / Henry'],
];

export default function Compare() {
  const tour = useWalkthrough();
  const [discipline, setDiscipline] = useDiscipline();
  const [params, patch] = useParamsState();
  const packet = useApi('/research/' + discipline);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState('');
  const { finalists, registry } = useSnapshot();
  const defaultIds = finalists[discipline].slice(0, 2).map(row => row.pid);
  const storageKey = 'prism-comparison-' + discipline;
  const encoded = params.get('ids') ?? localStorage.getItem(storageKey) ?? defaultIds.join(',');
  const ids = [...new Set(encoded.split(',').map(Number).filter(id => registry.some(player => player.pid === id)))].slice(0, 4);
  const temporary = params.has('tour');
  useEffect(() => { if (!temporary) localStorage.setItem(storageKey, encoded); }, [storageKey, encoded, temporary]);
  const update = selection => patch({ d: discipline, ids: selection.join(',') || 'none' });
  async function copy() {
    try { await navigator.clipboard.writeText(new URL(comparisonLink(discipline, ids), location.origin).href); setCopied('Link copied'); }
    catch { setCopied('Share the URL from the address bar'); }
  }
  return <>
    <PageHead kicker={<Stamp>Player intelligence</Stamp>} title="Comparison lab" description="Compare up to four players in one discipline. Follow the move from raw pressure quality to the D.1 shrunken estimate."
      actions={<><Toggle value={discipline} options={disciplines} label="Comparison discipline"
        onChange={next => { setAdding(false); setDiscipline(next, { ids: '' }); }} />
        <button className="button" onClick={copy}><Copy size={15} /> Copy comparison URL</button></>} />
    {copied && <p className="footnote mb-2" role="status">{copied}</p>}
    <details className="disclosure comparison-presets"><summary>Suggested comparisons</summary>
      <div className="chips detail-body">{presets.map(([d, a, b, label]) => <Link className="button small" key={label} to={comparisonLink(d, [a, b])}>{label}</Link>)}</div>
    </details>
    <ApiState result={packet}>{pool => {
      const rows = ids.map(id => pool.find(row => row.pid === id)).filter(Boolean);
      const pickerPlayers = registry.filter(player => pool.some(row => row.pid === player.pid && (num(row.p_pressure_n) > 0 || num(row.p_ordinary_n) > 0)));
      const metrics = [
        ['D.1 rank', 'rank', count], ['D.1 reliability tier', 'tier', count], ['Shrunken pressure runs / 100', 'p_pressure_shrunk', signed],
        ['Raw pressure runs / 100', 'p_pressure_quality', signed], ['Raw ordinary runs / 100', 'p_ordinary_quality', signed],
        ['Native uplift runs / 100', 'p_pressure_uplift', signed], [componentNames[components[discipline][1]] + ' shrunk / 100', 's_pressure_shrunk', signed],
        ['Pressure attempts', 'p_pressure_n', count], ['Ordinary attempts', 'p_ordinary_n', count], ['Independent pressure matches', 'p_pressure_matches', count],
        ['Effective pressure matches', 'p_pressure_effective_matches', fixed], ['Positive qualifying matches', 'p_consistency_positive_frequency', percent],
        ['Raw pressure after best-match removal', 'p_best_removed_pressure_quality', signed],
        ['IPL pressure attempts', 'IPL_p_pressure_n', count], ['T20I pressure attempts', 'T20I_p_pressure_n', count],
      ];
      const reversal = rows.flatMap(rawLeader => rows.map(shrunkenLeader => ({ rawLeader, shrunkenLeader })))
        .find(({ rawLeader, shrunkenLeader }) => [rawLeader, shrunkenLeader].every(row =>
          num(row.p_pressure_quality) != null && num(row.p_pressure_shrunk) != null)
          && Number(rawLeader.p_pressure_quality) > Number(shrunkenLeader.p_pressure_quality)
          && Number(rawLeader.p_pressure_shrunk) < Number(shrunkenLeader.p_pressure_shrunk));
      const tableRows = [...metrics.map(([label, key, format]) => ({ label, ...Object.fromEntries(rows.map(row => [row.pid, format(key === 'tier' && !row.rank ? null : row[key])])) })),
        { label: 'Raw pressure 95% interval', ...Object.fromEntries(rows.map(row => [row.pid, interval(row.p_pressure_low, row.p_pressure_high)])) }];
      return <>
        <section className="comparison-arena">
          <SectionHead title="Comparison roster" description="Frozen D.1 ranks appear for eligible players. Other roster members retain their available evidence." action={
            ids.length < 4 && <button className="button" onClick={() => setAdding(value => !value)}><Plus size={16} /> Add player</button>} />
          {adding && ids.length < 4 && <div className="mb-3 max-w-sm"><PlayerPicker label="Add a player with scored evidence" players={pickerPlayers}
            exclude={ids} autofocus onChange={id => { update([...ids, id]); setAdding(false); }} /></div>}
          <div className={'duel-roster ' + discipline + (rows.length === 2 ? ' head-to-head' : '')}>
            {rows.map(row => <article key={row.pid} className="duel-player">
            <header><PlayerName row={row} discipline={discipline} showId />
              <button className="icon-button" aria-label={'Remove ' + row.player_name} onClick={() => update(ids.filter(id => id !== row.pid))}><Minus size={15} /></button>
            </header>
            <Metric label="Shrunken pressure / 100" value={signed(row.p_pressure_shrunk)} tone={discipline === 'batting' ? 'pink' : 'blue'} />
            <Pill tone={row.rank ? 'green' : 'amber'}>{row.rank ? 'D.1 #' + row.rank + ' · Tier ' + row.tier : 'Outside D.1 gate'}</Pill>
          </article>)}</div>
          {rows.length < 2 ? <Empty title="Select at least two players" detail="Use Add player or choose a suggested comparison." />
            : <div className="grid-main compare-evidence">
              <Panel tourTarget="comparison-rates" title="Raw, shrunken and best-removed quality" subtitle="Primary runs / 100 attempts">
                <PlayerBars rows={rows} discipline={discipline} label="Raw pressure, shrunken and best removed"
                  highlightField={{ raw: "p_pressure_quality", shrunk: "p_pressure_shrunk" }[tour.highlight]}
                  fields={[{ key: 'p_pressure_quality', color: palette.raw, label: 'Raw' },
                    { key: 'p_pressure_shrunk', color: palette[discipline], label: 'Shrunken' },
                    { key: 'p_best_removed_pressure_quality', color: palette.violet, label: 'Raw best removed' }]} />
                {reversal && tour.highlight !== "raw" && <p className="footnote">{reversal.rawLeader.player_name} leads this pair on raw pressure quality.
                  {' '}{reversal.shrunkenLeader.player_name} leads after shrinkage and retains {percent(reversal.shrunkenLeader.p_pressure_shrinkage_weight)}
                  {' '}of the raw rate, compared with {percent(reversal.rawLeader.p_pressure_shrinkage_weight)} for {reversal.rawLeader.player_name}.</p>}
              </Panel>
              <Panel title="Side-by-side evidence">
                <Table label="Player comparison" columns={[{ key: 'label', label: 'Measure' },
                  ...rows.map(row => ({ key: String(row.pid), label: row.player_name, numeric: true }))]} rows={tableRows} scroll />
              </Panel>
            </div>}
        </section>
        {tour.target === 'comparison-uplift' && rows.length >= 2 && <Panel className="comparison-uplift" tourTarget="comparison-uplift"
          title="Pressure, ordinary and native uplift" subtitle="Each rate uses runs per 100 attempts. Uplift is pressure minus ordinary.">
          <PlayerBars rows={rows} discipline={discipline} label="Pressure quality, ordinary quality and native uplift"
            highlightField={tour.highlight === 'uplift' ? 'p_pressure_uplift' : undefined}
            fields={[{ key: 'p_pressure_quality', color: palette[discipline], label: 'Pressure' },
              { key: 'p_ordinary_quality', color: palette.raw, label: 'Ordinary' },
              { key: 'p_pressure_uplift', color: palette.violet, label: 'Native uplift' }]} />
          <Table label="Pressure and ordinary rates and their difference" rows={rows} columns={[
            { key: 'player_name', label: 'Player' },
            ...[['p_pressure_quality', 'Pressure'], ['p_ordinary_quality', 'Ordinary'], ['p_pressure_uplift', 'Native uplift']]
              .map(([key, label]) => ({ key, label, numeric: true, render: row => signed(row[key]) })),
          ]} />
        </Panel>}
        {rows.length >= 2 && <section className="block">
          <SectionHead title="Why the order moves" description="D.1 applies a separate uncertainty weight to each raw pressure estimate. Higher raw contribution can become lower shrunken contribution when its estimated match variance is larger." />
          <div className="grid-3 comparison-traces">
            <Panel tourTarget="comparison-matches" title="Independent and effective matches" subtitle="Primary pressure evidence">
              <PlayerBars rows={rows} discipline={discipline} label="Independent and effective pressure matches" unit="matches"
                fields={[{ key: 'p_pressure_matches', color: palette.raw, label: 'Independent' },
                  { key: 'p_pressure_effective_matches', color: palette[discipline], label: 'Effective' }]} />
            </Panel>
            <Panel title="Raw pressure intervals" subtitle="Conditional 95% whole-match bootstrap">
              <Intervals rows={rows} discipline={discipline} />
            </Panel>
            <Panel title="Competition exposure" subtitle="Share of supported primary pressure attempts">
              <Coverage rows={rows} discipline={discipline} />
              <div className="chips">{rows.map(row => <Link className="pill" to={playerLink(row.pid, discipline)} key={row.pid}>{row.player_name} · {percent(competitionShare(row))} IPL</Link>)}</div>
            </Panel>
          </div>
        </section>}
      </>;
    }}</ApiState>
  </>;
}
