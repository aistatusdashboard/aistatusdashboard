import Link from 'next/link';

// A post-mortem of a specific, resolved past event. The timeline is taken
// verbatim from OpenAI's own status updates on the day and fixed here (history
// doesn't change), rather than live-queried — so it stays accurate even after
// the incident rolls out of the live feed window.
const TIMELINE: Array<{ t: string; s: string; b: string }> = [
  { t: '15:04', s: 'Identified', b: 'Elevated latency across the impacted services. OpenAI starts working on a mitigation.' },
  { t: '15:21', s: 'Identified', b: 'Now elevated errors too. ChatGPT Work mode is unavailable, with Plus users particularly impacted.' },
  { t: '16:02', s: 'Ongoing', b: 'Users across multiple subscription plans are unable to start or continue tasks in ChatGPT Work.' },
  { t: '17:01–19:29', s: 'Ongoing', b: 'Work tasks keep failing through four more status updates over the next ~2.5 hours.' },
  { t: '20:01', s: 'Monitoring', b: 'A mitigation is applied; OpenAI monitors recovery.' },
  { t: '20:28', s: 'Resolved', b: 'All impacted services have fully recovered.' },
];

const AFTERMATH: Array<{ d: string; b: string }> = [
  { d: 'Aug 31, 22:27', b: 'Elevated latency in the Responses API (into Sep 1).' },
  { d: 'Sep 1, 00:38', b: 'Elevated errors in ChatGPT conversations for Free and Go plans.' },
  { d: 'Sep 2, 18:13', b: 'Errors creating new accounts.' },
  { d: 'Sep 3, 00:04', b: 'ChatGPT Work Mode high error rates.' },
  { d: 'Sep 3, 14:58', b: 'Elevated errors across ChatGPT and Codex.' },
  { d: 'Sep 4, 07:00', b: 'Increased errors for users in the APAC region across ChatGPT, Work, image generation, Voice and Codex.' },
];

function toneFor(s: string): string {
  if (s === 'Resolved') return 'text-emerald-600 dark:text-emerald-400';
  if (s === 'Monitoring') return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default function ChatgptDownAug2026() {
  return (
    <div className="space-y-8">
      <p className="text-base text-slate-700 dark:text-slate-300">
        On <span className="font-medium">August 31, 2026</span>, ChatGPT had its biggest outage of the
        season — searches for &ldquo;chatgpt down&rdquo; spiked to roughly ten times any other AI
        outage in the following three months. Here is exactly what happened, minute by minute, rebuilt
        from <Link href="/chatgpt" className="underline">OpenAI&rsquo;s own status updates</Link>.
      </p>

      <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">5h 24m</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">main outage</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">ChatGPT Work</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">hit hardest</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">6 days</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">of aftershocks</div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          The timeline <span className="font-normal text-sm text-slate-500">(all times UTC)</span>
        </h2>
        <ol className="space-y-3">
          {TIMELINE.map((e) => (
            <li key={e.t} className="flex gap-4">
              <span className="w-24 shrink-0 text-sm font-mono tabular-nums text-slate-500 dark:text-slate-400">{e.t}</span>
              <span className={`w-24 shrink-0 text-xs font-semibold uppercase tracking-wide ${toneFor(e.s)}`}>{e.s}</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{e.b}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The core incident ran <span className="font-medium">five hours and twenty-four minutes</span>,
          from 15:04 to 20:28 UTC. The pattern is a familiar one: latency first, then outright errors,
          and the paid <span className="font-medium">Work</span> (business) tier took the worst of it —
          exactly when teams relying on it for actual work were online.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">It didn&rsquo;t end there</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          That resolution wasn&rsquo;t the end of it. Over the following days OpenAI posted a string of
          further incidents — a rough patch, not a one-off:
        </p>
        <div className="rounded-xl border border-slate-200 p-1.5 dark:border-slate-800">
          {AFTERMATH.map((e) => (
            <div key={e.d} className="flex gap-4 px-3 py-2">
              <span className="w-28 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300">{e.d}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">{e.b}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">The takeaway</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Even the most-used AI in the world goes down — and when it does, it&rsquo;s the paid, work-critical
          tiers that feel it first. The only way to know whether it&rsquo;s you or them is to check the
          source. We mirror ChatGPT&rsquo;s official status in plain English on the{' '}
          <Link href="/chatgpt" className="underline">ChatGPT status page</Link>, track every provider&rsquo;s
          outages in the <Link href="/incidents" className="underline">outage history</Link>, and rank who
          breaks least on the <Link href="/reliability" className="underline">reliability board</Link>.
        </p>
      </section>
    </div>
  );
}
