import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "./theme.css";
import "./tokens.css";

/* الخط (قرار المالك 2026-11-27): IBM Plex Sans Arabic هو خط
   الواجهة الوحيد لكل شيء — نص، عناوين، أزرار، قوائم —
   أنضف بكتير (4 أوزان 400/500/600/700، عربي+لاتيني،
   self-hosted من البناء نفسه، display: swap). أميري
   باقٍ للآية فقط («نِعْمَةً مِّنْ عِندِنَا…») كما هي الآن
   بالظبط، بقرار المالك — لا يظهر في أي سطح تاني. */
const plexSans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex",
});

/* أميري للآية فقط — نفس الإعداد اللي كانت به (400/700،
   عربي+لاتيني، preload: false)؛ ملفّا وزن 400 محمّلان
   مسبقًا أدناه لأن الآية فوق الطيّة في الرئيسية. */
const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-amiri",
  preload: false,
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
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${plexSans.variable} ${amiri.variable}`}>
      <head>
        {/* Preload the verse's two 400-weight Amiri files only
            (arabic 400 + latin 400): the verse sits above the
            fold on Home, so its font loads with first paint.
            The hrefs are the build-emitted filenames
            (.next/static/media/) — if Amiri is ever re-fetched
            or its subsets change, re-read them from the build
            output; a stale href only wastes one preload, the
            @font-face rules still load the real files. */}
        <link
          rel="preload"
          href="/_next/static/media/05d29f0ed5b0e698-s.6d7a8113.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/_next/static/media/648474ecaeaf4c9a-s.caba5483.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {/* Theme before paint: the login shell is server-rendered,
            so the server cannot know the stored/OS theme. This tiny
            inline script sets data-theme from is-theme-v3 (or the OS
            preference) before React hydrates, so dark users never see
            a light flash; useDarkMode in App.tsx then syncs its state
            to the same value. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("is-theme-v3");var d=m==="dark"||(m!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
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
