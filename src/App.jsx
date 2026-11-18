import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { Snapshot, useApi, useDiscipline } from './data.jsx';
import { activeRoute, CommandPalette, NavigationDock } from './navigation.jsx';
import { ApiState, Empty } from './ui.jsx';
import Overview from './pages/Overview.jsx';

const Rankings = lazy(() => import('./pages/Rankings.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Compare = lazy(() => import('./pages/Compare.jsx'));
const Pressure = lazy(() => import('./pages/Pressure.jsx'));
const Matches = lazy(() => import('./pages/Matches.jsx'));
const Methods = lazy(() => import('./pages/Methods.jsx'));
const Reliability = lazy(() => import('./pages/Reliability.jsx'));
const Candidates = lazy(() => import('./pages/Candidates.jsx'));
const Policies = lazy(() => import('./pages/Policies.jsx'));
const Audit = lazy(() => import('./pages/Audit.jsx'));
const Findings = lazy(() => import('./pages/Findings.jsx'));

export default function App() {
  const result = useApi('/snapshot');
  const location = useLocation();
  const workspace = useRef(null);
  const [discipline] = useDiscipline();
  const [search, setSearch] = useState(false);
  const section = activeRoute(location.pathname);
  const profile = location.pathname.startsWith('/players/');
  const sectionName = section?.name || (profile ? 'Player profile' : 'PRISM Intelligence');
  const pageName = location.pathname.split('/')[1] || 'overview';
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      workspace.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
    document.title = sectionName + ' · PRISM Intelligence';
  }, [location.pathname, sectionName]);
  useEffect(() => {
    const handle = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearch(open => !open);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
  return <MotionConfig reducedMotion="user">
    <a className="skip-link" href="#content">Skip to content</a>
    <div className="shell">
      <NavigationDock key={location.pathname} onSearch={() => setSearch(true)} searchReady={Boolean(result.data)} />
      <div className="workspace" ref={workspace}>
        <header className="context-line">
          <div className="breadcrumb">
            <Link to="/" className="context-brand">PRISM <span>Intelligence</span></Link>
            <span className="breadcrumb-separator" aria-hidden="true">/</span>
            {(section || profile) && <span className="context-cluster">{section?.group || 'Intelligence'}</span>}
            {(section || profile) && <span className="breadcrumb-separator context-cluster" aria-hidden="true">/</span>}
            <strong>{sectionName}</strong>
          </div>
          <span className="header-scope"><i /> {location.pathname.startsWith('/matches') ? 'Organiser fixtures' : 'Frozen IPL + T20I'}</span>
        </header>
        <main id="content">
          <ApiState result={result}>{data => <Snapshot.Provider value={data}>
            <Suspense fallback={<div role="status" aria-label="Opening section" className="skeleton"><i /><i /><i /></div>}>
              <motion.div className={'page page-' + pageName + (location.pathname.startsWith('/matches/') ? ' match-detail' : '')} key={location.pathname} initial={{ opacity: .62, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .19 }}>
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="/rankings" element={<Rankings />} />
                  <Route path="/players/:id" element={<Profile />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/candidates" element={<Candidates />} />
                  <Route path="/pressure" element={<Pressure />} />
                  <Route path="/matches/:id?" element={<Matches />} />
                  <Route path="/reliability" element={<Reliability />} />
                  <Route path="/methodology" element={<Methods />} />
                  <Route path="/policies" element={<Policies />} />
                  <Route path="/audit" element={<Audit />} />
                  <Route path="/findings" element={<Findings />} />
                  <Route path="*" element={<Empty title="Page unavailable" detail="Use the navigation dock to return to the research." />} />
                </Routes>
              </motion.div>
            </Suspense>
            {search && <CommandPalette snapshot={data} discipline={discipline} onClose={() => setSearch(false)} />}
          </Snapshot.Provider>}</ApiState>
        </main>
        <footer className="workspace-footer"><span>PRISM Intelligence · Rajasthan Royals SupeRR Selector S2</span>
          <Link to="/audit"><CircleHelp size={14} /> Data provenance</Link></footer>
      </div>
    </div>
  </MotionConfig>;
}
