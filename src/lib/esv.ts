import { db, getMeta } from './db';
import { getBook, loadKjvChapter, type Verse } from './bible';

// The ESV API (https://api.esv.org) is free for non-commercial use with a personal key.
// Its terms limit how much text an app may keep, so the local cache is capped and
// least-recently-fetched chapters are evicted first.
const ESV_CACHE_VERSE_LIMIT = 500;

export const ESV_COPYRIGHT =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.';

export type Translation = 'ESV' | 'KJV';

export interface ChapterText {
  translation: Translation;
  verses: Verse[];
  error?: string;
}

export async function getEsvKey(): Promise<string> {
  return getMeta('esvKey', '');
}

export async function loadChapter(book: string, chapter: number, preferred: Translation): Promise<ChapterText> {
  if (preferred === 'ESV') {
    const key = await getEsvKey();
    if (key) {
      try {
        return { translation: 'ESV', verses: await loadEsvChapter(book, chapter, key) };
      } catch (err) {
        const verses = await loadKjvChapter(book, chapter);
        return { translation: 'KJV', verses, error: (err as Error).message };
      }
    }
  }
  return { translation: 'KJV', verses: await loadKjvChapter(book, chapter) };
}

async function loadEsvChapter(book: string, chapter: number, key: string): Promise<Verse[]> {
  const cacheKey = `${book}.${chapter}`;
  const cached = await db.esvCache.get(cacheKey);
  if (cached) {
    await db.esvCache.update(cacheKey, { fetchedAt: Date.now() });
    return cached.verses;
  }
  if (!navigator.onLine) throw new Error('Offline — showing KJV until this chapter can be fetched.');
  const b = getBook(book)!;
  const params = new URLSearchParams({
    q: `${b.name} ${chapter}`,
    'include-passage-references': 'false',
    'include-first-verse-numbers': 'true',
    'include-verse-numbers': 'true',
    'include-footnotes': 'false',
    'include-footnote-body': 'false',
    'include-headings': 'true',
    'include-subheadings': 'false',
    'include-audio-link': 'false',
    'include-short-copyright': 'false',
    'include-copyright': 'false',
    'include-crossrefs': 'false',
  });
  const res = await fetch(`https://api.esv.org/v3/passage/html/?${params}`, {
    headers: { Authorization: `Token ${key}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error('The ESV API key was rejected — check it in Settings.');
  if (!res.ok) throw new Error(`ESV API error (${res.status}) — showing KJV.`);
  const data = (await res.json()) as { passages: string[] };
  const verses = parseEsvHtml(data.passages.join(''));
  if (!verses.length) throw new Error('ESV returned no text — showing KJV.');
  await db.esvCache.put({ key: cacheKey, verses, fetchedAt: Date.now() });
  await trimCache();
  return verses;
}

async function trimCache() {
  const all = await db.esvCache.orderBy('fetchedAt').reverse().toArray();
  let total = 0;
  const evict: string[] = [];
  for (const c of all) {
    total += c.verses.length;
    if (total > ESV_CACHE_VERSE_LIMIT) evict.push(c.key);
  }
  if (evict.length) await db.esvCache.bulkDelete(evict);
}

/** Walk the ESV HTML, assigning text to verses by their numbered markers. */
export function parseEsvHtml(html: string): Verse[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const verses: Verse[] = [];
  let current: Verse | undefined;
  let pendingHeading: string | undefined;
  let pendingPara = true;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (current) current.text += node.textContent ?? '';
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      if (!node.classList.contains('extra_text')) pendingHeading = node.textContent?.trim();
      return;
    }
    if (node.classList.contains('footnote') || node.classList.contains('extra_text') || tag === 'sup') return;
    if (node.classList.contains('chapter-num') || node.classList.contains('verse-num')) {
      const m = node.id.match(/v\d{2}\d{3}(\d{3})/) ?? node.textContent?.match(/(\d+)\s*$/);
      const n = m ? +m[1] : (current?.n ?? 0) + 1;
      current = { n, text: '', heading: pendingHeading, para: pendingPara || undefined };
      pendingHeading = undefined;
      pendingPara = false;
      verses.push(current);
      return;
    }
    if (tag === 'p') pendingPara = true;
    if (tag === 'br' && current) current.text += ' ';
    node.childNodes.forEach(walk);
    if (tag === 'p' && current) current.text += ' ';
  };
  doc.body.childNodes.forEach(walk);
  for (const v of verses) v.text = v.text.replace(/\s+/g, ' ').trim();
  // Merge any duplicate verse numbers (e.g. a verse split around a heading).
  const merged: Verse[] = [];
  for (const v of verses) {
    const prev = merged[merged.length - 1];
    if (prev && prev.n === v.n) prev.text = `${prev.text} ${v.text}`.trim();
    else merged.push(v);
  }
  return merged;
}
