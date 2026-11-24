/* ============================================================
   صفحة المعاينة — #/preview
   طلبها صاحب الموقع صراحة: الفحص الآلي يصل لصفحة الدخول فقط،
   فهذه الصفحة تعرض الهوية البصرية الجديدة (المرحلتان أ + ب:
   نظام التصميم + التخطيط والسايدبار والهيدر، ومعها الكروت
   والمجلدات بنفس التوكنز) ببيانات تجريبية مطابقة في الشكل
   والحجم لبياناته الحقيقية: نفس أسماء المجلدات الأحد عشر،
   ونفس العدّاد «88 رد في 11 مجلد»، وعناوين ردود من مكتبته.
   لا تتصل بالخادم إطلاقًا، ولا تمس أي بيانات حقيقية — كل
   تفاعلاتها محلية (ثيم، لون مميز، طيّ السايدبار، بحث شكلي،
   نسخ فعلي للنص التجريبي). الخروج منها بحذف #/preview.
   ============================================================ */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
Archive, Check, ChevronDown, Clock, Copy, FolderOpen, Heart, History,
Home, LayoutGrid, List, Moon, MoreHorizontal, Pencil, Pin, Rows3, Search,
Sparkles, Star, Sun, Trash2, TrendingUp, X,
} from "lucide-react";

const VERSE = "نِعْمَةً مِّنْ عِندِنَا ۚ كَذَٰلِكَ نَجْزِي مَن شَكَرَ";

type Folder = { name: string; count: number; icon: string };
const FOLDERS: Folder[] = [
  { name: "ترحيب", count: 4, icon: "👋" },
  { name: "مميزات وأسئلة", count: 9, icon: "✦" },
  { name: "أسعار", count: 12, icon: "💰" },
  { name: "بكالوريا", count: 3, icon: "🎓" },
  { name: "دفع", count: 8, icon: "💳" },
  { name: "فودافون كاش", count: 6, icon: "📱" },
  { name: "دعم فني", count: 9, icon: "🛠" },
  { name: "قواعد", count: 6, icon: "📜" },
  { name: "مدرسين", count: 12, icon: "👩‍🏫" },
  { name: "مواعيد", count: 5, icon: "🗓" },
  { name: "معلومات عامة", count: 14, icon: "ℹ️" },
];

type Reply = {
  title: string; body: string; folder: string; tags: string[];
  uses: number; pinned?: boolean; fav?: boolean; edited: string;
};
const REPLIES: Reply[] = [
  { title: "السلام عليكم — ولد", body: "وعليكم السلام ورحمة الله وبركاته 🤩\nأهلًا بيك يا بطل في الخطة التعليمية! معاك فريق الدعم، تحت أمرك في أي استفسار عن الاشتراك أو الحصص.", folder: "ترحيب", tags: ["ترحيب", "بداية المحادثة"], uses: 132, pinned: true, fav: true, edited: "اليوم" },
  { title: "السلام عليكم — بنت", body: "وعليكم السلام ورحمة الله وبركاته 🤩\nأهلًا بيكي يا بطلة في الخطة التعليمية! معاكي فريق الدعم، تحت أمرك في أي استفسار عن الاشتراك أو الحصص.", folder: "ترحيب", tags: ["ترحيب", "بداية المحادثة"], uses: 118, fav: true, edited: "اليوم" },
  { title: "المميزات كاملة", body: "مميزات الخطة التعليمية:\n• حصص مسجلة بجودة عالية تقدر ترجع لها في أي وقت\n• متابعة مستمرة واختبارات دورية\n• ملخصات وملفات PDF لكل حصة\n• دعم فني على مدار الساعة", folder: "مميزات وأسئلة", tags: ["مميزات"], uses: 96, edited: "أمس" },
  { title: "سؤال الخصم — السنة معروفة", body: "حضرتك طالب في أي سنة دراسية؟ وهل الدراسة عربي ولا لغات؟ عشان أقولك السعر بعد الخصم بالظبط.", folder: "مميزات وأسئلة", tags: ["خصم", "أسعار"], uses: 74, edited: "أمس" },
  { title: "أسعار أولى ثانوي — عربي", body: "أسعار أولى ثانوي (عربي):\nالخطة الشهرية متاحة الآن، وتقدر تشترك من رابع ابتدائي لثالث ثانوي. للتفاصيل الكاملة ابعتلي اسم المادة اللي محتاجها.", folder: "أسعار", tags: ["أولى ثانوي", "عربي"], uses: 61, edited: "منذ 3 أيام" },
  { title: "خطوات الدفع فوري", body: "خطوات الدفع عن طريق فوري:\n1) اطلب كود الدفع من هنا\n2) الكود بيبدأ بـ 97 وصلاحيته يومين\n3) ادفع من أي منفذ فوري\n4) الاشتراك بيتفعّل فورًا بعد الدفع", folder: "دفع", tags: ["فوري", "دفع"], uses: 88, pinned: true, edited: "منذ يومين" },
  { title: "اعتراض على طريقة الدفع", body: "الدفع بفوري هو الأسرع والأضمن: التفعيل بيتم لحظيًا بعد الدفع مباشرة، وبيوصلك إشعار بالتأكيد. لو واجهتك أي مشكلة في الدفع ابعتلنا وهنساعدك خطوة بخطوة.", folder: "دفع", tags: ["فوري", "اعتراض"], uses: 33, edited: "منذ أسبوع" },
  { title: "ابتدائي غير متاح", body: "متاح من رابع ابتدائي لثالث ثانوي فقط. لو الطالب في أولى أو تانية أو تالتة ابتدائي، الاشتراك مش متاح حاليًا — تابعنا وهيتم الإعلان فور توفره.", folder: "معلومات عامة", tags: ["ابتدائي"], uses: 45, edited: "منذ أسبوع" },
];

