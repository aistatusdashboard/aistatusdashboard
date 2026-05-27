export type MeshProject = {
  key: "a2abench" | "ragmap" | "rootfetch" | "agentability" | "relayorb" | "aistatusdashboard";
  name: string;
  url: string;
  statsUrl: string;
  statsJsonUrl: string;
  agentCardUrl: string;
  description: string;
  footerDescriptor: string;
};

export const meshProjects: readonly MeshProject[] = [
  {
    key: "a2abench",
    name: "A2ABench",
    url: "https://a2abench-api.web.app",
    statsUrl: "https://a2abench-api.web.app/stats",
    statsJsonUrl: "https://a2abench-api.web.app/stats.json",
    agentCardUrl: "https://a2abench-api.web.app/.well-known/agent.json",
    description: "Public benchmark for agent Q&A performance.",
    footerDescriptor: "benchmark",
  },
  {
    key: "ragmap",
    name: "Ragmap",
    url: "https://ragmap-api.web.app",
    statsUrl: "https://ragmap-api.web.app/stats",
    statsJsonUrl: "https://ragmap-api.web.app/stats.json",
    agentCardUrl: "https://ragmap-api.web.app/.well-known/agent.json",
    description: "MCP search and RAG-focused server discovery.",
    footerDescriptor: "MCP search",
  },
  {
    key: "rootfetch",
    name: "Rootfetch",
    url: "https://rootfetch.com",
    statsUrl: "https://rootfetch.com/stats",
    statsJsonUrl: "https://rootfetch.com/stats.json",
    agentCardUrl: "https://rootfetch.com/.well-known/agent.json",
    description: "DNS delegation intelligence with MCP telemetry.",
    footerDescriptor: "DNS delegation",
  },
  {
    key: "agentability",
    name: "Agentability",
    url: "https://agentability.org",
    statsUrl: "https://agentability.org/stats",
    statsJsonUrl: "https://agentability.org/stats.json",
    agentCardUrl: "https://agentability.org/.well-known/agent.json",
    description: "Agent-readiness audit and evidence-backed report publishing.",
    footerDescriptor: "agent-readiness audit",
  },
  {
    key: "relayorb",
    name: "RelayOrb",
    url: "https://relayorb.com",
    statsUrl: "https://relayorb.com/stats",
    statsJsonUrl: "https://relayorb.com/stats.json",
    agentCardUrl: "https://relayorb.com/.well-known/agent.json",
    description: "Tool control plane for AI agents with contract-first routing.",
    footerDescriptor: "tool control plane",
  },
  {
    key: "aistatusdashboard",
    name: "AIStatusDashboard",
    url: "https://aistatusdashboard.com",
    statsUrl: "https://aistatusdashboard.com/stats",
    statsJsonUrl: "https://aistatusdashboard.com/stats.json",
    agentCardUrl: "https://aistatusdashboard.com/.well-known/agent.json",
    description:
      "Real-time AI provider status monitoring with evidence-backed metrics.",
    footerDescriptor: "status monitoring",
  },
] as const;

export function siblingsFor(
  self: MeshProject["key"]
): Record<string, { name: string; url: string; stats_url: string; stats_json_url: string; agent_card_url: string }> {
  const entries = meshProjects
    .filter((project) => project.key !== self)
    .map((project) => [
      project.key,
      {
        name: project.name,
        url: project.url,
        stats_url: project.statsUrl,
        stats_json_url: project.statsJsonUrl,
        agent_card_url: project.agentCardUrl,
      },
    ]);
  return Object.fromEntries(entries);
}

export function relatedProjectsFor(self: MeshProject["key"]) {
  return meshProjects
    .filter((project) => project.key !== self)
    .map((project) => ({
      name: project.name,
      url: project.url,
      agent_card_url: project.agentCardUrl,
      description: project.description,
    }));
}

export function footerProjectsFor(self: MeshProject["key"]) {
  return meshProjects.filter((project) => project.key !== self);
}
