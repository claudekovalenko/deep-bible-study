import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRange, getBook, keyToRef, loadGreekChapter, tokenize, bareWord, type GreekWord } from '../lib/bible';
import { db, uid, type Board, type BoardEdge, type BoardNode, type BubbleKind } from '../lib/db';
import { loadChapter } from '../lib/esv';
import { fmtDate, fmtDateTime, youtubeId } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { AudioClipView, VoiceRecorder } from '../components/Audio';
import { GreekCard } from '../components/StudyPanel';
import { Icon } from '../components/Icon';

const BUBBLE_KINDS: { kind: BubbleKind; label: string }[] = [
  { kind: 'thought', label: 'Thought' },
  { kind: 'meaning', label: 'Meaning' },
  { kind: 'question', label: 'Question' },
  { kind: 'crossref', label: 'Cross-ref' },
  { kind: 'greek', label: 'Greek' },
  { kind: 'application', label: 'Application' },
  { kind: 'link', label: 'Link / video' },
];

const VERSE_WIDTH = 880;
type Pt = { x: number; y: number };
type Sel = { type: 'node' | 'word' | 'greek' | 'edge'; id: string } | null;

type BoardDoc = Board;

export function Whiteboard() {
  const { key: keyParam } = useParams();
  const key = Number(keyParam);
  const nav = useNavigate();
  const ref = keyToRef(key);
  const book = getBook(ref.book);
  const [prefs] = usePrefs();

  // null = no board yet; undefined = still loading.
  const stored = useLiveQuery(() => db.boards.get(key).then((b) => b ?? null), [key]);
  const [doc, setDoc] = useState<BoardDoc | null>(null);
  const [liveText, setLiveText] = useState<{ tokens: string[]; translation: string }>();
  const [greek, setGreek] = useState<GreekWord[]>([]);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [sel, setSel] = useState<Sel>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<Record<string, Pt>>({});
  const viewport = useRef<HTMLDivElement>(null);
  const verseRef = useRef<HTMLDivElement>(null);
  const loadedKey = useRef<number | null>(null);

  // Load the board once per verse (then keep local state authoritative).
  useEffect(() => {
    if (stored === undefined || loadedKey.current === key) return;
    loadedKey.current = key;
    const now = Date.now();
    setDoc(stored ?? { id: key, nodes: [], edges: [], createdAt: now, updatedAt: now });
  }, [stored, key]);

  useEffect(() => {
    if (!book) return;
    loadChapter(book.id, ref.chapter, prefs.translation).then((t) => {
      const v = t.verses.find((x) => x.n === ref.verse);
      setLiveText({ tokens: tokenize(v?.text ?? ''), translation: t.translation });
    });
    if (book.testament === 'NT') loadGreekChapter(book.id, ref.chapter).then((g) => setGreek(g.get(ref.verse) ?? []));
    else setGreek([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, prefs.translation]);

  // Word connections point at token indexes, so a board keeps the wording it was built on.
  const tokens = doc?.tokens?.length ? doc.tokens : liveText?.tokens ?? [];
  const translation = doc?.tokens?.length ? doc.translation : liveText?.translation;

  // Persist (debounced).
  const saveTimer = useRef<number>(undefined);
  const commit = useCallback(
    (next: BoardDoc) => {
      const withText = next.tokens?.length || !liveText ? next : { ...next, tokens: liveText.tokens, translation: liveText.translation };
      const stamped = { ...withText, updatedAt: Date.now() };
      setDoc(stamped);
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        if (stamped.nodes.length || stored) db.boards.put(stamped);
      }, 300);
    },
    [liveText, stored],
  );

  // Measure where each word sits so lines can attach to it.
  useLayoutEffect(() => {
    const root = verseRef.current;
    if (!root) return;
    const measure = () => {
      const a: Record<string, Pt> = {};
      root.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
        a[el.dataset.anchor!] = {
          x: root.offsetLeft + el.offsetLeft + el.offsetWidth / 2,
          y: root.offsetTop + el.offsetTop + el.offsetHeight / 2,
        };
      });
      setAnchors(a);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [tokens.join(' '), greek.length]);

  // Centre the verse on first load.
  useLayoutEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const k = Math.min(1, (vp.clientWidth - 32) / (VERSE_WIDTH + 40));
    setView({ x: vp.clientWidth / 2, y: vp.clientHeight / 2 - 20, k });
  }, [key]);

  const posOf = useCallback(
    (id: string): Pt | undefined => {
      if (id.startsWith('w:') || id.startsWith('g:')) return anchors[id];
      const n = doc?.nodes.find((x) => x.id === id);
      return n ? { x: n.x, y: n.y } : undefined;
    },
    [anchors, doc],
  );

  // ---- mutations ----
  const addNode = (from: string | null, at?: Pt, kind: BubbleKind = 'thought') => {
    if (!doc) return;
    let p = at;
    if (!p && from) {
      const origin = posOf(from) ?? { x: 0, y: 0 };
      const n = doc.edges.filter((e) => e.from === from).length;
      const isGreek = from.startsWith('g:');
      const above = !isGreek && n % 2 === 0;
      const ring = Math.floor(n / 2);
      p = { x: origin.x, y: origin.y + (above ? -180 - ring * 30 : 200 + ring * 30) };
    }
    // Nudge sideways until the new bubble doesn't sit on top of another one.
    const clear = (q: Pt) => doc.nodes.every((o) => Math.abs(o.x - q.x) > 235 || Math.abs(o.y - q.y) > 120);
    for (let i = 1; p && !clear(p) && i < 24; i++) {
      const step = Math.ceil(i / 2) * 240 * (i % 2 ? 1 : -1);
      const base: Pt = p;
      const q = { x: base.x + step, y: base.y };
      if (clear(q)) p = q;
    }
    p ??= { x: 0, y: -240 };
    const now = Date.now();
    const node: BoardNode = { id: uid(), x: p.x, y: p.y, text: '', kind, createdAt: now, updatedAt: now };
    const edges = from ? [...doc.edges, { id: uid(), from, to: node.id }] : doc.edges;
    commit({ ...doc, nodes: [...doc.nodes, node], edges });
    setSel({ type: 'node', id: node.id });
  };

  const updateNode = (id: string, patch: Partial<BoardNode>, stamp = true) => {
    if (!doc) return;
    commit({
      ...doc,
      nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch, ...(stamp ? { updatedAt: Date.now() } : {}) } : n)),
    });
  };

  const removeNode = async (id: string) => {
    if (!doc) return;
    const n = doc.nodes.find((x) => x.id === id);
    if (n?.text && !confirm('Delete this bubble?')) return;
    if (n?.audioId) await db.audio.delete(n.audioId);
    commit({ ...doc, nodes: doc.nodes.filter((x) => x.id !== id), edges: doc.edges.filter((e) => e.from !== id && e.to !== id) });
    setSel(null);
  };

  const connect = (from: string, to: string) => {
    if (!doc || from === to) return;
    const exists = doc.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
    if (!exists) commit({ ...doc, edges: [...doc.edges, { id: uid(), from, to }] });
  };

  const pick = (target: Sel) => {
    if (connectFrom && target && target.type !== 'edge') {
      connect(connectFrom, target.id);
      setConnectFrom(null);
    }
    setSel(target);
  };

  // ---- pan / zoom / drag ----
  const drag = useRef<{ kind: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d: number; k: number } | null>(null);

  const zoomAt = (factor: number, px: number, py: number) =>
    setView((v) => {
      const k = Math.min(3, Math.max(0.2, v.k * factor));
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });

  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const onViewportDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
      drag.current = null;
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest('.bubble, .bw, .gw, .board-edge')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };

  const onViewportMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = viewport.current!.getBoundingClientRect();
      const target = Math.min(3, Math.max(0.2, (pinch.current.k * d) / pinch.current.d));
      zoomAt(target / view.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.kind === 'pan') setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    else if (d.id && d.moved && doc) {
      setDoc({
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === d.id ? { ...n, x: d.ox + dx / view.k, y: d.oy + dy / view.k } : n)),
      });
    }
  };

  const onViewportUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'pan' && !d.moved) {
      setSel(null);
      setConnectFrom(null);
    }
    if (d.kind === 'node' && d.moved && doc) commit(doc);
  };

  const onBubbleDown = (e: React.PointerEvent, n: BoardNode) => {
    if ((e.target as HTMLElement).closest('textarea, input, button, a, audio, select')) return;
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.current?.setPointerCapture(e.pointerId);
    drag.current = { kind: 'node', id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
    pick({ type: 'node', id: n.id });
  };

  const onCanvasDouble = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.bubble, .bw, .gw')) return;
    const r = viewport.current!.getBoundingClientRect();
    addNode(null, { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k });
  };

  const fit = () => {
    const vp = viewport.current;
    if (!vp || !doc) return;
    const pts = [...Object.values(anchors), ...doc.nodes.map((n) => ({ x: n.x, y: n.y }))];
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs, -VERSE_WIDTH / 2) - 140;
    const maxX = Math.max(...xs, VERSE_WIDTH / 2) + 140;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 100;
    const k = Math.min(1.5, vp.clientWidth / (maxX - minX), vp.clientHeight / (maxY - minY));
    setView({ k, x: vp.clientWidth / 2 - ((minX + maxX) / 2) * k, y: vp.clientHeight / 2 - ((minY + maxY) / 2) * k });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('textarea, input')) return;
      if (e.key === 'Escape') {
        setConnectFrom(null);
        setSel(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        if (sel.type === 'node') removeNode(sel.id);
        if (sel.type === 'edge' && doc) {
          commit({ ...doc, edges: doc.edges.filter((x) => x.id !== sel.id) });
          setSel(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const edgesDrawn = useMemo(
    () =>
      (doc?.edges ?? [])
        .map((e) => ({ e, a: posOf(e.from), b: posOf(e.to) }))
        .filter((x): x is { e: BoardEdge; a: Pt; b: Pt } => !!x.a && !!x.b),
    [doc, posOf],
  );

  const wordConnections = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of doc?.edges ?? []) for (const id of [e.from, e.to]) if (/^[wg]:/.test(id)) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [doc]);

  if (!book) return <div className="page">Unknown verse.</div>;
  const selNode = sel?.type === 'node' ? doc?.nodes.find((n) => n.id === sel.id) : undefined;
  const selWord = sel?.type === 'word' ? +sel.id.slice(2) : undefined;
  const selGreek = sel?.type === 'greek' ? greek[+sel.id.slice(2)] : undefined;
  const nextVerse = ref.verse < (book.verses[ref.chapter - 1] ?? 0) ? key + 1 : null;
  const prevVerse = ref.verse > 1 ? key - 1 : null;

  return (
    <div className="whiteboard">
      <div className="board-bar">
        <Link className="icon-btn" to={`/read/${ref.book}/${ref.chapter}?v=${ref.verse}`} aria-label="Back to reading">
          <Icon name="left" />
        </Link>
        <div>
          <div className="eyebrow">Whiteboard{translation ? ` · ${translation}` : ''}</div>
          <h1>{formatRange(key, key)}</h1>
        </div>
        <span className="spacer" />
        <button className="icon-btn" disabled={!prevVerse} onClick={() => prevVerse && nav(`/board/${prevVerse}`)} aria-label="Previous verse">
          <Icon name="left" size={18} />
        </button>
        <button className="icon-btn" disabled={!nextVerse} onClick={() => nextVerse && nav(`/board/${nextVerse}`)} aria-label="Next verse">
          <Icon name="right" size={18} />
        </button>
        <span className="bar-sep" />
        <button className="icon-btn" onClick={() => zoomAt(1 / 1.2, (viewport.current?.clientWidth ?? 0) / 2, (viewport.current?.clientHeight ?? 0) / 2)} aria-label="Zoom out">
          <Icon name="zoomOut" size={19} />
        </button>
        <button className="icon-btn" onClick={() => zoomAt(1.2, (viewport.current?.clientWidth ?? 0) / 2, (viewport.current?.clientHeight ?? 0) / 2)} aria-label="Zoom in">
          <Icon name="zoomIn" size={19} />
        </button>
        <button className="icon-btn" onClick={fit} aria-label="Fit everything">
          <Icon name="fit" size={19} />
        </button>
        <button className="btn primary" onClick={() => addNode(null)}>
          <Icon name="plus" size={16} /> Bubble
        </button>
      </div>

      {connectFrom && <div className="connect-hint">Tap a word or bubble to connect it · Esc to cancel</div>}

      <div
        ref={viewport}
        className={`board-viewport ${connectFrom ? 'connecting' : ''}`}
        onPointerDown={onViewportDown}
        onPointerMove={onViewportMove}
        onPointerUp={onViewportUp}
        onPointerCancel={onViewportUp}
        onDoubleClick={onCanvasDouble}
        style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${28 * view.k}px ${28 * view.k}px` }}
      >
        <div className="board-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="board-edges" width="1" height="1">
            {edgesDrawn.map(({ e, a, b }) => {
              const my = (a.y + b.y) / 2;
              const d = `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
              const on = sel?.type === 'edge' && sel.id === e.id;
              const toNode = doc?.nodes.find((n) => n.id === e.to);
              return (
                <g key={e.id} className={`board-edge kind-${toNode?.kind ?? 'thought'} ${on ? 'on' : ''}`}>
                  <path d={d} className="edge-hit" onPointerDown={(ev) => { ev.stopPropagation(); setSel({ type: 'edge', id: e.id }); }} />
                  <path d={d} className="edge-line" />
                </g>
              );
            })}
          </svg>

          <div ref={verseRef} className="board-verse" style={{ width: VERSE_WIDTH, left: -VERSE_WIDTH / 2, top: -70 }}>
            <div className="board-words">
              {tokens.map((t, i) => (
                <Fragment key={i}>
                  <button
                    data-anchor={`w:${i}`}
                    className={`bw ${selWord === i ? 'on' : ''} ${wordConnections.has(`w:${i}`) ? 'has' : ''}`}
                    onClick={() => pick({ type: 'word', id: `w:${i}` })}
                    onDoubleClick={(e) => { e.stopPropagation(); addNode(`w:${i}`); }}
                  >
                    {t}
                  </button>{' '}
                </Fragment>
              ))}
            </div>
            {greek.length > 0 && (
              <div className="board-greek" lang="grc">
                {greek.map((w, i) => (
                  <Fragment key={i}>
                    <button
                      data-anchor={`g:${i}`}
                      className={`gw ${sel?.type === 'greek' && sel.id === `g:${i}` ? 'on' : ''} ${wordConnections.has(`g:${i}`) ? 'has' : ''}`}
                      onClick={() => pick({ type: 'greek', id: `g:${i}` })}
                      onDoubleClick={(e) => { e.stopPropagation(); addNode(`g:${i}`, undefined, 'greek'); }}
                    >
                      {w.text}
                    </button>{' '}
                  </Fragment>
                ))}
              </div>
            )}
          </div>

          {doc?.nodes.map((n) => (
            <Bubble
              key={n.id}
              n={n}
              selected={sel?.type === 'node' && sel.id === n.id}
              onDown={(e) => onBubbleDown(e, n)}
              onText={(text) => updateNode(n.id, { text })}
            />
          ))}
        </div>

        {doc && !doc.nodes.length && (
          <div className="board-empty">
            <strong>Zoom in on this verse.</strong> Tap a word, then <em>Branch</em> to draw out what it makes you think — or double-click
            anywhere for a free-floating bubble. Every bubble is dated.
          </div>
        )}
      </div>

      {(selNode || selWord !== undefined || selGreek || sel?.type === 'edge') && (
        <div className="inspector">
          {selNode && (
            <>
              <div className="kind-picker">
                {BUBBLE_KINDS.map((k) => (
                  <button key={k.kind} className={`chip bub-${k.kind} ${selNode.kind === k.kind ? 'on' : ''}`} onClick={() => updateNode(selNode.id, { kind: k.kind })}>
                    {k.label}
                  </button>
                ))}
              </div>
              {selNode.kind === 'link' && (
                <input placeholder="Paste a link (YouTube, article…)" value={selNode.url ?? ''} onChange={(e) => updateNode(selNode.id, { url: e.target.value })} />
              )}
              {selNode.audioId ? (
                <AudioClipView id={selNode.audioId} onRemove={() => { db.audio.delete(selNode.audioId!); updateNode(selNode.id, { audioId: undefined }); }} />
              ) : null}
              <div className="composer-actions">
                <button className="btn soft" onClick={() => addNode(selNode.id)}>
                  <Icon name="plus" size={16} /> Branch
                </button>
                <button className="btn ghost" onClick={() => setConnectFrom(selNode.id)}>
                  <Icon name="link" size={16} /> Connect
                </button>
                {!selNode.audioId && <VoiceRecorder compact onSaved={(id) => updateNode(selNode.id, { audioId: id })} />}
                <span className="spacer" />
                <span className="muted small" title={`Edited ${fmtDateTime(selNode.updatedAt)}`}>
                  {fmtDate(selNode.createdAt)}
                </span>
                <button className="icon-btn" onClick={() => removeNode(selNode.id)} aria-label="Delete bubble">
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </>
          )}
          {selWord !== undefined && (
            <>
              <div className="inspector-title">
                “{bareWord(tokens[selWord] ?? '')}” <span className="muted small">{wordConnections.get(`w:${selWord}`) ?? 0} connections</span>
              </div>
              <div className="composer-actions">
                <button className="btn primary" onClick={() => addNode(`w:${selWord}`)}>
                  <Icon name="plus" size={16} /> Branch a thought
                </button>
                <button className="btn soft" onClick={() => addNode(`w:${selWord}`, undefined, 'meaning')}>Meaning</button>
                <button className="btn soft" onClick={() => addNode(`w:${selWord}`, undefined, 'question')}>Question</button>
                <button className="btn soft" onClick={() => addNode(`w:${selWord}`, undefined, 'crossref')}>Cross-ref</button>
                <button className="btn ghost" onClick={() => setConnectFrom(`w:${selWord}`)}>
                  <Icon name="link" size={16} /> Connect
                </button>
              </div>
            </>
          )}
          {selGreek && (
            <>
              <GreekCard w={selGreek} />
              <div className="composer-actions">
                <button className="btn primary" onClick={() => addNode(sel!.id, undefined, 'greek')}>
                  <Icon name="plus" size={16} /> Branch from the Greek
                </button>
                <button className="btn ghost" onClick={() => setConnectFrom(sel!.id)}>
                  <Icon name="link" size={16} /> Connect
                </button>
              </div>
            </>
          )}
          {sel?.type === 'edge' && (
            <div className="composer-actions">
              <span className="muted">Connection</span>
              <span className="spacer" />
              <button
                className="btn ghost"
                onClick={() => {
                  if (doc) commit({ ...doc, edges: doc.edges.filter((x) => x.id !== sel.id) });
                  setSel(null);
                }}
              >
                <Icon name="trash" size={16} /> Remove line
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({
  n,
  selected,
  onDown,
  onText,
}: {
  n: BoardNode;
  selected: boolean;
  onDown: (e: React.PointerEvent) => void;
  onText: (t: string) => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [n.text, selected]);
  useEffect(() => {
    if (selected && !n.text) ta.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const yt = n.kind === 'link' && n.url ? youtubeId(n.url) : undefined;

  return (
    <div
      className={`bubble bub-${n.kind} ${selected ? 'on' : ''}`}
      style={{ left: n.x, top: n.y }}
      onPointerDown={onDown}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <span className="bubble-kind">{BUBBLE_KINDS.find((k) => k.kind === n.kind)?.label}</span>
      {selected ? (
        <textarea ref={ta} value={n.text} placeholder="What does this make you think?" onChange={(e) => onText(e.target.value)} rows={1} />
      ) : (
        <div className="bubble-text">{n.text || <span className="muted">Empty thought</span>}</div>
      )}
      {yt && <img className="bubble-thumb" src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" />}
      {n.url && (
        <a className="bubble-link" href={n.url} target="_blank" rel="noreferrer">
          <Icon name={yt ? 'video' : 'link'} size={13} /> {n.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 32)}
        </a>
      )}
      {n.audioId && !selected && (
        <span className="bubble-audio">
          <Icon name="mic" size={13} /> voice memo
        </span>
      )}
      <time className="bubble-date">{fmtDate(n.createdAt)}</time>
    </div>
  );
}
