import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, requestPersistence, setMeta } from '../lib/db';
import { downloadBackup, importBackup } from '../lib/backup';
import { ESV_COPYRIGHT } from '../lib/esv';
import { fmtDateTime } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { Icon } from '../components/Icon';

export function Settings() {
  const [prefs, setPrefs] = usePrefs();
  const [key, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [status, setStatus] = useState<string>();
  const [storage, setStorage] = useState<{ persisted: boolean; usage?: number; quota?: number }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastBackup = useLiveQuery(() => getMeta<number>('lastBackupAt', 0), []);

  useEffect(() => {
    getMeta('esvKey', '').then((k) => setKey(k));
    (async () => {
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      const est = await navigator.storage?.estimate?.();
      setStorage({ persisted, usage: est?.usage, quota: est?.quota });
    })();
  }, []);

  const saveKey = async () => {
    await setMeta('esvKey', key.trim());
    await db.esvCache.clear();
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  const doImport = async (f: File) => {
    try {
      const counts = await importBackup(f);
      const n = Object.values(counts).reduce((a, b) => a + b, 0);
      setStatus(`Restored ${n} records from ${f.name}.`);
    } catch (e) {
      setStatus(`Could not import: ${(e as Error).message}`);
    }
  };

  const mb = (b?: number) => (b === undefined ? '—' : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <div className="page settings">
      <header className="page-head">
        <div className="eyebrow">Settings</div>
        <h1 className="display">Tend the garden</h1>
      </header>

      <section className="card">
        <h2>ESV text</h2>
        <p>
          The ESV is provided by Crossway’s free API for personal, non-commercial use. Create a key at{' '}
          <a href="https://api.esv.org/account/create-application/" target="_blank" rel="noreferrer">
            api.esv.org
          </a>{' '}
          (sign in, “Create an API application”), then paste it here. Until then — or when offline and a chapter isn’t cached — the
          public-domain KJV is shown.
        </p>
        <div className="row">
          <input
            type="password"
            autoComplete="off"
            placeholder="ESV API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="btn primary" onClick={saveKey}>
            {keySaved ? 'Saved' : 'Save key'}
          </button>
        </div>
        <p className="muted small">
          Your key stays on this device and is never included in backups. Per the ESV API terms, only a limited number of verses are
          cached locally.
        </p>
      </section>

      <section className="card">
        <h2>Reading</h2>
        <div className="row">
          <span>Theme</span>
          <div className="seg">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} className={prefs.theme === t ? 'on' : ''} onClick={() => setPrefs({ theme: t })}>
                <Icon name={t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'settings'} size={15} /> {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span>Text size</span>
          <input
            type="range"
            min={0.85}
            max={1.4}
            step={0.05}
            value={prefs.fontScale}
            onChange={(e) => setPrefs({ fontScale: +e.target.value })}
          />
          <span className="muted small">{Math.round(prefs.fontScale * 100)}%</span>
        </div>
      </section>

      <section className="card">
        <h2>Keep it safe for decades</h2>
        <p>
          Everything you write is stored privately in this browser on this device. Download a backup regularly and keep it somewhere
          safe (iCloud Drive, Google Drive, email to yourself). A backup restores everything — entries, their edit history, applications,
          whiteboards, links and voice memos — on any device.
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => downloadBackup().then(() => setStatus('Backup downloaded.'))}>
            <Icon name="download" size={17} /> Download backup
          </button>
          <button className="btn soft" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={17} /> Restore from backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
        <p className="muted small">
          Last backup: {lastBackup ? fmtDateTime(lastBackup) : 'never'}. Restoring merges with what is here; the newer copy of any entry
          wins.
        </p>
        {status && <div className="notice">{status}</div>}
        <div className="row">
          <span>
            Storage: {mb(storage?.usage)} used ·{' '}
            {storage?.persisted ? 'protected from automatic clearing' : 'the browser may clear it under pressure'}
          </span>
          {!storage?.persisted && (
            <button
              className="btn ghost"
              onClick={async () => {
                const persisted = await requestPersistence();
                setStorage((s) => ({ ...s, persisted }));
              }}
            >
              Protect storage
            </button>
          )}
        </div>
        <p className="muted small">Tip: installing the app to your home screen makes its storage far more durable, especially on iPhone.</p>
      </section>

      <section className="card about">
        <h2>Sources</h2>
        <p className="small">{ESV_COPYRIGHT}</p>
        <p className="small">
          Greek: <em>The Greek New Testament: SBL Edition</em>, © 2010 Society of Biblical Literature and Logos Bible Software. Parsing and
          lemmas from MorphGNT (CC BY-SA). Glosses from the MorphGNT lexicon and the Dodson Greek Lexicon (public domain).
        </p>
        <p className="small">King James Version (public domain) as an offline fallback.</p>
      </section>
    </div>
  );
}
