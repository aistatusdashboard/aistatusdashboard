export const dynamic = 'force-dynamic';

export default function SiteHealthPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-4xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Site Health Checks</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Weekly job verifies robots.txt, sitemap.xml, and key URLs for 200/canonical/noindex correctness.
        </p>
        <div className="surface-card p-4">
          <p>Checks include: robots.txt, sitemap.xml, /ai, /llms.txt, /openapi.json, /providers, /datasets.</p>
        </div>
      </div>
    </main>
  );
}
