import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { bareWord, formatRange, loadLexicon, refKey, tokenize, type GreekWord, type LexEntry, type Verse } from '../lib/bible';
import { db, entriesInRange, ENTRY_KINDS, incomingPassages, resourcesInRange, type Entry, type EntryKind } from '../lib/db';
import { describeParse } from '../lib/morph';
import type { Selection } from '../pages/Reader';
import { Composer } from './Composer';
import { EntryCard } from './EntryCard';
import { Icon } from './Icon';
import { ResourceCard, ResourceForm } from './Resources';

interface Props {
  book: string;
  chapter: number;
  sel: Selection;
  verses: Verse[];
  translation: string;
  greek?: GreekWord[];
  onClose: () => void;
  onSelectWord: (i?: number) => void;
  onSelectGreek: (i?: number) => void;
}

export function StudyPanel({ book, chapter, sel, verses, translation, greek, onClose, onSelectWord, onSelectGreek }: Props) {
  const start = refKey(book, chapter, sel.from);
  const end = refKey(book, chapter, sel.to);
  const single = sel.from === sel.to;
  const [tab, setTab] = useState<'study' | 'sources'>('study');
  const [writing, setWriting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<EntryKind | 'all'>('all');
  const tokens = single && verses[0] ? tokenize(verses[0].text) : [];
  const word = sel.word !== undefined ? bareWord(tokens[sel.word] ?? '') : undefined;
  const gword = sel.greek !== undefined ? greek?.[sel.greek] : undefined;

  useEffect(() => {
    setWriting(false);
    setAdding(false);
  }, [start, end, sel.word, sel.greek]);

  const rangeEntries = useLiveQuery(() => entriesInRange(start, end), [start, end]) ?? [];
  const lemmaEntries = useLiveQuery(
    () => (gword ? db.entries.where('lemma').equals(gword.lemma).toArray() : Promise.resolve([] as Entry[])),
    [gword?.lemma],
  ) ?? [];
  const resources = useLiveQuery(() => resourcesInRange(start, end), [start, end]) ?? [];
  const incoming = useLiveQuery(() => incomingPassages(start, end), [start, end]) ?? [];

  let entries = gword
    ? lemmaEntries
    : sel.word !== undefined
      ? rangeEntries.filter((e) => e.start === start && e.wordIndex === sel.word)
      : rangeEntries.filter((e) => !e.lemma || (e.start >= start && e.end <= end));
  const counts = new Map<EntryKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  if (filter !== 'all') entries = entries.filter((e) => e.kind === filter);
  entries = [...entries].sort((a, b) => b.createdAt - a.createdAt);

  const wordCounts = new Map<number, number>();
  for (const e of rangeEntries) if (e.start === start && e.wordIndex !== undefined) wordCounts.set(e.wordIndex, (wordCounts.get(e.wordIndex) ?? 0) + 1);

  const label = formatRange(start, end);

  return (
    <aside className="study-panel" aria-label={`Study ${label}`}>
      <div className="panel-head">
        <div>
          <div className="eyebrow">{translation}</div>
          <h2>{label}</h2>
        </div>
        <span className="spacer" />
        <Link className="btn soft" to={`/board/${start}`} title="Open this verse on a whiteboard">
          <Icon name="board" size={17} /> Whiteboard
        </Link>
        <button className="icon-btn" onClick={onClose} aria-label="Close study panel">
          <Icon name="close" />
        </button>
      </div>

      <div className="panel-scroll">
        <div className="panel-text">
          {single ? (
            <p className="focus-verse">
              {tokens.map((t, i) => (
                <Fragment key={i}>
                  <button
                    className={`tword ${sel.word === i ? 'on' : ''} ${wordCounts.has(i) ? 'has' : ''}`}
                    onClick={() => onSelectWord(sel.word === i ? undefined : i)}
                  >
                    {t}
                  </button>{' '}
                </Fragment>
              ))}
            </p>
          ) : (
            <p className="focus-verse range">
              {verses.map((v) => (
                <Fragment key={v.n}>
                  <sup className="vnum">{v.n}</sup>
                  {v.text}{' '}
                </Fragment>
              ))}
            </p>
          )}
          {single && greek && greek.length > 0 && (
            <p className="focus-greek" lang="grc">
              {greek.map((w, i) => (
                <Fragment key={i}>
                  <button className={`gword ${sel.greek === i ? 'on' : ''}`} onClick={() => onSelectGreek(sel.greek === i ? undefined : i)}>
                    {w.text}
                  </button>{' '}
                </Fragment>
              ))}
            </p>
          )}
          {single && <p className="muted small hint">Tap a word to study it on its own.</p>}
        </div>

        {gword && <GreekCard w={gword} onClear={() => onSelectGreek(undefined)} />}
        {word && (
          <div className="focus-chip">
            Studying the word <strong>“{word}”</strong>
            <button className="icon-btn tiny" onClick={() => onSelectWord(undefined)} aria-label="Stop focusing this word">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'study'} className={tab === 'study' ? 'on' : ''} onClick={() => setTab('study')}>
            {gword ? `Notes on ${gword.lemma}` : 'My study'} <span className="count">{counts.size ? [...counts.values()].reduce((a, b) => a + b) : ''}</span>
          </button>
          <button role="tab" aria-selected={tab === 'sources'} className={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}>
            Voices & links <span className="count">{resources.length + incoming.length || ''}</span>
          </button>
        </div>

        {tab === 'study' && (
          <>
            {writing ? (
              <Composer
                start={start}
                end={gword ? start : end}
                wordIndex={sel.word}
                word={word}
                lemma={gword?.lemma}
                onDone={() => setWriting(false)}
                autoFocus
              />
            ) : (
              <button className="write-prompt" onClick={() => setWriting(true)}>
                <Icon name="edit" size={18} />
                {gword
                  ? `Write a word study on ${gword.lemma}…`
                  : word
                    ? `What does “${word}” open up?`
                    : 'Write commentary, a note, a prayer, an application…'}
              </button>
            )}
            {counts.size > 1 && (
              <div className="filter-row">
                <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
                  All
                </button>
                {ENTRY_KINDS.filter((k) => counts.has(k.kind)).map((k) => (
                  <button key={k.kind} className={`chip kind-${k.kind} ${filter === k.kind ? 'on' : ''}`} onClick={() => setFilter(k.kind)}>
                    {k.label} {counts.get(k.kind)}
                  </button>
                ))}
              </div>
            )}
            <div className="entry-list">
              {entries.map((e) => (
                <EntryCard key={e.id} entry={e} showRef={!!gword || e.start !== start || e.end !== end} />
              ))}
              {!entries.length && !writing && (
                <p className="empty">
                  {gword ? 'No notes on this Greek word yet.' : 'Nothing written here yet. Every entry is dated, so years from now you can trace how this text shaped you.'}
                </p>
              )}
            </div>
          </>
        )}

        {tab === 'sources' && (
          <>
            {adding ? (
              <ResourceForm start={start} end={end} onDone={() => setAdding(false)} />
            ) : (
              <button className="write-prompt" onClick={() => setAdding(true)}>
                <Icon name="plus" size={18} /> Add a theologian, sermon, video, quote, or cross-reference
              </button>
            )}
            <div className="entry-list">
              {resources.map((r) => (
                <ResourceCard key={r.id} r={r} showRef={r.start !== start || r.end !== end} />
              ))}
              {incoming.map((r) => (
                <ResourceCard key={r.id} r={r} incoming />
              ))}
              {!resources.length && !incoming.length && !adding && (
                <p className="empty">Gather the voices that have helped you see this text — they will be here whenever you return.</p>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export function GreekCard({ w, onClear }: { w: GreekWord; onClear?: () => void }) {
  const [lex, setLex] = useState<LexEntry>();
  useEffect(() => {
    let live = true;
    setLex(undefined);
    loadLexicon().then((l) => live && setLex(l[w.lemma]));
    return () => {
      live = false;
    };
  }, [w.lemma]);
  return (
    <div className="greek-card">
      <div className="greek-card-head">
        <span className="greek big" lang="grc">
          {w.text.replace(/[,.;·]/g, '')}
        </span>
        <span className="spacer" />
        {onClear && (
          <button className="icon-btn tiny" onClick={onClear} aria-label="Close word">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <dl>
        <dt>Lexical form</dt>
        <dd>
          <Link to={`/word/${encodeURIComponent(w.lemma)}`} className="greek">
            {lex?.c ?? w.lemma}
          </Link>
          {lex?.s && <span className="muted small"> · Strong’s G{lex.s}</span>}
        </dd>
        <dt>Gloss</dt>
        <dd>{lex?.g || '—'}</dd>
        {lex?.d && lex.d !== lex.g && (
          <>
            <dt>Definition</dt>
            <dd>{lex.d}</dd>
          </>
        )}
        <dt>Parsing</dt>
        <dd>{describeParse(w.pos, w.parse)}</dd>
      </dl>
      <Link className="btn soft small" to={`/word/${encodeURIComponent(w.lemma)}`}>
        <Icon name="search" size={15} /> Every use of {w.lemma} in the NT
      </Link>
    </div>
  );
}
