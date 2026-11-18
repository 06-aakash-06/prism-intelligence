import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, Crosshair, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';
import { chapters, exampleSearch, findStep, matchesExample, steps } from './chapters.mjs';
import { num } from '../analytics.mjs';
import { signed } from '../ui.jsx';
import { WalkthroughContext, useWalkthrough } from './context.jsx';
import './walkthrough.css';

function cleanSearch(location, record) {
  const params = new URLSearchParams(location.search);
  params.delete('tour');
  for (const [name, { before, applied }] of record || []) {
    if (params.get(name) !== applied) continue;
    if (before === null) params.delete(name);
    else params.set(name, before);
  }
  return params.size ? '?' + params : '';
}

export function WalkthroughProvider({ children, snapshot }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [index, setIndex] = useState(() => findStep(new URLSearchParams(location.search).get('tour')));
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const records = useRef(new Map());
  const originalFocus = useRef(null);
  const initialLink = useRef(true);
  const step = steps[index];
  const onRoute = Boolean(step && location.pathname === step.path);
  const example = onRoute && matchesExample(step, location.search);
  const guided = Boolean(step && onRoute && example && !paused);

  function move(nextIndex, { start = false } = {}) {
    const destination = steps[nextIndex];
    if (!destination) return;
    const samePath = location.pathname === destination.path;
    const saved = records.current.get(destination.path);
    const source = samePath ? location.search : saved?.search || '';
    if (step && location.pathname !== destination.path && records.current.has(location.pathname)) {
      const record = records.current.get(location.pathname);
      record.search = location.search;
    }
    const search = exampleSearch(destination, source);
    const before = new URLSearchParams(source);
    const after = new URLSearchParams(search);
    const fields = saved?.fields || new Map();
    for (const key of Object.keys(destination.params || {})) {
      const previous = fields.get(key);
      fields.set(key, {
        before: previous && before.get(key) === previous.applied ? previous.before : before.get(key),
        applied: after.get(key),
      });
    }
    records.current.set(destination.path, { fields, search });
    setIndex(nextIndex);
    setPaused(false);
    setRevision(value => value + 1);
    navigate({ pathname: destination.path, search, hash: destination.hash || '' }, {
      replace: !start, preventScrollReset: true, state: { prismWalkthrough: true },
    });
  }

  useEffect(() => {
    if (!initialLink.current) return;
    initialLink.current = false;
    if (index >= 0) move(index);
  }); // Normalize direct links once, including chapter IDs.

  function start() {
    if (!step) {
      originalFocus.current = document.activeElement?.closest('dialog')
        ? document.querySelector('.dock-search') : document.activeElement;
      records.current.clear();
    }
    move(0, { start: !step });
    focusNarration();
  }

  function exit(goToRankings = false) {
    const record = records.current.get(location.pathname);
    const search = cleanSearch(location, record?.fields);
    const hash = step?.hash === location.hash ? '' : location.hash;
    const destination = goToRankings ? '/rankings' : { pathname: location.pathname, search, hash };
    setIndex(-1);
    setPaused(false);
    records.current.clear();
    navigate(destination, { replace: true, preventScrollReset: true });
    const trigger = originalFocus.current;
    originalFocus.current = null;
    requestAnimationFrame(() => {
      if (!goToRankings && trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
      else if (!goToRankings && trigger?.matches('.dock-search')) document.querySelector('.dock-search')?.focus({ preventScroll: true });
      else {
        const heading = document.querySelector('#content .page h1, #content h1') || document.getElementById('content');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true });
      }
    });
  }

  useEffect(() => {
    if (!step) return;
    function keydown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open], [role="dialog"]')) return;
      event.preventDefault();
      exit();
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const value = { start, target: onRoute ? step.target : undefined, highlight: guided ? step.highlight : undefined, active: Boolean(step) };
  return <WalkthroughContext.Provider value={value}>
    {children}
    {step && <WalkthroughController key="walkthrough" {...{ step, index, paused, setPaused, revision, onRoute, example, move, exit, snapshot }} />}
  </WalkthroughContext.Provider>;
}

export function WalkthroughEntry() {
  const tour = useWalkthrough();
  return <button type="button" className="tour-entry" hidden={tour.active} onClick={tour.start}>
    <span className="tour-entry-icon"><Compass size={23} aria-hidden="true" /></span>
    <span><strong>Explore PRISM</strong><small>Follow the evidence from a match situation to the final rankings.</small></span>
    <ArrowRight size={20} aria-hidden="true" />
  </button>;
}

function focusNarration() {
  requestAnimationFrame(() => document.getElementById('tour-heading')?.focus({ preventScroll: true }));
}

