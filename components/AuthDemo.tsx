/* AuthDemo — العرض الحيّ المتحرك في صفحة الدخول/التسجيل
   (الجولة 8: التصميم كصفحة هبوط).

   فكرة واحدة قوية: محادثة وهمية + نافذة "IS Shortcuts" المنبثقة،
   حلقة 16 ثانية تُعيد نفسها (ضمن 14-18ث):
     0.0-3.2ث  مؤشر يومض ويكتب "/شكرا" حرفًا حرفًا بإيقاع واقعي
     3.2-6.0ث  النافذة المنبثقة تنبثق تحت صندوق الكتابة، أول نتيجة
               "الرد الكامل" مع وسم مجلدها؛ بلا أي تلميح لمفاتيح
     6.0-9.5ث  مؤشر ينزلق للنتيجة الأولى، ضغطة (تموّج)، والرد الكامل
               يتمدّد في صندوق الكتابة كرسالة مرسَلة
     9.5-12ث   حالة نجاح "تم النسخ" (علامة ✓ + توهّج ناعم)
     12-15ث   مونتاج سريع للمزايا: 4 شرائح تنزلق + خطوة "إضافة
               اختصار" (ضغطة "+" وظهور اختصار جديد في القائمة)
     15-16ث   تلاشٍ ناعم وإعادة الحلقة من جديد

   بيانات وهمية فقط — نفس نصوص أمثلة صندوق التجربة، بلا أي
   ردود حقيقية. بلا فيديو: HTML/CSS/SVG + JS صغير (مؤقّت
   50ms واحد). حركات transform/opacity فقط، ونسبة أبعاد
   محجوزة فلا قفز في التخطيط. إيقاف مؤقت عند إخفاء التبويب
   أو خروج العرض من الشاشة (IntersectionObserver)، وزر
   تشغيل/إيقاف، وإطار ثابت نهائي عند prefers-reduced-motion.
   النقر على خطوة يقفز لمشهدها (تفاعل مع العرض، لا اختصارات
   لوحة مفاتيح). */

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Folder,
  Image as ImageIcon,
  MousePointer2,
  Plus,
  Search,
  Zap,
} from "lucide-react";

type Lang = "ar" | "en";

const LOOP_MS = 16000;
const TYPE_AT = [500, 1100, 1650, 2350, 2900]; // ظهور حروف "/شكرا"
const TYPED = "/شكرا";
const POPUP_AT = 3200;
const TYPING_AT = 1800; // فقاعة «يكتب…» تملأ المسرح قبل النافذة
const CURSOR_AT = 6000;
const PRESS_AT = 7000;
const SENT_AT = 7800;
const SUCCESS_AT = 9500;
const MONTAGE_AT = 12000;
const ADD_AT = 13500; // «+» press + the new shortcut appears in the list
const FADE_AT = 15000;

/* نتائج وهمية للنافذة المنبثقة — نفس نصوص الأمثلة، مع وسم
   مجلد وهمي لكل رد. */
const RESULTS = [
  {
    trigger: "/شكرا",
    title: "شكراً",
    body: "شكراً جزيلاً لتواصلك معنا! سعداء بخدمتك، ولو احتجت أي مساعدة تانية احنا موجودين في أي وقت.",
    folder: "عام",
  },
  {
    trigger: "/شكرا-2",
    title: "شكراً لثقتك",
    body: "شكراً لثقتك فينا، ويسعدنا نخدمك في أي وقت.",
    folder: "عام",
  },
  {
    trigger: "/مواعيد",
    title: "مواعيد العمل",
    body: "مواعيد العمل من السبت للخميس، من 9 صباحاً حتى 9 مساءً.",
    folder: "الأسعار",
  },
];

const BENEFITS = [
  { icon: Copy, label: "نسخ بضغطة" },
  { icon: Folder, label: "مجلدات منظمة" },
  { icon: ImageIcon, label: "صور مع الرد" },
  { icon: Search, label: "بحث يفهم العربي" },
];

