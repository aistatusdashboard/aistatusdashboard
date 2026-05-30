import type { Metadata } from 'next';
import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import CodeSnippet from '@/app/components/CodeSnippet';
import { MCP_REGISTRY_URL } from '@/lib/config/links';

type DatasetDoc = {
  name: string;
  href: string;
  format: string;
  bytes: number | null;
  updatedAt: string | null;
  schemaHref: string;
  sample: string;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Developer hub',
    description: 'API, OpenAPI spec, MCP server, datasets, and embed widgets for AI provider status.',
    alternates: { canonical: '/developer' },
    openGraph: {
      title: 'Developer hub | AI Status Dashboard',
      description: 'API, OpenAPI spec, MCP server, datasets, and embed widgets for AI provider status.',
    },
    twitter: {
      title: 'Developer hub | AI Status Dashboard',
      description: 'API, OpenAPI spec, MCP server, datasets, and embed widgets for AI provider status.',
    },
  };
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatTimestamp(iso: string | null) {
  if (!iso) return 'Unknown';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

async function fileMetadata(relPath: string) {
  const target = path.join(process.cwd(), 'public', relPath.replace(/^\//, ''));
  const stat = await fs.stat(target);
  const raw = await fs.readFile(target, 'utf8');
  return {
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    sample: raw.split(/\r?\n/).find((line) => line.trim().length > 0) || '',
  };
}

async function loadDatasetDocs(): Promise<DatasetDoc[]> {
  const [incidents, metrics] = await Promise.all([
    fileMetadata('/datasets/incidents.ndjson'),
    fileMetadata('/datasets/metrics.csv'),
  ]);
  const latestDatasetUpdate =
    incidents.updatedAt && metrics.updatedAt
      ? new Date(Math.max(new Date(incidents.updatedAt).getTime(), new Date(metrics.updatedAt).getTime())).toISOString()
      : incidents.updatedAt || metrics.updatedAt;
  const totalDatasetBytes = incidents.bytes + metrics.bytes;

  return [
    {
      name: 'Datasets index',
      href: '/datasets',
      format: 'HTML index',
      bytes: totalDatasetBytes,
      updatedAt: latestDatasetUpdate,
      schemaHref: '/datasets/schemas',
      sample: 'Browse dataset entries, schemas, and retrieval links.',
    },
    {
      name: 'incidents.ndjson',
      href: '/datasets/incidents.ndjson',
      format: 'NDJSON',
      bytes: incidents.bytes,
      updatedAt: incidents.updatedAt,
      schemaHref: '/datasets/schemas/incidents.schema.json',
      sample: incidents.sample,
    },
    {
      name: 'metrics.csv',
      href: '/datasets/metrics.csv',
      format: 'CSV',
      bytes: metrics.bytes,
      updatedAt: metrics.updatedAt,
      schemaHref: '/datasets/schemas/metrics.schema.json',
      sample: metrics.sample,
    },
  ];
}

export default async function DeveloperPage() {
  const datasets = await loadDatasetDocs();
  const apiQuickstart =
    'curl "https://aistatusdashboard.com/api/public/v1/status/summary?provider=openai&lens=observed"';
  const mcpQuickstart = 'npx @modelcontextprotocol/inspector https://aistatusdashboard.com/mcp';

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="surface-card-strong p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Developer</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">
            Build with AI status data
          </h1>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">API quickstart</h2>
          <CodeSnippet code={apiQuickstart} ariaLabel="Copy API quickstart command" />
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">OpenAPI spec</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Full public API schema with examples and envelope fields.
          </p>
          <div className="text-sm space-x-4">
            <Link href="/openapi.json" className="underline">/openapi.json</Link>
            <Link href="/openapi.yaml" className="underline">/openapi.yaml</Link>
            <Link href="/.well-known/openapi.json" className="underline">/.well-known/openapi.json</Link>
            <Link href="/.well-known/openapi.yaml" className="underline">/.well-known/openapi.yaml</Link>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Specification links are served directly from production routes for reliable tool ingestion.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">MCP server</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Use the streamable HTTP MCP endpoint to query status and incidents from agent workflows.
          </p>
          <div className="text-sm">
            <Link href="/mcp" className="underline">https://aistatusdashboard.com/mcp</Link>
          </div>
          <CodeSnippet code={mcpQuickstart} ariaLabel="Copy MCP quickstart command" />
          <a href={MCP_REGISTRY_URL} className="underline text-sm">
            MCP Registry listing →
          </a>
        </section>

        <section className="surface-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Datasets</h2>
          <div className="space-y-4">
            {datasets.map((dataset) => (
              <article
                key={dataset.href}
                className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={dataset.href} className="font-semibold underline text-slate-900 dark:text-white">
                    {dataset.name}
                  </a>
                  <span className="text-xs rounded-full border border-slate-300/70 dark:border-slate-600/70 px-2 py-0.5">
                    {dataset.format}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Size: {formatBytes(dataset.bytes)}</span>
                  <span>Last updated: {formatTimestamp(dataset.updatedAt)}</span>
                  <a href={dataset.schemaHref} className="underline">Schema</a>
                </div>
                <CodeSnippet
                  code={dataset.sample}
                  ariaLabel={`Copy ${dataset.name} sample row`}
                  className="mt-1"
                />
              </article>
            ))}
          </div>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Embed widget</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Publish status badges in web pages, docs, and READMEs.
          </p>
          <Link href="/embed" className="underline text-sm">
            Open embed docs →
          </Link>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Reliability lab</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Advanced analytics and forecasting for operators.
          </p>
          <Link href="/dashboard?tab=reliability" className="underline text-sm">
            Open reliability tab →
          </Link>
        </section>
      </div>
    </main>
  );
}
