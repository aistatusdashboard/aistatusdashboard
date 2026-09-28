import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div id="main" className="flex-1">
        {children}
      </div>
      <Footer />
    </>
  );
}
