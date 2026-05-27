import { relatedProjectsFor } from "@/lib/cross-project";

export function buildAgentCard() {
  return {
    name: "AIStatusDashboard",
    description:
      "Real-time status monitoring and incident intelligence for 18 AI provider APIs with evidence-backed metrics, casual mode, public datasets, and fallback-plan generation.",
    url: "https://aistatusdashboard.com",
    version: "1.0.0",
    documentationUrl: "https://aistatusdashboard.com/llms-full.txt",
    apiEndpoints: {
      openapi: "https://aistatusdashboard.com/.well-known/openapi.json",
      air: "https://aistatusdashboard.com/.well-known/air.json",
      plugin: "https://aistatusdashboard.com/.well-known/ai-plugin.json",
      providers: "https://aistatusdashboard.com/api/public/v1/providers",
      status_summary: "https://aistatusdashboard.com/api/public/v1/status/summary",
      health_matrix: "https://aistatusdashboard.com/api/public/v1/status/health-matrix",
      incidents: "https://aistatusdashboard.com/api/public/v1/incidents",
      metrics: "https://aistatusdashboard.com/api/public/v1/metrics",
      fallback_plan:
        "https://aistatusdashboard.com/api/public/v1/recommendations/fallback_plan",
      policy_generate: "https://aistatusdashboard.com/api/public/v1/policy/generate",
      casual_status: "https://aistatusdashboard.com/api/public/v1/casual/status",
      casual_reports: "https://aistatusdashboard.com/api/public/v1/casual/reports",
    },
    mcpServers: [
      {
        name: "aistatusdashboard",
        transport: "streamable-http",
        url: "https://aistatusdashboard.com/mcp",
      },
    ],
    datasets: [
      {
        name: "incidents",
        url: "https://aistatusdashboard.com/datasets/incidents.ndjson",
        format: "ndjson",
      },
      {
        name: "metrics",
        url: "https://aistatusdashboard.com/datasets/metrics.csv",
        format: "csv",
      },
    ],
    related: relatedProjectsFor("aistatusdashboard"),
  };
}
