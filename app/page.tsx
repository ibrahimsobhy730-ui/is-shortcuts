"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../components/query-client";
import { App } from "../components/App";

/* The app shell is server-rendered now (the login page paints for
   real instead of a blank shell). App reads window/localStorage only
   after mount — theme, language, session token and the #/preview
   hash all start from server-safe defaults and are restored in
   effects — so prerendering it is safe. The Workspace itself still
   only renders once the user is authenticated. */

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
