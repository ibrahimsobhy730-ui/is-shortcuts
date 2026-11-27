/* AuthExplainer — لوحة العرض في صفحتي تسجيل الدخول وإنشاء
   حساب جديد (الجولة 8: التصميم كصفحة هبوط).

   فكرة واحدة قوية: العرض المتحرك (AuthDemo) هو البطل؛ تحته
   صندوق التجربة التفاعلي "جرّب بنفسك" كما هو تمامًا (يكتب
   الزائر اختصارًا فيظهر الرد الكامل، أو يدوس شريحة مثال
   فتُكتب حرفًا حرفًا، وزر النسخ ينسخ فعلًا)، ثم سطر إضافة
   الاختصار، ثم المزايا الأربع. الصورة الثابتة أُلغيت: العرض
   المتحرك حلّ محلّها، ونصّها "Tab أو Enter للإدراج" تلميح
   لوحة مفاتيح ممنوع في العرض الجديد.

   قواعد صارمة (قرارات المالك):
   · الإضافة: المالك بنى إضافة المتصفح بنفسه (2026-11-27) وأمر
     بإضافة دليل تثبيتها + زر تحميل الـ ZIP داخل الموقع — شريط
     التحميل أسفل الشرح يفتح الدليل كحوار، والموقع نفسه يستضيف
     الملف فقط ولا يعدّل كود الإضافة إطلاقًا.
   · لا شهادات ولا اقتباسات ولا أسماء مختلقة — لا
     إثبات اجتماعي مزيّف إطلاقًا.
   · كل عيّنات العرض أمثلة خيالية موسومة «مثال» بوضوح،
     وليست ردود المالك — مكتبته الحقيقية خلف الدخول،
     والمعاينة التفاعلية بردوده الحقيقية موجودة أصلًا
     في صندوق بحث الرئيسية بعد الدخول.
   · المكوّن مكتفٍ بذاته: لا يستورد من App.tsx (لا دورة
     استيراد)، والأيقونات من lucide-react مباشرة. */

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Folder,
  Image as ImageIcon,
  Plus,
  Puzzle,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import AuthDemo from "./AuthDemo";
import { ExtensionInstallGuide } from "./ExtensionInstallGuide";

type Lang = "ar" | "en";

/* أمثلة خيالية للتوضيح فقط — ليست ردودًا حقيقية من أي
   مكتبة. الاختصارات تبدأ بـ «/» كما في عرف الاختصارات. */
const EXAMPLES: { trigger: string; title: string; body: string }[] = [
  {
    trigger: "/شكرا",
    title: "شكراً",
    body: "شكراً جزيلاً لتواصلك معنا! سعداء بخدمتك، ولو احتجت أي مساعدة تانية احنا موجودين في أي وقت.",
  },
  {
    trigger: "/مواعيد",
    title: "مواعيد العمل",
    body: "مواعيد العمل من السبت للخميس، من 9 صباحاً حتى 9 مساءً. ابعتلنا رسالتك في أي وقت وهنرد عليك في أقرب وقت.",
  },
  {
    trigger: "/سعر",
    title: "سعر الباقة",
    body: "سعر الباقة الشهرية 150 جنيه، والدفع عن طريق فوري أو تحويل بنكي. للاشتراك ابعتلنا رسالة وهنفعّلها لك فوراً.",
  },
];

