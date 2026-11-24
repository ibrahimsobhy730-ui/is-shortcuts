"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../components/query-client";

/* The app is fully client-rendered (ssr: false) — same as the Muse
   artifact, which was a SPA. App reads window/localStorage during
   render (theme, session token, #/preview hash), so server
   prerendering it would crash; the login page shell and all SEO meta
   still ship in the HTML from layout.tsx. */

const App = dynamic(
  () => import("../components/App").then((m) => m.App),
  { ssr: false },
);

export default function Home() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA offline support is a bonus; the app works without it. */
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </QueryClientProvider>
  );
}