const ACCENTS = [
  { key: "royal", label: "أزرق ملكي", swatch: "#1668C4" },
  { key: "sky", label: "سماوي", swatch: "#0284C7" },
  { key: "teal", label: "مخضر", swatch: "#0F766E" },
  { key: "violet", label: "بنفسجي", swatch: "#7C3AED" },
  { key: "rose", label: "وردي", swatch: "#E11D63" },
  { key: "amber", label: "كهرماني", swatch: "#B45309" },
] as const;

const NAV = [
  { key: "home", label: "الرئيسية", icon: Home, count: 88 },
  { key: "fav", label: "المفضلة", icon: Star, count: null },
  { key: "recent", label: "استُخدمت مؤخراً", icon: Clock, count: null },
  { key: "top", label: "الأكثر استخداماً", icon: TrendingUp, count: null },
  { key: "history", label: "سجل النسخ", icon: History, count: null },
  { key: "trash", label: "سلة المهملات", icon: Trash2, count: null },
] as const;

export function PreviewPage({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const [rail, setRail] = useState(false);
  const [accent, setAccent] = useState<string>(() => document.documentElement.dataset.accent ?? "royal");
  const [view, setView] = useState<"grid" | "list" | "compact">("grid");
  const [chip, setChip] = useState("الكل");
  const [moreOpen, setMoreOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try { window.localStorage.setItem("is-accent", accent); } catch { /* ignore */ }
  }, [accent]);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return REPLIES;
    return REPLIES.filter((r) => r.title.includes(q) || r.body.includes(q) || r.folder.includes(q));
  }, [query]);

  const doCopy = async (r: Reply) => {
    try { await navigator.clipboard.writeText(r.body); } catch { /* المعاينة فقط */ }
    setCopied(r.title);
    setToast(`اتنسخ «${r.title}»`);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setCopied(null); setToast(null); }, 1800);
  };

  const segIndex = view === "compact" ? 0 : view === "list" ? 1 : 2;

  return (
    <div dir="rtl" className="app-shell min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* ===== الهيدر العائم الزجاجي ===== */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="float-header mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4" style={{ borderRadius: 26 }}>
          <span className="logo-modern shrink-0" role="img" aria-label="IS">
            <svg viewBox="0 0 240 227" width={44} height={42} aria-hidden="true" className="block">
              <defs>
                <linearGradient id="preview-logo-arch" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--logo-hi)" />
                  <stop offset="0.5" stopColor="var(--logo-mid)" />
                  <stop offset="1" stopColor="var(--logo-lo)" />
                </linearGradient>
              </defs>
              <path d="M76.4 7.7 L93.5 7.7 L93.9 9.7 Q94.3 11.6 93.9 12.0 Q93.5 12.4 80.4 12.5 L67.4 12.6 L67.4 113.3 Q67.4 213.9 67.8 214.2 Q68.1 214.7 85.8 214.4 Q103.4 214.1 103.8 214.6 Q104.2 214.9 104.2 217.0 L104.2 219.1 L83.8 219.2 Q63.5 219.3 59.1 218.8 Q54.6 218.3 48.9 216.5 Q43.2 214.7 39.3 212.6 Q35.5 210.5 31.6 207.7 Q27.7 204.8 24.4 201.6 Q21.2 198.3 18.3 194.4 Q15.5 190.5 13.9 187.7 Q12.4 184.8 10.8 180.7 Q9.3 176.5 8.2 171.6 Q7.2 166.7 7.4 111.4 Q7.7 56.2 9.8 49.5 Q11.9 42.7 14.4 38.0 Q17.0 33.4 21.6 28.0 Q26.1 22.7 31.8 18.6 Q37.5 14.4 42.2 12.4 Q46.9 10.3 53.1 9.0 Q59.3 7.7 76.4 7.7 Z M232.2 104.3 L232.0 148.8 L231.2 143.7 Q230.2 138.7 228.9 135.3 Q227.6 131.9 227.6 95.9 Q227.6 59.8 226.1 53.6 Q224.5 47.4 222.2 42.7 Q219.8 38.0 217.0 34.2 Q214.1 30.3 212.0 28.0 Q209.7 25.9 209.1 25.8 L208.4 25.6 L208.4 48.2 L208.4 70.7 L206.5 71.1 Q204.5 71.5 204.2 71.1 Q203.8 70.7 202.7 64.2 Q201.7 57.8 200.1 53.3 Q198.6 48.9 196.2 44.5 Q193.9 40.1 190.0 35.2 Q186.1 30.3 181.0 25.8 Q176.0 21.2 169.3 17.3 Q162.5 13.4 158.1 11.9 Q153.7 10.3 147.2 9.0 L140.7 7.7 L161.0 7.7 Q181.2 7.7 187.7 9.3 Q194.2 10.8 198.6 12.9 Q203.0 15.0 206.1 17.0 Q209.2 19.1 213.2 22.9 Q217.3 26.6 220.9 31.6 Q224.5 36.5 227.1 42.2 Q229.7 47.9 231.0 53.9 Q232.3 59.8 232.2 104.3 Z M35.1 113.4 L34.9 204.3 L29.6 199.5 Q24.3 194.7 21.7 191.1 Q19.1 187.4 17.3 183.8 Q15.5 180.2 13.7 173.4 Q11.9 166.7 12.1 111.7 Q12.4 56.7 13.7 52.1 Q15.0 47.4 17.3 42.7 Q19.6 38.0 22.5 34.2 Q25.3 30.3 29.9 26.3 Q34.4 22.2 34.8 22.3 L35.2 22.5 L35.1 113.4 Z M82.0 163.9 L82.1 131.2 L84.0 131.2 Q85.8 131.2 86.1 131.6 Q86.5 131.9 86.5 135.0 Q86.5 138.2 87.3 141.8 Q88.1 145.4 88.1 152.9 Q88.1 160.5 89.4 167.5 Q90.7 174.5 94.1 184.3 Q97.4 194.2 100.7 200.6 L103.9 206.9 L99.0 205.1 Q94.1 203.2 88.0 200.0 Q81.9 196.8 82.0 163.9 Z" fill="var(--logo-deep)" fillRule="evenodd" />
              <path d="M123.1 9.5 Q130.9 7.7 136.6 7.7 Q142.3 7.7 146.2 8.5 Q150.1 9.3 152.3 10.2 L154.5 11.1 L154.1 11.4 Q153.7 11.9 147.2 12.1 Q140.7 12.4 136.9 13.4 Q133.0 14.4 129.1 16.5 Q125.2 18.6 122.2 21.6 Q119.2 24.6 116.9 29.2 Q114.6 33.9 114.0 39.1 Q113.5 44.3 114.3 47.6 Q115.1 51.0 117.4 54.9 Q119.7 58.8 124.3 62.8 Q128.8 66.8 134.0 69.9 Q139.2 73.1 146.5 76.4 Q153.7 79.8 168.0 85.5 Q182.2 91.2 189.8 94.8 Q197.3 98.5 201.4 101.1 Q205.6 103.7 207.7 105.2 Q209.7 106.8 215.3 112.9 Q220.9 119.0 222.7 121.8 Q224.5 124.7 227.1 130.6 Q229.7 136.6 231.0 142.3 Q232.3 148.0 232.6 154.8 Q232.8 161.5 232.3 165.9 Q231.8 170.3 230.7 174.2 Q229.7 178.1 227.1 183.8 Q224.5 189.5 221.4 193.9 Q218.3 198.3 212.7 203.4 Q207.1 208.4 202.7 211.0 Q198.3 213.6 192.1 215.7 Q185.9 217.8 180.7 218.5 Q175.5 219.3 162.5 219.1 Q149.6 218.8 140.0 217.3 Q130.4 215.7 118.7 212.1 Q107.0 208.4 105.3 207.3 Q103.7 206.1 101.3 202.0 Q99.0 197.8 96.4 191.3 Q93.8 184.8 92.3 179.6 Q90.7 174.5 89.4 167.2 Q88.1 159.9 88.1 156.3 Q88.1 152.7 88.5 152.3 L88.9 151.9 L91.3 158.7 Q93.8 165.6 95.9 169.5 Q98.0 173.4 101.6 178.9 Q105.2 184.3 109.0 188.3 Q112.7 192.4 116.4 195.5 Q120.0 198.6 124.9 202.0 Q129.9 205.3 134.8 207.7 Q139.7 210.0 145.9 211.8 Q152.2 213.6 158.4 214.1 Q164.6 214.7 167.7 214.1 Q170.8 213.6 175.2 211.8 Q179.6 210.0 181.2 209.0 Q182.8 207.9 185.7 204.7 Q188.7 201.4 190.0 199.1 Q191.3 196.8 192.1 194.2 Q192.9 191.6 193.1 186.7 Q193.4 181.7 192.9 179.6 Q192.4 177.6 190.3 173.4 Q188.2 169.3 185.0 165.8 Q181.7 162.3 177.6 159.4 Q173.4 156.6 167.2 153.5 Q161.0 150.3 141.5 142.6 Q122.1 134.8 114.6 130.9 Q107.0 127.0 103.4 124.7 Q99.8 122.3 97.2 120.3 Q94.6 118.2 90.8 113.9 Q87.1 109.6 84.7 105.7 Q82.4 101.8 80.3 97.2 Q78.2 92.5 76.7 86.0 Q75.1 79.5 74.9 73.3 Q74.6 67.1 75.4 61.4 Q76.2 55.7 77.5 51.5 Q78.8 47.4 80.6 43.5 Q82.4 39.6 85.5 34.9 Q88.6 30.3 92.7 26.3 Q96.7 22.2 100.5 19.4 Q104.4 16.5 109.9 13.9 Q115.3 11.3 123.1 9.5 Z M191.6 212.1 Q185.4 214.7 183.0 215.2 Q180.7 215.7 178.5 215.6 L176.3 215.4 L182.1 213.2 Q187.9 211.0 192.4 207.9 Q196.8 204.8 200.8 200.0 Q204.8 195.2 206.9 190.8 Q209.0 186.4 209.7 182.8 Q210.5 179.1 210.3 172.4 Q210.0 165.6 208.4 161.0 Q206.9 156.3 204.5 152.4 Q202.2 148.5 196.6 143.0 Q191.1 137.4 183.3 133.2 Q175.5 129.1 152.2 120.5 Q128.8 112.0 118.2 106.8 Q107.6 101.6 103.7 98.7 Q99.8 95.9 96.3 92.4 Q92.8 88.9 90.7 85.8 Q88.6 82.7 86.8 78.0 Q85.0 73.3 84.2 69.2 Q83.4 65.0 83.7 59.6 Q84.0 54.1 85.5 48.7 Q87.1 43.2 89.1 39.3 Q91.2 35.5 94.1 31.8 Q96.9 28.2 101.7 24.2 Q106.5 20.2 110.4 17.8 Q114.3 15.5 118.4 13.9 Q122.6 12.4 126.7 11.6 Q130.9 10.8 132.1 10.9 L133.2 11.1 L128.1 12.8 Q123.1 14.4 117.9 17.6 Q112.7 20.7 107.9 26.0 Q103.1 31.3 101.1 35.2 Q99.0 39.1 98.0 42.5 Q96.9 45.8 96.9 53.9 Q96.9 61.9 98.5 66.6 Q100.0 71.2 102.6 75.4 Q105.2 79.5 110.3 84.4 Q115.3 89.1 122.1 92.8 Q128.8 96.4 155.0 106.3 Q181.2 116.1 189.2 120.3 Q197.3 124.4 201.7 127.5 Q206.1 130.6 209.6 134.2 Q213.1 137.6 215.7 141.3 Q218.3 144.9 220.4 149.8 Q222.4 154.8 223.0 157.1 Q223.5 159.4 223.5 166.7 Q223.5 173.9 222.4 177.8 Q221.4 181.7 219.3 186.1 Q217.3 190.5 214.4 194.4 Q211.5 198.3 207.8 201.8 Q204.0 205.3 200.9 207.4 Q197.8 209.5 191.6 212.1 Z" fill="url(#preview-logo-arch)" fillRule="evenodd" />
            </svg>
          </span>
          <div className="relative mx-auto w-full min-w-0 max-w-2xl flex-1 transition-[max-width] duration-300 focus-within:max-w-3xl">
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--faint)]">
              <Search size={19} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <input
              aria-label="دوّر في الردود (معاينة)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دوّر باسم الرد أو كلمة منه…"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-3 pe-11 ps-12 text-[15px] outline-none transition-shadow placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
            />
            {query && (
              <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")} className="lux-btn absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--faint)]">
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>
          <span className="hidden items-center gap-1.5 text-[12px] font-semibold text-[var(--dim)] sm:flex" role="status">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--success)]" />
            متزامن
          </span>
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="لون التمييز">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-label={a.label}
                aria-pressed={accent === a.key}
                onClick={() => setAccent(a.key)}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{ background: a.swatch, boxShadow: accent === a.key ? "0 0 0 2px var(--surface), 0 0 0 4px var(--text)" : undefined }}
              />
            ))}
          </div>
          <button type="button" aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"} aria-pressed={dark} onClick={onToggleDark} className="lux-btn shrink-0 rounded-full p-2.5 text-[var(--dim)] hover:bg-[var(--surface-alt)]">
            {dark ? <Sun size={18} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <span className="flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-3 ps-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-[var(--accent-ink)]" style={{ background: "linear-gradient(150deg, var(--accent), var(--accent-strong))" }}>إ</span>
            <span className="hidden leading-tight min-[480px]:block">
              <span className="block text-sm font-semibold">Ibrahim Sobhi</span>
              <span className="block text-[12px] text-[var(--faint)]">صفحة معاينة</span>
            </span>
          </span>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-7xl items-start gap-6 px-4 sm:px-6">
        {/* ===== السايدبار العائم ===== */}
        <aside
          className="modern-sidebar sticky top-[104px] hidden max-h-[calc(100dvh-116px)] shrink-0 self-start py-5 lg:block"
          style={{ width: rail ? 72 : 268 }}
          aria-label="التنقل الرئيسي (معاينة)"
        >
          <div className={`max-h-[calc(100dvh-116px-2.5rem)] overflow-y-auto no-scrollbar ${rail ? "px-1.5" : "px-2.5"}`}>
            <button
              type="button"
              onClick={() => setRail((v) => !v)}
              aria-pressed={rail}
              aria-label={rail ? "توسيع القائمة" : "تصغير القائمة"}
              data-tip={rail ? "توسيع القائمة" : "تصغير القائمة"}
              className="lux-btn mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--dim)]"
            >
              <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" style={{ transform: rail ? "rotate(90deg)" : "rotate(-90deg)" }} />
              {!rail && <span>تصغير القائمة</span>}
            </button>

            <p className={`nav-label px-2 pb-1.5 font-bold text-[var(--faint)] ${rail ? "sr-only" : ""}`}>المكتبة</p>
            <ul className="space-y-0.5">
              {NAV.map((n, i) => (
                <li key={n.key}>
                  <button
                    type="button"
                    aria-current={i === 0 ? "page" : undefined}
                    data-tip={rail ? n.label : undefined}
                    className={`lux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-start ${i === 0 ? "nav-item-active font-bold text-[var(--text)]" : "text-[var(--dim)]"}`}
                  >
                    <n.icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                    {!rail && <span className="nav-label flex-1 truncate">{n.label}</span>}
                    {!rail && n.count !== null && (
                      <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[12px] font-bold text-[var(--dim)]">{n.count}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setFoldersOpen((v) => !v)}
              aria-expanded={foldersOpen}
              className={`mt-4 flex w-full items-center gap-1.5 px-2 pb-1.5 text-start ${rail ? "justify-center" : ""}`}
            >
              {!rail && <span className="nav-label flex-1 font-bold text-[var(--faint)]">المجلدات</span>}
              <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className="text-[var(--faint)]" style={{ transform: foldersOpen ? undefined : "rotate(90deg)" }} />
            </button>
            <div className="nav-group-body" data-open={foldersOpen}>
              <div>
                <ul className="space-y-0.5">
                  {FOLDERS.map((f) => (
                    <li key={f.name}>
                      <button type="button" data-tip={rail ? f.name : undefined} className="lux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-start text-[var(--dim)]">
                        <span aria-hidden="true" className="text-[15px] leading-none">{f.icon}</span>
                        {!rail && <span className="nav-label flex-1 truncate">{f.name}</span>}
                        {!rail && <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[12px] font-bold">{f.count}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {!rail && <p className="nav-label mt-4 px-2 pb-1.5 font-bold text-[var(--faint)]">ذكية</p>}
            <button type="button" data-tip={rail ? "غير مستخدمة من مدة" : undefined} className="lux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-start text-[var(--dim)]">
              <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[var(--accent)]" />
              {!rail && <span className="nav-label flex-1 truncate">غير مستخدمة من مدة</span>}
              {!rail && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[12px] font-bold text-[var(--accent)]">✦</span>}
            </button>
          </div>
        </aside>

        {/* ===== المحتوى ===== */}
        <main className="pv-shell min-w-0 flex-1 pb-28 lg:pb-16">
          {/* البانر المدمج القابل للطي */}
          {bannerOpen ? (
            <section className="verse-hero mt-4 px-4 py-3 text-center sm:mt-5" aria-label="البانر">
              <p className="verse" style={{ fontSize: "clamp(21px, 3.2vw, 29px)" }}>{VERSE}</p>
              <span aria-hidden="true" className="orn-divider"><i /></span>
              <p className="mt-1.5 text-[13px] font-semibold text-[var(--dim)]">88 رد في 11 مجلد — مكتبتك جاهزة</p>
              <button type="button" onClick={() => setBannerOpen(false)} aria-label="طيّ البانر" className="lux-btn mx-auto mt-2 flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--dim)]">
                طيّ البانر <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </section>
          ) : (
            <button type="button" onClick={() => setBannerOpen(true)} aria-label="فتح البانر" className="lux-btn mt-5 flex w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 sm:mt-6">
              <span className="verse text-[15px]">{VERSE}</span>
              <span className="text-[12px] font-bold text-[var(--dim)]">88 رد في 11 مجلد</span>
            </button>
          )}

          {/* شريط الفلاتر: صف واحد — 4 أزرار أساسية بعدّادات،
              والباقي في «المزيد»، ومفتاح العرض المجزّأ في الطرف */}
          <div className="sticky top-[92px] z-30 mt-5">
            <div className="modern-switcher relative flex flex-wrap items-center gap-1.5 rounded-[24px] px-3 py-2.5">
              {([
                { label: "الكل", count: 88 },
                { label: "المفضلة", count: 12 },
                { label: "استُخدمت مؤخراً", count: 41 },
                { label: "الأحدث", count: 88 },
              ]).map((c) => (
                <button key={c.label} type="button" aria-pressed={chip === c.label} data-on={chip === c.label} onClick={() => setChip(c.label)} className="pv-chip flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-bold text-[var(--dim)]">
                  {c.label}
                  <span className="rounded-full bg-[var(--surface-alt)] px-1.5 text-[12px] font-bold leading-5">{c.count}</span>
                </button>
              ))}
              <div className="relative">
                <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((v) => !v)} className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-bold ${["سجل النسخ", "الأكثر استخداماً", "الأقل استخداماً", "لم تُستخدم"].includes(chip) ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--dim)]"}`}>
                  المزيد
                  <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" style={{ transform: moreOpen ? "rotate(180deg)" : undefined }} />
                </button>
                {moreOpen && (
                  <div className="pop-glass animate-menu absolute end-0 top-[calc(100%+8px)] z-[var(--z-menu)] w-52 rounded-[var(--r-md)] p-1.5" role="menu" aria-label="عروض إضافية">
                    {["سجل النسخ", "الأكثر استخداماً", "الأقل استخداماً", "لم تُستخدم"].map((c) => (
                      <button key={c} type="button" role="menuitem" aria-pressed={chip === c} onClick={() => { setChip(c); setMoreOpen(false); }} className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-start text-[13px] font-semibold ${chip === c ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--dim)]"}`}>
                        <span className="flex-1">{c}</span>
                        {chip === c && <Check size={14} strokeWidth={2} aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" aria-hidden="true" />
              <span className="rounded-full px-3 py-2 text-[13px] font-bold text-[var(--dim)]">فلاتر</span>
              <div className="pv-seg ms-auto flex rounded-full border border-[var(--border)] bg-[var(--surface-alt)] p-1" role="group" aria-label="طريقة العرض">
                <span className="pv-seg-thumb" style={{ insetInlineStart: 4 + segIndex * 64, width: 60 } as CSSProperties} aria-hidden="true" />
                {([
                  { k: "compact", icon: Rows3, label: "مضغوط" },
                  { k: "list", icon: List, label: "مريح" },
                  { k: "grid", icon: LayoutGrid, label: "شبكة" },
                ] as const).map((v) => (
                  <button key={v.k} type="button" aria-label={v.label} aria-pressed={view === v.k} onClick={() => setView(v.k)} className="relative z-[1] flex h-9 w-16 items-center justify-center rounded-full text-[13px] font-bold text-[var(--dim)]" style={view === v.k ? { color: "var(--text)" } : undefined}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* قسم مجلد */}
          <section aria-label="مجلد ترحيب" className="mt-6">
            <div className="folder-bar flex items-center gap-3">
              <span className="folder-bar-icon fhue-2" aria-hidden="true"><FolderOpen size={24} strokeWidth={1.75} /></span>
              <h2 className="folder-bar-title">ترحيب</h2>
              <span className="folder-bar-count">4 ردود</span>
              <span className="ms-auto" />
              <button type="button" className="folder-bar-open" onClick={() => setEditorOpen(true)}>
                عرض المجلد
                <span className="folder-bar-arrow" aria-hidden="true">←</span>
              </button>
            </div>

            <div className="pv-cards pv-stagger mt-4" data-view={view}>
              {shown.map((r, i) => (
                <article key={r.title} className="pv-card lux-card elev-card group/card relative flex flex-col rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-5" style={{ "--i": i } as CSSProperties}>
                  {/* شريط الأكشنز العائم عند التحويم */}
                  <div className="pv-actions absolute end-3 top-3 z-[2] flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-[var(--shadow-2)]">
                    <button type="button" aria-label="مفضلة" className="lux-btn rounded-full p-1.5" style={r.fav ? { color: "var(--favorite)" } : { color: "var(--dim)" }}><Star size={15} strokeWidth={1.75} aria-hidden="true" fill={r.fav ? "currentColor" : "none"} /></button>
                    <button type="button" aria-label="تثبيت" className="lux-btn rounded-full p-1.5 text-[var(--dim)]"><Pin size={15} strokeWidth={1.75} aria-hidden="true" /></button>
                    <button type="button" aria-label="تعديل" onClick={() => setEditorOpen(true)} className="lux-btn rounded-full p-1.5 text-[var(--dim)]"><Pencil size={15} strokeWidth={1.75} aria-hidden="true" /></button>
                    <button type="button" aria-label="أرشفة" className="lux-btn rounded-full p-1.5 text-[var(--dim)]"><Archive size={15} strokeWidth={1.75} aria-hidden="true" /></button>
                  </div>
                  <button type="button" aria-label="قائمة الرد" className="lux-btn absolute end-3 top-3 rounded-full p-1.5 text-[var(--dim)] min-[1024px]:hidden">
                    <MoreHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>

                  <h3 className="flex items-center gap-1.5 pe-8 font-semibold" style={{ fontSize: "var(--fs-card)" }}>
                    {r.pinned && <Pin size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[var(--accent)]" />}
                    {r.title}
                    {r.fav && <Star size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: "var(--favorite)" }} fill="currentColor" />}
                  </h3>
                  <p className="clamp-3 mt-1.5 whitespace-pre-line text-[var(--dim)]" style={{ fontSize: "var(--fs-body)", lineHeight: 1.75 }}>{r.body}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--dim)]" style={{ fontSize: "var(--fs-meta)" }}>
                    <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 font-bold">{r.folder}</span>
                    {r.tags.slice(0, 2).map((t) => (
                      <span key={t} className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 font-semibold">{t}</span>
                    ))}
                    {r.tags.length > 2 && <span className="font-semibold text-[var(--faint)]">+{r.tags.length - 2}</span>}
                    <span>· اتستخدم {r.uses} مرة</span>
                    <span>· {r.edited}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => doCopy(r)}
                    aria-label={`نسخ رد ${r.title}`}
                    className={`copy-cta mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] px-5 text-[15px] font-bold ${copied === r.title ? "copy-cta-done" : ""}`}
                  >
                    {copied === r.title
                      ? <><Check size={17} strokeWidth={2.2} aria-hidden="true" className="animate-copy-pop" /> اتنسخ</>
                      : <><Copy size={16} strokeWidth={1.75} aria-hidden="true" /> نسخ الرد</>}
                  </button>
                </article>
              ))}
              {shown.length === 0 && (
                <p className="rounded-[var(--r-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-10 text-center text-[var(--dim)]">
                  مفيش ردود مطابقة لبحثك في المعاينة.
                </p>
              )}
            </div>
          </section>

          {/* مجلد ذكي بحد متدرج */}
          <section aria-label="مجلد ذكي" className="mt-8">
            <div className="smart-folder-bar flex items-center gap-3 rounded-[26px] px-[18px] py-[14px]">
              <span className="folder-bar-icon" aria-hidden="true"><Sparkles size={24} strokeWidth={1.75} /></span>
              <h2 className="folder-bar-title">غير مستخدمة من مدة</h2>
              <span className="folder-bar-count">مجلد ذكي ✦</span>
              <span className="ms-auto text-[13px] font-semibold text-[var(--dim)]">بيتحدث تلقائيًا حسب الشروط</span>
            </div>
          </section>

          <p className="mt-10 flex items-center gap-2 text-[13px] text-[var(--faint)]">
            <Heart size={14} strokeWidth={1.75} aria-hidden="true" />
            دي صفحة معاينة للهوية البصرية الجديدة — البيانات تجريبية بنفس شكل بياناتك، ومفيش أي حاجة هنا بتتخزن أو بتتغير في مكتبتك.
          </p>
        </main>
      </div>

      {/* التنقل السفلي الزجاجي — موبايل */}
      <nav className="bottom-nav fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around rounded-[24px] px-2 py-1.5 lg:hidden" aria-label="التنقل السفلي (معاينة)">
        {NAV.slice(0, 4).map((n, i) => (
          <button key={n.key} type="button" aria-current={i === 0 ? "page" : undefined} className="flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[16px]" style={i === 0 ? { color: "var(--accent)", background: "var(--accent-soft)" } : { color: "var(--dim)" }}>
            <n.icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[12px] font-bold">{n.label}</span>
          </button>
        ))}
        <button type="button" className="flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[var(--dim)]">
          <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-[12px] font-bold">القائمة</span>
        </button>
      </nav>

      {/* محرر كلوحة جانبية زجاجية — عينة شكلية */}
      {editorOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)]" role="dialog" aria-modal="true" aria-label="محرر الرد (معاينة)">
          <button type="button" aria-label="إغلاق المحرر" onClick={() => setEditorOpen(false)} className="absolute inset-0 h-full w-full bg-[var(--scrim)]" />
          <aside className="glass-panel animate-sheet absolute inset-y-0 end-0 flex w-[min(430px,94vw)] flex-col p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">تعديل الرد</h2>
              <span className="ms-auto flex items-center gap-1.5 text-[12px] font-semibold text-[var(--success)]">
                <Check size={14} strokeWidth={2} aria-hidden="true" /> اتحفظ تلقائيًا
              </span>
              <button type="button" aria-label="إغلاق" onClick={() => setEditorOpen(false)} className="lux-btn rounded-full p-2 text-[var(--dim)]">
                <X size={17} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <label className="mt-5 block text-[13px] font-bold text-[var(--dim)]" htmlFor="pv-title">العنوان</label>
            <input id="pv-title" defaultValue="السلام عليكم — ولد" className="mt-1.5 w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]" />
            <label className="mt-4 block text-[13px] font-bold text-[var(--dim)]" htmlFor="pv-body">نص الرد</label>
            <textarea id="pv-body" rows={7} defaultValue={REPLIES[0]?.body} className="mt-1.5 w-full resize-none rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] leading-8 outline-none focus:border-[var(--accent)]" />
            <p className="mt-2 text-[12px] text-[var(--faint)]">بيتحفظ تلقائيًا وانت بتكتب — دي معاينة شكلية للمحرر في الهوية الجديدة.</p>
            <button type="button" onClick={() => setEditorOpen(false)} className="btn-lux mt-auto w-full rounded-full py-3 text-[15px] font-bold">حفظ الرد</button>
          </aside>
        </div>
      )}

      {/* توست زجاجي */}
      {toast && (
        <div role="status" className="glass animate-pop fixed bottom-24 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold lg:bottom-8">
          <Check size={16} strokeWidth={2.2} aria-hidden="true" className="text-[var(--success)]" />
          {toast}
        </div>
      )}
    </div>
  );
}
