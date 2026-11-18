import { Database, FileCheck2, LockKeyhole } from 'lucide-react';
import { componentNames, truth } from '../analytics.mjs';
import { useApi, useParamsState, useSnapshot } from '../data.jsx';
import { metric } from '../player-evidence.jsx';
import { ApiState, Export, Field, Metric, PageHead, Panel, Pill, SectionHead, Table, TextLink, count, titleCase } from '../ui.jsx';

const relationships = {
  'competitions.csv': 'Competition ID → matches and team mappings',
  'teams.csv': 'Competition ID + team ID → listed teams',
  'matches.csv': 'Match ID → deliveries and playing XIs',
  'ball_by_ball.csv': 'Match ID + innings + original row → delivery and player evidence',
  'playing_eleven.csv': 'Match ID + team ID + player ID → reported participation',
  'competition_team_player_mapping.csv': 'Competition ID + team ID + player ID → registered identities and aliases',
};

export default function Audit() {
  const result = useApi('/research/audit');
  const [params, patch] = useParamsState();
  const { kpis } = useSnapshot();
  return <>
    <PageHead kicker="Evidence lineage" title="Data & reproducibility"
      description="Trace every PRISM metric to a repository export. Inspect the original files, coverage exceptions and frozen validation receipts."
      actions={<a className="button" href="/api/methodology-report" target="_blank" rel="noreferrer"><FileCheck2 size={16} /> Final report</a>} />
    <ApiState result={result}>{data => {
      const find = params.get('q')?.toLowerCase().trim() || '';
      const rows = data.inventory.filter(item => (item.file + ' ' + item.purpose).toLowerCase().includes(find));
      const col = [{ key: 'file', label: 'Repository source', render: row => <span className="code-path">{row.file}</span> },
        { key: 'purpose', label: 'Dashboard evidence' }, { key: 'sha256', label: 'SHA-256', render: row => <code className="code-path hash block">{row.sha256}</code> },
        { key: 'reportBaseline', label: 'Report baseline', render: row => row.reportBaseline ? <Pill tone="green">Hash matched</Pill> : 'Indexed hash' }];
      return <>
        <div className="metrics-grid audit-tape">
          <Metric label="Organiser files" value={count(data.inputs.length)} detail="Source SHA-256 and row counts checked on index build" />
          <Metric label="Frozen ranks verified" value={data.lockReceipt.original_D1_order_exactly_reproduced.batting &&
            data.lockReceipt.original_D1_order_exactly_reproduced.bowling ? 'Both' : 'Check receipt'} detail="Batting and bowling · final lock receipt" />
          <Metric label="Frozen V2 labels replayed" value={count(kpis.supportedLabels)} detail="Supported exported delivery states" />
          <Metric label="Scored component events" value={count(kpis.eventCount)} detail="Four separate native measures" />
        </div>
        <section className="block">
          <SectionHead title="Organiser input inventory" description="The index verifies the original archive-derived CSVs against the Phase A manifest."
            action={<Pill tone="green"><LockKeyhole size={13} /> Original hashes verified</Pill>} />
          <Panel><Table label="Official organiser input files" rows={data.inputs} rowKey={row => row.file} columns={[
            { key: 'file', label: 'File', render: row => <code className="code-path">{row.file}</code> }, metric('rows', 'Rows', count),
            { key: 'keys', label: 'Key relationship', render: row => relationships[row.file] },
            { key: 'sha256', label: 'SHA-256', render: row => <code className="code-path hash block">{row.sha256}</code> },
          ]} /></Panel>
        </section>
        <section className="block">
          <SectionHead title="Reconstruction and scoring coverage" description="Phase A exact-score checks span the supplied pack. Scored player evidence uses certified IPL and T20I rows." />
          <div className="grid-2">
            <Panel title="Archived reconstruction checks">
              <Table label="Pre-delivery state checks" rows={[
                { item: 'Exact pre-score states', validated: kpis.preScore, population: kpis.deliveries },
                { item: 'Exact chase-state rows', validated: kpis.chase, population: null },
                { item: 'Supported target matches', validated: data.checks.supported_target_matches, population: null },
                { item: 'Run margin reconciliations', validated: data.checks.run_margin_pass, population: data.checks.run_margin_matches },
                { item: 'Wicket margin reconciliations', validated: data.checks.wicket_margin_pass, population: data.checks.wicket_margin_matches },
                { item: 'Completed over reconciliations', validated: data.checks.completed_overs_pass, population: data.checks.completed_overs },
              ]} columns={[{ key: 'item', label: 'Check' }, metric('validated', 'Supported', count), metric('population', 'Checked population', count)]} />
              <p className="footnote">Phase A receipt recorded {data.foundationTestCount} focused tests. Match <TextLink to="/matches/20190">#20190</TextLink> retains its wicket-margin exception.</p>
            </Panel>
            <Panel title="Fixture support by competition" subtitle="Counts include all original organiser fixtures.">
              <Table label="Fixture coverage by domain and certification" rows={data.fixtureGroups} scroll columns={[
                { key: 'domain', label: 'Domain', render: row => titleCase(row.domain) }, { key: 'status', label: 'Support status', render: row => titleCase(row.status) },
                metric('matches', 'Matches', count), metric('deliveries', 'Rows', count),
              ]} />
            </Panel>
          </div>
          <details className="disclosure mt-3">
            <summary>Attribution, free hits and out-of-scope observations</summary>
            <div className="detail-body">
              <p>Scoring preserves independent support masks for the four native components. Wides, no-balls and unrecognized delivery types do not advance legal-ball count. An incoming free hit remains through wides and known no-balls. Unclear credit, additional runs, penalties or free-hit state can suppress the affected component.</p>
              <p>Emerging and other fixtures remain open to inspection. D.1 uses the official-only IPL and T20I scope. Conditions with unsupported targets or insufficient earlier history retain their unsupported state.</p>
              <Table label="Attribution coverage" rows={data.attribution} scroll columns={[
                { key: 'component', label: 'Component', render: row => componentNames[row.component] }, { key: 'domain', label: 'Domain' }, { key: 'year', label: 'Year' },
                metric('raw_rows', 'Input rows', count), metric('attribution_supported', 'Attribution supported', count),
                metric('context_supported', 'Context supported', count),
              ]} />
            </div>
          </details>
        </section>
        <section className="block">
          <SectionHead title="Freezes and verification" description="Published research checks and dashboard ingestion assertions address different stages." />
          <div className="grid-2">
            <Panel title="Pressure and expectation chronology">
              <p className="muted text-sm">Frozen scheme <code className="code-path">{data.freeze.pressure}</code>. Same-domain V2 references use only earlier dates. Phase C uses competition-specific models trained on earlier calendar years.</p>
              <p className="muted text-sm">Earlier research records {count(data.pressureReceipt.hard_scenario_checks)} of {count(data.pressureReceipt.hard_scenario_total)} hard scenarios passing, with protected inputs {truth(data.pressureReceipt.all_prior_files_unchanged) ? 'verified unchanged' : 'requiring review'}.</p>
              <p className="muted text-sm">Model selection years {data.freeze.selection_years.join(', ')}. Retrospective evaluation years {data.freeze.evaluation_years.join(', ')}.</p>
              <TextLink to="/methodology#expectations">See fitted model details</TextLink>
            </Panel>
            <Panel title="Original Policy A lock" subtitle={'Stored receipt · ' + data.lockReceipt.status}>
              <p className="muted text-sm">{count(data.lockReceipt.focused_tests)} focused tests · {count(data.lockReceipt.adopted_tables)} adopted research tables · {count(data.lockReceipt.prior_files_checked)} protected files checked at the lock.</p>
              <p className="muted text-sm">Dashboard ingestion independently checks input hashes, all 183 eligible ranks, top-ten score strings and supported V2 replay. The export remains a research reference with human submission checks pending.</p>
              <p className="code-path">Rules SHA-256 {data.lockReceipt.rule_sha256}</p>
            </Panel>
          </div>
          <Panel className="mt-3" title="Final methodology report receipt"
            subtitle={data.reportVerification.status + ' · ' + data.reportVerification.report_pages + ' pages'}>
            <p className="muted text-sm">{count(data.reportVerification.checks.filter(item => item.pass).length)} report checks passed. The receipt records
              {' ' + count(data.reportVerification.existing_files_checked)} pre-existing files checked with
              {' ' + count(data.reportVerification.existing_files_changed.length)} changes.</p>
            <p className="code-path">Report SHA-256 {data.reportVerification.report_sha256}</p>
          </Panel>
          <Panel className="mt-3" title="Source differences and exclusions">
            <ul className="detail-stack list-disc pl-4 text-sm muted">{data.differences.map(item => <li key={item}>{item}</li>)}</ul>
          </Panel>
        </section>
        <section className="block">
          <SectionHead title="Dashboard provenance" description="Search the indexed files and export the visible source map." action={<Database size={18} className="violet" />} />
          <Panel title="Metric source inventory" action={<Export name="prism-source-inventory" columns={col} rows={rows} />}>
            <div className="controls"><Field label="File or evidence metric" value={params.get('q') || ''} onChange={q => patch({ q }, true)} /></div>
            <Table label="Dashboard source inventory" rows={rows} columns={col} rowKey={row => row.key} scroll />
          </Panel>
        </section>
      </>;
    }}</ApiState>
  </>;
}
