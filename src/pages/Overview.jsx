import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Binary, ChartNoAxesCombined, Database, Layers3, LockKeyhole, ScanLine, ShieldCheck, Target } from 'lucide-react';
import { comparisonLink, useDiscipline, useSnapshot } from '../data.jsx';
import { palette, Scatter } from '../charts.jsx';
import { count, Metric, Panel, Pill, PlayerName, SectionHead, signed, TextLink, Toggle, disciplines } from '../ui.jsx';

const pipeline = [
  { name: 'Inputs', icon: Database, to: '/audit', detail: 'Six organiser files join by fixture, team and official player ID. Reconstruct the score, wickets and legal balls before each attempt.' },
  { name: 'Pressure labels', icon: Target, to: '/pressure', detail: 'Frozen V2 uses earlier same-competition first innings to classify batting and bowling situations separately.' },
  { name: 'Expectations', icon: Binary, to: '/methodology#expectations', detail: 'Earlier-year models estimate runs and secondary outcomes from the match situation. Player identity is excluded.' },
  { name: 'Contribution', icon: ChartNoAxesCombined, to: '/methodology#components', detail: 'Compare observed and expected outcomes in four native units, then measure pressure quality, ordinary quality and uplift.' },
  { name: 'Reliability', icon: ShieldCheck, to: '/reliability', detail: 'Inspect independent and effective matches, repeated positives, shrinkage and the influence of each player’s strongest match.' },
  { name: 'Policy A', icon: Layers3, to: '/rankings', detail: 'Apply both-component admission requirements, then order by reliability tier and shrunken pressure quality.' },
];

function RankingPreview({ rows, discipline }) {
  return <Panel className={'ranking-preview ' + discipline} title={discipline === 'batting' ? 'Batting ten' : 'Bowling ten'}
    subtitle={discipline === 'batting' ? 'Contextual runs added per 100 attempts' : 'Contextual runs prevented per 100 attempts'}
    action={<Link className="icon-button" aria-label={'Open ' + discipline + ' rankings'} to={'/rankings?d=' + discipline}><ArrowUpRight size={17} /></Link>}>
    <div className="mini-table"><div className="mini-head"><span>Rank</span><span>Player</span><span>Shrunken</span></div>
      {rows.map(row => <div className="mini-row" key={row.pid}>
        <span className="mini-rank">{String(row.rank).padStart(2, '0')}</span>
        <div className="mini-player"><PlayerName row={row} discipline={discipline} />
          <div className="mini-track" aria-hidden="true"><i style={{ width: Math.max(0, Number(row.p_pressure_shrunk) / Number(rows[0].p_pressure_shrunk) * 100) + '%' }} /></div>
        </div><span className="mini-score">{signed(row.p_pressure_shrunk)}</span>
      </div>)}
    </div>
  </Panel>;
}

