import booksData from '../data/books.json';

export interface Book {
  id: string;
  name: string;
  testament: 'OT' | 'NT';
  verses: number[]; // verse count per chapter (English versification)
  index: number; // 1-based canonical order
}

export const BOOKS: Book[] = (booksData as Omit<Book, 'index'>[]).map((b, i) => ({ ...b, index: i + 1 }));
const byId = new Map(BOOKS.map((b) => [b.id, b]));

export function getBook(id: string): Book | undefined {
  return byId.get(id);
}

/** A verse or passage. verseEnd/chapterEnd default to the start. */
export interface Ref {
  book: string;
  chapter: number;
  verse?: number;
  chapterEnd?: number;
  verseEnd?: number;
}

/** Sortable numeric key: BBCCCVVV. */
export function refKey(book: string, chapter: number, verse = 0): number {
  const b = getBook(book);
  return (b?.index ?? 0) * 1_000_000 + chapter * 1000 + verse;
}

export function keyToRef(key: number): { book: string; chapter: number; verse: number } {
  const b = BOOKS[Math.floor(key / 1_000_000) - 1];
  return { book: b?.id ?? 'gen', chapter: Math.floor((key % 1_000_000) / 1000), verse: key % 1000 };
}

export function refRange(r: Ref): { start: number; end: number } {
  const start = refKey(r.book, r.chapter, r.verse ?? 1);
  const endChapter = r.chapterEnd ?? r.chapter;
  const book = getBook(r.book);
  const endVerse = r.verseEnd ?? r.verse ?? book?.verses[endChapter - 1] ?? 999;
  return { start, end: refKey(r.book, endChapter, endVerse) };
}

export function formatRange(start: number, end: number, short = false): string {
  const a = keyToRef(start);
  const b = keyToRef(end);
  const book = getBook(a.book);
  const name = short ? shortName(a.book) : book?.name ?? a.book;
  if (start === end) return `${name} ${a.chapter}:${a.verse}`;
  if (a.chapter === b.chapter) {
    const last = getBook(a.book)?.verses[a.chapter - 1];
    if (a.verse === 1 && b.verse === last) return `${name} ${a.chapter}`;
    return `${name} ${a.chapter}:${a.verse}–${b.verse}`;
  }
  return `${name} ${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`;
}

export function shortName(id: string): string {
  const name = getBook(id)?.name ?? id;
  const special: Record<string, string> = {
    'Song of Solomon': 'Song', Philippians: 'Phil', Philemon: 'Phlm', Judges: 'Judg', Ecclesiastes: 'Eccl',
  };
  if (special[name]) return special[name];
  const m = name.match(/^(\d )?(.*)$/)!;
  return (m[1] ?? '') + m[2].slice(0, m[2].length > 5 ? 3 : m[2].length);
}

// ---- Reference parsing -------------------------------------------------------

const ALIASES: Record<string, string> = {};
function alias(id: string, ...names: string[]) {
  for (const n of names) ALIASES[n.toLowerCase().replace(/[\s.]/g, '')] = id;
}
for (const b of BOOKS) alias(b.id, b.id, b.name);
alias('gen', 'gn', 'ge'); alias('exo', 'ex', 'exod'); alias('lev', 'lv'); alias('num', 'nm', 'nu'); alias('deu', 'dt', 'deut');
alias('jos', 'josh'); alias('jdg', 'judg', 'jg'); alias('rut', 'ru', 'rth'); alias('1sa', '1sam', '1samuel'); alias('2sa', '2sam');
alias('1ki', '1kgs', '1kings'); alias('2ki', '2kgs', '2kings'); alias('1ch', '1chr', '1chron'); alias('2ch', '2chr', '2chron');
alias('ezr', 'ezra'); alias('neh', 'ne'); alias('est', 'esth'); alias('psa', 'ps', 'psalm', 'pss', 'psalms');
alias('pro', 'prov', 'pr', 'prv'); alias('ecc', 'eccl', 'eccles', 'qoh'); alias('sng', 'song', 'sos', 'songofsongs', 'canticles');
alias('isa', 'is'); alias('jer', 'je'); alias('lam', 'la'); alias('ezk', 'ezek', 'eze'); alias('dan', 'dn', 'da');
alias('hos', 'ho'); alias('jol', 'joel', 'jl'); alias('amo', 'am', 'amos'); alias('oba', 'obad', 'ob'); alias('jon', 'jonah', 'jnh');
alias('mic', 'mi'); alias('nam', 'nah', 'na'); alias('hab', 'hb'); alias('zep', 'zeph', 'zp'); alias('hag', 'hg');
alias('zec', 'zech', 'zc'); alias('mal', 'ml'); alias('mat', 'matt', 'mt'); alias('mrk', 'mark', 'mk', 'mr');
alias('luk', 'luke', 'lk'); alias('jhn', 'john', 'jn', 'joh'); alias('act', 'acts', 'ac'); alias('rom', 'ro', 'rm');
alias('1co', '1cor', '1corinthians'); alias('2co', '2cor'); alias('gal', 'ga'); alias('eph', 'ephes'); alias('php', 'phil', 'pp');
alias('col', 'co'); alias('1th', '1thess', '1thes'); alias('2th', '2thess', '2thes'); alias('1ti', '1tim'); alias('2ti', '2tim');
alias('tit', 'ti'); alias('phm', 'philem', 'phlm'); alias('heb', 'he'); alias('jas', 'jam', 'james', 'jm');
alias('1pe', '1pet', '1pt'); alias('2pe', '2pet', '2pt'); alias('1jn', '1john', '1jo'); alias('2jn', '2john', '2jo');
alias('3jn', '3john', '3jo'); alias('jud', 'jude', 'jd'); alias('rev', 're', 'rv', 'revelation', 'apocalypse');

