import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { parseRef, REF_PATTERN } from './bible';

// A deliberately small markdown dialect for study notes:
// paragraphs, "- " lists, "> " quotes, **bold**, *italic*, [text](url), bare URLs,
// and Scripture references (e.g. "Rom 8:28–30") become links into the reader.

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="md">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>;
        }
        if (lines.every((l) => l.startsWith('>'))) {
          return <blockquote key={i}>{joinLines(lines.map((l) => l.replace(/^>\s?/, '')))}</blockquote>;
        }
        const h = block.match(/^(#{1,3})\s+(.*)$/);
        if (h && lines.length === 1) return <h4 key={i}>{inline(h[2])}</h4>;
        return <p key={i}>{joinLines(lines)}</p>;
      })}
    </div>
  );
}

function joinLines(lines: string[]): ReactNode {
  return lines.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(l)}
    </Fragment>
  ));
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(...refs(text.slice(last, m.index), k++));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('*')) out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    else if (t.startsWith('[')) {
      const [, label, url] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      out.push(<a key={k++} href={url} target="_blank" rel="noreferrer">{label}</a>);
    } else out.push(<a key={k++} href={t} target="_blank" rel="noreferrer">{t.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a>);
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(...refs(text.slice(last), k++));
  return out;
}

function refs(text: string, seed: number): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(REF_PATTERN)) {
    const ref = parseRef(m[0]);
    if (!ref) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    const v = ref.verse ? `?v=${ref.verse}` : '';
    out.push(
      <Link key={`${seed}-${k++}`} className="ref-link" to={`/read/${ref.book}/${ref.chapter}${v}`}>
        {m[0]}
      </Link>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
