/* AuthExplainer — LEGENDARY «النُّور»: the demo is ONE living scene,
   not a stack of boxes. The animated chat (AuthDemo) is the single
   stage; beneath it, one quiet download line. No try-it box, no
   step cards, no feature pills, no download card — those were the
   6-box stack the owner rejected. Demo data stays fictional and
   clearly marked by AuthDemo itself; no real replies here. */

import { useEffect, useState } from "react";
import { Download, Puzzle, X } from "lucide-react";
import AuthDemo from "./AuthDemo";
import { ExtensionInstallGuide } from "./ExtensionInstallGuide";

type Lang = "ar" | "en";

export default function AuthExplainer({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const [showGuide, setShowGuide] = useState(false);

  /* حوار دليل الإضافة: Escape يقفله، والصفحة خلفه تتجمد. */
  useEffect(() => {
    if (!showGuide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowGuide(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showGuide]);

  return (
    <section
      className="auth-r8-demo"
      aria-label={en ? "How IS works" : "إزاي بيشتغل؟"}
    >
      {/* One living scene: the animated chat is the whole demo.
          The 3 step captions live INSIDE the stage's bottom edge
          (see AuthDemo's legend-stage-captions). */}
      <div className="legend-stage-wrap">
        <AuthDemo lang={lang} />
      </div>

      {/* Download: one quiet centred line, not a card. */}
      <p className="legend-auth-download">
        {en ? "Take IS everywhere — " : "خد IS معاك في أي مكان — "}
        <a
          href="/is-shortcuts-extension.zip"
          download="is-shortcuts-extension.zip"
          className="legend-auth-download-link"
        >
          <Download size={15} />
          {en ? "Download the extension" : "تحميل الاكستنشن"}
        </a>
        <span aria-hidden="true"> · </span>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="legend-auth-download-link"
        >
          <Puzzle size={15} />
          {en ? "Install guide" : "شرح التثبيت"}
        </button>
      </p>

      {/* حوار دليل التثبيت: دوسة على الخلفية تقفله. */}
      {showGuide && (
        <div
          className="auth-r8-guide-dialog"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="auth-r8-guide-panel"
            role="dialog"
            aria-modal="true"
            aria-label={en ? "Extension install guide" : "دليل تثبيت الإضافة"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auth-r8-guide-head">
              <span className="auth-r8-guide-head-title">
                {en ? "Extension install guide" : "دليل تثبيت الإضافة"}
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label={en ? "Close the guide" : "إغلاق الدليل"}
                className="lux-btn auth-r8-guide-close"
              >
                <X size={17} />
              </button>
            </div>
            <ExtensionInstallGuide lang={lang} />
          </div>
        </div>
      )}
    </section>
  );
}
