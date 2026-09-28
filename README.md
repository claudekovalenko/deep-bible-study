# Deep Study

A personal, installable (PWA) Bible study app built for decades of use — a place to write your own
commentary on every passage, verse, and word, and to watch the record of how the Word has shaped you grow over time.

## What it does

- **Read** in the ESV (with your free personal API key) or the offline KJV, with section headings and paragraphing.
- **Greek side by side** — the SBL Greek New Testament next to the English. Tap any Greek word for its lexical form,
  gloss, Strong's number, and full parsing; open a **word study** listing every NT occurrence and all your notes on that lemma.
- **Dated study entries** on any verse, passage (shift-click to select a range, or "Chapter notes"), or individual
  word: commentary, notes, insights, questions, prayers, applications. Every entry records when it was written,
  keeps its full edit history, and can hold tags and **voice memos**. Scripture references in your writing
  (e.g. `Rom 8:28`) become links.
- **Applications you live out** — log each time you applied something, with the date, and see the timeline.
- **Verse whiteboards** — zoom into one verse; the English (and Greek) words become anchors. Branch bubbles off
  any word, connect ideas to each other, pan/zoom/pinch, attach links, YouTube videos, and voice memos. Every bubble is dated.
- **Voices & links** — attach theologians, sermons, YouTube videos, articles, books, quotes, and cross-references to
  any passage. The Library gathers them by theologian.
- **Journal** — everything, by date, searchable and filterable by type and tag. **Today** shows "on this day" entries
  from past years, your applications in progress, and a canon map of where you've studied.

## Your data

Everything lives privately in your browser's IndexedDB on your device — nothing is sent anywhere
(except ESV text requests to api.esv.org). **Download a backup** from Settings regularly; a backup is a single JSON file
containing all entries, their edit history, logs, whiteboards, links, and voice memos, and it restores on any device.
Installing to the home screen makes storage much more durable (especially on iPhone).

## ESV API key

Create a free key at <https://api.esv.org/account/create-application/> and paste it into Settings. Per the ESV API
terms, only a limited number of verses (500) are cached locally; the app evicts the oldest chapters automatically.

## Development

```bash
npm install
npm run dev          # local dev server
npm run build        # typecheck + production build into dist/
npm run build:data   # regenerate bundled Bible data in public/data (downloads sources into .cache/)
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa (offline support).

### Deploying

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`. Enable it once under
**Settings → Pages → Source: GitHub Actions**. The site will be at `https://<user>.github.io/deep-bible-study/`.

## Sources & licensing

- ESV® Bible © 2001 Crossway — via the ESV API for personal, non-commercial use.
- *The Greek New Testament: SBL Edition* © 2010 Society of Biblical Literature and Logos Bible Software.
- MorphGNT morphology & lexicon (CC BY-SA); Dodson Greek Lexicon (public domain).
- King James Version (public domain).
