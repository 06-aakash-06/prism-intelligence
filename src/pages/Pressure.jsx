import { ArrowDownRight, Check, CircleMinus, Crosshair, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'motion/react';
import { num, pressureState } from '../analytics.mjs';
import { axis, Chart, palette } from '../charts.jsx';
import { query, useApi, useParamsState } from '../data.jsx';
import { pressurePresets } from '../pressure-presets.mjs';
import { ScenarioSwitches, Stamp } from '../instruments.jsx';
import { ApiState, Field, PageHead, SectionHead, Select, TextLink, Toggle, count, fixed } from '../ui.jsx';

const gates = {
  attainable: ['Scoring plausibility', 'Positive demand and required pace at or below the historical 99th percentile.'],
  start: ['Early-state gate', 'At least six legal balls complete or at least two wickets down.'],
  late: ['Late urgency', 'At most 30 balls remaining and relative urgency at least 1.'],
  fragile: ['Wicket fragility', 'At most three wickets remaining and either at most 30 balls left or demand of at least 0.5 runs per ball.'],
  recovery: ['Collapse / recovery', 'Early wickets or at least two wickets in the prior 12 legal balls, with score below prior mean pace.'],
  acceleration: ['Late batting acceleration', 'At least 60 legal balls completed and relative urgency at least 1.'],
  platform: ['Bowling platform', 'At least 60 legal balls completed, score at or above historical par, and either urgency at least 1 or at most three wickets remaining.'],
};

function PressureReadout({ label, value, note, className = '' }) {
  return <div className={'pressure-readout ' + className}><dt>{label}</dt><dd>{value}</dd>{note && <dd className="readout-note">{note}</dd>}</div>;
}

function PaceGauge({ pace, median, upper }) {
  const values = [['Required', pace, 'demand'], ['Median', median, 'median'], ['99th percentile', upper, 'limit']];
  const scale = Math.max(1, ...values.map(([, value]) => Number.isFinite(value) ? value : 0));
  return <div className="pressure-gauge">
    <div className="instrument-caption"><span>Pace comparison</span><span>Runs / ball</span></div>
    <div className="gauge-track" aria-hidden="true">
      <div className="gauge-ticks" />
      {values.filter(([, value]) => Number.isFinite(value)).map(([label, value, key]) =>
        <i key={key} className={key} title={label + ': ' + fixed(value)} style={{ left: Math.max(0, value) / scale * 100 + '%' }} />)}
    </div>
    <dl>{values.map(([label, value, key]) => <PressureReadout key={key} className={key} label={label} value={fixed(value)} />)}</dl>
  </div>;
}

function Classification({ state, classified, reference, duration }) {
  const shared = classified.batting === classified.bowling;
  return <section className="classification-instrument" data-tour={reference && duration ? "pressure-readout" : undefined} id="classification-readout" tabIndex={-1} aria-labelledby="pressure-classification">
    <div className="classification-etching" aria-hidden="true" />
    <div className="instrument-caption"><h2 id="pressure-classification">Frozen V2 classification</h2><Crosshair size={16} aria-hidden="true" /></div>
    <div className={'classification-outcomes ' + (shared ? 'shared' : 'split')} aria-live="polite" aria-atomic="true">
      <motion.div key={classified.batting + '/' + classified.bowling} initial={{ opacity: 0.58, y: 5 }}
        animate={{ opacity: 1, y: 0 }} transition={{ duration: .19 }} className="outcome-types">
        {(shared ? [['Batting & bowling', classified.batting]] : [['Batting', classified.batting], ['Bowling', classified.bowling]])
          .map(([role, status]) => <div className={'outcome ' + status.toLowerCase()} key={role}><span>{role}</span><strong>{status}</strong></div>)}
      </motion.div>
    </div>
    <div className="classification-reference">
      {reference ? count(reference.matches) + ' historical matches · latest ' + reference.latest : 'No frozen prior-date reference for this cutoff'}
    </div>
    {classified.reason && <p className="classification-warning">{classified.reason}</p>}
    <dl className="classification-metrics">
      <PressureReadout label="Balls remaining" value={count(classified.B)} />
      <PressureReadout label="Wickets remaining" value={count(classified.K)} />
      <PressureReadout label={state.innings === 2 ? 'Runs required' : 'Reference demand'} value={fixed(classified.demand, state.innings === 2 ? 0 : 1)}
        note={state.innings === 1 && reference ? 'First innings 75th percentile · ' + fixed(reference.objective, 1) : undefined} />
      <PressureReadout label="Relative urgency" value={fixed(classified.urgency)}
        note="Required pace / median (floor 0.25)" />
    </dl>
    <PaceGauge pace={classified.pace} median={duration?.median} upper={duration?.upper} />
  </section>;
}

function Gate({ gate, passed }) {
  const Icon = passed === undefined ? CircleMinus : passed ? Check : X;
  const status = passed === undefined ? 'Unavailable' : passed ? 'Pass' : 'Fail';
  return <li className={'diagnostic-gate ' + status.toLowerCase()}>
    <span className="gate-signal"><Icon size={15} aria-hidden="true" /></span>
    <div><strong>{gates[gate][0]}</strong><p>{gates[gate][1]}</p></div>
    <span className="gate-verdict">{status}</span>
  </li>;
}

function RuleCanvas({ state, classified, reference, duration }) {
  const first = state.innings === 1;
  const surfaces = reference ? Object.entries(reference.duration).map(([balls, ref]) => [Number(balls), ref.median, ref.upper]) : [];
  const renderGate = gate => <Gate key={gate} gate={gate} passed={classified.gates[gate]} />;
  return <section className="block pressure-diagnostics" data-tour={reference ? "pressure-gates" : undefined}>
    <SectionHead title="Pressure-rule diagnostic" description="Follow the gates from scoring plausibility to the innings-specific triggers." />
    <div className="diagnostic-composition">
      <div className="logic-trace" aria-label="Which gates passed?">
        <div className="instrument-caption"><h3>Rule evaluation</h3><span>{first ? 'First innings' : 'Chase'}</span></div>
        <div className="logic-group"><span>Required for both roles</span><ol>{['attainable', 'start'].map(renderGate)}</ol></div>
        <div className="logic-group"><span>{first ? 'Batting · any trigger' : 'Either trigger · both roles'}</span>
          <ol>{(first ? ['recovery', 'acceleration'] : ['late', 'fragile']).map(renderGate)}</ol></div>
        {first && <div className="logic-group"><span>Bowling · required platform</span><ol>{renderGate('platform')}</ol></div>}
      </div>
      <div className="pace-envelope">
        <div className="instrument-caption"><h3>Historical pace envelope</h3><span>Earlier first innings</span></div>
        {reference ? <Chart label="Historical median and 99th-percentile scoring pace by remaining balls" height={300} option={{
          animationDuration: 140,
          grid: { left: 34, right: 21, top: 39, bottom: 32, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
          legend: { top: 0, left: 15, textStyle: { color: palette.muted } },
          xAxis: { ...axis, type: 'value', min: 1, max: 120, name: 'Legal balls remaining', nameLocation: 'middle', nameGap: 27 },
          yAxis: { ...axis, type: 'value' },
          tooltip: { trigger: 'axis', formatter: entries => entries[0]?.axisValue + ' balls left\n' +
            entries.map(entry => entry.seriesName + '  ' + fixed(entry.value[1]) + ' runs/ball').join('\n') },
          series: [
            { name: '99th percentile', type: 'line', showSymbol: false, itemStyle: { color: palette.violet },
              data: surfaces.map(([balls, , upper]) => [balls, upper]),
              markLine: duration ? { data: [{ xAxis: classified.B }], symbol: 'none', silent: true, label: { show: false } } : undefined },
            { name: 'Median', type: 'line', showSymbol: false, itemStyle: { color: palette.batting }, data: surfaces.map(([balls, median]) => [balls, median]) },
            { name: 'Simulated demand', type: 'scatter', symbolSize: 9, itemStyle: { color: palette.mint },
              data: classified.pace == null ? [] : [[classified.B, classified.pace]] },
          ],
        }} /> : <p className="muted">Select a later reference date with sufficient earlier matches to see this surface.</p>}
        <dl className="pace-annotation"><PressureReadout label="Historical par" value={fixed(classified.par)} />
          <PressureReadout label="Exact-duration observations" value={count(duration?.n)} /></dl>
        <p className="footnote">The envelope describes historical scoring pace and uses no current-delivery outcome or win probability.</p>
      </div>
    </div>
  </section>;
}

function Simulator({ dates }) {
  const [params, patch] = useParamsState();
  const domain = params.get('domain') === 'T20I' ? 'T20I' : 'IPL';
  const choices = dates.filter(row => row.domain === domain);
  const date = params.get('date') || choices.findLast(row => row.supported)?.date || '';
  const result = useApi(date ? '/pressure?' + query({ domain, date }) : null);
  const state = Object.fromEntries(Object.entries(pressurePresets[0]).filter(([key]) => key !== 'label')
    .map(([key, value]) => [key, params.has(key) ? params.get(key) === 'unset' ? null : num(params.get(key)) : value]));
  const selected = pressurePresets.find(({ label: _label, ...preset }) => Object.entries(preset)
    .every(([key, value]) => key === 'prior12' && state.innings === 2 || state[key] === value))?.label;
  const apply = ({ label: _label, ...preset }) => patch({ ...preset, target: preset.target ?? 'unset' });
  const change = (key, value) => patch({ [key]: value || 'unset' }, true);
  const first = state.innings === 1;
  const slider = Math.max(0, Math.min(120, state.L ?? 0));
  const reference = result.data?.reference;
  const duration = reference?.duration[120 - state.L];
  const classified = result.data ? pressureState({ ...state, prior12: first ? state.prior12 : 0 },
    duration ? { ...duration, mean: reference.mean, objective: reference.objective } : null) : null;
  const outcome = classified && (classified.batting === classified.bowling ? classified.batting
    : 'Bat ' + classified.batting + ' / Bowl ' + classified.bowling);
  return <>
    <div className="lab-composition">
      <section className="state-instrument" data-tour="pressure-controls" aria-labelledby="match-state">
        <div className="instrument-caption"><h2 id="match-state">Match-state controls</h2><SlidersHorizontal size={15} aria-hidden="true" />
          {outcome && <a href="#classification-readout" className={'mobile-outcome ' + classified.batting.toLowerCase()}
            aria-label={'View classification: ' + outcome}>{outcome}<ArrowDownRight size={12} aria-hidden="true" /></a>}
        </div>
        <div className="history-fields">
          <Select label="Competition type" value={domain} options={['IPL', 'T20I']} onChange={domain => patch({ domain, date: '' })} />
          <Select label="Historical reference date" value={date} options={choices.map(row => ({
            value: row.date, label: row.date + (row.supported ? '' : ' · insufficient history'),
          })).reverse()} onChange={date => patch({ date })} />
        </div>
        <div className="innings-switch"><span>Innings</span><Toggle label="Innings" value={String(state.innings)}
          options={[{ value: '1', label: 'First innings' }, { value: '2', label: 'Chase' }]}
          onChange={innings => patch({ innings, target: innings === '2' && state.target === null ? 180 : state.target })} /></div>
        <div className="score-controls">
          <Field label="Runs scored" type="number" value={state.S} min={0} onChange={value => change('S', value)} />
          <Field label="Wickets lost" type="number" value={state.W} min={0} max={10} onChange={value => change('W', value)} />
          {first
            ? <Field label="Wickets in last 12 legal balls" type="number" value={state.prior12} min={0} max={state.W || 0}
              onChange={value => change('prior12', value)} />
            : <Field label="Chase target" type="number" value={state.target} min={1} onChange={value => change('target', value)} />}
        </div>
        <div className="innings-position">
          <div className="position-slider">
            <label htmlFor="innings-progress">Innings position</label>
            <input id="innings-progress" type="range" min={0} max={120} value={slider}
              aria-valuetext={slider + ' legal balls completed'} onChange={event => change('L', event.target.value)} />
            <div className="position-ticks" aria-hidden="true"><span>0</span><span>30</span><span>60</span><span>90</span><span>120</span></div>
          </div>
          <Field label="Legal balls completed" type="number" value={state.L} min={0} max={120} onChange={value => change('L', value)} />
        </div>
        <div className="preset-block" data-tour-mobile="pressure-controls"><div className="instrument-caption"><span>Scenario presets</span><ArrowDownRight size={14} aria-hidden="true" /></div>
          <ScenarioSwitches scenarios={pressurePresets} selected={selected} onChange={apply} label="Scenario presets" /></div>
        <p className="footnote">The simulator assumes a standard 120-ball innings. The selected date limits the reference to earlier matches.</p>
      </section>
      <ApiState result={result}>{() => <>
        <Classification state={state} classified={classified} reference={reference} duration={duration} />
        <RuleCanvas state={state} classified={classified} reference={reference} duration={duration} />
      </>}</ApiState>
    </div>
  </>;
}

export default function Pressure() {
  const result = useApi('/pressure');
  return <>
    <PageHead kicker={<Stamp tone="pink">Frozen V2</Stamp>} title="Pressure Explorer"
      description="Set a pre-delivery match state and test it against the historical scoring envelope."
      actions={<TextLink to="/methodology#pressure-rule">Classifier equations</TextLink>} />
    <ApiState result={result}>{({ dates }) => <Simulator dates={dates} />}</ApiState>
  </>;
}
