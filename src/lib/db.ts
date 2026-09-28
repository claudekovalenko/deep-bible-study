import Dexie, { type EntityTable } from 'dexie';

export type EntryKind = 'commentary' | 'note' | 'question' | 'insight' | 'prayer' | 'application';

export const ENTRY_KINDS: { kind: EntryKind; label: string; hint: string }[] = [
  { kind: 'commentary', label: 'Commentary', hint: 'Your exposition of what the text means' },
  { kind: 'note', label: 'Note', hint: 'Observations, context, structure' },
  { kind: 'insight', label: 'Insight', hint: 'Something the Spirit opened up' },
  { kind: 'question', label: 'Question', hint: 'What you are still wrestling with' },
  { kind: 'prayer', label: 'Prayer', hint: 'Praying the text back to God' },
  { kind: 'application', label: 'Application', hint: 'How you will live this out' },
];

export interface Revision {
  body: string;
  title?: string;
  at: number;
}

/** A dated piece of study attached to a verse, a passage, a word, or a Greek lemma. */
export interface Entry {
  id: string;
  kind: EntryKind;
  start: number; // refKey of first verse
  end: number; // refKey of last verse
  wordIndex?: number; // index of an English token within the start verse
  word?: string; // the English word (kept for display even if tokenisation shifts)
  lemma?: string; // Greek lemma for word-study notes
  title?: string;
  body: string;
  tags: string[];
  audioIds: string[];
  createdAt: number;
  updatedAt: number;
  revisions: Revision[];
  status?: 'active' | 'done'; // applications
}

/** A dated record of actually living out an application. */
export interface ApplicationLog {
  id: string;
  entryId: string;
  at: number;
  body: string;
}

export type ResourceKind = 'video' | 'article' | 'book' | 'sermon' | 'podcast' | 'quote' | 'passage';

/** An outside voice on a text: a theologian, sermon, video, quote, or a cross-reference. */
export interface Resource {
  id: string;
  kind: ResourceKind;
  start: number;
  end: number;
  title: string;
  url?: string;
  author?: string;
  note?: string;
  targetStart?: number; // for kind 'passage': the connected passage
  targetEnd?: number;
  createdAt: number;
  updatedAt: number;
}

export type BubbleKind = 'thought' | 'question' | 'meaning' | 'crossref' | 'greek' | 'application' | 'link';

export interface BoardNode {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: BubbleKind;
  url?: string;
  audioId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoardEdge {
  id: string;
  from: string; // node id, or "w:<index>" / "g:<index>" for English / Greek words
  to: string;
}

/** A whiteboard that zooms into a single verse. id = refKey. */
export interface Board {
  id: number;
  nodes: BoardNode[];
  edges: BoardEdge[];
  translation?: string; // wording the board was built on (word lines point at token indexes)
  tokens?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AudioClip {
  id: string;
  blob: Blob;
  mime: string;
  duration: number;
  createdAt: number;
}

export interface CachedChapter {
  key: string; // "<book>.<chapter>"
  verses: { n: number; text: string; heading?: string; para?: boolean }[];
  fetchedAt: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const db = new Dexie('deep-bible-study') as Dexie & {
  entries: EntityTable<Entry, 'id'>;
  logs: EntityTable<ApplicationLog, 'id'>;
  resources: EntityTable<Resource, 'id'>;
  boards: EntityTable<Board, 'id'>;
  audio: EntityTable<AudioClip, 'id'>;
  esvCache: EntityTable<CachedChapter, 'key'>;
  meta: EntityTable<Meta, 'key'>;
};

db.version(1).stores({
  entries: 'id, kind, start, end, lemma, createdAt, updatedAt, *tags',
  logs: 'id, entryId, at',
  resources: 'id, kind, start, targetStart, author, createdAt',
  boards: 'id, updatedAt',
  audio: 'id, createdAt',
  esvCache: 'key, fetchedAt',
  meta: 'key',
});

/** Tables that hold the user's study (everything except caches). */
export const USER_TABLES = ['entries', 'logs', 'resources', 'boards', 'audio', 'meta'] as const;

export const uid = () => crypto.randomUUID();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

// ---- Mutations -----------------------------------------------------------------

export async function saveEntry(e: Partial<Entry> & Pick<Entry, 'kind' | 'start' | 'end' | 'body'>): Promise<string> {
  const now = Date.now();
  if (e.id) {
    const prev = await db.entries.get(e.id);
    if (prev) {
      const changed = prev.body !== e.body || (prev.title ?? '') !== (e.title ?? '');
      await db.entries.put({
        ...prev,
        ...e,
        updatedAt: changed ? now : prev.updatedAt,
        revisions: changed ? [...prev.revisions, { body: prev.body, title: prev.title, at: prev.updatedAt }] : prev.revisions,
      } as Entry);
      return e.id;
    }
  }
  const id = e.id ?? uid();
  await db.entries.add({
    tags: [],
    audioIds: [],
    revisions: [],
    ...e,
    id,
    createdAt: e.createdAt ?? now,
    updatedAt: now,
  } as Entry);
  return id;
}

export async function deleteEntry(id: string) {
  const e = await db.entries.get(id);
  await db.transaction('rw', db.entries, db.logs, db.audio, async () => {
    await db.logs.where('entryId').equals(id).delete();
    if (e?.audioIds.length) await db.audio.bulkDelete(e.audioIds);
    await db.entries.delete(id);
  });
}

/** Entries touching any verse in [start, end]. Scoped to the book for speed. */
export function entriesInRange(start: number, end: number) {
  const bookStart = Math.floor(start / 1_000_000) * 1_000_000;
  return db.entries.where('start').between(bookStart, end, true, true).filter((e) => e.end >= start).toArray();
}

export function resourcesInRange(start: number, end: number) {
  const bookStart = Math.floor(start / 1_000_000) * 1_000_000;
  return db.resources.where('start').between(bookStart, end, true, true).filter((r) => r.end >= start).toArray();
}

/** Cross-references pointing *into* a range from elsewhere. */
export function incomingPassages(start: number, end: number) {
  const bookStart = Math.floor(start / 1_000_000) * 1_000_000;
  return db.resources
    .where('targetStart')
    .between(bookStart, end, true, true)
    .filter((r) => (r.targetEnd ?? r.targetStart!) >= start)
    .toArray();
}

export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
