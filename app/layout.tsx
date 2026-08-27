import type { Metadata } from 'next';
import './globals.css';

import { ErrorBoundary } from './components/ErrorBoundary';
import { geistSans, geistMono } from './fonts';
import { Suspense } from 'react';
import { Providers } from './providers';
import Script from 'next/script';
import GlobalErrorHandler from './components/GlobalErrorHandler';
import OfflineIndicator from './components/OfflineIndicator';
import GoogleAnalytics from './components/GoogleAnalytics';
import CookieConsentBanner from './components/CookieConsentBanner';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-ZV3PS0MPQ7';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';
const googleSiteVerificationTokens = [
  process.env.GOOGLE_SITE_VERIFICATION || 'ueTuf7cizmQ207EZVX_RnvXzSW0FUqd_zAg7Kq2QpBU',
  process.env.GOOGLE_SITE_VERIFICATION_ALT || 'thZbMJrJpI5W61kPQCXhMn44Gt9ycmYeTX6f2xxIg68',
].filter(Boolean);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Is ChatGPT down? Live status for your AI apps | AI Status',
    template: '%s | AI Status',
  },
  description:
    'Is ChatGPT down? Is Claude down? Live, plain-English status for the AI apps you use — checked with our own tests every few minutes.',
  authors: [{ name: 'AI Status' }],
  creator: 'AI Status',
  publisher: 'AI Status',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'AI Status',
    title: 'Is your AI down right now?',
    description:
      'Live, plain-English status for ChatGPT, Claude, Gemini, and the other AI apps you use.',
    images: [
      {
        url: `${SITE_URL}/og.png`,
        width: 1200,
        height: 630,
        alt: 'AI Status',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Is your AI down right now?',
    description: 'Live, plain-English status for ChatGPT, Claude, Gemini, and more.',
    images: [`${SITE_URL}/og.png`],
  },
  alternates: {
    canonical: SITE_URL,
    types: {
      'application/rss+xml': `${SITE_URL}/rss.xml`,
    },
  },
  verification: {
    google: googleSiteVerificationTokens,
  },
  category: 'technology',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'msapplication-TileColor': '#0f172a',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'AI Status',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      contactPoint: process.env.NEXT_PUBLIC_CONTACT_EMAIL
        ? {
            '@type': 'ContactPoint',
            email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
            contactType: 'support',
          }
        : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AI Status',
      url: SITE_URL,
    },
  ];

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="application-name" content="AI Status" />
        <meta name="apple-mobile-web-app-title" content="AI Status" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* GA4 bootstrap in initial HTML — deterministic, consent-mode gated.
            Stored opt-in grants analytics_storage synchronously; otherwise the
            tag runs cookieless until the banner decision arrives. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
(function () {
  var granted = false;
  try {
    var raw = localStorage.getItem('ai-status-cookie-consent-v1');
    if (raw) granted = JSON.parse(raw).decision === 'accepted';
  } catch (e) {}
  gtag('consent', 'default', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
})();`,
          }}
        />
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
      </head>
      <body className={`${geistSans.className} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}>
        <ErrorBoundary>
          <Providers>
            <Suspense fallback={null}>
              <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
            </Suspense>
            <GlobalErrorHandler />
            <OfflineIndicator />
            <CookieConsentBanner />
            {children}
          </Providers>
        </ErrorBoundary>

        {/* Service Worker Registration */}
        <Script id="sw-registration" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              const registerServiceWorker = async function() {
                try {
                  const hostname = window.location.hostname;
                  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
                  const allowLocalSw = ${process.env.NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST === 'true' ? 'true' : 'false'};

                  // Service workers often cause confusing caching issues during local dev.
                  // If one is installed on localhost, unregister it to keep the dev experience reliable.
                  if (isLocalhost && !allowLocalSw) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map((r) => r.unregister()));
                    return;
                  }

                  await navigator.serviceWorker.register('/sw.js');
                } catch (registrationError) {
                  console.log('SW registration failed:', registrationError);
                }
              };

              // afterInteractive scripts can run after the window load event in fast navigations.
              // Register immediately if the document is already loaded.
              if (document.readyState === 'complete') {
                registerServiceWorker();
              } else {
                window.addEventListener('load', registerServiceWorker);
              }
            }
          `}
        </Script>
      </body>
    </html>
  );
}
