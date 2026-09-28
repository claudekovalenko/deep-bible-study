const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const fmtDate = (t: number) => dateFmt.format(t);
export const fmtTime = (t: number) => timeFmt.format(t);
export const fmtDateTime = (t: number) => `${dateFmt.format(t)} · ${timeFmt.format(t)}`;
export const fmtLongDate = (t: number) => longFmt.format(t);

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function relative(t: number): string {
  const diff = Date.now() - t;
  const day = 86_400_000;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < day && new Date(t).getDate() === new Date().getDate()) return `today, ${fmtTime(t)}`;
  if (diff < 2 * day) return `yesterday, ${fmtTime(t)}`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return fmtDate(t);
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(t: number): string {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function fromLocalInput(s: string): number {
  return new Date(s).getTime();
}

export function youtubeId(url: string): string | undefined {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1];
}

export function youtubeStart(url: string): number | undefined {
  const m = url.match(/[?&](?:t|start)=(\d+)(?:s)?/);
  return m ? +m[1] : undefined;
}
