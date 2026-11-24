/* Test-only render check: loads the built site in jsdom (no real
   browser is launchable in this VM — the bundled Chromium needs the
   runtime's WebGL domain policy) and reports whether the login page
   actually renders, plus any client console errors.
   Usage: node scripts/verify-render.mjs [url] */

import { JSDOM, VirtualConsole } from "jsdom";

const url = process.argv[2] ?? "http://localhost:3100/";
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => errors.push(`jsdomError: ${e.message}`));
virtualConsole.on("error", (...args) => errors.push(`console.error: ${args.join(" ")}`));

const html = await (await fetch(url)).text();
const dom = new JSDOM(html, {
  url,
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    // Stubs for browser APIs jsdom lacks that the app touches.
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    });
    window.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.scrollTo = () => {};
  },
});

const markers = ["تسجيل الدخول", "كلمة المرور", "إنشاء حساب", "IS"];
const deadline = Date.now() + 25000;
let found = [];
while (Date.now() < deadline) {
  const text = dom.window.document.body?.textContent ?? "";
  found = markers.filter((m) => text.includes(m));
  if (found.includes("تسجيل الدخول") || found.includes("كلمة المرور")) break;
  await new Promise((r) => setTimeout(r, 500));
}
const text = (dom.window.document.body?.textContent ?? "").replace(/\s+/g, " ").trim();
console.log(`URL: ${url}`);
console.log(`Rendered text (${text.length} chars): ${text.slice(0, 400)}`);
console.log(`Markers found: ${found.join(", ") || "(none)"}`);
console.log(`Client errors: ${errors.length ? "\n  - " + errors.join("\n  - ") : "(none)"}`);
console.log(
  found.includes("تسجيل الدخول") || found.includes("كلمة المرور")
    ? "RENDER-OK: login page rendered"
    : "RENDER-FAIL: login page did not render",
);
process.exit(
  found.includes("تسجيل الدخول") || found.includes("كلمة المرور") ? 0 : 1,
);
