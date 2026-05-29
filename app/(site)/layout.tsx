import Navbar from '@/app/components/Navbar';
import TodayStrip from '@/app/components/TodayStrip';
import Footer from '@/app/components/Footer';
import { headers } from 'next/headers';
import { shouldRenderLiveStatusStrip } from '@/lib/ui/status-chrome';

function resolvePathnameFromHeaders(input: Headers): string {
  return (
    input.get('x-pathname') ||
    input.get('x-matched-path') ||
    input.get('x-forwarded-uri') ||
    input.get('x-original-url') ||
    input.get('x-url') ||
    input.get('x-rewrite-url') ||
    input.get('x-invoke-path') ||
    '/'
  );
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = resolvePathnameFromHeaders(headerList);
  const showLiveStatusStrip = shouldRenderLiveStatusStrip(pathname);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-3 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        Skip to main content
      </a>
      <Navbar showStatusChrome={showLiveStatusStrip} />
      {showLiveStatusStrip ? <TodayStrip /> : null}
      <div id="main" className="flex-1">
        {children}
      </div>
      <Footer />
    </>
  );
}
