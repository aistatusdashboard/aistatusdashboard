import type { Metadata } from 'next';
import './globals.css';

import { ErrorBoundary } from './components/ErrorBoundary';
import ClientTimestamp from './components/ClientTimestamp';
import { geistSans, geistMono } from './fonts';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Suspense } from 'react';
import { Providers } from './providers';
import Script from 'next/script';
import GlobalErrorHandler from './components/GlobalErrorHandler';
import OfflineIndicator from './components/OfflineIndicator';
import TodayStrip from './components/TodayStrip';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-ZV3PS0MPQ7';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const googleSiteVerificationTokens = [
  process.env.GOOGLE_SITE_VERIFICATION || 'ueTuf7cizmQ207EZVX_RnvXzSW0FUqd_zAg7Kq2QpBU',
  process.env.GOOGLE_SITE_VERIFICATION_ALT || 'thZbMJrJpI5W61kPQCXhMn44Gt9ycmYeTX6f2xxIg68',
].filter(Boolean);

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AI Status Dashboard',
  url: SITE_URL,
  applicationCategory: 'WebApplication',
  operatingSystem: 'Web',
  description: 'AI reliability control plane: status, incidents, metrics, and fallback policy generation.',
  offers: { '@type': 'Offer', price: '0' },
  sameAs: [
    'https://github.com/aistatusdashboard/aistatusdashboard',
    'https://registry.modelcontextprotocol.io/v0.1/servers/io.github.aistatusdashboard%2Faistatusdashboard/versions/latest',
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AI Status Dashboard - Real-time AI Provider Monitoring',
    template: '%s | AI Status Dashboard',
  },
  description:
    'Real-time status monitoring dashboard for AI provider APIs including OpenAI, Anthropic, Google AI, and more. Monitor service availability.',
  keywords: [
    'AI status',
    'API monitoring',
    'OpenAI status',
    'Anthropic status',
    'Google AI status',
    'service monitoring',
    'uptime monitoring',
    'API dashboard',
    'real-time status',
    'AI provider monitoring',
  ],
  authors: [{ name: 'AI Status Dashboard Team' }],
  creator: 'AI Status Dashboard',
  publisher: 'AI Status Dashboard',
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
    siteName: 'AI Status Dashboard',
    title: 'AI Status Dashboard - Real-time AI Provider Monitoring',
    description:
      'Monitor the status of major AI providers including OpenAI, Anthropic, Google AI, and more in real-time.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'AI Status Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Status Dashboard - Real-time AI Provider Monitoring',
    description: 'Real-time monitoring of AI provider APIs',
    images: ['/og.png'],
    creator: '@aistatusdash',
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
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#3b82f6',
      },
    ],
  },
  other: {
    'msapplication-TileColor': '#0f172a',
  },
};

// Client-side initialization
function ClientInit() {
  return null;
}

// Google Analytics component
function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'AI Status Dashboard',
      url: SITE_URL,
      logo: `${SITE_URL}/brand/logo-mark.png`,
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
      name: 'AI Status Dashboard',
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/dashboard?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'AI Status Dashboard',
      description: 'Real-time status monitoring dashboard for AI provider APIs',
      url: SITE_URL,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
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
        <meta name="application-name" content="AI Status Dashboard" />
        <meta name="apple-mobile-web-app-title" content="AI Status Dashboard" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([homeJsonLd, ...jsonLd]) }}
        />

        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
      </head>
      <body className={`${geistSans.className} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}>
        <ErrorBoundary>
          <Providers>
            <GlobalErrorHandler />
            <Suspense fallback={null}>
              <ClientInit />
            </Suspense>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-3 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Skip to main content
            </a>
            <Navbar />
            <TodayStrip />
            <OfflineIndicator />
            <div id="main" className="flex-1">
              {children}
            </div>

            <Footer />
          </Providers>
        </ErrorBoundary>
        <noscript>
          <div className="noscript-notice">
            <p>Interactive dashboard requires JavaScript. Live snapshot is available below.</p>
          </div>
        </noscript>

        <Script src="/sdk/ai-status-sdk.js" strategy="afterInteractive" />

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

                  const registration = await navigator.serviceWorker.register('/sw.js');
                  console.log('SW registered:', registration);
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

        {/* Firebase Messaging - Temporarily disabled to avoid import issues */}
        {/* 
        <Script id="firebase-messaging" strategy="afterInteractive">
          {`
            // Initialize Firebase messaging when the page loads
            if (typeof window !== 'undefined') {
              import('../lib/firebase-messaging').then(module => {
                module.initializePushNotifications();
              }).catch(console.error);
            }
          `}
        </Script>
        */}

      </body>
    </html>
  );
}
