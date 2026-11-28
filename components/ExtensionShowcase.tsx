"use client";

/* «تحميل الاكستنشن» — LEGENDARY «النُّور» frame, same content.
   The video IS the hero (full width, 16:9, floating glass chip on
   its lower edge) — no navy deck above it. Chapters are a horizontal
   filmstrip (click seeks + plays). The download climax is ONE centred
   Ink Slab → live ZIP. The 6-step guide is an accordion of 6 quiet
   rows (same steps, same enhanced images, same ZIP/video links).
   The extension itself is untouched — we only host the ZIP + guide. */

import { useRef, useState } from "react";
import { ChevronDown, Download, FolderDown, Play, Puzzle } from "lucide-react";
import { STEPS } from "./ExtensionInstallGuide";

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
  const [openStep, setOpenStep] = useState<number>(0);
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
    <section className="legend-extension animate-fade mx-auto max-w-4xl" aria-label={en ? "Download the extension" : "تحميل الاكستنشن"}>
      {/* IMAGINATION — the title chip sits ABOVE the video now, never
          over the player's native controls (the old floating chip
          covered the seek bar). */}
      <div className="legend-ext-chip-row">
        <a
          href="/is-shortcuts-extension.zip"
          download
          className="legend-ext-chip"
        >
          <Download size={15} aria-hidden="true" />
          <span>{en ? "Download the extension" : "تحميل الاكستنشن"}</span>
          <span aria-hidden="true">·</span>
          <span dir="ltr">v3.0.0</span>
          <span aria-hidden="true">·</span>
          <span>{en ? "Free" : "مجاني"}</span>
          <span aria-hidden="true">·</span>
          <span>Chrome</span>
        </a>
      </div>
      {/* VIDEO — the hero, framed as a screen on the desk. */}
      <div className="legend-ext-video relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-black shadow-[var(--shadow-2)]">
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
      </div>
      <p className="mt-3 text-center text-[13px] font-bold text-[var(--dim)]">
        {en ? "70 seconds — Arabic voiceover with captions" : "٧٠ ثانية — تعليق صوتي عربي مع ترجمة مكتوبة"}
      </p>

      {/* CHAPTERS — horizontal filmstrip, click seeks + plays. */}
      <div className="mt-6">
        <p className="mb-2.5 text-[13px] font-bold text-[var(--faint)]">
          {en ? "Chapters — tap one and the video jumps to it" : "الفصول — دوس على أي فصل والفيديو يروح له"}
        </p>
        <div className="legend-filmstrip no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {CHAPTERS.map((c, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => seek(c.start)}
                aria-label={`${en ? "Step" : "الخطوة"} ${i + 1} — ${en ? c.en : c.ar} — ${fmtTime(c.start)}`}
                aria-current={active || undefined}
                className={`lux-btn legend-chapter group shrink-0 overflow-hidden rounded-[20px] border bg-[var(--surface)] text-start shadow-[var(--shadow-1)] ${
                  active ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="relative block aspect-video w-56 overflow-hidden bg-[var(--surface-alt)]">
                  <img src={c.thumb} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${c.pos}`} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-2)]">
                      <Play size={18} aria-hidden="true" />
                    </span>
                  </span>
                  <span className="absolute bottom-2 end-2 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[12px] font-bold text-white" dir="ltr">
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

      {/* DOWNLOAD — one centred Ink Slab, the one dark object. */}
      <div className="legend-ink-slab mt-8">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-white">
          <Puzzle size={26} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-center">
          <span className="block text-[17px] font-extrabold leading-snug text-white" dir="ltr">
            IS - Extension · v3.0.0
          </span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-white/70">
            {en
              ? "Compressed file · 47 KB · free — install it in under a minute with the video above."
              : "ملف مضغوط · ٤٧ كيلوبايت · مجاني — ثبّته في أقل من دقيقة مع الفيديو اللي فوق."}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-center gap-2">
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
            className="lux-btn rounded-full px-4 py-2 text-[13px] font-bold text-white/80 hover:text-white"
          >
            {en ? "Step-by-step guide" : "شرح التثبيت خطوة بخطوة"}
          </button>
        </span>
      </div>

      {/* FULL GUIDE — accordion of 6 quiet rows. */}
      <div ref={guideRef} className="mt-10 scroll-mt-4">
        <h2 className="text-[20px] font-extrabold leading-snug">
          {en ? "Step-by-step install guide" : "شرح التثبيت خطوة بخطوة"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {en
            ? "Six steps with pictures — the same steps as the video, one by one."
            : "٦ خطوات بالصور — نفس خطوات الفيديو، خطوة خطوة."}
        </p>
        <div className="legend-guide-accordion mt-4">
          {STEPS.map((s, i) => {
            const open = openStep === i;
            return (
              <div key={s.id} className="legend-guide-row">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenStep(open ? -1 : i)}
                  className="lux-btn legend-guide-head"
                >
                  <span className="legend-guide-num" aria-hidden="true">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-[15px] font-extrabold leading-snug">{en ? s.titleEn : s.titleAr}</span>
                    <span className="block text-[12px] font-semibold text-[var(--faint)]">{en ? s.badgeEn : s.badgeAr}</span>
                  </span>
                  <ChevronDown size={17} aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="legend-guide-body">
                    {s.visualType === "image" && s.imageSrc ? (
                      <span className="legend-guide-imgwrap">
                        <img src={s.imageSrc} alt="" loading="lazy" className="w-full rounded-[14px] border border-[var(--border)]" />
                        {s.hotspot && (
                          <span
                            className="legend-guide-hotspot"
                            style={{ top: s.hotspot.top, left: s.hotspot.left }}
                          >
                            {en ? s.hotspot.labelEn : s.hotspot.labelAr}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="legend-guide-tile" aria-hidden="true">
                        {s.visualType === "download" ? <Download size={26} /> : <FolderDown size={26} />}
                      </span>
                    )}
                    <p className="text-[14px] leading-relaxed">{en ? s.descEn : s.descAr}</p>
                    <p className="legend-guide-tip">{en ? s.tipEn : s.tipAr}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
