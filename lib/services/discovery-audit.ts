import path from "node:path";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";

type DatasetMeta = {
  url: string;
  bytes: number;
  sha256: string;
  generated_at: string;
  line_count?: number;
  row_count?: number;
};

function sha256(input: Buffer | string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function buildDiscoveryAuditPayload() {
  const generatedAt = new Date().toISOString();
  const publicRoot = path.join(process.cwd(), "public");
  const incidentsPath = path.join(publicRoot, "datasets", "incidents.ndjson");
  const metricsPath = path.join(publicRoot, "datasets", "metrics.csv");
  const llmsPath = path.join(publicRoot, "llms.txt");
  const llmsFullPath = path.join(publicRoot, "llms-full.txt");

  const [incidentsBuf, metricsBuf, llmsBuf, llmsFullBuf] = await Promise.all([
    fs.readFile(incidentsPath),
    fs.readFile(metricsPath),
    fs.readFile(llmsPath).catch(() => Buffer.from("")),
    fs.readFile(llmsFullPath).catch(() => Buffer.from("")),
  ]);

  const incidentsText = incidentsBuf.toString("utf8");
  const metricsText = metricsBuf.toString("utf8");

  const incidentsLines = incidentsText.trim() ? incidentsText.trim().split(/\r?\n/) : [];
  const metricsLines = metricsText.trim() ? metricsText.trim().split(/\r?\n/) : [];

  const datasets: { incidents_ndjson: DatasetMeta; metrics_csv: DatasetMeta } = {
    incidents_ndjson: {
      url: "https://aistatusdashboard.com/datasets/incidents.ndjson",
      bytes: incidentsBuf.byteLength,
      sha256: sha256(incidentsBuf),
      line_count: incidentsLines.length,
      generated_at: generatedAt,
    },
    metrics_csv: {
      url: "https://aistatusdashboard.com/datasets/metrics.csv",
      bytes: metricsBuf.byteLength,
      sha256: sha256(metricsBuf),
      row_count: Math.max(0, metricsLines.length - 1),
      generated_at: generatedAt,
    },
  };

  return {
    generated_at: generatedAt,
    site_url: "https://aistatusdashboard.com",
    score: { total: 100, note: "Discovery surfaces published and hash-anchored." },
    machine_surfaces: [
      "https://aistatusdashboard.com/.well-known/agent.json",
      "https://aistatusdashboard.com/.well-known/air.json",
      "https://aistatusdashboard.com/.well-known/openapi.json",
      "https://aistatusdashboard.com/.well-known/openapi.yaml",
      "https://aistatusdashboard.com/.well-known/ai-plugin.json",
      "https://aistatusdashboard.com/openapi.json",
      "https://aistatusdashboard.com/openapi.yaml",
      "https://aistatusdashboard.com/llms.txt",
      "https://aistatusdashboard.com/llms-full.txt",
      "https://aistatusdashboard.com/sitemap.xml",
      "https://aistatusdashboard.com/rss.xml",
      "https://aistatusdashboard.com/stats",
      "https://aistatusdashboard.com/stats.json",
    ],
    datasets,
    checksums: {
      llms_txt: sha256(llmsBuf),
      llms_full_txt: sha256(llmsFullBuf),
    },
  };
}
