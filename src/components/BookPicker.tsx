import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BOOKS, getBook, parseRef } from '../lib/bible';
import { Icon } from './Icon';

/** Full-screen overlay to jump to any book & chapter, or type a reference. */
export function BookPicker({ onClose, current }: { onClose: () => void; current?: string }) {
  const nav = useNavigate();
  const [book, setBook] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const b = book ? getBook(book) : undefined;

  const go = (id: string, ch: number, v?: number) => {
    nav(`/read/${id}/${ch}${v ? `?v=${v}` : ''}`);
    onClose();
  };

  const submit = () => {
    const r = parseRef(q);
    if (r) go(r.book, r.chapter, r.verse ? (r.verseEnd ? undefined : r.verse) : undefined);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose a passage">
        <div className="picker-head">
          {b ? (
            <button className="icon-btn" onClick={() => setBook(undefined)} aria-label="Back to books">
              <Icon name="left" />
            </button>
          ) : (
            <Icon name="search" />
          )}
          {b ? (
            <h2>{b.name}</h2>
          ) : (
            <input
              autoFocus
              placeholder="Go to… e.g. Romans 8:28, Ps 23, jn 1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {b ? (
          <div className="chapter-grid">
            {b.verses.map((_, i) => (
              <button key={i} onClick={() => go(b.id, i + 1)}>
                {i + 1}
              </button>
            ))}
          </div>
        ) : (
          (['OT', 'NT'] as const).map((t) => (
            <section key={t}>
              <h3 className="eyebrow">{t === 'OT' ? 'Old Testament' : 'New Testament'}</h3>
              <div className="book-grid">
                {BOOKS.filter((x) => x.testament === t)
                  .filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()))
                  .map((x) => (
                    <button
                      key={x.id}
                      className={x.id === current ? 'on' : ''}
                      onClick={() => (x.verses.length === 1 ? go(x.id, 1) : setBook(x.id))}
                    >
                      {x.name}
                    </button>
                  ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
