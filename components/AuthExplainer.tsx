/* AuthExplainer — الشرح التوضيحي التفاعلي على صفحتي
   تسجيل الدخول وإنشاء حساب جديد (طلب المالك 2026-11-27).
   يجلس تحت نموذج الدخول مباشرة، في نفس العمود، ولا
   يخفي النموذج أبدًا — النموذج هو البطل، والشرح تحته.

   المركز: عرض حيّ حقيقي (مش صورة): الزائر يكتب اختصارًا
   في صندوق العرض فيظهر الرد الكامل مكانه بتمدّد متحرك،
   أو يدوس شريحة مثال فيُكتب الاختصار حرفًا حرفًا
   (مؤشر «بيكتب…») ثم ينكشف الرد، وزر النسخ ينسخ فعلًا.

   قواعد صارمة (قرارات المالك):
   · لا ذكر لأي إضافة متصفح إطلاقًا — الموقع بلا إضافة،
     والعرض داخل الموقع فقط.
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
  Folder,
  Image as ImageIcon,
  MousePointerClick,
  Plus,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

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
  const typeTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(typeTimer.current);
      window.clearTimeout(copyTimer.current);
    },
    [],
  );

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
      className="auth-explainer"
      aria-label={en ? "How IS works" : "إزاي بيشتغل؟"}
    >
      {/* العنوان: شرح لا وعود — ماذا يفعل الموقع في سطرين. */}
      <div className="auth-explainer-head">
        <span className="auth-explainer-eyebrow">
          <Sparkles size={13} />
          {en ? "See it work" : "شوفه بيشتغل"}
        </span>
        <h2>{en ? "How IS works" : "إزاي بيشتغل؟"}</h2>
        <p>
          {en
            ? "Type a shortcut — get the full reply instantly, and copy it in one tap. Try it yourself, right here:"
            : "اكتب اختصار — وخد الرد الكامل فورًا، وانسخه بضغطة واحدة. جرّب بنفسك هنا دلوقتي:"}
        </p>
      </div>

      {/* العرض الحيّ: صندوق كتابة + انكشاف الرد مكانه. */}
      <div className="auth-demo">
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
            ? "These are just illustrative examples — your real replies stay private in your account and appear after you sign in."
            : "دي أمثلة للتوضيح بس — ردودك الحقيقية محفوظة في حسابك وبتظهر بعد الدخول."}
        </p>
      </div>

      {/* الخطوات الثلاث: اكتب ← يظهر ← انسخ. */}
      <ol className="auth-steps">
        {[
          {
            n: "١",
            icon: Zap,
            title: en ? "Type the shortcut" : "اكتب الاختصار",
            text: en
              ? "Any word, number or symbol — it is yours."
              : "أي كلمة أو رقم أو رمز — اختصارك انت.",
          },
          {
            n: "٢",
            icon: Search,
            title: en ? "The reply appears" : "الرد يظهر فورًا",
            text: en
              ? "The full reply, right in the search box."
              : "الرد الكامل، جوه بوكس البحث نفسه.",
          },
          {
            n: "٣",
            icon: MousePointerClick,
            title: en ? "Copy in one tap" : "انسخه بضغطة",
            text: en
              ? "Text — and images with it — in one copy."
              : "النص — والصور معاه — في نسخة واحدة.",
          },
        ].map((s) => (
          <li key={s.n} className="auth-step">
            <span className="auth-step-num" aria-hidden="true">
              {s.n}
            </span>
            <span className="auth-step-icon" aria-hidden="true">
              <s.icon size={16} />
            </span>
            <p className="auth-step-title">{s.title}</p>
            <p className="auth-step-text">{s.text}</p>
          </li>
        ))}
      </ol>

      {/* إضافة اختصار: سطر واحد واضح + لمحة شكلية. */}
      <div className="auth-add">
        <span className="auth-add-icon" aria-hidden="true">
          <Plus size={16} />
        </span>
        <div>
          <p className="auth-add-title">
            {en ? "Adding a shortcut takes seconds" : "إضافة اختصار بتاخد ثواني"}
          </p>
          <p className="auth-add-text">
            {en
              ? "From «New», write the reply, give it any shortcut, and the site suggests the easiest free ones for you — one tap to accept."
              : "من زر «جديد» اكتب الرد، وحطّ له أي اختصار، والموقع بيقترح عليك أسهل الاختصارات الفاضية — دوسة واحدة توافق."}
          </p>
        </div>
      </div>

      {/* المزايا الأساسية: أربع حبوب بأيقونات — بلا زحمة. */}
      <div className="auth-features">
        {[
          { icon: Search, label: en ? "Instant Arabic-aware search" : "بحث فوري يفهم العربي" },
          { icon: Copy, label: en ? "One-tap copy" : "نسخ بضغطة واحدة" },
          { icon: Folder, label: en ? "Organised folders" : "مجلدات منظمة" },
          { icon: ImageIcon, label: en ? "Images with the reply" : "صور مع الرد" },
        ].map((f) => (
          <span key={f.label} className="auth-feature">
            <f.icon size={14} />
            {f.label}
          </span>
        ))}
      </div>
    </section>
  );
}