const STEPS = [
  {
    title: "اكتب الاختصار",
    text: "أي كلمة أو رقم أو رمز.",
    from: 0,
    to: 3200,
  },
  {
    title: "الرد يظهر فوراً",
    text: "الرد الكامل في بوكس البحث.",
    from: 3200,
    to: 9500,
  },
  {
    title: "انسخه بضغطة",
    text: "النص والصور في نسخة واحدة.",
    from: 9500,
    to: 16000,
  },
];

export default function AuthDemo({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const [elapsed, setElapsed] = useState(0);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0); // performance.now() عند بداية الحلقة الحالية
  const pausedAtRef = useRef(0); // elapsed عند الإيقاف
  const elapsedRef = useRef(0);

  /* تفضيل تقليل الحركة: إطار ثابت نهائي بلا حلقة. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* إيقاف عند الخروج من الشاشة. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* إيقاف عند إخفاء التبويب. */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pausedAtRef.current = elapsedRef.current;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const running =
    inView &&
    (typeof document === "undefined" ? true : !document.hidden) &&
    !reduced;

  /* محرّك الحلقة: مؤقّت 50ms واحد يحدّث elapsed. عند الإيقاف
     يُجمَّد elapsed؛ عند الاستئناف تُستأنف الحلقة من مكانها. */
  useEffect(() => {
    if (!running) {
      pausedAtRef.current = elapsedRef.current;
      return;
    }
    startRef.current = performance.now() - pausedAtRef.current;
    const id = window.setInterval(() => {
      const next = (performance.now() - startRef.current) % LOOP_MS;
      elapsedRef.current = next;
      setElapsed(next);
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  /* ---- الحالة المشتقة من elapsed ---- */
  const t = reduced ? SUCCESS_AT + 100 : elapsed; // الإطار الثابت: بعد النجاح
  const typedLen = TYPE_AT.filter((at) => t >= at).length;
  const typed = TYPED.slice(0, typedLen);
  /* النافذة تفتح مرتين: عند الكتابة (3.2-9ث) ثم في المونتاج
     (12ث+) لتظهر الاختصار الجديد «/ترحيب» في القائمة. */
  const popupOpen = (t >= POPUP_AT && t < 9000) || t >= MONTAGE_AT;
  const cursorShown = t >= CURSOR_AT && t < SUCCESS_AT;
  const cursorAtResult = t >= CURSOR_AT + 300 && t < SUCCESS_AT;
  const pressing = t >= PRESS_AT && t < PRESS_AT + 450;
  const sent = t >= SENT_AT;
  /* فقاعة «الرد المُرسَل» تظهر مع النجاح (9.5ث) لا مع الإرسال
     (7.8ث) — وإلا ظهرت خلف النافذة المفتوحة وتداخل نصّها
     مع صفوفها — وتختفي في المونتاج (12ث+) حتى لا يبرز
     ذيلها من تحت النافذة المعادة ويتداخل مع الشرائح. */
  const bubbleShown = t >= SUCCESS_AT && t < MONTAGE_AT;
  const success = t >= SUCCESS_AT && t < MONTAGE_AT;
  const montage = t >= MONTAGE_AT;
  /* Sequential montage (was one simultaneous pile-up that collided
     with the popup rows and the composer): chips first (12–13.5s),
     then the «+» press + the new shortcut in the list (13.5s+). */
  const montageChips = t >= MONTAGE_AT && t < ADD_AT;
  const montageAdd = t >= ADD_AT;
  const fading = t >= FADE_AT;
  const activeStep = t < 3200 ? 0 : t < 9500 ? 1 : 2; // حدود STEPS[1].from / STEPS[2].from
  const stepText = en
    ? [
        "Any word, number or symbol.",
        "Right in the search box.",
        "Text and images in one copy.",
      ]
    : STEPS.map((s) => s.text);

  return (
    <figure
      className="auth-r8-demo-fig"
      role="figure"
      aria-label={
        en
          ? "Animated demo: type a shortcut, the reply appears, copy it in one tap"
          : "عرض متحرك: اكتب اختصارًا، يظهر الرد، انسخه بضغطة"
      }
    >
      {/* بديل نصي كامل للعرض لقارئات الشاشة. */}
      <span className="sr-only">
        {en
          ? "How it works in three steps. 1. Type the shortcut: any word, number or symbol. 2. The reply appears: right in the search box. 3. Copy in one tap: text and images in one copy."
          : "إزاي بيشتغل في 3 خطوات. 1. اكتب الاختصار: أي كلمة أو رقم أو رمز. 2. الرد يظهر فورًا: الرد الكامل في بوكس البحث. 3. انسخه بضغطة: النص والصور في نسخة واحدة."}
      </span>

      {/* المسرح: توهّج هادئ + حبيبات 2% + إبراز من أعلى. */}
      <div
        ref={stageRef}
        className={`auth-r8-stage${fading ? " auth-r8-stage-fading" : ""}`}
        data-phase={activeStep}
        data-playing={running ? "1" : "0"}
        data-montage={montage ? "1" : "0"}
      >
        {/* نافذة محادثة وهمية عامة — بلا أي شعارات. */}
        <div className="auth-r8-chat" aria-hidden="true">
          <div className="auth-r8-chat-head">
            <span className="auth-r8-dot" />
            <span className="auth-r8-dot" />
            <span className="auth-r8-dot" />
            <span className="auth-r8-chat-title">
              {en ? "Chat" : "محادثة"}
            </span>
          </div>
          <div className="auth-r8-chat-body">
            <div className="auth-r8-bubble auth-r8-bubble-in">
              {en ? "Hi! How can I help?" : "أهلاً! أقدر أساعدك إزاي؟"}
            </div>
            {/* Rev2: the question fills the chat at 0.6s (was 1.2s) —
                the compact stage must not read as an empty box in
                the first seconds of every loop. Mock text only. */}
            {t >= 600 && (
              <div className="auth-r8-bubble auth-r8-bubble-in auth-r8-bubble-q">
                {en ? "Can I see the prices?" : "ممكن أسعار الباقات؟"}
              </div>
            )}
            {/* تلميح هادئ يملأ فراغ الجسم في أول 1.8 ثانية، ثم
                فقاعة «يكتب…» حتى تنبثق النافذة (3.2ث) — نفس
                الموضع في التكديس فلا قفز في التخطيط. */}
            {!sent && t < TYPING_AT && (
              <div className="auth-r8-bubble-note">
                {en
                  ? "Type a shortcut — the reply appears instantly."
                  : "اكتب اختصارًا — والرد يظهر فورًا."}
              </div>
            )}
            {!sent && t >= TYPING_AT && t < POPUP_AT && (
              <div className="auth-r8-bubble auth-r8-bubble-typing" aria-hidden="true">
                <span className="auth-r8-typing-dot" />
                <span className="auth-r8-typing-dot" />
                <span className="auth-r8-typing-dot" />
              </div>
            )}
            {bubbleShown && (
              <div className="auth-r8-bubble auth-r8-bubble-out auth-r8-bubble-sent">
                {RESULTS[0]!.body}
              </div>
            )}
          </div>
          {/* صندوق الكتابة: الكتابة الحرفية ثم الرد المتمدّد. */}
          <div className="auth-r8-composer">
            <span className="auth-r8-composer-icon">
              <Search size={16} />
            </span>
            <span className="auth-r8-composer-text" dir="auto">
              {sent ? (
                <span className="auth-r8-composer-sent">{RESULTS[0]!.body}</span>
              ) : (
                <>
                  {typed}
                  <span className="auth-r8-caret" />
                </>
              )}
            </span>
            {success && (
              <span className="auth-r8-copied">
                <Check size={13} />
                {en ? "Copied" : "تم النسخ"}
              </span>
            )}
          </div>
        </div>

        {/* النافذة المنبثقة الزجاجية: نتائج مطابقة + وسم مجلد. */}
        <div
          className={`auth-r8-popup${popupOpen ? " auth-r8-popup-open" : ""}`}
          aria-hidden="true"
        >
          <div className="auth-r8-popup-head">
            <span className="auth-r8-popup-brand">
              <Zap size={13} />
              IS Shortcuts
            </span>
            <span className="auth-r8-popup-count">
              {en ? "3 replies" : "٣ ردود"}
            </span>
          </div>
          <ul className="auth-r8-popup-list">
            {RESULTS.map((r, i) => (
              <li
                key={r.trigger}
                className={`auth-r8-popup-item${i === 0 ? " auth-r8-popup-item-active" : ""}`}
              >
                <span className="auth-r8-popup-item-main">
                  <span className="auth-r8-popup-item-title" dir="auto">
                    {i === 0 ? (
                      <>
                        <mark>{r.title}</mark>
                      </>
                    ) : (
                      r.title
                    )}
                  </span>
                  <span className="auth-r8-popup-item-tag">{r.folder}</span>
                </span>
                <span className="auth-r8-popup-item-trig" dir="auto">
                  {r.trigger}
                </span>
              </li>
            ))}
            {/* خطوة "إضافة اختصار" تظهر في المونتاج — مع الضغطة. */}
            {montageAdd && (
              <li className="auth-r8-popup-item auth-r8-popup-item-new">
                <span className="auth-r8-popup-item-main">
                  <span className="auth-r8-popup-item-title">
                    {en ? "Welcome" : "ترحيب"}
                  </span>
                  <span className="auth-r8-popup-item-tag">{en ? "New" : "جديد"}</span>
                </span>
                <span className="auth-r8-popup-item-trig" dir="auto">
                  /ترحيب
                </span>
              </li>
            )}
          </ul>

          {/* المؤشر المنزلق + تموّج الضغطة — داخل النافذة نفسها
              فيثبت على الصف الأول في كل المقاسات (top ثابت). */}
          {cursorShown && (
            <span
              className={`auth-r8-cursor${cursorAtResult ? " auth-r8-cursor-at" : ""}${pressing ? " auth-r8-cursor-press" : ""}`}
              aria-hidden="true"
            >
              <MousePointer2 size={20} fill="currentColor" />
              {pressing && <span className="auth-r8-ripple" />}
            </span>
          )}
        </div>

        {/* مونتاج المزايا: 4 شرائح + خطوة الإضافة. */}
        {montage && (
          <div className="auth-r8-montage" aria-hidden="true">
            {montageChips && BENEFITS.map((b, i) => (
              <span
                key={b.label}
                className="auth-r8-montage-chip"
                style={{ "--i": i } as React.CSSProperties}
              >
                <b.icon size={14} />
                {en
                  ? [
                      "One-tap copy",
                      "Folders",
                      "Images included",
                      "Arabic-aware search",
                    ][i]
                  : b.label}
              </span>
            ))}
            {montageAdd && (
            <span
              className="auth-r8-montage-add"
              style={{ "--i": 4 } as React.CSSProperties}
            >
              <span className="auth-r8-montage-plus">
                <Plus size={14} />
              </span>
              {en ? "Add a shortcut in seconds" : "أضف اختصارًا في ثوانٍ"}
            </span>
            )}
          </div>
        )}
        {/* LEGENDARY — the 3 steps as small captions INSIDE the
            scene's bottom edge, not separate cards. */}
        <div className="legend-stage-captions" aria-hidden="true">
          <span>١ اكتب الاختصار</span>
          <span aria-hidden="true">·</span>
          <span>٢ الرد يظهر فوراً</span>
          <span aria-hidden="true">·</span>
          <span>٣ انسخه بضغطة</span>
        </div>
      </div>

      {/* Rev1: the step text now lives inside each step card — the
          visible caption line is gone; the live region stays for
          screen readers only. */}
      <p className="sr-only" aria-live="polite">
        {stepText[activeStep]}
      </p>
    </figure>
  );
}