export default function AuthExplainer({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const typeTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(typeTimer.current);
      window.clearTimeout(copyTimer.current);
    },
    [],
  );

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

  const q = typed.trim();
  const match = EXAMPLES.find((e) => e.trigger === q) ?? null;
  const hasText = q.length > 0;

  /* الكتابة حرفًا حرفًا عند دوس شريحة مثال — تحاكي كتابة
     الزائر بنفسه، ثم ينكشف الرد. */
  const typeExample = (trigger: string) => {
    window.clearTimeout(typeTimer.current);
    setTyping(true);
    setTyped("");
    let i = 0;
    const step = () => {
      i += 1;
      setTyped(trigger.slice(0, i));
      if (i < trigger.length) {
        typeTimer.current = window.setTimeout(step, 45);
      } else {
        setTyping(false);
      }
    };
    typeTimer.current = window.setTimeout(step, 120);
  };

  const clearDemo = () => {
    window.clearTimeout(typeTimer.current);
    setTyping(false);
    setTyped("");
    setCopied(false);
  };

  const copyExample = async () => {
    if (!match) return;
    try {
      await navigator.clipboard.writeText(match.body);
    } catch {
      /* بديل قديم: حقل مؤقت — النسخ لا يفشل بصمت أبدًا. */
      const ta = document.createElement("textarea");
      ta.value = match.body;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* لا شيء — زر النسخ يبقى كما هو. */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section
      className="auth-r8-demo"
      aria-label={en ? "How IS works" : "إزاي بيشتغل؟"}
    >
      {/* العنوان: سطر واحد، ثم العرض المتحرك هو البطل. */}
      <div className="auth-r8-demo-head">
        <span className="auth-r8-eyebrow">
          <Sparkles size={13} />
          {en ? "See it work" : "شوفه بيشتغل"}
        </span>
        <h2 className="auth-r8-demo-title">{en ? "How IS works" : "إزاي بيشتغل؟"}</h2>
        <p className="auth-r8-demo-sub">
          {en
            ? "Watch a shortcut turn into a full reply — then try it yourself."
            : "شوف الاختصار بيتحوّل لرد كامل قدامك — وبعدين جرّب بنفسك."}
        </p>
      </div>

      {/* العرض المتحرك: محادثة وهمية + نافذة IS Shortcuts. */}
      <AuthDemo lang={lang} />

      {/* جرّب بنفسك: صندوق التجربة كما هو — كتابة حقيقية،
          انكشاف الرد، نسخ حقيقي، شرائح أمثلة. */}
      <div className="auth-r8-try">
        <p className="auth-r8-try-label">
          {en ? "Try it yourself" : "جرّب بنفسك"}
        </p>
        <div className="auth-demo-box">
          <span className="auth-demo-icon" aria-hidden="true">
            <Search size={18} />
          </span>
          <input
            dir="auto"
            value={typed}
            onChange={(e) => {
              setTyping(false);
              window.clearTimeout(typeTimer.current);
              setTyped(e.target.value);
            }}
            placeholder={en ? "Type a shortcut… e.g. /شكرا" : "اكتب اختصار… مثال: /شكرا"}
            aria-label={en ? "Try a demo shortcut" : "جرّب اختصار تجريبي"}
            className="auth-demo-input"
          />
          {typing && (
            <span className="auth-demo-typing" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          {typed && !typing && (
            <button
              type="button"
              aria-label={en ? "Clear the demo" : "مسح العرض"}
              onClick={clearDemo}
              className="lux-btn auth-demo-clear"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* شرائح الأمثلة: دوسة واحدة تكتب الاختصار وتكشف الرد. */}
        <div className="auth-demo-chips">
          {EXAMPLES.map((e) => (
            <button
              key={e.trigger}
              type="button"
              onClick={() => typeExample(e.trigger)}
              className="lux-btn trig-chip"
            >
              <Zap size={13} />
              <span dir="auto">{e.trigger}</span>
            </button>
          ))}
        </div>

        {/* الانكشاف: نفس خدعة التمدّد grid-rows في معاينة
            البحث — البوكس يكبر لتحت ويجيب الرد كاملًا. */}
        <div
          className={`search-trig-expand ${match ? "search-trig-expand-open" : ""}`}
        >
          <div className="search-trig-expand-inner">
            {match && (
              <div className="search-trig-panel auth-demo-panel">
                <div className="auth-demo-match-head">
                  <span className="auth-demo-example-badge">
                    {en ? "Example" : "مثال"}
                  </span>
                  <span dir="auto" className="trig-hero-pill">
                    <Zap size={13} />
                    {match.trigger}
                  </span>
                </div>
                <p className="auth-demo-match-title">{match.title}</p>
                <p className="auth-demo-match-body">{match.body}</p>
                <button
                  type="button"
                  onClick={() => void copyExample()}
                  className="lux-btn btn-lux auth-demo-copy"
                >
                  {copied ? (
                    <>
                      <Check size={15} /> {en ? "Copied" : "اتنسخ"}
                    </>
                  ) : (
                    <>
                      <Copy size={15} /> {en ? "Copy the reply" : "انسخ الرد"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* لا تطابق: إرشاد للشرائح بدل الفراغ. */}
        {hasText && !match && !typing && (
          <p className="auth-demo-nomatch">
            {en
              ? "No demo matches that — try one of the examples above."
              : "مفيش مثال بالنص ده — جرّب واحد من الأمثلة اللي فوق."}
          </p>
        )}
        <p className="auth-demo-note">
          {en
            ? "Examples only — your real replies stay private and appear after you sign in."
            : "دي أمثلة للتوضيح بس — ردودك الحقيقية محفوظة في حسابك وبتظهر بعد الدخول."}
        </p>
      </div>

      {/* إضافة اختصار: سطر واحد واضح (نفس المعنى، أقصر). */}
      <div className="auth-r8-add">
        <span className="auth-r8-add-icon" aria-hidden="true">
          <Plus size={16} />
        </span>
        <div>
          <p className="auth-r8-add-title">
            {en ? "Adding a shortcut takes seconds" : "إضافة اختصار بتاخد ثواني"}
          </p>
          <p className="auth-r8-add-text">
            {en
              ? "From «New», write the reply, give it any shortcut — the site suggests the easiest free ones, one tap to accept."
              : "من «جديد» اكتب الرد وحطّ له أي اختصار — والموقع يقترح أسهل الفاضي، دوسة واحدة توافق."}
          </p>
        </div>
      </div>

      {/* المزايا الأساسية: أربع حبوب بأيقونات — بلا زحمة. */}
      <div className="auth-r8-features">
        {[
          { icon: Search, label: en ? "Arabic-aware search" : "بحث فوري يفهم العربي" },
          { icon: Copy, label: en ? "One-tap copy" : "نسخ بضغطة واحدة" },
          { icon: Folder, label: en ? "Organised folders" : "مجلدات منظمة" },
          { icon: ImageIcon, label: en ? "Images with the reply" : "صور مع الرد" },
        ].map((f) => (
          <span key={f.label} className="auth-r8-feature">
            <f.icon size={14} />
            {f.label}
          </span>
        ))}
      </div>

      {/* تحميل الإضافة: شريط واحد مدمج أسفل الشرح — تحميل الـ ZIP
          + زر يفتح دليل التثبيت الكامل كحوار. */}
      <div className="auth-r8-ext">
        <span className="auth-r8-ext-icon" aria-hidden="true">
          <Puzzle size={18} />
        </span>
        <div className="auth-r8-ext-text">
          <p className="auth-r8-ext-title">
            {en ? "Take IS everywhere" : "خد IS معاك في أي مكان"}
          </p>
          <p className="auth-r8-ext-sub">
            {en
              ? "Browser extension v3.0 — free download"
              : "إضافة المتصفح — الإصدار 3.0 — تحميل مجاني"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="lux-btn auth-r8-ext-guide"
        >
          {en ? "Install guide" : "شرح التثبيت"}
        </button>
        <a
          href="/is-shortcuts-extension.zip"
          download="is-shortcuts-extension.zip"
          className="lux-btn btn-lux auth-r8-ext-dl"
        >
          <Download size={15} />
          {en ? "Download" : "تحميل"}
        </a>
      </div>

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
