"use client";

/* «تحميل الاكستنشن» — product-showcase page for the owner's own
   extension (IS - Extension v3.0.0, HIS code — we only host the ZIP
   and the guide). Structure, decided by the owner 2026-11-27:
   hero moment → the real 70s video as the centerpiece → the 6 steps
   as clickable chapters that seek the video → the download card as
   the climax → the full 6-step interactive guide below.
   The video is a real file (public/extension-guide.mp4, 70.5s,
   1280×720, Arabic voiceover + burned-in captions); the chapter
   thumbnails are the 4 enhanced step photos + 2 frames from the
   video's designed step cards. Nothing here modifies the extension. */

import { useRef, useState } from "react";
import { Download, Play, Puzzle } from "lucide-react";
import { ExtensionInstallGuide } from "./ExtensionInstallGuide";

const CHAPTERS = [
  { key: "s1", start: 9.5, thumb: "/guide/chapter-step1.jpg", pos: "", ar: "حمّل ملف الإضافة", en: "Download the extension file" },
  { key: "s2", start: 19, thumb: "/guide/chapter-step2.jpg", pos: "", ar: "فك الضغط عن الملف", en: "Extract the file" },
  { key: "s3", start: 28, thumb: "/guide/step-menu.png", pos: "", ar: "افتح إدارة الإضافات", en: "Open Manage extensions" },
  { key: "s4", start: 36.5, thumb: "/guide/step-dev-mode.png", pos: "", ar: "فعّل وضع المطوّرين", en: "Turn on Developer mode" },
  { key: "s5", start: 44.5, thumb: "/guide/step-load-unpacked.png", pos: "object-left", ar: "تحميل إضافة غير مضغوطة", en: "Load unpacked" },
  { key: "s6", start: 52.5, thumb: "/guide/step-select-folder.png", pos: "", ar: "اختار المجلد المفكوك", en: "Pick the extracted folder" },
];

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExtensionShowcase({ lang }: { lang: "ar" | "en" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const en = lang === "en";

  const activeIdx = CHAPTERS.reduce(
    (acc, c, i) => (current >= c.start - 0.4 ? i : acc),
    -1,
  );

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    void v.play();
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="animate-fade mx-auto max-w-4xl" aria-label={en ? "Download the extension" : "تحميل الاكستنشن"}>
      {/* HERO — deep navy deck, same tokens as the home banner */}
      <div
        className="relative overflow-hidden rounded-[var(--radius)] px-6 py-8 text-center shadow-[var(--deck-glow)] sm:px-10 sm:py-10"
        style={{
          background: "var(--deck-bg)",
          border: "1px solid var(--deck-border)",
          boxShadow: "var(--deck-glow), inset 0 1px 0 oklch(1 0 0 / 0.14)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(520px 200px at 50% -10%, rgb(59 130 246 / 0.32), transparent 70%), radial-gradient(420px 180px at 85% 110%, rgb(56 189 248 / 0.22), transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px] border border-[oklch(1_0_0/0.25)] bg-[oklch(1_0_0/0.12)] text-white shadow-[var(--shadow-2)]">
            <Puzzle size={26} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="mt-4 text-[12.5px] font-bold text-[var(--deck-dim)]">
            IS Shortcuts · {en ? "Browser extension" : "إضافة المتصفح"}
          </p>
          <h1 className="mt-1.5 text-[30px] font-extrabold leading-tight text-[var(--deck-text)] sm:text-[36px]">
            {en ? "Download the Extension" : "تحميل الاكستنشن"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--deck-dim)]">
            {en
              ? "Your ready replies, anywhere — the video, the steps and the download, all in one place."
              : "ردودك الجاهزة في أي مكان — الفيديو والخطوات والتحميل، كلهم في صفحة واحدة."}
          </p>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-[oklch(1_0_0/0.25)] bg-[oklch(1_0_0/0.10)] px-3 py-1 text-[12.5px] font-bold text-[var(--deck-text)]" dir="ltr">
              v3.0.0
            </span>
            <span className="rounded-full border border-[oklch(1_0_0/0.25)] bg-[oklch(1_0_0/0.10)] px-3 py-1 text-[12.5px] font-bold text-[var(--deck-text)]">
              {en ? "Free" : "مجاني"}
            </span>
            <span className="rounded-full border border-[oklch(1_0_0/0.25)] bg-[oklch(1_0_0/0.10)] px-3 py-1 text-[12.5px] font-bold text-[var(--deck-text)]">
              Chrome
            </span>
          </p>
        </div>
      </div>

      {/* VIDEO — the centerpiece */}
      <div className="mt-6 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]">
        <video
          ref={videoRef}
          controls
          preload="metadata"
          poster="/extension-guide-poster.jpg"
          src="/extension-guide.mp4"
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          className="aspect-video w-full bg-black"
          aria-label={en ? "Extension install video — 70 seconds" : "فيديو تثبيت الإضافة — ٧٠ ثانية"}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-[13px] font-bold text-[var(--dim)]">
            {en ? "70 seconds — Arabic voiceover with captions" : "٧٠ ثانية — تعليق صوتي عربي مع ترجمة مكتوبة"}
          </p>
          <a
            href="/is-shortcuts-extension.zip"
            download
            className="lux-btn flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
          >
            <Download size={15} aria-hidden="true" />
            {en ? "Download the ZIP" : "تحميل الملف"}
          </a>
        </div>
      </div>

      {/* CHAPTERS — the 6 steps, each seeks the video */}
      <div className="mt-6">
        <p className="mb-2.5 text-[13px] font-bold text-[var(--faint)]">
          {en ? "Chapters — tap one and the video jumps to it" : "الفصول — دوس على أي فصل والفيديو يروح له"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHAPTERS.map((c, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => seek(c.start)}
                aria-label={`${en ? "Step" : "الخطوة"} ${i + 1} — ${en ? c.en : c.ar} — ${fmtTime(c.start)}`}
                aria-current={active || undefined}
                className={`lux-btn group overflow-hidden rounded-[var(--radius)] border bg-[var(--surface)] text-start shadow-[var(--shadow-1)] transition-transform hover:-translate-y-0.5 ${
                  active ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="relative block aspect-video overflow-hidden bg-[var(--surface-alt)]">
                  <img src={c.thumb} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${c.pos}`} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-2)]">
                      <Play size={18} aria-hidden="true" />
                    </span>
                  </span>
                  <span className="absolute bottom-2 end-2 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[11px] font-bold text-white" dir="ltr">
                    {fmtTime(c.start)}
                  </span>
                </span>
                <span className="flex items-center gap-2.5 px-3.5 py-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                      active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-[14px] font-bold leading-snug">{en ? c.en : c.ar}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DOWNLOAD — the climax */}
      <div
        className="mt-6 flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[linear-gradient(150deg,color-mix(in_srgb,var(--accent)_10%,var(--surface)),var(--surface)_65%)] p-5 shadow-[var(--shadow-1)] sm:flex-row sm:items-center sm:p-6"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow-2)]">
          <Puzzle size={26} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-extrabold leading-snug" dir="ltr">
            IS - Extension · v3.0.0
          </span>
          <span className="mt-0.5 block text-[13.5px] leading-relaxed text-[var(--dim)]">
            {en
              ? "Compressed file · 47 KB · free — install it in under a minute with the video above."
              : "ملف مضغوط · ٤٧ كيلوبايت · مجاني — ثبّته في أقل من دقيقة مع الفيديو اللي فوق."}
          </span>
        </span>
        <span className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            href="/is-shortcuts-extension.zip"
            download
            className="btn-lux flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold"
          >
            <Download size={18} aria-hidden="true" />
            {en ? "Download now" : "حمّل دلوقتي"}
          </a>
          <button
            type="button"
            onClick={() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="lux-btn rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--dim)] hover:text-[var(--text)]"
          >
            {en ? "Step-by-step guide" : "شرح التثبيت خطوة بخطوة"}
          </button>
        </span>
      </div>

      {/* FULL GUIDE */}
      <div ref={guideRef} className="mt-10 scroll-mt-4">
        <h2 className="text-[20px] font-extrabold leading-snug">
          {en ? "Step-by-step install guide" : "شرح التثبيت خطوة بخطوة"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {en
            ? "Six steps with pictures — the same steps as the video, one by one."
            : "٦ خطوات بالصور — نفس خطوات الفيديو، خطوة خطوة."}
        </p>
        <div className="mt-4">
          <ExtensionInstallGuide lang={lang} />
        </div>
      </div>
    </section>
  );
}
