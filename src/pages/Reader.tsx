import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BOOKS, getBook, loadGreekChapter, refKey, tokenize, type GreekWord, type Verse } from '../lib/bible';
import { db, entriesInRange, type Entry } from '../lib/db';
import { loadChapter, ESV_COPYRIGHT, type ChapterText } from '../lib/esv';
import { usePrefs } from '../lib/prefs';
import { BookPicker } from '../components/BookPicker';
import { Icon } from '../components/Icon';
import { StudyPanel } from '../components/StudyPanel';

export interface Selection {
  from: number; // verse numbers
  to: number;
  word?: number; // English token index (single verse only)
  greek?: number; // Greek word index (single verse only)
}

export function parseSelection(sp: URLSearchParams): Selection | undefined {
  const v = sp.get('v');
  if (!v) return undefined;
  const [a, b] = v.split('-').map(Number);
  if (!a) return undefined;
  const sel: Selection = { from: a, to: b && b >= a ? b : a };
  if (sp.get('w')) sel.word = +sp.get('w')!;
  if (sp.get('g')) sel.greek = +sp.get('g')!;
  return sel;
}

export function Reader() {
  const params = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [prefs, setPrefs] = usePrefs();
  const book = getBook(params.book ?? '') ?? getBook('jhn')!;
  const chapter = Math.max(1, Math.min(+(params.chapter ?? 1) || 1, book.verses.length));
  const [text, setText] = useState<ChapterText>();
  const [greek, setGreek] = useState<Map<number, GreekWord[]>>(new Map());
  const [picker, setPicker] = useState(false);
  const sel = parseSelection(sp);
  const isNT = book.testament === 'NT';
  const parallel = prefs.showGreek && isNT;

  useEffect(() => {
    let live = true;
    setText(undefined);
    loadChapter(book.id, chapter, prefs.translation).then((t) => live && setText(t));
    setPrefs({ lastRead: { book: book.id, chapter } });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, chapter, prefs.translation]);

  useEffect(() => {
    let live = true;
    if (isNT) loadGreekChapter(book.id, chapter).then((g) => live && setGreek(g));
    else setGreek(new Map());
    return () => {
      live = false;
    };
  }, [book.id, chapter, isNT]);

  // Scroll a selected verse into view when arriving from a link.
  useEffect(() => {
    if (!text || !sel) return;
    document.getElementById(`v${sel.from}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const chStart = refKey(book.id, chapter, 0);
  const chEnd = refKey(book.id, chapter, 999);
  const entries = useLiveQuery(() => entriesInRange(chStart, chEnd), [chStart]) ?? [];
  const boards = useLiveQuery(() => db.boards.where('id').between(chStart, chEnd).primaryKeys(), [chStart]) ?? [];
  const resources = useLiveQuery(() => db.resources.where('start').between(chStart, chEnd).toArray(), [chStart]) ?? [];

  const marks = useMemo(() => {
    const m = new Map<number, { kinds: Set<Entry['kind']>; count: number; words: Set<number> }>();
    for (const e of entries) {
      const v = e.start % 1000;
      if (e.start < chStart) continue;
      const row = m.get(v) ?? { kinds: new Set(), count: 0, words: new Set() };
      row.kinds.add(e.kind);
      row.count++;
      if (e.wordIndex !== undefined) row.words.add(e.wordIndex);
      m.set(v, row);
    }
    for (const r of resources) {
      const v = r.start % 1000;
      const row = m.get(v) ?? { kinds: new Set(), count: 0, words: new Set() };
      row.count++;
      m.set(v, row);
    }
    return m;
  }, [entries, resources, chStart]);

  const boardSet = new Set(boards.map((k) => k % 1000));

  const select = (v: number, extend: boolean) => {
    const next = new URLSearchParams();
    if (extend && sel) {
      const a = Math.min(sel.from, v);
      const b = Math.max(sel.to, v);
      next.set('v', a === b ? String(a) : `${a}-${b}`);
    } else if (sel && sel.from === v && sel.to === v && !sel.word && sel.greek === undefined) {
      setSp(next, { replace: true });
      return;
    } else next.set('v', String(v));
    setSp(next, { replace: true });
  };

  const selectGreek = (v: number, i: number) => setSp({ v: String(v), g: String(i) }, { replace: true });

  const goChapter = (d: number) => {
    const idx = book.index - 1;
    let b = book;
    let c = chapter + d;
    if (c < 1) {
      const prev = BOOKS[idx - 1];
      if (!prev) return;
      b = prev;
      c = prev.verses.length;
    } else if (c > book.verses.length) {
      const next = BOOKS[idx + 1];
      if (!next) return;
      b = next;
      c = 1;
    }
    nav(`/read/${b.id}/${c}`);
    window.scrollTo({ top: 0 });
  };

  const lastVerse = text?.verses[text.verses.length - 1]?.n ?? book.verses[chapter - 1];

  return (
    <div className={`reader ${sel ? 'has-panel' : ''}`}>
      <div className="reader-main">
        <div className="reader-bar">
          <button className="icon-btn" onClick={() => goChapter(-1)} aria-label="Previous chapter">
            <Icon name="left" />
          </button>
          <button className="passage-title" onClick={() => setPicker(true)}>
            {book.name} {chapter}
            <Icon name="down" size={16} />
          </button>
          <button className="icon-btn" onClick={() => goChapter(1)} aria-label="Next chapter">
            <Icon name="right" />
          </button>
          <span className="spacer" />
          <div className="seg" role="group" aria-label="Translation">
            {(['ESV', 'KJV'] as const).map((t) => (
              <button key={t} className={prefs.translation === t ? 'on' : ''} onClick={() => setPrefs({ translation: t })}>
                {t}
              </button>
            ))}
          </div>
          {isNT && (
            <button
              className={`btn toggle ${prefs.showGreek ? 'on' : ''}`}
              onClick={() => setPrefs({ showGreek: !prefs.showGreek })}
              title="Show the SBL Greek New Testament side by side"
            >
              <span className="greek">Ελ</span> Greek
            </button>
          )}
          <button
            className="btn ghost"
            title="Study the whole chapter"
            onClick={() => setSp({ v: `1-${lastVerse}` }, { replace: true })}
          >
            Chapter notes
          </button>
        </div>

        {text?.error && (
          <div className="notice">
            {text.error} {text.error.includes('Settings') && <Link to="/settings">Open Settings</Link>}
          </div>
        )}
        {text && text.translation === 'KJV' && prefs.translation === 'ESV' && !text.error && (
          <div className="notice">
            Showing the KJV. <Link to="/settings">Add your free ESV API key</Link> to read in the ESV.
          </div>
        )}

        <article className={`scripture ${parallel ? 'parallel' : ''}`} lang="en">
          <h1 className="chapter-heading">
            <span className="eyebrow">{book.name}</span>
            <span className="chapter-num">{chapter}</span>
          </h1>
          {!text && <div className="loading">Opening the Word…</div>}
          {text && parallel && (
            <div className="parallel-head">
              <span>{text.translation}</span>
              <span>SBL Greek New Testament</span>
            </div>
          )}
          {text &&
            (parallel ? (
              text.verses.map((v) => (
                <Fragment key={v.n}>
                  {v.heading && <h2 className="section-heading">{v.heading}</h2>}
                  <div className={`verse-row ${inSel(sel, v.n) ? 'selected' : ''}`} id={`v${v.n}`}>
                    <VerseText v={v} sel={sel} mark={marks.get(v.n)} board={boardSet.has(v.n)} onSelect={select} />
                    <p className="greek-verse" lang="grc">
                      {(greek.get(v.n) ?? []).map((w, i) => (
                        <Fragment key={i}>
                          <button
                            className={`gword ${sel?.from === v.n && sel.greek === i ? 'on' : ''}`}
                            onClick={() => selectGreek(v.n, i)}
                          >
                            {w.text}
                          </button>{' '}
                        </Fragment>
                      ))}
                    </p>
                  </div>
                </Fragment>
              ))
            ) : (
              groupParagraphs(text.verses, text.translation === 'KJV').map((para, i) => (
                <Fragment key={i}>
                  {para[0].heading && <h2 className="section-heading">{para[0].heading}</h2>}
                  <p className="para">
                    {para.map((v) => (
                      <VerseText
                        key={v.n}
                        v={v}
                        sel={sel}
                        mark={marks.get(v.n)}
                        board={boardSet.has(v.n)}
                        onSelect={select}
                        inline
                      />
                    ))}
                  </p>
                </Fragment>
              ))
            ))}
          {text && (
            <footer className="chapter-foot">
              <button className="btn ghost" onClick={() => goChapter(-1)}>
                <Icon name="left" size={16} /> Previous
              </button>
              <button className="btn ghost" onClick={() => goChapter(1)}>
                Next <Icon name="right" size={16} />
              </button>
            </footer>
          )}
          {text?.translation === 'ESV' && <p className="copyright">{ESV_COPYRIGHT}</p>}
          {parallel && (
            <p className="copyright">
              Greek: SBL Greek New Testament, © 2010 Society of Biblical Literature and Logos Bible Software. Morphology:
              MorphGNT (CC BY-SA).
            </p>
          )}
        </article>
      </div>

      {sel && text && (
        <StudyPanel
          book={book.id}
          chapter={chapter}
          sel={sel}
          verses={text.verses.filter((v) => v.n >= sel.from && v.n <= sel.to)}
          translation={text.translation}
          greek={sel.from === sel.to ? greek.get(sel.from) : undefined}
          onClose={() => setSp({}, { replace: true })}
          onSelectWord={(w) => setSp(w === undefined ? { v: String(sel.from) } : { v: String(sel.from), w: String(w) }, { replace: true })}
          onSelectGreek={(g) => setSp(g === undefined ? { v: String(sel.from) } : { v: String(sel.from), g: String(g) }, { replace: true })}
        />
      )}

      {picker && <BookPicker current={book.id} onClose={() => setPicker(false)} />}
    </div>
  );
}


function inSel(sel: Selection | undefined, n: number) {
  return !!sel && n >= sel.from && n <= sel.to;
}

function groupParagraphs(verses: Verse[], eachVerse: boolean): Verse[][] {
  const out: Verse[][] = [];
  for (const v of verses) {
    if (!out.length || eachVerse || v.para || v.heading) out.push([v]);
    else out[out.length - 1].push(v);
  }
  return out;
}

function VerseText({
  v,
  sel,
  mark,
  board,
  onSelect,
  inline,
}: {
  v: Verse;
  sel?: Selection;
  mark?: { kinds: Set<Entry['kind']>; count: number; words: Set<number> };
  board: boolean;
  onSelect: (v: number, extend: boolean) => void;
  inline?: boolean;
}) {
  const selected = inSel(sel, v.n);
  const tokens = mark?.words.size ? tokenize(v.text) : undefined;
  return (
    <span
      id={inline ? `v${v.n}` : undefined}
      className={`verse ${selected ? 'selected' : ''} ${mark ? 'annotated' : ''}`}
      onClick={(e) => onSelect(v.n, e.shiftKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(v.n, e.shiftKey)}
    >
      <sup className="vnum">{v.n}</sup>
      {tokens
        ? tokens.map((t, i) => (
            <Fragment key={i}>
              <span className={mark!.words.has(i) ? 'marked-word' : undefined}>{t}</span>{' '}
            </Fragment>
          ))
        : `${v.text} `}
      {(mark || board) && (
        <span className="verse-marks" aria-label={`${mark?.count ?? 0} notes`}>
          {[...(mark?.kinds ?? [])].map((k) => (
            <i key={k} className={`dot kind-${k}`} />
          ))}
          {board && <Icon name="board" size={13} className="board-mark" />}
        </span>
      )}
    </span>
  );
}
