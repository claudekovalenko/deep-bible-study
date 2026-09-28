import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/inter';
import '@fontsource/gentium-book-plus/greek-400.css';
import '@fontsource/gentium-book-plus/greek-700.css';
import '@fontsource/gentium-book-plus/greek-ext-400.css';
import './styles.css';
import { App } from './App';
import { PrefsProvider } from './lib/prefs';
import { requestPersistence } from './lib/db';

requestPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </PrefsProvider>
  </StrictMode>,
);
