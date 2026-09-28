import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ResourceKind } from '../lib/db';
import { ResourceCard, resourceLabel } from '../components/Resources';

/** Every theologian, sermon, video, quote and cross-reference you have gathered. */
export function Library() {
  const all = useLiveQuery(() => db.resources.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [kind, setKind] = useState<ResourceKind | 'all'>('all');
  const [author, setAuthor] = useState<string>('');
  const [q, setQ] = useState('');

  const authors = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all) if (r.author) m.set(r.author, (m.get(r.author) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);
  const kinds = [...new Set(all.map((r) => r.kind))];
  const needle = q.toLowerCase();
  const shown = all.filter(
    (r) =>
      (kind === 'all' || r.kind === kind) &&
      (!author || r.author === author) &&
      (!needle || [r.title, r.author, r.note, r.url].some((s) => s?.toLowerCase().includes(needle))),
  );

  return (
    <div className="page library">
      <header className="page-head">
        <div className="eyebrow">Library</div>
        <h1 className="display">A great cloud of witnesses</h1>
        <p className="lede">The voices that have helped you see — gathered from every passage you have studied.</p>
      </header>
      <div className="toolbar">
        <input className="search" placeholder="Search titles, authors, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="library-layout">
        {authors.length > 0 && (
          <aside className="authors">
            <h3 className="eyebrow">Theologians & teachers</h3>
            <button className={!author ? 'on' : ''} onClick={() => setAuthor('')}>
              Everyone
            </button>
            {authors.map(([a, n]) => (
              <button key={a} className={author === a ? 'on' : ''} onClick={() => setAuthor(author === a ? '' : a)}>
                {a} <span className="muted">{n}</span>
              </button>
            ))}
          </aside>
        )}
        <div>
          {kinds.length > 1 && (
            <div className="filter-row">
              <button className={`chip ${kind === 'all' ? 'on' : ''}`} onClick={() => setKind('all')}>
                All
              </button>
              {kinds.map((k) => (
                <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                  {resourceLabel(k)}
                </button>
              ))}
            </div>
          )}
          <div className="resource-grid">
            {shown.map((r) => (
              <ResourceCard key={r.id} r={r} showRef />
            ))}
          </div>
          {!shown.length && (
            <p className="empty">
              {all.length ? 'Nothing matches.' : 'Open any verse and use “Voices & links” to add a theologian, a sermon, a YouTube video, a quote, or a cross-reference.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
