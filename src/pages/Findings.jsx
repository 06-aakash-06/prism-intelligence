import { Activity, ArrowUpRight, CircleGauge, GitCompareArrows, Globe2, LockKeyhole, ScanLine, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { comparisonLink, useSnapshot } from '../data.jsx';
import { PageHead, Panel, SectionHead, TextLink, signed } from '../ui.jsx';

export default function Findings() {
  const { finalists } = useSnapshot();
  const russell = finalists.batting[0], kishan = finalists.batting.find(row => row.pid === 4117);
  const bumrah = finalists.bowling[0], narine = finalists.bowling[1];
  const patidar = finalists.batting.find(row => row.pid === 5039);
  const findings = [
    { icon: CircleGauge, title: 'Context changes the value of a run', body: 'Two identical outcomes can leave different residuals. Andre Russell’s two fours in the same fixture have different expected runs because the balls arrived in different states.',
      link: 'Inspect the observed–expected example', to: '/methodology' },
    { icon: GitCompareArrows, title: 'Shrinkage can reverse a raw order', body: 'Ishan Kishan’s ' + signed(kishan.p_pressure_quality) + ' raw batting runs per 100 exceeds Andre Russell’s ' +
      signed(russell.p_pressure_quality) + '. D.1 shrinks the two to ' + signed(kishan.p_pressure_shrunk) + ' and ' + signed(russell.p_pressure_shrunk) + ' respectively.',
      link: 'Compare Russell and Kishan', to: comparisonLink('batting', [russell.pid, kishan.pid]) },
    { icon: Activity, title: 'Absolute quality and uplift measure different things', body: 'Rajat Patidar’s ' + signed(patidar.p_pressure_quality) + ' raw pressure runs per 100 coexist with ' +
      signed(patidar.p_pressure_uplift) + ' native uplift. His ordinary adjusted rate is already strong.',
      link: 'Compare Kishan and Patidar', to: comparisonLink('batting', [kishan.pid, patidar.pid]) },
    { icon: ShieldCheck, title: 'Independent match repetition matters', body: 'Narine leads Bumrah on raw pressure contribution, and Bumrah leads after shrinkage. Repeated opportunities and exposure concentration help explain the difference.',
      link: 'Compare Bumrah and Narine', to: comparisonLink('bowling', [bumrah.pid, narine.pid]) },
    { icon: SlidersHorizontal, title: 'Selection depends on evidence thresholds', body: 'Raising the ordinary batting-attempt minimum from 60 to 120 removes Akeal Hosein from the ten and admits Ruturaj Gaikwad under the same ordering rules.',
      link: 'Inspect the threshold sensitivity', to: '/candidates?d=batting&minO=120' },
    { icon: Globe2, title: 'T20I coverage limits direct IPL interpretation', body: 'Competition-specific expectation models adjust local baselines. The pooled D.1 record still reflects the supplied mix of IPL and T20I chances. It contains no estimated league-strength conversion.',
      link: 'Compare IPL evidence shares', to: '/rankings?chart=coverage' },
    { icon: ScanLine, title: 'Rank values and intervals answer different questions', body: 'Ranks order deterministic shrunken estimates after tier assignment. Raw pressure intervals can overlap even when point estimates differ. Overlap alone is insufficient to establish equality or a dependable rank difference.',
      link: 'Inspect the raw intervals', to: '/reliability' },
    { icon: LockKeyhole, title: 'The revised estimator left selection unresolved', body: 'The covariance method addresses a sparse-sample variance failure and improves some forecasts. The paired retrospectives leave the selection advantage unresolved. D.1 remains the retained historical reference.',
      link: 'Inspect policy validation', to: '/policies' },
  ];
  return <>
    <PageHead kicker="Interpretation" title="Findings & limitations"
      description="What the organiser data allows PRISM to measure, and where the historical evidence runs out." />
    <ol className="research-brief" data-tour="research-findings">{findings.map(({ icon: Icon, title, body, link, to }, index) => <li key={title}>
      <div className="brief-index" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><Icon size={18} /></div>
      <h2>{title}</h2>
      <div><p>{body}</p><TextLink to={to}>{link}</TextLink></div>
    </li>)}</ol>
    <section className="block">
      <SectionHead title="Use the ranking in its historical scope" description="Selection decisions need additional evidence about the player and role." />
      <div className="grid-2 research-caveats">
        <Panel title="Cricket context and psychology">
          <p className="muted text-sm">The V2 classifier uses pre-delivery urgency, fragility and historical scoring plausibility. It measures an operational cricket situation. Psychological resilience, tactical intent and future performance remain unverified.</p>
          <p className="muted text-sm">The run model omits opposition strength, batting position and individual skill. The secondary model uses broader innings and phase expectations. All intervals are conditional on the frozen models and labels.</p>
        </Panel>
        <Panel title="IPL auction decisions">
          <p className="muted text-sm">D.1 is a run-first ranking of supplied historical opportunities with reliability checks. Contract status, auction eligibility, fitness, price and squad fit require separately verified evidence. None enters D.1.</p>
          <a className="text-link mt-3" href="/api/methodology-report" target="_blank" rel="noreferrer">Read the methodology report <ArrowUpRight size={14} /></a>
        </Panel>
      </div>
    </section>
  </>;
}
