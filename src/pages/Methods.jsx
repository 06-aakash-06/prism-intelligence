import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { BookOpen, FileDown } from 'lucide-react';
import { componentNames } from '../analytics.mjs';
import { GroupBars, palette } from '../charts.jsx';
import { matchLink, useApi, useParamsState } from '../data.jsx';
import { metric } from '../player-evidence.jsx';
import { ApiState, PageHead, Panel, SectionHead, Table, TextLink, Toggle, count, fixed, signed } from '../ui.jsx';

function MathLine({ formula }) {
  const html = katex.renderToString(formula, { displayMode: true, throwOnError: false, output: 'htmlAndMathml', trust: false });
  return <div className="math-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Method({ id, title, children }) {
  const { hash } = useLocation();
  const separator = title.indexOf('. ');
  return <details id={id} className="disclosure scroll-target notebook-stage" open={hash === '#' + id ? true : undefined}>
    <summary><span className="notebook-number" aria-hidden="true">{title.slice(0, separator).padStart(2, '0')}</span>
      <span>{title.slice(separator + 2)}</span></summary><div className="detail-body">{children}</div>
  </details>;
}

const methodology = [
  ['inputs', '1. Source data and reconstructed match state', <>
    <p>Six organiser CSVs join competitions and teams to matches, playing XIs and deliveries. The ID registry retains all numeric player IDs and listed aliases.</p>
    <MathLine formula={'S_{m,e}=\\sum_{j<e}(\\mathrm{runs}_j+\\mathrm{extras1}_j+\\mathrm{extras2}_j)'} />
    <p>Wides and no-balls consume no legal ball. Known no-balls carry the free hit through following wides. Ambiguous penalty timing, dismissal credit and free-hit states withhold affected outcomes. The innings ledger keeps the original CSV row on each delivery.</p>
    <TextLink to="/audit">Inspect the source checks</TextLink>
  </>],
  ['pressure-rule', '2. Frozen V2 pre-delivery pressure', <>
    <p>Let S be runs, W wickets lost and L legal balls completed, all recorded before the delivery. Set B = 120 − L and K = 10 − W. The reference requires at least 30 earlier checked first innings in the same competition type.</p>
    <MathLine formula={'\\widehat q_{\\tau}(B)=\\frac{n_B q_{B,\\tau}+30q_{\\lfloor(B-1)/6\\rfloor,\\tau}}{n_B+30}\\quad r=D/B\\quad u=r/\\max(\\widehat q_{.50},.25)'} />
    <p>For a chase, demand D is target minus score. For a first innings, it is the gap to the historical 75th-percentile total, floored at zero. Each match supplies at most one observation per exact ball duration and one per six-ball bucket.</p>
    <MathLine formula={'\\begin{aligned} E&=[D>0]\\land[r\\le\\widehat q_{.99}]\\,, & G&=[L\\ge6\\lor W\\ge2]\\\\ H&=[B\\le30]\\land[u\\ge1]\\,, & J&=[K\\le3]\\land([B\\le30]\\lor[r\\ge.5])\\\\ R&=([W\\ge3\\land L\\le48]\\lor[W\\ge5\\land L<90]\\lor[C_{12}\\ge2])\\land[S<\\overline F L/120] \\end{aligned}'} />
    <MathLine formula={'\\begin{aligned}P_{\\mathrm{chase}}&=E\\land G\\land(H\\lor J)\\\\P_{\\mathrm{bat,first}}&=E\\land G\\land(R\\lor[L\\ge60\\land u\\ge1])\\\\P_{\\mathrm{bowl,first}}&=E\\land G\\land[L\\ge60]\\land[S\\ge\\overline F L/120]\\land([u\\ge1]\\lor[K\\le3])\\end{aligned}'} />
    <p>C₁₂ is the preceding 12-legal-ball wicket count. The duration ceiling is a historical rate. Too little history or an uncertified match state yields an unsupported label.</p>
    <TextLink to="/pressure">Run the classifier</TextLink>
  </>],
  ['expectations', '3. Contextual run expectation', <>
    <p>Models fit separately by competition using only earlier calendar years. Each fit needs at least 30 historical matches and 500 supported observations. Model choice used 2023 and 2024 comparisons. The 2025 and 2026 periods have since been inspected.</p>
    <MathLine formula={'\\mu_e=\\exp\\big(\\mathrm{clip}(\\beta_0+\\mathbf{z}_e^\\top\\boldsymbol{\\beta},-15,8)\\big)\\,,\\quad \\mathcal L=\\sum_e(\\exp(\\eta_e)-Y_e\\eta_e)+5\\sum_{j>0}\\beta_j^2'} />
    <p>The 20 features encode innings, time remaining, wickets, chase requirements, first-innings pace and incoming free hit. Standardization uses training means and standard deviations. Player identity is excluded. The link estimates a mean outcome.</p>
  </>],
  ['secondary', '4. Innings and phase secondary expectations', <>
    <MathLine formula={'\\widehat\\mu_{i,h}=\\frac{\\sum_{e\\in(i,h)}Y_e+100g_i}{n_{i,h}+100}'} />
    <p>Earlier supported binary outcomes are pooled within innings and phase, shrunk toward the earlier innings mean. Powerplay is before 36 legal balls, middle is 36–89, and death begins at 90. A known free hit has zero expected credited wickets.</p>
  </>],
  ['components', '5. Four native performance components', <>
    <Table label="Native contribution components" rows={[
      { component: 'Batting runs', observed: 'Runs credited to striker', contribution: 'Observed − expected', unit: 'Runs' },
      { component: 'Dismissal avoidance', observed: 'Supported striker dismissal indicator', contribution: 'Expected − observed', unit: 'Dismissals avoided' },
      { component: 'Bowling runs prevented', observed: 'Runs charged to bowler', contribution: 'Expected − observed', unit: 'Runs' },
      { component: 'Credited wickets', observed: 'Supported bowler wicket indicator', contribution: 'Observed − expected', unit: 'Wickets' },
    ]} columns={[{ key: 'component', label: 'Component' }, { key: 'observed', label: 'Observed outcome' },
      { key: 'contribution', label: 'Favorable residual' }, { key: 'unit', label: 'Native unit' }]} />
    <p>Each component keeps its own denominator. Wides can count for bowling. Byes and leg-byes are excluded from bowler charges. Run-outs are excluded from bowler wickets. The ordering keeps runs and secondary outcomes in their own units.</p>
  </>],
  ['rates', '6. Pressure quality, ordinary quality and uplift', <>
    <MathLine formula={'A=100\\frac{\\sum_{e\\in P}r_e}{n_P}\\,,\\quad O=100\\frac{\\sum_{e\\in O}r_e}{n_O}\\,,\\quad U=A-O'} />
    <p>Positive pressure quality means more contribution than expected. Positive uplift means greater contribution than in ordinary situations. A player can be strong in pressure with negative uplift if their ordinary performance is even stronger.</p>
  </>],
  ['matching', '7. Competition-year matching', <>
    <MathLine formula={'U_{\\mathrm{matched}}=\\frac{\\sum_g n_{P,g}(A_g-O_g)}{\\sum_g n_{P,g}}\\quad\\text{over groups with both states}'} />
    <p>Match pressure and ordinary observations within each competition-year group. Report the fraction of pressure attempts covered. The tie-break uses this contrast at 80% pressure coverage or higher. Pooled scores aggregate supported residuals and attempts without a league-strength multiplier.</p>
  </>],
  ['repetition', '8. Match-level reliability', <>
    <MathLine formula={'h_{m,s}=\\frac{100}{N_s}\\left(R_{m,s}-\\frac{n_{m,s}\\theta_s}{100}\\right),\\quad v_s=\\frac{M}{M-1}\\sum_m h_{m,s}^2,\\quad v_U=\\frac{M}{M-1}\\sum_m(h_{m,P}-h_{m,O})^2'} />
    <p>The original variance uses player matches with either state. Consistency uses matches with at least six supported attempts in the state. Positive means residual above zero. Materially adverse means below −10 runs or −2 secondary events per 100 attempts.</p>
  </>],
  ['effective', '9. Independent and effective match support', <>
    <MathLine formula={'M_{\\mathrm{eff},s}=\\frac{(\\sum_m n_{m,s})^2}{\\sum_m n_{m,s}^2}'} />
    <p>Independent matches count distinct fixtures. Effective matches decrease when attempts cluster in a few fixtures. The effective count equals the independent count when exposure is evenly distributed.</p>
  </>],
  ['removal', '10. Best-match removal', <>
    <MathLine formula={'m^*=\\arg\\max_m R_{m,P}\\,,\\quad A_{-\\mathrm{best}}=100\\frac{\\sum_{m\\ne m^*}R_{m,P}}{\\sum_{m\\ne m^*}n_{m,P}}'} />
    <p>Choose the largest total pressure contribution. Remove the entire match from both pressure and ordinary observations before recalculating pressure quality and uplift.</p>
  </>],
  ['shrinkage', '11. Original empirical-Bayes shrinkage', <>
    <MathLine formula={'\\widehat\\tau^2=\\max\\{\\operatorname{Var}(\\theta_{\\rm ref})-\\overline v_{\\rm ref},0\\},\\quad \\widetilde\\theta=\\frac{\\widehat\\tau^2}{\\widehat\\tau^2+v}\\theta'} />
    <p>References are specific to component, scope and metric. Each reference player requires 30 attempts and three matches in both states. At least ten reference players are needed. D.1 shrinks pressure, ordinary quality and uplift separately.</p>
    <p>Raw conditional intervals use 500 whole-match bootstrap draws with fitted expectations and labels held fixed. Later covariance experiments use separate estimates and do not feed the D.1 order.</p>
    <TextLink to="/reliability">Explore the uncertainty audit</TextLink>
  </>],
  ['eligibility', '12. Admission and reliability tiers', <>
    <p>Both components require at least 60 supported attempts in each state. Batting requires at least 10 independent matches per state and component, bowling at least five.</p>
    <p>Tier 1 requires positive shrunken primary quality, positive raw pressure after best-match removal, at least five qualifying matches and at least half positive. Tier 2 requires the first two conditions. Tier 3 requires positive shrunken primary quality. Tier 4 covers other eligible cases.</p>
    <TextLink to="/candidates">Change the support thresholds</TextLink>
  </>],
  ['ordering', '13. Exact Policy A order and tie-breaks', <>
    <p>Order ascending by tier. Within tier, order descending by shrunken primary pressure rounded to nine decimals, shrunken secondary pressure, matched raw uplift where there is at least 80% pressure coverage, separately shrunken uplift, effective pressure matches, independent pressure matches, and pressure attempts. Sort missing values last. Break final ties by ascending numeric ID.</p>
    <TextLink to="/rankings">See the frozen order</TextLink>
  </>],
];

