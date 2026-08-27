import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-slate-900 text-white px-4 py-3 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        Skip to main content
      </a>
      <Navbar />
      <div id="main" className="flex-1">
        {children}
      </div>
      <Footer />
    </>
  );
}