export default function Overview() {
  const { kpis, finalists, rankings, population } = useSnapshot();
  const [step, setStep] = useState(0);
  const [discipline, setDiscipline] = useDiscipline();
  const complete = Object.fromEntries(population.filter(row => row.status === 'ALL_NATIVE_POINT_COMPONENTS_ESTIMABLE')
    .map(row => [row.discipline, row.players]));
  const reversals = [
    { title: 'Russell overtakes Kishan', discipline: 'batting', ids: [1318, 4117] },
    { title: 'Bumrah overtakes Narine', discipline: 'bowling', ids: [2933, 781] },
  ];
  return <>
    <section className="hero">
      <div className="hero-grid" aria-hidden="true"><div className="pitch"><i /><i /><i /></div></div>
      <div className="hero-body">
        <div className="eyebrow"><span className="eyebrow-rule" /> SupeRR Selector S2 <span className="low-contrast">/</span> Round 1 research</div>
        <h1>Performance<br />under <em>pressure.</em></h1>
        <p>How much did a player contribute relative to what the situation demanded? PRISM measures contextual T20 performance, ordinary form and the reliability of the match evidence.</p>
        <div className="hero-actions">
          <Link className="button primary" to="/rankings">Explore D.1 rankings <ArrowRight size={16} /></Link>
          <Link className="button ghost" to="/methodology">See the methodology <ArrowUpRight size={15} /></Link>
        </div>
      </div>
      <div className="hero-scope">
        <div className="scope-label"><LockKeyhole size={13} /> Frozen reference</div>
        <strong>D.1 <span>Policy A</span></strong>
        <div className="scope-divider" />
        <span>IPL + T20I <b>·</b> 2023–2026 scores</span>
      </div>
    </section>

    <div className="dataset-strip" aria-label="Organiser dataset coverage">
      <Metric label="Match fixtures" value={count(kpis.matches)} detail="Across supplied competitions" />
      <Metric label="Delivery entries" value={count(kpis.deliveries)} detail="Original organiser records" />
      <Metric label="Official player IDs" value={count(kpis.players)} detail="Numeric registry" />
      <Metric label="Exact pre-score rows" value={count(kpis.preScore)} detail={count(kpis.chase) + ' supported chase states'} />
    </div>

    <section className="block">
      <SectionHead title="The selected twenty" description={rankings.batting.length + ' eligible batters · ' + rankings.bowling.length + ' eligible bowlers · frozen order'}
        action={<Pill tone="green"><LockKeyhole size={12} /> D.1 reference</Pill>} />
      <div className="grid-2 broadcast-order">
        <RankingPreview rows={finalists.batting} discipline="batting" />
        <RankingPreview rows={finalists.bowling} discipline="bowling" />
      </div>
      <p className="footnote">Complete native point estimates exist for {complete.batting} batting and {complete.bowling} bowling entries. Policy A applies separate support rules to both native components.</p>
    </section>

    <section className="block">
      <SectionHead title="Why the raw order changes" description="Estimated match uncertainty pulls less-supported rates further toward zero." />
      <div className="grid-2 reversal-ledger">{reversals.map(item => {
        const rows = item.ids.map(id => finalists[item.discipline].find(row => row.pid === id));
        return <Panel title={item.title} subtitle="Raw → shrunken pressure runs / 100 attempts" key={item.title}
          action={<Link className="icon-button" aria-label={'Compare ' + rows.map(row => row.player_name).join(' and ')}
            to={comparisonLink(item.discipline, item.ids)}><ArrowUpRight size={17} /></Link>}>
          {rows.map(row => <div className="reversal-row" key={row.pid}>
            <PlayerName row={row} discipline={item.discipline} />
            <span>{signed(row.p_pressure_quality)} <ArrowRight size={13} /> <b style={{ color: palette[item.discipline] }}>{signed(row.p_pressure_shrunk)}</b></span>
          </div>)}
        </Panel>;
      })}</div>
    </section>

    <section className="block">
      <SectionHead title="How PRISM works" description="Follow a delivery from its source row to the ranked player evidence." />
      <div className="pipeline-instrument">
        <div className="pipeline" role="group" aria-label="PRISM processing stages">{pipeline.map(({ name, icon: Icon }, index) =>
          <button key={name} aria-pressed={step === index} onClick={() => setStep(index)}><Icon size={18} /><span>{name}</span></button>)}</div>
        <div className="pipeline-detail"><ScanLine size={20} /> <p>{pipeline[step].detail}</p><TextLink to={pipeline[step].to}>Explore stage</TextLink></div>
      </div>
    </section>

    <section className="block overview-quality">
      <SectionHead title="Pressure quality and uplift" description="Quality measures contribution against expectation. Uplift compares pressure and ordinary rates for the same player."
        action={<Toggle value={discipline} onChange={setDiscipline} options={disciplines} label="Overview scatter discipline" />} />
      <Panel subtitle="Finalists · both axes use native runs per 100 attempts" title="Two dimensions of performance">
        <Scatter rows={finalists[discipline]} discipline={discipline} x="p_pressure_quality" y="p_pressure_uplift"
          xLabel="Raw pressure quality" yLabel="Native uplift" xUnit="runs / 100" yUnit="runs / 100" />
      </Panel>
      <div className="insight-banner"><ShieldCheck size={20} /><p>PRISM measures historical contributions under an operational pressure rule. Psychological resilience and future IPL performance remain unverified.</p><TextLink to="/findings">Findings & limitations</TextLink></div>
    </section>
  </>;
}
