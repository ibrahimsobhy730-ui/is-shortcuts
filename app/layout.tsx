import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Readex_Pro } from "next/font/google";
import "./globals.css";
import "./theme.css";
import "./tokens.css";

/* #11 (light + smooth) — Readex Pro self-hosted: the same
   typeface and the same 4 weights (400/500/600/700), fetched
   once at build time and served from the site itself instead of
   a render-blocking Google Fonts @import on every first visit.
   display: swap keeps text visible while the font loads. */
const readexPro = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-readex",
});

/* App shell: Arabic RTL, the IS identity, and the search/social meta
   the artifact already carried (its index.html), plus the PWA
   manifest link. The page itself renders client-side (see page.tsx)
   — the same as the artifact, which was a fully client-rendered SPA. */

export const metadata: Metadata = {
  title: "IS — مكتبة ردودك الجاهزة | اختصاراتك الخاصة",
  description:
    "IS — مكتبة ردودك الجاهزة: نظّم ردودك واختصاراتك في مجلدات، دوّر ببحث فوري بيفهم العربي، وانسخ أي رد بضغطة واحدة. حساب خاص بيك، وردودك محفوظة عندك انت بس.",
  keywords: [
    "IS",
    "ردود جاهزة",
    "اختصارات نصية",
    "مكتبة ردود",
    "نسخ رد",
    "ردود خدمة عملاء",
  ],
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IS",
    statusBarStyle: "default",
  },
  applicationName: "IS",
  openGraph: {
    type: "website",
    siteName: "IS",
    locale: "ar_EG",
    title: "IS — مكتبة ردودك الجاهزة",
    description:
      "نظّم ردودك في مجلدات، دوّر ببحث فوري بيفهم العربي، وانسخ أي رد بضغطة واحدة. حساب خاص بيك وردودك محفوظة عندك انت بس.",
  },
  twitter: {
    card: "summary",
    title: "IS — مكتبة ردودك الجاهزة",
    description:
      "نظّم ردودك في مجلدات، دوّر ببحث فوري بيفهم العربي، وانسخ أي رد بضغطة واحدة.",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "IS",
    "display-mode": "standalone",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDF3FE" },
    { media: "(prefers-color-scheme: dark)", color: "#050A18" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={readexPro.variable}>
      <body>
        {/* Structured data, carried from the artifact's index.html:
            tells search engines plainly what this application is,
            that it is free to start, and what it runs on. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "IS",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              inLanguage: "ar",
              description:
                "مكتبة ردود جاهزة خاصة: تنظيم الردود والاختصارات النصية في مجلدات، بحث فوري يفهم العربية، ونسخ أي رد بضغطة واحدة.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EGP" },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
