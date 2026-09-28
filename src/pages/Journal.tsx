import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ENTRY_KINDS, type Entry, type EntryKind, type Resource } from '../lib/db';
import { formatRange } from '../lib/bible';
import { dayKey, fmtLongDate, fmtTime } from '../lib/format';
import { EntryCard } from '../components/EntryCard';
import { ResourceCard } from '../components/Resources';

type Item =
  | { type: 'entry'; at: number; entry: Entry }
  | { type: 'log'; at: number; body: string; entry?: Entry }
  | { type: 'resource'; at: number; r: Resource }
  | { type: 'board'; at: number; id: number; count: number };

/** Every dated thing, newest first: a record of your walk through the Word. */
export function Journal() {
  const [sp, setSp] = useSearchParams();
  const tag = sp.get('tag') ?? '';
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<EntryKind | 'all' | 'sources' | 'boards'>('all');

  const data = useLiveQuery(async () => {
    const [entries, logs, resources, boards] = await Promise.all([
      db.entries.toArray(),
      db.logs.toArray(),
      db.resources.toArray(),
      db.boards.toArray(),
    ]);
    return { entries, logs, resources, boards };
  }, []);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data?.entries ?? []) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const byId = new Map(data.entries.map((e) => [e.id, e]));
    const out: Item[] = [];
    const entryMatch = (e: Entry) =>
      (!tag || e.tags.includes(tag)) &&
      (!needle ||
        [e.title, e.body, e.word, e.lemma, formatRange(e.start, e.end), ...e.tags].some((s) => s?.toLowerCase().includes(needle)));
    if (kind !== 'sources' && kind !== 'boards') {
      for (const e of data.entries) if ((kind === 'all' || e.kind === kind) && entryMatch(e)) out.push({ type: 'entry', at: e.createdAt, entry: e });
      if ((kind === 'all' || kind === 'application') && !tag) {
        for (const l of data.logs) {
          const entry = byId.get(l.entryId);
          if (!needle || l.body.toLowerCase().includes(needle) || (entry && entryMatch(entry)))
            out.push({ type: 'log', at: l.at, body: l.body, entry });
        }
      }
    }
    if ((kind === 'all' || kind === 'sources') && !tag) {
      for (const r of data.resources)
        if (!needle || [r.title, r.author, r.note, r.url].some((s) => s?.toLowerCase().includes(needle)))
          out.push({ type: 'resource', at: r.createdAt, r });
    }
    if ((kind === 'all' || kind === 'boards') && !tag && !needle) {
      for (const b of data.boards) if (b.nodes.length) out.push({ type: 'board', at: b.updatedAt, id: b.id, count: b.nodes.length });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [data, q, kind, tag]);

  const days = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items.slice(0, 400)) {
      const k = dayKey(it.at);
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m.entries()];
  }, [items]);

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Journal</div>
        <h1 className="display">Your walk through the Word</h1>
      </header>
      <div className="toolbar">
        <input className="search" placeholder="Search everything you’ve written…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="filter-row">
        {(['all', ...ENTRY_KINDS.map((k) => k.kind), 'sources', 'boards'] as const).map((k) => (
          <button key={k} className={`chip kind-${k} ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {k === 'all' ? 'Everything' : k === 'sources' ? 'Voices & links' : k === 'boards' ? 'Whiteboards' : ENTRY_KINDS.find((x) => x.kind === k)?.label}
          </button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="filter-row tags">
          {tags.slice(0, 30).map(([t, n]) => (
            <button key={t} className={`tag ${tag === t ? 'on' : ''}`} onClick={() => setSp(tag === t ? {} : { tag: t })}>
              #{t} <span className="muted">{n}</span>
            </button>
          ))}
        </div>
      )}
      {days.map(([day, list]) => (
        <section key={day} className="day">
          <h2 className="day-head">{fmtLongDate(list[0].at)}</h2>
          <div className="entry-list">
            {list.map((it) =>
              it.type === 'entry' ? (
                <EntryCard key={it.entry.id} entry={it.entry} showRef />
              ) : it.type === 'log' ? (
                <div key={`l${it.at}${it.body}`} className="log-item">
                  <span className="badge kind-application">Applied</span>
                  <time className="muted small">{fmtTime(it.at)}</time>
                  <div>
                    {it.body || 'Applied'}
                    {it.entry && (
                      <div className="muted small">
                        {it.entry.title ?? it.entry.body.slice(0, 80)} · {formatRange(it.entry.start, it.entry.end)}
                      </div>
                    )}
                  </div>
                </div>
              ) : it.type === 'resource' ? (
                <ResourceCard key={it.r.id} r={it.r} showRef />
              ) : (
                <Link key={`b${it.id}`} to={`/board/${it.id}`} className="log-item board-item">
                  <span className="badge">Whiteboard</span>
                  <span>
                    {formatRange(it.id, it.id)} · {it.count} bubble{it.count > 1 ? 's' : ''}
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>
      ))}
      {data && !items.length && <p className="empty">{q || tag ? 'Nothing matches.' : 'Your journal fills as you study.'}</p>}
      {items.length > 400 && <p className="muted small">Showing the latest 400 — search to find older entries.</p>}
    </div>
  );
}