export default function Methods() {
  const result = useApi('/research/methods');
  const [params, patch] = useParamsState();
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, [hash]);
  return <>
    <PageHead kicker="PRISM research system" title="Model methodology"
      description="Explore the frozen rules, component models, match reliability and exact ranking sequence."
      actions={<a className="button" href="/api/methodology-report" target="_blank" rel="noreferrer"><FileDown size={16} /> Final methodology PDF</a>} />
    <ApiState result={result}>{data => {
      const state = params.get('example') === 'ordinary' ? 'ordinary' : 'pressure';
      const example = data.examples.find(row => row.state === state);
      return <div className="grid-main notebook-example">
        <Panel title="Two actual Andre Russell fours" subtitle="Match 20202 · same observed runs, different expected runs">
          <div className="mb-2"><Toggle value={state} options={[{ value: 'pressure', label: 'Pressure four' }, { value: 'ordinary', label: 'Ordinary four' }]}
            onChange={example => patch({ example })} label="Observed and expected example" /></div>
          {example && <>
            <GroupBars rows={[{ ...example, name: 'Outcome' }]} fields={[{ key: 'Y', label: 'Observed', color: palette.batting },
              { key: 'expected', label: 'Expected', color: palette.raw }]} unit="runs" label="Russell observed runs and frozen expectation" height={129} />
            <p className="mono">{fixed(example.Y)} − {fixed(example.expected)} = <strong className="positive">{signed(example.residual)} runs</strong></p>
            <TextLink to={matchLink(example.match_id, { player: 1318, d: 'batting', component: example.component, row: example.source_row })}>Inspect original CSV row #{example.source_row}</TextLink>
          </>}
        </Panel>
        <Panel title="Frozen pooled reference variances" subtitle="Empirical-Bayes τ² by component and measure.">
          <Table label="Pooled shrinkage parameters"
            rows={Object.entries(Object.groupBy(data.shrinkage.filter(row => row.scope === 'IPL_T20I'), row => row.component))
              .map(([component, rows]) => ({ component, ...Object.fromEntries(rows.map(row => [row.metric, row.tau_squared])) }))}
            columns={[{ key: 'component', label: 'Component', render: row => componentNames[row.component] },
              metric('pressure', 'Pressure', fixed), metric('ordinary', 'Ordinary', fixed), metric('uplift', 'Uplift', fixed)]} />
          <p className="footnote">Separate parameters retain the units of each native measure.</p>
        </Panel>
      </div>;
    }}</ApiState>
    <section className="block">
      <SectionHead title="From source state to ranking" description="Expand a stage to inspect its rule or equation." action={<BookOpen size={19} className="violet" />} />
      <div className="detail-stack notebook-spine">{methodology.map(([id, title, content]) => <Method key={id} id={id} title={title}>{content}</Method>)}</div>
    </section>
    <section className="block">
      <SectionHead title="Expectation training cutoffs" description="Chronology is copied from Phase C. Each model sees only earlier calendar years." />
      <ApiState result={result}>{data => <Panel><Table label="Expectation-training chronology" rows={data.chronology} scroll columns={[
        { key: 'component', label: 'Component', render: row => componentNames[row.component] }, { key: 'domain', label: 'Competition' },
        { key: 'year', label: 'Scoring year' }, { key: 'history_latest', label: 'Latest training date' },
        metric('history_matches', 'Training matches', count), metric('training_attempts', 'Training attempts', count),
      ]} /></Panel>}</ApiState>
    </section>
  </>;
}
