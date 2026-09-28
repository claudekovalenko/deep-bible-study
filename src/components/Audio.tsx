import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../lib/db';
import { Icon } from './Icon';

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) ?? '';
}

/** Records a voice memo into IndexedDB and reports its id. */
export function VoiceRecorder({ onSaved, compact }: { onSaved: (id: string) => void; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'recording' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const started = useRef(0);

  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        const id = uid();
        await db.audio.add({
          id,
          blob,
          mime: blob.type,
          duration: (Date.now() - started.current) / 1000,
          createdAt: Date.now(),
        });
        onSaved(id);
        setState('idle');
        setElapsed(0);
      };
      rec.current = r;
      started.current = Date.now();
      r.start();
      setState('recording');
    } catch {
      setState('error');
    }
  };

  if (state === 'recording') {
    return (
      <button type="button" className="btn recording" onClick={() => rec.current?.stop()}>
        <span className="pulse" /> {fmt(elapsed)} <Icon name="stop" size={16} /> Stop
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn ghost"
      onClick={start}
      title={state === 'error' ? 'Microphone unavailable — check permissions' : 'Record a voice memo'}
    >
      <Icon name="mic" size={17} /> {compact ? '' : state === 'error' ? 'Mic blocked' : 'Voice'}
    </button>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function AudioClipView({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const clip = useLiveQuery(() => db.audio.get(id), [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!clip) return;
    const u = URL.createObjectURL(clip.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);
  if (!clip || !url) return null;
  return (
    <div className="audio-clip">
      <Icon name="mic" size={15} />
      <audio controls preload="metadata" src={url} />
      <span className="muted small">{fmt(clip.duration)}</span>
      {onRemove && (
        <button type="button" className="icon-btn" onClick={onRemove} aria-label="Remove recording">
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}
