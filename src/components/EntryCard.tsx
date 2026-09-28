import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteEntry, ENTRY_KINDS, uid, type Entry } from '../lib/db';
import { formatRange, keyToRef } from '../lib/bible';
import { fmtDate, fmtDateTime, fromLocalInput, relative, toLocalInput } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { AudioClipView } from './Audio';
import { Composer } from './Composer';
import { Icon } from './Icon';

export function KindBadge({ kind }: { kind: Entry['kind'] }) {
  return <span className={`badge kind-${kind}`}>{ENTRY_KINDS.find((k) => k.kind === kind)?.label}</span>;
}

export function RefLink({ start, end }: { start: number; end: number }) {
  const r = keyToRef(start);
  return (
    <Link className="ref-chip" to={`/read/${r.book}/${r.chapter}?v=${r.verse}`}>
      {formatRange(start, end)}
    </Link>
  );
}

export function EntryCard({ entry, showRef }: { entry: Entry; showRef?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);

  if (editing) {
    return (
      <div className="entry-card editing">
        <Composer start={entry.start} end={entry.end} editing={entry} onDone={() => setEditing(false)} autoFocus />
      </div>
    );
  }

  return (
    <article className={`entry-card kind-${entry.kind}`}>
      <header>
        <KindBadge kind={entry.kind} />
        {showRef && <RefLink start={entry.start} end={entry.end} />}
        {entry.word && <span className="word-chip">“{entry.word}”</span>}
        {entry.lemma && (
          <Link className="word-chip greek" to={`/word/${encodeURIComponent(entry.lemma)}`}>
            {entry.lemma}
          </Link>
        )}
        <span className="spacer" />
        <time className="muted small" dateTime={new Date(entry.createdAt).toISOString()} title={fmtDateTime(entry.createdAt)}>
          {relative(entry.createdAt)}
        </time>
      </header>
      {entry.title && <h3 className="entry-title">{entry.title}</h3>}
      {entry.body && <Markdown text={entry.body} />}
      {entry.audioIds.map((id) => (
        <AudioClipView key={id} id={id} />
      ))}
      {entry.tags.length > 0 && (
        <div className="tags">
          {entry.tags.map((t) => (
            <Link key={t} to={`/journal?tag=${encodeURIComponent(t)}`} className="tag">
              #{t}
            </Link>
          ))}
        </div>
      )}
      {entry.kind === 'application' && <ApplicationLogs entry={entry} />}
      <footer>
        <span className="muted small">
          Written {fmtDateTime(entry.createdAt)}
          {entry.revisions.length > 0 && (
            <>
              {' · '}
              <button className="link-btn" onClick={() => setHistory((h) => !h)}>
                edited {entry.revisions.length}× (last {fmtDate(entry.updatedAt)})
              </button>
            </>
          )}
        </span>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit">
          <Icon name="edit" size={16} />
        </button>
        <button
          className="icon-btn"
          aria-label="Delete"
          onClick={() => confirm('Delete this entry? This cannot be undone.') && deleteEntry(entry.id)}
        >
          <Icon name="trash" size={16} />
        </button>
      </footer>
      {history && (
        <div className="history">
          {[...entry.revisions].reverse().map((r, i) => (
            <div key={i} className="revision">
              <div className="muted small">
                <Icon name="history" size={13} /> Version from {fmtDateTime(r.at)}
              </div>
              {r.title && <strong>{r.title}</strong>}
              <Markdown text={r.body} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ApplicationLogs({ entry }: { entry: Entry }) {
  const logs = useLiveQuery(() => db.logs.where('entryId').equals(entry.id).sortBy('at'), [entry.id]) ?? [];
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [at, setAt] = useState(() => toLocalInput(Date.now()));
  const done = entry.status === 'done';

  const add = async () => {
    await db.logs.add({ id: uid(), entryId: entry.id, at: fromLocalInput(at), body: body.trim() });
    setBody('');
    setOpen(false);
  };

  return (
    <div className="app-logs">
      {logs.length > 0 && (
        <ol className="timeline">
          {logs.map((l) => (
            <li key={l.id}>
              <time>{fmtDateTime(l.at)}</time>
              <span>{l.body || 'Applied'}</span>
              <button
                className="icon-btn tiny"
                aria-label="Remove log"
                onClick={() => confirm('Remove this log?') && db.logs.delete(l.id)}
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ol>
      )}
      {open ? (
        <div className="log-form">
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          <textarea
            rows={2}
            autoFocus
            placeholder="What did you do? What happened?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="composer-actions">
            <span className="spacer" />
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={add}>
              Log it
            </button>
          </div>
        </div>
      ) : (
        <div className="composer-actions">
          <button className="btn soft" onClick={() => setOpen(true)}>
            <Icon name="check" size={16} /> I applied this
          </button>
          <button
            className="btn ghost"
            onClick={() => db.entries.update(entry.id, { status: done ? 'active' : 'done' })}
          >
            {done ? 'Reopen' : 'Mark as woven in'}
          </button>
          {logs.length > 0 && <span className="muted small">{logs.length} time{logs.length > 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>
  );
}
