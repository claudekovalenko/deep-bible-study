import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icon } from './components/Icon';
import { usePrefs } from './lib/prefs';
import { Home } from './pages/Home';
import { Reader } from './pages/Reader';
import { Whiteboard } from './pages/Whiteboard';
import { Journal } from './pages/Journal';
import { Applications } from './pages/Applications';
import { Library } from './pages/Library';
import { WordStudy } from './pages/WordStudy';
import { Settings } from './pages/Settings';

export function App() {
  const [prefs] = usePrefs();
  const loc = useLocation();
  const immersive = loc.pathname.startsWith('/board/');
  const nav = [
    { to: '/', icon: 'home', label: 'Today', end: true },
    { to: `/read/${prefs.lastRead.book}/${prefs.lastRead.chapter}`, match: '/read', icon: 'book', label: 'Read' },
    { to: '/journal', icon: 'journal', label: 'Journal' },
    { to: '/apply', icon: 'apply', label: 'Living it' },
    { to: '/library', icon: 'library', label: 'Library' },
    { to: '/settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className={`shell ${immersive ? 'immersive' : ''}`}>
      <nav className="rail" aria-label="Main">
        <div className="brand" title="Deep Study">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={30} height={30} />
          <span>Deep Study</span>
        </div>
        {nav.map((n) => (
          <NavLink
            key={n.label}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive || (n.match && loc.pathname.startsWith(n.match)) ? 'active' : '')}
          >
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/read/:book/:chapter" element={<Reader />} />
          <Route path="/read" element={<Navigate to={`/read/${prefs.lastRead.book}/${prefs.lastRead.chapter}`} replace />} />
          <Route path="/board/:key" element={<Whiteboard />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/apply" element={<Applications />} />
          <Route path="/library" element={<Library />} />
          <Route path="/word/:lemma" element={<WordStudy />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
