import { NextResponse } from "next/server";
import { searchIncidents } from "@/lib/services/public-data";
import { appNameForProvider } from "@/lib/casual/app-lookup";

export const dynamic = "force-dynamic";

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
  const payload = await searchIncidents({ limit: 50 });
  const incidents = payload.data.incidents || [];
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>AI Status Dashboard — AI outages &amp; incidents</title>\n    <link>https://aistatusdashboard.com/</link>\n    <description>Live incidents across ChatGPT, Claude, Gemini and 20+ AI apps, read from each provider's official status page.</description>\n    <language>en-us</language>\n    <lastBuildDate>${now}</lastBuildDate>\n    <ttl>60</ttl>\n${items.join(
    "\n"
  )}\n  </channel>\n</rss>\n`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=120",
    },
  });
}
