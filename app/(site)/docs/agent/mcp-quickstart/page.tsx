import type { Metadata } from 'next';
import McpCallout from '@/app/components/McpCallout';
import CodeSnippet from '@/app/components/CodeSnippet';

export const metadata: Metadata = {
  title: 'MCP Quickstart',
  description: 'Quickstart for the AI Status Dashboard MCP server.',
  alternates: {
    canonical: '/docs/agent/mcp-quickstart',
  },
};

export default function McpQuickstartPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <McpCallout />

          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              MCP Quickstart
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Connect to the MCP server
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Use the MCP endpoint to retrieve status summaries, incidents, metrics, and fallback plans.
            </p>
          </header>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Endpoint</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              https://aistatusdashboard.com/mcp
            </p>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Example JSON-RPC calls</h2>
            <CodeSnippet
              code={`{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "status.get_summary",
    "arguments": { "provider": "openai", "window_seconds": 1800 }
  }
}`}
              ariaLabel="Copy MCP quickstart JSON-RPC request"
            />
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Org lens auth</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The <code>my_org</code> lens requires OAuth and the <code>org.read</code> scope.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
