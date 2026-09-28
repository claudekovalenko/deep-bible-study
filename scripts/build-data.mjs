// Builds the static Bible data bundled with the app:
//   public/data/kjv/<book>.json      public-domain English fallback (offline)
//   public/data/sblgnt/<book>.json   SBL Greek New Testament with MorphGNT parsing
//   public/data/lexicon.json         lemma -> gloss / Strong's / definition
//   src/data/books.json              canon, chapter & verse counts
//
// Sources are downloaded once into .cache/. Run: npm run build:data
import fs from 'node:fs/promises';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const PUB = path.join(ROOT, 'public', 'data');

const BOOKS = [
  ['gen', 'Genesis'], ['exo', 'Exodus'], ['lev', 'Leviticus'], ['num', 'Numbers'], ['deu', 'Deuteronomy'],
  ['jos', 'Joshua'], ['jdg', 'Judges'], ['rut', 'Ruth'], ['1sa', '1 Samuel'], ['2sa', '2 Samuel'],
  ['1ki', '1 Kings'], ['2ki', '2 Kings'], ['1ch', '1 Chronicles'], ['2ch', '2 Chronicles'], ['ezr', 'Ezra'],
  ['neh', 'Nehemiah'], ['est', 'Esther'], ['job', 'Job'], ['psa', 'Psalms'], ['pro', 'Proverbs'],
  ['ecc', 'Ecclesiastes'], ['sng', 'Song of Solomon'], ['isa', 'Isaiah'], ['jer', 'Jeremiah'], ['lam', 'Lamentations'],
  ['ezk', 'Ezekiel'], ['dan', 'Daniel'], ['hos', 'Hosea'], ['jol', 'Joel'], ['amo', 'Amos'],
  ['oba', 'Obadiah'], ['jon', 'Jonah'], ['mic', 'Micah'], ['nam', 'Nahum'], ['hab', 'Habakkuk'],
  ['zep', 'Zephaniah'], ['hag', 'Haggai'], ['zec', 'Zechariah'], ['mal', 'Malachi'],
  ['mat', 'Matthew'], ['mrk', 'Mark'], ['luk', 'Luke'], ['jhn', 'John'], ['act', 'Acts'],
  ['rom', 'Romans'], ['1co', '1 Corinthians'], ['2co', '2 Corinthians'], ['gal', 'Galatians'], ['eph', 'Ephesians'],
  ['php', 'Philippians'], ['col', 'Colossians'], ['1th', '1 Thessalonians'], ['2th', '2 Thessalonians'], ['1ti', '1 Timothy'],
  ['2ti', '2 Timothy'], ['tit', 'Titus'], ['phm', 'Philemon'], ['heb', 'Hebrews'], ['jas', 'James'],
  ['1pe', '1 Peter'], ['2pe', '2 Peter'], ['1jn', '1 John'], ['2jn', '2 John'], ['3jn', '3 John'],
  ['jud', 'Jude'], ['rev', 'Revelation'],
];
const MORPHGNT_FILES = [
  '61-Mt', '62-Mk', '63-Lk', '64-Jn', '65-Ac', '66-Ro', '67-1Co', '68-2Co', '69-Ga', '70-Eph', '71-Php',
  '72-Col', '73-1Th', '74-2Th', '75-1Ti', '76-2Ti', '77-Tit', '78-Phm', '79-Heb', '80-Jas', '81-1Pe',
  '82-2Pe', '83-1Jn', '84-2Jn', '85-3Jn', '86-Jud', '87-Re',
];

async function cached(name, url) {
  const file = path.join(CACHE, name);
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    console.log('downloading', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const text = await res.text();
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(file, text);
    return text;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
}

// --- KJV (public domain) ---------------------------------------------------
const kjvRaw = await cached('kjv.json', 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json');
const kjv = JSON.parse(kjvRaw.replace(/^﻿/, ''));
const books = [];
for (let i = 0; i < BOOKS.length; i++) {
  const [id, name] = BOOKS[i];
  const chapters = kjv[i].chapters.map((c) => c.map((v) => v.replace(/[{}]/g, '').trim()));
  await writeJson(path.join(PUB, 'kjv', `${id}.json`), chapters);
  books.push({ id, name, testament: i < 39 ? 'OT' : 'NT', verses: chapters.map((c) => c.length) });
}

// --- SBLGNT + MorphGNT -----------------------------------------------------
// Line: BBCCVV POS PARSE text word normalized lemma
const lemmas = new Set();
for (let i = 0; i < MORPHGNT_FILES.length; i++) {
  const f = MORPHGNT_FILES[i];
  const raw = await cached(`${f}.txt`, `https://raw.githubusercontent.com/morphgnt/sblgnt/master/${f}-morphgnt.txt`);
  const chapters = {};
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [ref, pos, parse, text, , , lemma] = line.split(' ');
    const c = String(+ref.slice(2, 4));
    const v = String(+ref.slice(4, 6));
    // Drop SBLGNT text-critical sigla (⸀⸁⸂⸃⸄⸅) from the reading text.
    const clean = text.replace(/[\u2E00-\u2E05]/g, '');
    ((chapters[c] ??= {})[v] ??= []).push([clean, lemma, pos.replace(/-$/, ''), parse]);
    lemmas.add(lemma);
  }
  await writeJson(path.join(PUB, 'sblgnt', `${BOOKS[39 + i][0]}.json`), chapters);
}

// --- Lexicon ---------------------------------------------------------------
const lex = yamlLoad(await cached('lexemes.yaml', 'https://raw.githubusercontent.com/morphgnt/morphological-lexicon/master/lexemes.yaml'));
const dodsonCsv = await cached('dodson.csv', 'https://raw.githubusercontent.com/biblicalhumanities/Dodson-Greek-Lexicon/master/dodson.csv');
const dodsonLong = new Map();
for (const line of dodsonCsv.split('\n').slice(1)) {
  const cols = line.match(/"((?:[^"]|"")*)"/g)?.map((c) => c.slice(1, -1).replace(/""/g, '"'));
  if (cols?.length >= 5) dodsonLong.set(+cols[0], cols[4]);
}
const lexicon = {};
for (const lemma of lemmas) {
  const e = lex[lemma];
  if (!e) continue;
  const strongs = typeof e.strongs === 'number' ? e.strongs : parseInt(e.strongs, 10) || undefined;
  lexicon[lemma] = {
    g: e.gloss ?? '',
    s: strongs,
    c: e['full-citation-form'] ?? e['dodson-entry'] ?? lemma,
    d: strongs ? dodsonLong.get(strongs) : undefined,
  };
}
await writeJson(path.join(PUB, 'lexicon.json'), lexicon);
await writeJson(path.join(ROOT, 'src', 'data', 'books.json'), books);
console.log(`books: ${books.length}, greek lemmas: ${lemmas.size}, lexicon entries: ${Object.keys(lexicon).length}`);
