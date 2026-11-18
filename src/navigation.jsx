import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeftRight, ArrowUpRight, ChartNoAxesColumnIncreasing, ChevronRight, ChevronsRight, Compass, Database, FileCheck2,
  FlaskConical, GitCompareArrows, Layers3, LayoutGrid, Search, ShieldCheck, Target, UserRound, UsersRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useWalkthrough } from './walkthrough/context.jsx';
import { playerLink } from './data.jsx';
import { AnalysisDialog, Stamp } from './instruments.jsx';

export const sections = [
  { key: 'intelligence', label: 'Intelligence', icon: Layers3, routes: [
    { path: '/', name: 'Overview', icon: LayoutGrid },
    { path: '/rankings', name: 'Player rankings', icon: ChartNoAxesColumnIncreasing },
    { path: '/compare', name: 'Comparison lab', icon: ArrowLeftRight },
    { path: '/candidates', name: 'Candidate pool', icon: UsersRound },
  ] },
  { key: 'evidence', label: 'Evidence', icon: Activity, routes: [
    { path: '/pressure', name: 'Pressure Explorer', icon: Target },
    { path: '/matches', name: 'Match explorer', icon: Activity },
    { path: '/reliability', name: 'Reliability lab', icon: ShieldCheck },
  ] },
  { key: 'research', label: 'Research', icon: FlaskConical, routes: [
    { path: '/methodology', name: 'Methodology', icon: FlaskConical },
    { path: '/policies', name: 'Policies & validation', icon: GitCompareArrows },
    { path: '/audit', name: 'Data & reproducibility', icon: Database },
    { path: '/findings', name: 'Findings & limitations', icon: FileCheck2 },
  ] },
];

const routes = sections.flatMap(group => group.routes.map(route => ({ ...route, group: group.label, cluster: group.key })));

export function activeRoute(path) {
  return routes.find(route => path === route.path || route.path !== '/' && path.startsWith(route.path + '/'));
}

function Mark() {
  return <svg width="28" height="28" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M18 4 32 29H4L18 4Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
    <path d="M18 4v16l14 9M4 29l14-9" stroke="currentColor" strokeWidth="1.35" opacity=".72" />
    <path d="m12.1 15 5.9 5 6-5" stroke="currentColor" strokeWidth="1.45" />
  </svg>;
}

