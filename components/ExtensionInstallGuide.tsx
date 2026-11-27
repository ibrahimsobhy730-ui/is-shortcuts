"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileArchive,
  FolderOpen,
  HelpCircle,
  Maximize2,
  MousePointerClick,
  Pause,
  Pin,
  Play,
  Puzzle,
  X,
} from "lucide-react";

type ExtensionInstallGuideProps = {
  lang?: "ar" | "en";
  downloadUrl?: string;
};

type GuideStep = {
  id: string;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  tipAr: string;
  tipEn: string;
  visualType: "download" | "extract" | "image";
  imageSrc?: string;
  hotspot?: { top: string; left: string; labelAr: string; labelEn: string };
};

const STEPS: GuideStep[] = [
  {
    id: "download",
    badgeAr: "المرحلة 1 · التحميل",
    badgeEn: "Phase 1 · Download",
    titleAr: "حمّل ملف الإضافة المضغوط (.zip)",
    titleEn: "Download the Extension ZIP File",
    descAr:
      "اضغط على زر تحميل الإضافة عشان ينزل ملف is-shortcuts-extension.zip في مجلد التنزيلات (Downloads) على جهازك.",
    descEn:
      "Click the download button to save is-shortcuts-extension.zip into your computer's Downloads folder.",
    tipAr: "الملف بينزل مضغوط بصيغة ZIP — المتصفح مش بيقبل يثبّته وهو مضغوط، لازم نفك الضغط في الخطوة الجاية.",
    tipEn: "The file downloads as a ZIP archive — browsers require extracting it before loading.",
    visualType: "download",
  },
  {
    id: "extract",
    badgeAr: "المرحلة 2 · فك الضغط",
    badgeEn: "Phase 2 · Extract ZIP",
    titleAr: "فك الضغط عن الملف (Extract All)",
    titleEn: "Extract the ZIP Archive",
    descAr:
      "افتح مجلد التنزيلات، اعمل كليك يمين على ملف is-shortcuts-extension.zip، واختار Extract All... (أو استخراج الكل / Extract Here) واضغط Extract.",
    descEn:
      "Open Downloads, right-click is-shortcuts-extension.zip, choose Extract All... (or Extract Here), and click Extract.",
    tipAr:
      "مهم جدًا: بعد فك الضغط هيظهر مجلد أصفر عادي بنفس الاسم. احتفظ بيه في مكان ثابت وماتمسحوش لأن المتصفح بيشغّل الإضافة منه.",
    tipEn:
      "Important: Keep the extracted folder in a safe location and do not delete it — the browser runs the extension directly from it.",
    visualType: "extract",
  },
  {
    id: "menu",
    badgeAr: "المرحلة 3 · المتصفح",
    badgeEn: "Phase 3 · Browser",
    titleAr: "افتح صفحة إدارة الإضافات (Manage extensions)",
    titleEn: "Open Manage Extensions",
    descAr:
      "من شريط المتصفح فوق على اليمين، اضغط على أيقونة الإضافات (🧩) واختار Manage extensions من آخر القائمة.",
    descEn:
      "Click the puzzle Extensions icon (🧩) in the top-right browser toolbar, then select Manage extensions at the bottom.",
    tipAr: "تقدر برضه تفتحها مباشرة بكتابة chrome://extensions في شريط العنوان فوق.",
    tipEn: "You can also open chrome://extensions directly in your address bar.",
    visualType: "image",
    imageSrc: "/guide/step-menu.png",
    hotspot: {
      top: "86%",
      left: "48%",
      labelAr: "اضغط هنا",
      labelEn: "Click here",
    },
  },
  {
    id: "dev-mode",
    badgeAr: "المرحلة 4 · وضع المطورين",
    badgeEn: "Phase 4 · Developer Mode",
    titleAr: "فعّل زر Developer mode",
    titleEn: "Turn On Developer Mode",
    descAr:
      "في أعلى يمين صفحة الإضافات، فعّل مفتاح Developer mode (وضع مطوّري البرامج) عشان تظهر لك أزرار التثبيت اليدوي.",
    descEn:
      "In the top-right corner of the Extensions page, toggle Developer mode ON to reveal unpacked loading controls.",
    tipAr: "الخطوة دي بتتعمل مرة واحدة بس ومش بتأثر على أمان المتصفح.",
    tipEn: "You only need to enable this toggle once.",
    visualType: "image",
    imageSrc: "/guide/step-dev-mode.png",
    hotspot: {
      top: "52%",
      left: "88%",
      labelAr: "فعّل الزر ده",
      labelEn: "Toggle ON",
    },
  },
  {
    id: "load-unpacked",
    badgeAr: "المرحلة 5 · التحميل",
    badgeEn: "Phase 5 · Load",
    titleAr: "اضغط على زر Load unpacked",
    titleEn: "Click Load Unpacked",
    descAr:
      "بعد تفعيل وضع المطوّرين، هيظهر شريط أزرار جديد في أعلى اليسار — اضغط على أول زر وهو Load unpacked.",
    descEn:
      "Once Developer mode is enabled, a new toolbar appears at the top-left — click Load unpacked.",
    tipAr: "الزر ده بيفتح نافذة اختيار المجلد من جهازك.",
    tipEn: "This opens your system folder picker dialog.",
    visualType: "image",
    imageSrc: "/guide/step-load-unpacked.png",
    hotspot: {
      top: "54%",
      left: "26%",
      labelAr: "اضغط Load unpacked",
      labelEn: "Click Load unpacked",
    },
  },
  {
    id: "select-folder",
    badgeAr: "المرحلة 6 · الاختيار والتثبيت",
    badgeEn: "Phase 6 · Select & Pin",
    titleAr: "اختار المجلد المفكوك واضغط Select Folder",
    titleEn: "Select the Extracted Folder",
    descAr:
      "حدد المجلد اللي فكّيت ضغطه (is-shortcuts-extension) واضغط Select Folder. مبروك! الإضافة اشتغلت وتقدر تثبّت أيقونتها من علامة الدبوس (📌).",
    descEn:
      "Highlight the extracted folder (is-shortcuts-extension) and click Select Folder. Done! Pin its icon (📌) to keep it handy.",
    tipAr: "لو لقيت جوه المجلد مجلد تاني بنفس الاسم وملف manifest.json جواه، ادخل جواه واضغط Select Folder.",
    tipEn: "If there is a nested folder containing manifest.json, open it first then click Select Folder.",
    visualType: "image",
    imageSrc: "/guide/step-select-folder.png",
    hotspot: {
      top: "89%",
      left: "76%",
      labelAr: "اضغط Select Folder",
      labelEn: "Click Select Folder",
    },
  },
];

