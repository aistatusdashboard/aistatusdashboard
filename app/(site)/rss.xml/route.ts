import { NextResponse } from "next/server";
import { searchIncidents } from "@/lib/services/public-data";
import { appNameForProvider } from "@/lib/casual/app-lookup";

// Cache the feed (regenerate every 5 min in the background) instead of running
// a Firestore query at the origin on every hit. A crawler or health check then
// gets a fast CDN copy and never trips a cold-start timeout, which is what made
// /rss.xml intermittently "unreachable".
export const revalidate = 300;

// Never let a slow/cold Firestore read hang the response — fall back to an empty
// but valid feed. A momentarily empty feed beats a timeout.
async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const RESOLVED = new Set(["resolved", "completed", "cancelled"]);

export async function GET() {
  const incidents = await withTimeout<Record<string, unknown>[]>(
    searchIncidents({ limit: 50 }).then(
      (p) => (p.data.incidents || []) as Record<string, unknown>[],
      () => [] as Record<string, unknown>[]
    ),
    8000,
    []
  );
  const now = new Date().toUTCString();
  const items = incidents.slice(0, 25).map((incident: Record<string, unknown>) => {
    const incidentId = String(incident.incident_id || "");
    const providerId = String(incident.providerId || incident.provider_id || "provider");
    const app = appNameForProvider(providerId);
    const rawTitle = String(incident.title || "Incident");
    const resolved = RESOLVED.has(String(incident.status || "").toLowerCase()) || Boolean(incident.resolvedAt);
    const permalink = `https://aistatusdashboard.com/incidents/${encodeURIComponent(incidentId)}`;
    const updated = String(incident.updatedAt || incident.updated_at || new Date().toISOString());
    // Prefer the provider's latest update text; fall back to a plain summary.
    const updates = Array.isArray(incident.updates) ? (incident.updates as Array<Record<string, unknown>>) : [];
    const latest = [...updates]
      .filter((u) => String(u.body || "").trim())
      .sort((a, b) => Date.parse(String(b.createdAt || "")) - Date.parse(String(a.createdAt || "")))[0];
    const body = latest ? String(latest.body).replace(/\s+/g, " ").trim() : "";
    const started = incident.startedAt ? new Date(String(incident.startedAt)).toUTCString() : "";
    const summary = body
      ? `${resolved ? "Resolved" : "Ongoing"}. ${body}`
      : `${app} — ${resolved ? "resolved" : "ongoing"} incident${started ? ` (started ${started})` : ""}.`;
    const title = `${app}: ${rawTitle}${resolved ? " (resolved)" : " (ongoing)"}`;
    return `    <item>\n      <title>${esc(title)}</title>\n      <link>${esc(permalink)}</link>\n      <guid isPermaLink="true">${esc(
      permalink
    )}</guid>\n      <category>${esc(app)}</category>\n      <pubDate>${esc(
      new Date(updated).toUTCString()
    )}</pubDate>\n      <description>${esc(summary)}</description>\n    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>AI Status Dashboard — AI outages &amp; incidents</title>\n    <link>https://aistatusdashboard.com/</link>\n    <description>Live incidents across ChatGPT, Claude, Gemini and dozens of AI apps, read from each provider's official status page.</description>\n    <language>en-us</language>\n    <atom:link href="https://aistatusdashboard.com/rss.xml" rel="self" type="application/rss+xml" />\n    <image><url>https://aistatusdashboard.com/icon-192x192.png</url><title>AI Status Dashboard</title><link>https://aistatusdashboard.com/</link></image>\n    <lastBuildDate>${now}</lastBuildDate>\n    <ttl>60</ttl>\n${items.join(
    "\n"
  )}\n  </channel>\n</rss>\n`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