function findTarget(content, name) {
  if (!content) return null;
  if (window.matchMedia('(max-width: 690px)').matches) {
    const mobile = content.querySelector('[data-tour-mobile="' + name + '"]');
    if (mobile) return mobile;
  }
  return content.querySelector('[data-tour="' + name + '"]');
}

function focusEvidence(name) {
  const target = findTarget(document.getElementById('content'), name);
  if (!target) return;
  const focus = target.matches('details') ? target.querySelector('summary') : target;
  if (!focus.hasAttribute('tabindex') && !focus.matches('summary')) focus.setAttribute('tabindex', '-1');
  focus.scrollIntoView({ block: 'start', behavior: 'instant' });
  focus.focus({ preventScroll: true });
}

function Spotlight({ name, revision, enabled, onReadiness }) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const workspace = document.querySelector('.workspace');
    const content = document.getElementById('content');
    let frame;
    let target;
    let scrolled = false;
    const resize = new ResizeObserver(schedule);
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    function update() {
      const found = findTarget(content, name);
      if (found !== target) {
        if (target) resize.unobserve(target);
        target = found;
        if (target) resize.observe(target);
        scrolled = false;
      }
      if (!target || !target.getClientRects().length) {
        onReadiness({ revision, status: content?.querySelector('.skeleton') ? 'loading' : 'missing' });
        setRect(null);
        return;
      }
      onReadiness({ revision, status: 'ready' });
      const box = target.getBoundingClientRect();
      const workspaceBounds = workspace?.getBoundingClientRect();
      const floor = Math.max(0, workspaceBounds?.top ?? 0);
      const bottom = Math.min(workspaceBounds?.bottom ?? innerHeight, innerHeight);
      if (!scrolled && bottom - floor > 100) {
        scrolled = true;
        if (box.top < floor + 12 || box.bottom > bottom - 16) {
          const offset = box.top - floor - 16;
          if (workspace && getComputedStyle(workspace).overflowY === 'auto') workspace.scrollBy({ top: offset });
          else window.scrollBy({ top: offset });
        }
      }
      const actual = target.getBoundingClientRect();
      const top = Math.max(floor + 4, actual.top - 5);
      const edge = Math.min(actual.bottom + 5, bottom - 5);
      setRect(edge > top ? { top, left: Math.max(2, actual.left - 5),
        width: Math.min(actual.width + 10, innerWidth - Math.max(2, actual.left - 5) - 2),
        height: edge - top, name } : null);
    }
    const mutations = new MutationObserver(schedule);
    if (content) mutations.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
    if (workspace) resize.observe(workspace);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [name, revision, enabled, onReadiness]);
  return enabled && rect?.name === name && <div className="tour-spotlight" data-spotlight={name} aria-hidden="true"
    style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />;
}

function OrderChange({ finalists, params }) {
  const ids = params.ids.split(',').map(Number);
  const players = finalists?.[params.d]?.filter(row => ids.includes(row.pid)) || [];
  const columns = [
    { label: 'Before adjustment', key: 'p_pressure_quality' },
    { label: 'After adjustment', key: 'p_pressure_shrunk' },
  ];
  if (players.length !== ids.length || players.some(row => columns.some(({ key }) => num(row[key]) === null))) return null;

  return <figure className="tour-order">
    <figcaption>{params.d === 'batting' ? 'Extra runs' : 'Runs saved'} per 100 pressure attempts</figcaption>
    <div className="tour-order-stages">
      {columns.map(({ label, key }) => <div className="tour-order-stage" key={key}>
        <h3>{label}</h3>
        <ol aria-label={label}>
          {[...players].sort((a, b) => Number(b[key]) - Number(a[key])).map(row => <li key={row.pid}>
            <span>{row.player_name}</span><strong>{signed(row[key])}</strong>
          </li>)}
        </ol>
      </div>)}
    </div>
  </figure>;
}