export function ExtensionInstallGuide({
  lang = "ar",
  downloadUrl = "/is-shortcuts-extension.zip",
}: ExtensionInstallGuideProps) {
  const isEn = lang === "en";
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState(false);

  const step = STEPS[activeIdx]!;

  // Auto-play slideshow timer (like an interactive mini video)
  useEffect(() => {
    if (!autoPlay) {
      setProgress(0);
      return;
    }
    const duration = 4500;
    const tick = 50;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev + (tick / duration) * 100 >= 100) {
          setActiveIdx((idx) => (idx + 1) % STEPS.length);
          return 0;
        }
        return prev + (tick / duration) * 100;
      });
    }, tick);
    return () => window.clearInterval(timer);
  }, [autoPlay, activeIdx]);

  const copyChromeUrl = async () => {
    try {
      await navigator.clipboard.writeText("chrome://extensions");
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      dir={isEn ? "ltr" : "rtl"}
      className="elev-card rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <span className="folder-bar-icon">
            <Puzzle className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-[var(--text)] sm:text-lg">
                {isEn
                  ? "Browser Extension — Complete Setup Guide"
                  : "إضافة المتصفح — دليل فك الضغط والتثبيت الكامل"}
              </h3>
              <span
                dir="ltr"
                className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-strong)]"
              >
                Chrome · Edge · Brave
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--dim)]">
              {isEn
                ? "Follow the 6 visual steps from extracting the ZIP archive to pinning the extension."
                : "اتبع الخطوات التوضيحية من لحظة تحميل الملف المضغوط وفك الضغط وحتى تشغيل الإضافة."}
            </p>
          </div>
        </div>

        {/* Action Buttons: Download ZIP + Auto-Play Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={downloadUrl}
            download="is-shortcuts-extension.zip"
            className="btn-lux flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold"
          >
            <Download className="h-4 w-4" />
            {isEn ? "Download Extension (.zip)" : "تحميل الإضافة (.zip)"}
          </a>

          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            className="lux-btn flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-2 text-[13px] font-bold text-[var(--text)] hover:border-[var(--accent)]"
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Play className="h-3.5 w-3.5 text-[var(--accent)]" />}
            {autoPlay
              ? isEn ? "Pause Tour" : "إيقاف العرض"
              : isEn ? "Auto-Play Guide" : "تشغيل تلقائي"}
          </button>
        </div>
      </div>

      {/* Stepper Pills */}
      <div className="no-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, idx) => {
          const isCurrent = idx === activeIdx;
          const isDone = idx < activeIdx;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setAutoPlay(false);
                setActiveIdx(idx);
              }}
              className={`lux-btn flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-all ${
                isCurrent
                  ? "border-transparent bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                  : isDone
                    ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${
                  isCurrent
                    ? "bg-white/20 text-current"
                    : isDone
                      ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "bg-[var(--surface)] text-[var(--dim)]"
                }`}
              >
                {isDone ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              <span>
                {idx === 0
                  ? isEn ? "1. Download" : "١. التحميل"
                  : idx === 1
                    ? isEn ? "2. Extract ZIP" : "٢. فك الضغط"
                    : idx === 2
                      ? isEn ? "3. Extensions" : "٣. الإضافات"
                      : idx === 3
                        ? isEn ? "4. Dev Mode" : "٤. وضع المطوّر"
                        : idx === 4
                          ? isEn ? "5. Load" : "٥. تحميل المجلد"
                          : isEn ? "6. Select & Pin" : "٦. التثبيت"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Auto-play progress bar */}
      {autoPlay && (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Main Stage: Visual Illustration + Explanation */}
      <div className="mt-4 grid items-center gap-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5 lg:grid-cols-12">
        {/* Left/Start Column: Step Details */}
        <div className="flex flex-col justify-between lg:col-span-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-bold text-[var(--accent-strong)]">
              {isEn ? step.badgeEn : step.badgeAr}
            </span>

            <h4 className="mt-3 text-lg font-extrabold leading-snug text-[var(--text)]">
              {isEn ? step.titleEn : step.titleAr}
            </h4>

            <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
              {isEn ? step.descEn : step.descAr}
            </p>

            {/* Quick copy chrome://extensions on Step 3 */}
            {step.id === "menu" && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <code dir="ltr" className="font-mono text-xs font-bold text-[var(--accent-strong)]">
                  chrome://extensions
                </code>
                <button
                  type="button"
                  onClick={copyChromeUrl}
                  className="lux-btn inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-strong)]"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUrl ? (isEn ? "Copied" : "اتنسخ") : isEn ? "Copy Link" : "نسخ الرابط"}
                </button>
              </div>
            )}

            {/* Pin instruction on Step 6 */}
            {step.id === "select-folder" && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-semibold text-[var(--text)]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Pin className="h-4 w-4" />
                </span>
                <span>
                  {isEn
                    ? "Bonus: Click 🧩 in the toolbar and press the Pin icon next to IS Shortcuts."
                    : "خطوة إضافية: اضغط على 🧩 في شريط المتصفح ودوس علامة الدبوس 📌 جنب IS Shortcuts لتثبيتها."}
                </span>
              </div>
            )}

            {/* Helpful Tip Box */}
            <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--surface)] p-3 text-[12.5px] leading-relaxed text-[var(--dim)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <span>{isEn ? step.tipEn : step.tipAr}</span>
            </div>
          </div>

          {/* Prev / Next Navigation */}
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3.5">
            <button
              type="button"
              disabled={activeIdx === 0}
              onClick={() => {
                setAutoPlay(false);
                setActiveIdx((i) => Math.max(0, i - 1));
              }}
              className="lux-btn inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--text)] disabled:opacity-40"
            >
              {isEn ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {isEn ? "Previous" : "السابق"}
            </button>

            <span className="font-mono text-xs font-bold text-[var(--dim)]">
              {activeIdx + 1} / {STEPS.length}
            </span>

            <button
              type="button"
              onClick={() => {
                setAutoPlay(false);
                setActiveIdx((i) => (i + 1) % STEPS.length);
              }}
              className="lux-btn inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--accent-ink)]"
            >
              {activeIdx === STEPS.length - 1
                ? isEn ? "Restart" : "إعادة من الأول"
                : isEn ? "Next Step" : "الخطوة التالية"}
              {isEn ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Right/End Column: Visual Canvas */}
        <div className="lg:col-span-7">
          {step.visualType === "download" && (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-center shadow-inner">
              <div className="relative flex items-center gap-3 rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)] px-5 py-4 shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <FileArchive className="h-6 w-6" />
                </span>
                <div dir="ltr" className="text-left">
                  <div className="font-mono text-sm font-extrabold text-[var(--text)]">
                    is-shortcuts-extension.zip
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Downloaded · Downloads Folder</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-xs font-semibold text-[var(--dim)]">
                {isEn
                  ? "Locate this ZIP file inside your Downloads folder (Ctrl + J in Chrome)."
                  : "افتح مجلد التنزيلات (Downloads) أو اضغط Ctrl + J في المتصفح للوصول للملف."}
              </p>
            </div>
          )}

          {step.visualType === "extract" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-inner">
              {/* Illustrated 3-stage ZIP Extraction Diagram */}
              <div className="grid items-center gap-3 sm:grid-cols-3">
                {/* 1. ZIP File */}
                <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-3.5 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <FileArchive className="h-6 w-6" />
                  </div>
                  <span dir="ltr" className="mt-2 font-mono text-[11px] font-bold text-[var(--text)]">
                    ...extension.zip
                  </span>
                  <span className="mt-1 rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--danger)]">
                    {isEn ? "1. Right-Click" : "١. كليك يمين"}
                  </span>
                </div>

                {/* 2. Context Menu Extract All */}
                <div className="flex flex-col items-center rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] p-3.5 text-center shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <MousePointerClick className="h-6 w-6" />
                  </div>
                  <span className="mt-2 text-xs font-extrabold text-[var(--accent-strong)]">
                    Extract All...
                  </span>
                  <span className="mt-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--accent-strong)]">
                    {isEn ? "2. Click Extract" : "٢. استخراج الكل"}
                  </span>
                </div>

                {/* 3. Extracted Yellow Folder */}
                <div className="flex flex-col items-center rounded-xl border-2 border-[var(--success)]/50 bg-[var(--surface)] p-3.5 text-center shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <span dir="ltr" className="mt-2 font-mono text-[11px] font-bold text-[var(--text)]">
                    is-shortcuts-extension
                  </span>
                  <span className="mt-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-bold text-[var(--success)]">
                    {isEn ? "3. Ready Folder ✓" : "٣. المجلد الجاهز ✓"}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-center text-xs font-bold text-[var(--text)]">
                {isEn
                  ? "Use the extracted folder (Step 3) in Chrome — never select the .zip file itself."
                  : "في الخطوات الجاية هنختار المجلد المفكوك (رقم ٣) — مش الملف المضغوط!"}
              </div>
            </div>
          )}

          {step.visualType === "image" && step.imageSrc && (
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[#1e1f22] p-3 shadow-md">
              <div className="relative mx-auto flex min-h-[240px] max-h-[320px] items-center justify-center overflow-hidden rounded-xl">
                <img
                  src={step.imageSrc}
                  alt={isEn ? step.titleEn : step.titleAr}
                  onClick={() => setZoomImg(step.imageSrc || null)}
                  className="max-h-[300px] w-auto cursor-zoom-in rounded-lg object-contain shadow-lg transition-transform duration-300 group-hover:scale-[1.02]"
                />

                {/* Pulsing Hotspot Indicator */}
                {step.hotspot && (
                  <div
                    style={{ top: step.hotspot.top, left: step.hotspot.left }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    <span className="relative flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--accent-ink)] shadow-lg ring-4 ring-[var(--accent)]/35">
                      <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                      {isEn ? step.hotspot.labelEn : step.hotspot.labelAr}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setZoomImg(step.imageSrc || null)}
                className="lux-btn absolute bottom-3 end-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-black"
              >
                <Maximize2 className="h-3 w-3" />
                {isEn ? "Zoom" : "تكبير الصورة"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Troubleshooting Collapsible */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setFaqOpen((v) => !v)}
          className="lux-btn inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          <HelpCircle className="h-4 w-4" />
          {isEn
            ? "Common issues & quick fixes (Manifest missing / Folder deleted)"
            : "حل المشاكل الشائعة أثناء التثبيت (رسالة خطأ Manifest أو اختفاء الإضافة)"}
        </button>

        {faqOpen && (
          <div className="animate-rise mt-2.5 grid gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3.5 text-xs leading-relaxed text-[var(--dim)] sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="font-extrabold text-[var(--text)]">
                {isEn
                  ? "Error: Manifest file is missing or unreadable"
                  : "ظهرت رسالة: Manifest file is missing or unreadable"}
              </div>
              <p className="mt-1">
                {isEn
                  ? "You either selected the .zip file directly without extracting it, or selected the outer folder instead of the inner folder containing manifest.json."
                  : "السبب إنك اخترت ملف الـ .zip بدون فك الضغط، أو اخترت المجلد الخارجي وفيه مجلد تاني جواه — افتح المجلد اللي جواه ملف manifest.json واضغط Select Folder."}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="font-extrabold text-[var(--text)]">
                {isEn
                  ? "Extension disappeared after restarting Chrome"
                  : "الإضافة اختفت بعد ما قفلت الجهاز أو مسحت التنزيلات"}
              </div>
              <p className="mt-1">
                {isEn
                  ? "Keep the extracted folder in a permanent place (like Documents) before loading it, and do not delete it."
                  : "انقل المجلد المفكوك لمكان ثابت (زي Documents) قبل ما تضيفه للمتصفح، وماتمسحوش بعد التثبيت."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#18191c] p-3 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setZoomImg(null)}
              aria-label="Close"
              className="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomImg}
              alt="Step preview"
              className="max-h-[82vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