export function NavigationDock({ onSearch, searchReady }) {
  const [open, setOpen] = useState(null);
  const { pathname } = useLocation();
  const active = activeRoute(pathname)?.cluster || (pathname.startsWith('/players/') ? 'intelligence' : null);
  const group = sections.find(item => item.key === open);
  const ref = useRef(null);
  const triggers = useRef({});
  const keyboardEntry = useRef(false);
  const tray = useId();
  useEffect(() => {
    if (!open) return;
    if (keyboardEntry.current) {
      document.getElementById(tray + '-' + open)?.querySelector('a')?.focus();
      keyboardEntry.current = false;
    }
    const outside = event => { if (!ref.current?.contains(event.target)) setOpen(null); };
    const escape = event => {
      if (event.key === 'Escape') { setOpen(null); triggers.current[open]?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, tray]);
  return <nav ref={ref} className="dock" aria-label="PRISM navigation" data-expanded={Boolean(open)}>
    <div className="dock-body">
      <Link to="/" className="dock-mark" aria-label="PRISM overview" title="PRISM overview" onClick={() => setOpen(null)}><Mark /></Link>
      <button type="button" className="dock-toggle" aria-label={open ? 'Close navigation' : 'Browse navigation'}
        aria-expanded={Boolean(open)} aria-controls={group ? tray + '-' + group.key : undefined}
        onClick={() => setOpen(open ? null : active || sections[0].key)}>
        <Mark /><span className="dock-label">Browse</span><ChevronsRight size={13} className="dock-expand-icon" aria-hidden="true" />
      </button>
      <div className="dock-clusters">
        {sections.map(({ key, label, icon: Icon }) => <button type="button" key={key}
          ref={element => { triggers.current[key] = element; }}
          className={active === key ? 'is-current' : ''} aria-expanded={open === key}
          aria-controls={open === key ? tray + '-' + key : undefined} aria-label={label} title={label}
          onClick={event => {
            keyboardEntry.current = event.detail === 0 && open !== key;
            setOpen(open === key ? null : key);
          }}
          onKeyDown={event => {
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            if (open === key) document.getElementById(tray + '-' + key)?.querySelector('a')?.focus();
            else { keyboardEntry.current = true; setOpen(key); }
          }}><Icon size={18} aria-hidden="true" /><span className="dock-label">{label}</span><ChevronRight size={13} className="dock-forward" aria-hidden="true" /></button>)}
      </div>
    </div>
    <AnimatePresence>
      {group && <motion.div className="dock-tray" id={tray + '-' + group.key} key={group.key} initial={{ opacity: 0, scale: .96 }}
        animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration: .15 }}>
        <div className="dock-tray-head"><Stamp>{group.label}</Stamp><span>PRISM</span></div>
        {group.routes.map(({ path, name, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(null)}>
          <Icon size={16} aria-hidden="true" /><span>{name}</span><ArrowUpRight size={14} aria-hidden="true" />
        </NavLink>)}
      </motion.div>}
    </AnimatePresence>
    <button type="button" className="dock-search" aria-label="Open command palette" title="Open command palette (⌘/Ctrl K)"
      disabled={!searchReady} onClick={() => { setOpen(null); onSearch(); }}><Search size={18} aria-hidden="true" /><span className="dock-label">Search</span></button>
  </nav>;
}

export function CommandPalette({ snapshot, discipline, onClose }) {
  const navigate = useNavigate();
  const tour = useWalkthrough();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const list = useId();
  const ref = useRef(null);
  const search = query.toLowerCase().trim();
  const matches = term => search.split(/\s+/).every(token => String(term).toLowerCase().includes(token));
  const pages = routes.filter(route => matches(route.name + ' ' + route.group));
  const players = search ? snapshot.registry.filter(player => [player.pid, player.name, ...(player.aliases || [])].some(matches)).slice(0, 8) : [];
  const tourEntry = { name: tour.active ? 'Restart PRISM walkthrough' : 'Take the PRISM tour', group: 'Guided research', icon: Compass, action: tour.start };
  const entries = [...(matches(tourEntry.name + ' take walkthrough tour explore PRISM guided research') ? [tourEntry] : []), ...pages, ...players];
  const index = Math.min(selected, Math.max(0, entries.length - 1));

  function follow(entry) {
    if (!entry) return;
    if (entry.action) { onClose(); entry.action(); return; }
    let destination = entry.path;
    if (!destination) {
      const alternate = discipline === 'batting' ? 'bowling' : 'batting';
      const hasRank = key => snapshot.rankings[key].some(row => row.pid === entry.pid);
      const scope = !hasRank(discipline) && hasRank(alternate) ? alternate : discipline;
      destination = playerLink(entry.pid, scope);
    }
    onClose();
    navigate(destination);
  }
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return <AnalysisDialog title="PRISM command palette" className="command-dialog" onClose={onClose}>
    <div className="command-field"><Search size={20} aria-hidden="true" /><input data-initial-focus
      aria-label="Search pages, player names or official IDs" placeholder="Search pages, players or official IDs…"
      role="combobox" aria-controls={list} aria-expanded="true" aria-autocomplete="list"
      aria-activedescendant={entries.length ? list + '-' + index : undefined} value={query}
      onChange={event => { setQuery(event.target.value); setSelected(0); }}
      onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const next = index + (event.key === 'ArrowDown' ? 1 : -1);
          setSelected(Math.min(Math.max(0, entries.length - 1), Math.max(0, next)));
        }
        if (event.key === 'Enter') { event.preventDefault(); follow(entries[index]); }
      }} /><kbd>ESC</kbd></div>
    <div id={list} ref={ref} className="command-results" role="listbox" aria-label="Search results">
      {entries.map((entry, i) => {
        const Icon = entry.icon || UserRound;
        return <button type="button" role="option" aria-selected={i === index} id={list + '-' + i}
          tabIndex={-1} key={entry.path || entry.pid || entry.name} onClick={() => follow(entry)}>
          <Icon size={17} aria-hidden="true" /><strong>{entry.name}</strong><span>{entry.group || 'ID ' + entry.pid}</span><ArrowUpRight size={14} aria-hidden="true" />
        </button>;
      })}
      {!entries.length && <p role="status">No matching pages, players or actions.</p>}
    </div>
    <div className="command-hints"><span><kbd>↑</kbd> <kbd>↓</kbd> Select</span><span><kbd>↵</kbd> Open</span></div>
  </AnalysisDialog>;
}