function WalkthroughController({ step, index, paused, setPaused, revision, onRoute, example, move, exit, snapshot }) {
  const controller = useRef(null);
  const [readiness, setReadiness] = useState({ revision: -1, status: 'loading' });
  const chapterIndex = step.chapterIndex;
  const stepInChapter = step.chapter.steps.findIndex(item => item.id === step.id) + 1;
  const last = index === steps.length - 1;
  const guided = onRoute && !paused;
  const status = readiness.revision === revision ? readiness.status : 'loading';
  const showingExample = guided && example && status === 'ready';
  function advance() {
    if (steps[index + 1] === steps.at(-1) || document.activeElement?.closest('.tour-choices')) focusNarration();
    move(index + 1);
  }
  const narration = !onRoute ? 'You’re exploring another page.'
    : !example ? 'You’ve changed the live controls. The dashboard is now showing your selection.'
      : status === 'ready' ? step.text
        : status === 'loading' ? 'Opening the live evidence…'
          : 'This evidence is unavailable in the current view. You can keep going or return to it later.';
  const instruction = paused ? 'Select Resume to pick up where you left off.'
    : !onRoute ? 'Select “Return to example” or use the arrow to continue.'
      : status === 'loading' ? null
        : !example ? step.changedInstruction || 'Keep exploring, select “Restore example,” or continue with the arrow.'
          : status === 'ready' ? step.instruction : 'Use the arrow to continue to the next step.';
  useLayoutEffect(() => {
    const element = controller.current;
    const root = document.documentElement;
    const resize = new ResizeObserver(() => root.style.setProperty('--tour-height', element.offsetHeight + 'px'));
    resize.observe(element);
    return () => {
      resize.disconnect();
      root.style.removeProperty('--tour-height');
    };
  }, []);

  return <>
    <Spotlight name={step.target} revision={revision} enabled={guided} onReadiness={setReadiness} />
    <aside ref={controller} className="tour-controller" data-tour-step={step.id} aria-label="Walkthrough controller">
      <header className="tour-header">
        <Compass size={19} aria-hidden="true" /><span>GUIDED WALKTHROUGH</span>
        <span className="tour-count">STEP {String(index + 1).padStart(2, '0')} / {steps.length}</span>
        <button className="tour-icon" type="button" aria-label={paused ? 'Resume walkthrough' : 'Pause walkthrough'}
          title={paused ? 'Resume walkthrough' : 'Pause walkthrough'} onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button className="tour-icon" type="button" aria-label="Exit walkthrough" title="Exit walkthrough (Esc)" onClick={() => exit()}><X size={18} /></button>
      </header>
      <progress className="tour-progress" value={index + 1} max={steps.length} aria-label="Walkthrough progress" />
      <div className="tour-body">
        <div className="tour-chapters">
          <label htmlFor="tour-chapter" className="sr-only">Jump to chapter</label>
          <select id="tour-chapter" value={chapterIndex} onChange={event => move(findStep(chapters[Number(event.target.value)].id))}>
            {chapters.map((chapter, i) => <option key={chapter.id} value={i}>{String(i + 1).padStart(2, '0')} / {chapter.title}</option>)}
          </select>
          <span aria-label={'Step ' + stepInChapter + ' of ' + step.chapter.steps.length}>{stepInChapter}/{step.chapter.steps.length}</span>
        </div>
        <div className="tour-narrative" aria-live="polite" aria-atomic="true">
          <h2 id="tour-heading" key={step.id} tabIndex={-1}>{step.title}</h2>
          {showingExample && step.showOrder && <OrderChange finalists={snapshot?.finalists} params={step.params} />}
          <p className="tour-context">{paused ? 'Walkthrough paused. The dashboard is yours to explore.' : narration}</p>
          {instruction && <div className="tour-instruction">
            <span>{showingExample && step.choices ? 'Your choice' : showingExample && step.params ? 'On the dashboard' : 'What to do'}</span>
            <p>{instruction}</p>
          </div>}
        </div>
        <div className="tour-tools">
          {guided && status === 'ready' && <button className="tour-restore" type="button"
            onClick={() => focusEvidence(step.target)}><Crosshair size={13} aria-hidden="true" /> Show evidence</button>}
          {!paused && (!onRoute || !example) && <button type="button" className="tour-restore" onClick={() => move(index)}><RotateCcw size={13} />
            {onRoute ? 'Restore example' : 'Return to example'}</button>}
        </div>
        {showingExample && step.choices && <div className="tour-choices">{step.choices.map(choice =>
          <button type="button" key={choice} onClick={advance}>{choice}<ArrowRight size={13} /></button>)}</div>}
      </div>
      <footer className="tour-actions">
        <button type="button" className="tour-icon" aria-label="Restart walkthrough" title="Restart walkthrough" onClick={() => move(0)}><RotateCcw size={15} /></button>
        <button type="button" className="tour-icon" aria-label="Previous step" title="Previous step" disabled={!index} onClick={() => move(index - 1)}><ArrowLeft size={17} /></button>
        {!last && <button type="button" className="tour-icon" aria-label="Skip step" title="Skip step" onClick={advance}><SkipForward size={15} /></button>}
        {!last && <button type="button" className="tour-skip" onClick={() => exit()}>Skip tour</button>}
        {last ? <>
          <button type="button" className="tour-skip" onClick={() => exit()}>Explore on your own</button>
          <button type="button" className="tour-next" onClick={() => exit(true)}>Inspect the rankings <ArrowRight size={15} /></button>
        </> : <button type="button" className="tour-next" onClick={advance}>{step.next || 'Next step'} <ArrowRight size={15} /></button>}
      </footer>
    </aside>
  </>;
}
