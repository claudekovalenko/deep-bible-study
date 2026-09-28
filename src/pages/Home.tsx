import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BOOKS, getBook } from '../lib/bible';
import { db, getMeta } from '../lib/db';
import { dayKey, fmtLongDate, relative } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { EntryCard } from '../components/EntryCard';
import { Icon } from '../components/Icon';

export function Home() {
  const [prefs] = usePrefs();
  const last = prefs.lastRead;
  const lastBook = getBook(last.book);
  const stats = useLiveQuery(async () => {
    const entries = await db.entries.toArray();
    const logs = await db.logs.count();
    const boards = await db.boards.count();
    const resources = await db.resources.count();
    const verses = new Set(entries.map((e) => e.start));
    const days = new Set(entries.map((e) => dayKey(e.createdAt)));
    const byBook = new Map<number, number>();
    for (const e of entries) {
      const b = Math.floor(e.start / 1_000_000);
      byBook.set(b, (byBook.get(b) ?? 0) + 1);
    }
    const today = new Date();
    const onThisDay = entries.filter((e) => {
      const d = new Date(e.createdAt);
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
    });
    const recent = [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    const active = entries.filter((e) => e.kind === 'application' && e.status !== 'done').sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    const lastBackupAt = await getMeta<number>('lastBackupAt', 0);
    return { total: entries.length, logs, boards, resources, verses: verses.size, days: days.size, byBook, onThisDay, recent, active, lastBackupAt };
  }, []);

  const maxBook = Math.max(1, ...(stats ? [...stats.byBook.values()] : [1]));
  const backupDue = stats && stats.total > 0 && Date.now() - stats.lastBackupAt > 14 * 86_400_000;

  return (
    <div className="page home">
      <header className="page-head">
        <div className="eyebrow">{fmtLongDate(Date.now())}</div>
        <h1 className="display">Be still, and study.</h1>
        <p className="lede">“Your word is a lamp to my feet and a light to my path.” — Psalm 119:105</p>
      </header>

      <Link className="continue-card" to={`/read/${last.book}/${last.chapter}`}>
        <div>
          <div className="eyebrow">Continue in</div>
          <div className="continue-ref">
            {lastBook?.name} {last.chapter}
          </div>
        </div>
        <Icon name="right" size={26} />
      </Link>

      {backupDue && (
        <div className="notice">
          {stats!.lastBackupAt ? `Last backup ${relative(stats!.lastBackupAt)}.` : 'You haven’t backed up yet.'} Your study lives on this
          device — <Link to="/settings">download a backup</Link> so it is safe for years to come.
          <div className="muted small">
            This reminder only appears when you open the app — it can’t send push notifications. A recurring reminder on your phone’s
            calendar is the surest way to remember.
          </div>
        </div>
      )}

      {stats && (
        <section className="stats">
          <Stat n={stats.total} label="entries written" />
          <Stat n={stats.verses} label="verses studied" />
          <Stat n={stats.days} label="days in the Word" />
          <Stat n={stats.logs} label="times applied" />
          <Stat n={stats.boards} label="whiteboards" />
          <Stat n={stats.resources} label="voices & links" />
        </section>
      )}

      {stats && stats.onThisDay.length > 0 && (
        <section>
          <h2 className="section-title">On this day, years ago</h2>
          <div className="entry-list">
            {stats.onThisDay.map((e) => (
              <EntryCard key={e.id} entry={e} showRef />
            ))}
          </div>
        </section>
      )}

      {stats && stats.active.length > 0 && (
        <section>
          <h2 className="section-title">
            Living it <Link to="/apply" className="more">All applications</Link>
          </h2>
          <div className="entry-list">
            {stats.active.map((e) => (
              <EntryCard key={e.id} entry={e} showRef />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">
          Recently written <Link to="/journal" className="more">Journal</Link>
        </h2>
        {stats?.recent.length ? (
          <div className="entry-list">
            {stats.recent.map((e) => (
              <EntryCard key={e.id} entry={e} showRef />
            ))}
          </div>
        ) : (
          <div className="welcome">
            <h3>Welcome.</h3>
            <p>
              This is a place to <em>saturate</em> in Scripture for years. Open a chapter, tap a verse, and write — commentary,
              questions, prayers, applications. Tap any word to study it alone, open a verse on a whiteboard to map what it opens up,
              and see the Greek beside the English in the New Testament. Everything is dated, so over time this becomes a record of
              how the Word has shaped you.
            </p>
            <Link className="btn primary" to={`/read/${last.book}/${last.chapter}`}>
              Start reading
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">The whole counsel</h2>
        <div className="canon">
          {BOOKS.map((b) => {
            const n = stats?.byBook.get(b.index) ?? 0;
            return (
              <Link
                key={b.id}
                to={`/read/${b.id}/1`}
                className={`canon-book ${n ? 'has' : ''}`}
                style={{ '--heat': n ? 0.18 + 0.82 * (n / maxBook) : 0 } as React.CSSProperties}
                title={`${b.name}: ${n} entries`}
              >
                <span>{b.name}</span>
                {n > 0 && <em>{n}</em>}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <strong>{n.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
