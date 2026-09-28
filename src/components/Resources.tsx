import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, uid, type Resource, type ResourceKind } from '../lib/db';
import { formatRange, keyToRef, parseRef, refRange } from '../lib/bible';
import { fmtDate, youtubeId, youtubeStart } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { RefLink } from './EntryCard';
import { Icon } from './Icon';

const KINDS: { kind: ResourceKind; label: string }[] = [
  { kind: 'video', label: 'Video' },
  { kind: 'sermon', label: 'Sermon' },
  { kind: 'article', label: 'Article' },
  { kind: 'book', label: 'Book' },
  { kind: 'podcast', label: 'Podcast' },
  { kind: 'quote', label: 'Quote' },
  { kind: 'passage', label: 'Cross-reference' },
];

export const resourceLabel = (k: ResourceKind) => KINDS.find((x) => x.kind === k)?.label ?? k;

export function ResourceForm({ start, end, editing, onDone }: { start: number; end: number; editing?: Resource; onDone: () => void }) {
  const [kind, setKind] = useState<ResourceKind>(editing?.kind ?? 'video');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [author, setAuthor] = useState(editing?.author ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [target, setTarget] = useState(
    editing?.targetStart ? formatRange(editing.targetStart, editing.targetEnd ?? editing.targetStart) : '',
  );
  const targetRef = kind === 'passage' ? parseRef(target) : undefined;
  const authors = useLiveQuery(() => db.resources.orderBy('author').uniqueKeys(), []) ?? [];
  const ok = kind === 'passage' ? !!targetRef : !!(title.trim() || url.trim() || note.trim());

  const save = async () => {
    const now = Date.now();
    const range = targetRef ? refRange(targetRef) : undefined;
    const row: Resource = {
      id: editing?.id ?? uid(),
      kind,
      start: editing?.start ?? start,
      end: editing?.end ?? end,
      title: title.trim() || (range ? formatRange(range.start, range.end) : url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)),
      url: url.trim() || undefined,
      author: author.trim() || undefined,
      note: note.trim() || undefined,
      targetStart: range?.start,
      targetEnd: range?.end,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.resources.put(row);
    onDone();
  };

  return (
    <form
      className="resource-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) save();
      }}
    >
      <datalist id="authors">
        {authors.map((a) => (
          <option key={String(a)} value={String(a)} />
        ))}
      </datalist>
      <div className="kind-picker">
        {KINDS.map((k) => (
          <button type="button" key={k.kind} className={`chip ${kind === k.kind ? 'on' : ''}`} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === 'passage' ? (
        <>
          <input autoFocus placeholder="Connected passage, e.g. Isaiah 53:5 or Heb 4:12–13" value={target} onChange={(e) => setTarget(e.target.value)} />
          {target && (
            <div className="muted small">
              {targetRef ? `→ ${formatRange(refRange(targetRef).start, refRange(targetRef).end)}` : 'Not a recognised reference yet'}
            </div>
          )}
          <textarea rows={3} placeholder="How are these connected?" value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      ) : (
        <>
          <input autoFocus={!editing} placeholder="Link (YouTube, article, sermon…)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Theologian / author / speaker" value={author} onChange={(e) => setAuthor(e.target.value)} list="authors" />
          <textarea
            rows={3}
            placeholder={kind === 'quote' ? 'The quotation…' : 'What did you learn from it?'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      )}
      <div className="composer-actions">
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onDone}>
          Cancel
        </button>
        <button className="btn primary" disabled={!ok}>
          {editing ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}

export function ResourceCard({ r, showRef, incoming }: { r: Resource; showRef?: boolean; incoming?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const yt = r.url ? youtubeId(r.url) : undefined;

  if (editing) return <ResourceForm start={r.start} end={r.end} editing={r} onDone={() => setEditing(false)} />;

  if (r.kind === 'passage') {
    const linkStart = incoming ? r.start : r.targetStart!;
    const linkEnd = incoming ? r.end : r.targetEnd ?? r.targetStart!;
    const to = keyToRef(linkStart);
    return (
      <article className="resource-card passage">
        <header>
          <span className="badge">Cross-reference</span>
          <Link className="ref-chip strong" to={`/read/${to.book}/${to.chapter}?v=${to.verse}`}>
            {incoming ? '← ' : '→ '}
            {formatRange(linkStart, linkEnd)}
          </Link>
          {showRef && !incoming && <RefLink start={r.start} end={r.end} />}
          <span className="spacer" />
          <CardActions r={r} onEdit={() => setEditing(true)} />
        </header>
        {r.note && <Markdown text={r.note} />}
      </article>
    );
  }

  return (
    <article className={`resource-card kind-${r.kind}`}>
      {yt && (
        <div className="video">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1${youtubeStart(r.url!) ? `&start=${youtubeStart(r.url!)}` : ''}`}
              title={r.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button className="thumb" onClick={() => setPlaying(true)} aria-label={`Play ${r.title}`}>
              <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" />
              <span className="play">
                <Icon name="play" size={26} />
              </span>
            </button>
          )}
        </div>
      )}
      <header>
        <span className="badge">{resourceLabel(r.kind)}</span>
        {showRef && <RefLink start={r.start} end={r.end} />}
        <span className="spacer" />
        <CardActions r={r} onEdit={() => setEditing(true)} />
      </header>
      <h3 className="entry-title">
        {r.url ? (
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.title} <Icon name="link" size={14} />
          </a>
        ) : (
          r.title
        )}
      </h3>
      {r.author && <div className="author">{r.author}</div>}
      {r.note && (r.kind === 'quote' ? <blockquote className="quote">{r.note}</blockquote> : <Markdown text={r.note} />)}
      <div className="muted small">Added {fmtDate(r.createdAt)}</div>
    </article>
  );
}

function CardActions({ r, onEdit }: { r: Resource; onEdit: () => void }) {
  return (
    <>
      <button className="icon-btn" onClick={onEdit} aria-label="Edit">
        <Icon name="edit" size={15} />
      </button>
      <button className="icon-btn" aria-label="Delete" onClick={() => confirm('Remove this?') && db.resources.delete(r.id)}>
        <Icon name="trash" size={15} />
      </button>
    </>
  );
}
