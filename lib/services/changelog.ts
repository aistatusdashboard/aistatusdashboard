import fs from 'fs/promises';
import path from 'path';

export type ChangelogEntry = {
  title: string;
  date: string;
  summary?: string;
  link?: string;
};

export type ChangelogPayload = {
  generated_at?: string;
  entries: ChangelogEntry[];
};

export async function getChangelogEntries(limit = 20): Promise<ChangelogPayload> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'changelog.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const payload = JSON.parse(raw) as ChangelogPayload;
    const entries = Array.isArray(payload.entries) ? payload.entries.slice(0, limit) : [];
    return { generated_at: payload.generated_at, entries };
  } catch {
    return { entries: [] };
  }
}
