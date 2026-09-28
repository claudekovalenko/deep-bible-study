import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { formatRange } from '../lib/bible';
import { fmtDateTime } from '../lib/format';
import { EntryCard } from '../components/EntryCard';

/** Applications drawn from study, and the dated record of living them out. */
export function Applications() {
  const [tab, setTab] = useState<'active' | 'done' | 'timeline'>('active');
  const apps = useLiveQuery(() => db.entries.where('kind').equals('application').reverse().sortBy('createdAt'), []) ?? [];
  const logs = useLiveQuery(() => db.logs.orderBy('at').reverse().toArray(), []) ?? [];
  const byId = new Map(apps.map((a) => [a.id, a]));
  const shown = apps.filter((a) => (tab === 'done' ? a.status === 'done' : a.status !== 'done'));

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Living it</div>
        <h1 className="display">Be doers of the word</h1>
        <p className="lede">James 1:22 — every application you write, and every time you actually lived it out, with the date.</p>
      </header>
      <div className="tabs" role="tablist">
        <button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>
          In practice <span className="count">{apps.filter((a) => a.status !== 'done').length || ''}</span>
        </button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>
          Woven in <span className="count">{apps.filter((a) => a.status === 'done').length || ''}</span>
        </button>
        <button className={tab === 'timeline' ? 'on' : ''} onClick={() => setTab('timeline')}>
          Timeline <span className="count">{logs.length || ''}</span>
        </button>
      </div>
      {tab === 'timeline' ? (
        <ol className="timeline big">
          {logs.map((l) => {
            const a = byId.get(l.entryId);
            return (
              <li key={l.id}>
                <time>{fmtDateTime(l.at)}</time>
                <div>
                  <div>{l.body || 'Applied'}</div>
                  {a && (
                    <div className="muted small">
                      {a.title ?? a.body.slice(0, 90)} · {formatRange(a.start, a.end)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {!logs.length && <p className="empty">When you live out an application, tap “I applied this” and it will appear here, dated.</p>}
        </ol>
      ) : (
        <div className="entry-list">
          {shown.map((e) => (
            <EntryCard key={e.id} entry={e} showRef />
          ))}
          {!shown.length && (
            <p className="empty">
              {tab === 'active'
                ? 'No applications yet. While studying a passage, choose “Application” and write how you will live it out.'
                : 'Applications you mark as woven in will rest here.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
