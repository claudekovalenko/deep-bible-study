import { useState } from 'react';
import { db, ENTRY_KINDS, saveEntry, type Entry, type EntryKind } from '../lib/db';
import { fromLocalInput, toLocalInput } from '../lib/format';
import { AudioClipView, VoiceRecorder } from './Audio';
import { Icon } from './Icon';

interface Props {
  start: number;
  end: number;
  wordIndex?: number;
  word?: string;
  lemma?: string;
  initialKind?: EntryKind;
  editing?: Entry;
  onDone?: () => void;
  autoFocus?: boolean;
}

/** Write or edit a dated study entry. */
export function Composer({ start, end, wordIndex, word, lemma, initialKind, editing, onDone, autoFocus }: Props) {
  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? initialKind ?? 'commentary');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '');
  const [audioIds, setAudioIds] = useState<string[]>(editing?.audioIds ?? []);
  const [when, setWhen] = useState<number | undefined>(undefined);
  const [showDate, setShowDate] = useState(false);
  const hint = ENTRY_KINDS.find((k) => k.kind === kind)?.hint;

  const canSave = body.trim() || audioIds.length;

  const save = async () => {
    if (!canSave) return;
    await saveEntry({
      id: editing?.id,
      kind,
      start: editing?.start ?? start,
      end: editing?.end ?? end,
      wordIndex: editing ? editing.wordIndex : wordIndex,
      word: editing ? editing.word : word,
      lemma: editing ? editing.lemma : lemma,
      title: title.trim() || undefined,
      body: body.trim(),
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      audioIds,
      status: kind === 'application' ? editing?.status ?? 'active' : undefined,
      ...(when ? { createdAt: when } : {}),
    });
    if (!editing) {
      setBody('');
      setTitle('');
      setTags('');
      setAudioIds([]);
      setWhen(undefined);
      setShowDate(false);
    }
    onDone?.();
  };

  const cancel = async () => {
    // Discard recordings made during this unsaved edit.
    const fresh = audioIds.filter((id) => !editing?.audioIds.includes(id));
    if (fresh.length) await db.audio.bulkDelete(fresh);
    onDone?.();
  };

  return (
    <form
      className={`composer kind-${kind}`}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="kind-picker" role="radiogroup" aria-label="Entry type">
        {ENTRY_KINDS.map((k) => (
          <button
            type="button"
            key={k.kind}
            role="radio"
            aria-checked={kind === k.kind}
            className={`chip kind-${k.kind} ${kind === k.kind ? 'on' : ''}`}
            onClick={() => setKind(k.kind)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input
        className="title-input"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        autoFocus={autoFocus}
        placeholder={
          kind === 'application'
            ? 'How will I live this out? Be concrete — who, what, when.'
            : `${hint}…  (References like Rom 8:28 become links.)`
        }
        value={body}
        rows={5}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      />
      {audioIds.map((id) => (
        <AudioClipView key={id} id={id} onRemove={() => setAudioIds((a) => a.filter((x) => x !== id))} />
      ))}
      <div className="composer-row">
        <input
          className="tags-input"
          placeholder="Tags: grace, covenant…"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      {showDate && !editing && (
        <label className="date-field">
          Written on
          <input
            type="datetime-local"
            value={toLocalInput(when ?? Date.now())}
            onChange={(e) => setWhen(fromLocalInput(e.target.value))}
          />
        </label>
      )}
      <div className="composer-actions">
        <VoiceRecorder onSaved={(id) => setAudioIds((a) => [...a, id])} />
        {!editing && !showDate && (
          <button type="button" className="btn ghost" onClick={() => setShowDate(true)} title="Backdate this entry">
            <Icon name="clock" size={17} /> Date
          </button>
        )}
        <span className="spacer" />
        {(editing || onDone) && (
          <button type="button" className="btn ghost" onClick={cancel}>
            Cancel
          </button>
        )}
        <button className="btn primary" disabled={!canSave}>
          {editing ? 'Save changes' : 'Save'}
        </button>
      </div>
    </form>
  );
}
