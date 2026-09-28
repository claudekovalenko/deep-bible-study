import { db, setMeta, USER_TABLES, type AudioClip } from './db';

// A backup is one JSON file containing every table of personal study.
// Audio is embedded as base64 so the file is complete on its own.

interface BackupFile {
  app: 'deep-bible-study';
  version: 1;
  exportedAt: number;
  tables: Record<string, unknown[]>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};
  for (const name of USER_TABLES) {
    const rows = await db.table(name).toArray();
    if (name === 'audio') {
      tables.audio = await Promise.all(
        (rows as AudioClip[]).map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToBase64(blob) })),
      );
    } else if (name === 'meta') {
      tables.meta = rows.filter((r: { key: string }) => r.key !== 'esvKey');
    } else tables[name] = rows;
  }
  const file: BackupFile = { app: 'deep-bible-study', version: 1, exportedAt: Date.now(), tables };
  await setMeta('lastBackupAt', file.exportedAt);
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function downloadBackup() {
  const blob = await exportBackup();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `deep-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Merge a backup into the local database. Newer copies of the same record win. */
export async function importBackup(file: File): Promise<Record<string, number>> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'deep-bible-study') throw new Error('This file is not a Deep Study backup.');
  const counts: Record<string, number> = {};
  await db.transaction('rw', USER_TABLES.map((t) => db.table(t)), async () => {
    for (const name of USER_TABLES) {
      let rows = (data.tables[name] ?? []) as Record<string, unknown>[];
      if (name === 'audio') {
        rows = rows.map(({ data: b64, ...rest }) => ({ ...rest, blob: base64ToBlob(b64 as string, rest.mime as string) }));
      }
      const table = db.table(name);
      const pk = table.schema.primKey.keyPath as string;
      let n = 0;
      for (const row of rows) {
        const existing = await table.get(row[pk] as never);
        const newer = !existing || ((row.updatedAt as number) ?? 0) >= ((existing.updatedAt as number) ?? 0);
        if (newer) {
          await table.put(row);
          n++;
        }
      }
      counts[name] = n;
    }
  });
  return counts;
}
