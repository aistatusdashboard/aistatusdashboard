import { NextResponse } from "next/server";
import { searchIncidents } from "@/lib/services/public-data";

export const dynamic = "force-dynamic";

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const payload = await searchIncidents({ limit: 50 });
  const incidents = payload.data.incidents || [];
  const now = new Date().toUTCString();
  const items = incidents.slice(0, 25).map((incident: Record<string, unknown>) => {
    const incidentId = String(incident.incident_id || "");
    const provider = String(incident.providerId || incident.provider_id || "provider");
    const title = String(incident.title || "Incident");
    const permalink = `https://aistatusdashboard.com/incidents/${encodeURIComponent(incidentId)}`;
    const updated = String(incident.updatedAt || incident.updated_at || new Date().toISOString());
    return `    <item>\n      <title>${esc(`${provider}: ${title}`)}</title>\n      <link>${esc(
      permalink
    )}</link>\n      <guid>${esc(incidentId)}</guid>\n      <pubDate>${esc(
      new Date(updated).toUTCString()
    )}</pubDate>\n      <description>${esc(title)}</description>\n    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>AI Status Dashboard Incidents</title>\n    <link>https://aistatusdashboard.com/</link>\n    <description>Incidents and maintenances</description>\n    <lastBuildDate>${now}</lastBuildDate>\n    <ttl>60</ttl>\n${items.join(
    "\n"
  )}\n  </channel>\n</rss>\n`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=120",
    },
  });
}
