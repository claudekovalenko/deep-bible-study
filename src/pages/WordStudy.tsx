import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { findLemmaOccurrences, getBook, keyToRef, loadLexicon, type GreekWord, type LexEntry } from '../lib/bible';
import { db } from '../lib/db';
import { describeParse } from '../lib/morph';
import { EntryCard } from '../components/EntryCard';

/** A Greek lemma: its meaning, your notes on it, and every place it appears in the NT. */
export function WordStudy() {
  const lemma = decodeURIComponent(useParams().lemma ?? '');
  const [lex, setLex] = useState<LexEntry>();
  const [occ, setOcc] = useState<{ key: number; word: string; verse: GreekWord[] }[]>();
  const notes = useLiveQuery(() => db.entries.where('lemma').equals(lemma).reverse().sortBy('createdAt'), [lemma]) ?? [];

  useEffect(() => {
    setOcc(undefined);
    loadLexicon().then((l) => setLex(l[lemma]));
    findLemmaOccurrences(lemma).then(setOcc);
  }, [lemma]);

  const forms = useMemo(() => {
    const m = new Map<string, { count: number; parse: string; pos: string }>();
    for (const o of occ ?? []) {
      const w = o.verse.find((x) => x.lemma === lemma)!;
      const key = w.text.replace(/[,.;·]/g, '');
      const row = m.get(key) ?? { count: 0, parse: w.parse, pos: w.pos };
      row.count++;
      m.set(key, row);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [occ, lemma]);

  const byBook = useMemo(() => {
    const m = new Map<string, typeof occ>();
    for (const o of occ ?? []) {
      const b = keyToRef(o.key).book;
      m.set(b, [...(m.get(b) ?? []), o]);
    }
    return [...m.entries()];
  }, [occ]);

  return (
    <div className="page word-study">
      <header className="page-head">
        <div className="eyebrow">Word study{lex?.s ? ` · Strong’s G${lex.s}` : ''}</div>
        <h1 className="display greek" lang="grc">
          {lex?.c ?? lemma}
        </h1>
        {lex && <p className="lede">{lex.d ?? lex.g}</p>}
        {occ && (
          <p className="muted">
            {occ.length} verse{occ.length === 1 ? '' : 's'} in the SBL Greek New Testament
          </p>
        )}
      </header>

      <section>
        <h2 className="section-title">Your notes on {lemma}</h2>
        <div className="entry-list">
          {notes.map((e) => (
            <EntryCard key={e.id} entry={e} showRef />
          ))}
          {!notes.length && (
            <p className="empty">
              To write about this word, open any verse where it appears below, tap the Greek word, and write a word study — it will
              gather here from every passage.
            </p>
          )}
        </div>
      </section>

      {forms.length > 0 && (
        <section>
          <h2 className="section-title">Forms</h2>
          <div className="forms">
            {forms.slice(0, 40).map(([f, r]) => (
              <span key={f} className="form-chip" title={describeParse(r.pos, r.parse)}>
                <span className="greek" lang="grc">{f}</span> <span className="muted small">{r.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Occurrences</h2>
        {!occ && <div className="loading">Searching the Greek New Testament…</div>}
        {byBook.map(([book, list]) => (
          <details key={book} className="occ-book" open={byBook.length <= 3}>
            <summary>
              {getBook(book)?.name} <span className="muted">{list!.length}</span>
            </summary>
            {list!.map((o) => {
              const r = keyToRef(o.key);
              const gi = o.verse.findIndex((w) => w.lemma === lemma);
              return (
                <Link key={o.key} className="occ" to={`/read/${r.book}/${r.chapter}?v=${r.verse}&g=${gi}`}>
                  <span className="occ-ref">
                    {r.chapter}:{r.verse}
                  </span>
                  <span className="greek" lang="grc">
                    {o.verse.map((w, i) => (
                      <Fragment key={i}>{w.lemma === lemma ? <mark>{w.text}</mark> : w.text} </Fragment>
                    ))}
                  </span>
                </Link>
              );
            })}
          </details>
        ))}
      </section>
    </div>
  );
}
