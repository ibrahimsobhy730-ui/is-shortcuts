import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Amiri } from "next/font/google";
import "./globals.css";
import "./theme.css";
import "./tokens.css";

/* الخط الوحيد للموقع كله (قرار المالك 2026-11-26): أميري —
   نفس الخط اللي كانت الآية به قبل توحيد Readex Pro — لكن
   بعرض نظيف مناسب لواجهة الموقع، لا بشكل رقعة/زخرفي: وزن 400
   للنص والواجهة، و700 باعتدال للعناوين فقط، بلا معالجات
   زخرفية. أميري ليس متغيرًا وله وزنان فقط (400/700). يُحمَّل
   من Google Fonts وقت البناء ويُقدَّم من الموقع نفسه؛
   display: swap يبقي النص ظاهرًا أثناء التحميل. التكلفة
   الصريحة: أميري 400+700 × عربي+لاتيني = 248 كيلوبايت إجمالًا
   (عربي 400: 108 ك، عربي 700: 100 ك، لاتيني 400: 20 ك، لاتيني
   700: 20 ك) مقابل 54 ك فعليًا لـ Readex — نحو 4.6× (+194 ك).
   التخفيف: preload لملفّي وزن 400 فقط (روابط <link> أدناه،
   عناوينها من ناتج البناء)، وملفّا 700 يُحمَّلان عند الطلب؛
   أول رسم ≈ 128 ك خط بدل 248 ك. الباقي هو ثمن اختيار المالك
   للخط — غير مخفي. */
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
    <html lang="ar" dir="rtl" suppressHydrationWarning className={amiri.variable}>
      <head>
        {/* Preload the two 400-weight files only (arabic 400 +
            latin 400 = 128 KB): first paint carries ~128 KB of
            font instead of 248 KB; the 700 files load on demand.
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
