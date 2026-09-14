import type { BrowserFeedIncident, BrowserFeedSnapshot } from '@/lib/services/feed-snapshots';

// Turns the rendered HTML of a Rootly status page (home + /history) into the
// same snapshot the browser job produces, so one parser serves both paths.
// Rootly's markup is Tailwind soup; these patterns key on the few stable
// hooks it has (the banner class, the service <details>, the incident cards'
// data attribute) rather than on layout.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function text(fragment: string | undefined): string {
  return (fragment || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "September 10 at 04:50 PM UTC" plus the page's "Jul 2026 - Sep 2026" range.
export function parseRootlyDate(shown: string, rangeText: string, now = new Date()): string | null {
  const m = /([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*UTC/i.exec(shown || '');
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  let year = m[3] ? Number(m[3]) : null;
  if (year === null) {
    const range = /([A-Za-z]{3})\s+(\d{4})\s*-\s*([A-Za-z]{3})\s+(\d{4})/.exec(rangeText || '');
    if (range) {
      const endMonth = MONTHS.findIndex((name) => name.startsWith(range[3].toLowerCase()));
      year = month <= endMonth ? Number(range[4]) : Number(range[2]);
    } else {
      year = now.getUTCFullYear();
      if (month > now.getUTCMonth()) year -= 1;
    }
  }
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hour += 12;
  return new Date(Date.UTC(year, month, Number(m[2]), hour, Number(m[5]))).toISOString();
}

export function parseDuration(fragment: string): number | undefined {
  const m = /after\s+(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i.exec(fragment || '');
  if (!m) return undefined;
  const minutes = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return minutes > 0 ? minutes : undefined;
}

export function extractRootlyOverall(html: string): string {
  const m = /class="text-4xl[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(html);
  return text(m?.[1]);
}

export function extractRootlyComponents(html: string): Array<{ name: string; status: string }> {
  const out: Array<{ name: string; status: string }> = [];
  const re = /<details class="group[^"]*">\s*<summary[^>]*>([\s\S]*?)<\/summary>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const summary = m[1];
    const name = text(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(summary)?.[1]);
    const status = text(/<\/div>\s*<span[^>]*>([\s\S]*?)<\/span>\s*$/.exec(summary)?.[1]);
    if (name) out.push({ name, status });
  }
  return out;
}

export function extractRootlyIncidents(html: string, now = new Date()): BrowserFeedIncident[] {
  const range = text(/([A-Z][a-z]{2}\s+\d{4}\s*-\s*[A-Z][a-z]{2}\s+\d{4})/.exec(html)?.[1]);
  const parts = html.split(/data-status-pages--clickable-card-url-value="/).slice(1);
  const incidents: BrowserFeedIncident[] = [];
  for (const part of parts) {
    const url = part.slice(0, part.indexOf('"'));
    const card = part;
    const title = text(/<span class="hover:underline[^"]*">([\s\S]*?)<\/span>/.exec(card)?.[1]);
    const shown = text(/class="[^"]*hidden sm:flex">([\s\S]*?)<\/div>/.exec(card)?.[1]);
    // The status word sits in the first span right after the status icon.
    const status = text(/<\/svg>\s*<span>([\s\S]*?)<\/span>/.exec(card)?.[1]);
    const message = text(/status-page-markdown-content">([\s\S]*?)<\/span>/.exec(card)?.[1]);
    const duration = /<p>\s*(Resolved after[^<]*)<\/p>/.exec(card)?.[1] || '';
    const shownAt = parseRootlyDate(shown, range, now);
    if (!title || !shownAt) continue;
    const id = (/\/incidents\/([^/?#"]+)/.exec(url) || [])[1] || `${title}-${shownAt}`;
    incidents.push({
      id,
      url: url || undefined,
      title,
      status,
      message: message || undefined,
      shownAt,
      durationMinutes: parseDuration(duration),
    });
  }
  return incidents;
}

export function snapshotFromRootlyHtml(
  sourceId: string,
  providerId: string,
  mainHtml: string,
  historyHtml: string
): BrowserFeedSnapshot {
  return {
    sourceId,
    providerId,
    platform: 'rootly',
    fetchedAt: new Date().toISOString(),
    overall: extractRootlyOverall(mainHtml),
    components: extractRootlyComponents(mainHtml),
    incidents: extractRootlyIncidents(historyHtml),
  };
}