export function findBook(name: string): Book | undefined {
  const key = name.toLowerCase().replace(/[\s.]/g, '').replace(/^(i{1,3})(?=[a-z])/, (m) => String(m.length));
  if (ALIASES[key]) return getBook(ALIASES[key]);
  // Unique prefix match on full names.
  const matches = BOOKS.filter((b) => b.name.toLowerCase().replace(/\s/g, '').startsWith(key));
  return matches.length >= 1 && key.length >= 2 ? matches[0] : undefined;
}

/** Book name pattern used by the parser and for auto-linking references in notes. */
export const REF_PATTERN =
  /\b((?:[123]|I{1,3})\s?[A-Z][a-z]+\.?|[A-Z][a-z]+\.?(?:\s(?:of\s)?[A-Z][a-z]+)?)\s(\d{1,3})(?::(\d{1,3})(?:\s?[-–]\s?(\d{1,3})(?::(\d{1,3}))?)?)?/g;

export function parseRef(input: string): Ref | undefined {
  const m = input.trim().match(/^((?:[123]|i{1,3})?\s*[a-z][a-z\s.]*?)\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?)?)?$/i);
  if (!m) {
    const b = findBook(input);
    return b ? { book: b.id, chapter: 1 } : undefined;
  }
  const book = findBook(m[1]);
  if (!book) return undefined;
  const chapter = Math.min(+m[2], book.verses.length);
  const ref: Ref = { book: book.id, chapter };
  if (m[3]) ref.verse = +m[3];
  if (m[4] && m[5]) {
    ref.chapterEnd = +m[4];
    ref.verseEnd = +m[5];
  } else if (m[4]) ref.verseEnd = +m[4];
  return ref;
}

// ---- Text sources ------------------------------------------------------------

export interface Verse {
  n: number;
  text: string;
  heading?: string; // section heading shown before this verse
  para?: boolean; // begins a paragraph
}

export interface GreekWord {
  text: string;
  lemma: string;
  pos: string;
  parse: string;
}

const dataUrl = (p: string) => `${import.meta.env.BASE_URL}data/${p}`;
const jsonCache = new Map<string, Promise<unknown>>();
function loadJson<T>(p: string): Promise<T> {
  if (!jsonCache.has(p)) {
    const pr = fetch(dataUrl(p)).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${p}`);
      return r.json();
    });
    pr.catch(() => jsonCache.delete(p));
    jsonCache.set(p, pr);
  }
  return jsonCache.get(p) as Promise<T>;
}

export async function loadKjvChapter(book: string, chapter: number): Promise<Verse[]> {
  const data = await loadJson<string[][]>(`kjv/${book}.json`);
  return (data[chapter - 1] ?? []).map((text, i) => ({ n: i + 1, text }));
}

type GreekBook = Record<string, Record<string, [string, string, string, string][]>>;

export async function loadGreekChapter(book: string, chapter: number): Promise<Map<number, GreekWord[]>> {
  const map = new Map<number, GreekWord[]>();
  if (getBook(book)?.testament !== 'NT') return map;
  const data = await loadJson<GreekBook>(`sblgnt/${book}.json`);
  for (const [v, words] of Object.entries(data[String(chapter)] ?? {})) {
    map.set(+v, words.map(([text, lemma, pos, parse]) => ({ text, lemma, pos, parse })));
  }
  return map;
}

export interface LexEntry {
  g: string; // gloss
  s?: number; // Strong's
  c: string; // citation form
  d?: string; // Dodson definition
}

export function loadLexicon(): Promise<Record<string, LexEntry>> {
  return loadJson('lexicon.json');
}

/** Every occurrence of a lemma across the NT (loads all 27 books on first use). */
export async function findLemmaOccurrences(lemma: string): Promise<{ key: number; word: string; verse: GreekWord[] }[]> {
  const out: { key: number; word: string; verse: GreekWord[] }[] = [];
  const nt = BOOKS.filter((b) => b.testament === 'NT');
  const all = await Promise.all(nt.map((b) => loadJson<GreekBook>(`sblgnt/${b.id}.json`)));
  nt.forEach((b, i) => {
    for (const [c, verses] of Object.entries(all[i])) {
      for (const [v, words] of Object.entries(verses)) {
        const hit = words.find((w) => w[1] === lemma);
        if (hit) {
          out.push({
            key: refKey(b.id, +c, +v),
            word: hit[0],
            verse: words.map(([text, l, pos, parse]) => ({ text, lemma: l, pos, parse })),
          });
        }
      }
    }
  });
  return out;
}

/** Split English verse text into word tokens (words + trailing punctuation). */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function bareWord(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
