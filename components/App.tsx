import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal, flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "./safe-area";
import { FIELDS } from "./fields.generated";
import { api, type ApiResponse } from "./api";
import { PreviewPage } from "./Preview";
import {
AlarmClock,
Archive,
ArrowDown,
ArrowUp,
ArrowUpDown,
Atom,
Award,
Baby,
Backpack,
BadgePercent,
Banknote,
Bell,
BellRing,
Bold,
BookA,
BookOpenText,
Bookmark,
Braces,
Briefcase,
Calculator,
CalendarCheck,
CalendarDays,
Camera,
Car,
Cat,
ChartLine,
Check,
ChevronDown,
ChevronLeft,
ChevronRight,
CircleAlert,
CircleCheck,
CircleDollarSign,
CircleQuestionMark,
ClipboardList,
Clock,
Coffee,
Coins,
Command,
Compass,
Computer,
Copy,
CopyPlus,
CornerDownLeft,
CreditCard,
Crown,
Download,
Dumbbell,
Earth,
Eraser,
Eye,
EyeOff,
FileCheck,
FileText,
Flag,
Flame,
FlaskConical,
Flower2,
Folder,
FolderHeart,
FolderInput,
FolderOpen,
FolderPlus,
FoldVertical,
Gamepad2,
Gem,
Gift,
Globe,
GraduationCap,
GripVertical,
HandCoins,
HandHeart,
Headphones,
Headset,
Heart,
HeartHandshake,
HeartPulse,
History,
Hourglass,
House,
Inbox,
Info,
Italic,
KeyRound,
Keyboard,
Landmark,
Languages,
Laptop,
Layers,
Leaf,
Library,
LifeBuoy,
Lightbulb,
Link2,
List,
ListOrdered,
Lock,
LockKeyhole,
LogOut,
Mail,
MapPin,
Medal,
Megaphone,
Menu,
MessageCircle,
MessagesSquare,
MessageSquareHeart,
Mic,
Monitor,
MonitorSmartphone,
Moon,
NotebookPen,
Palette,
Pipette,
PanelRightClose,
PanelRightOpen,
Paperclip,
PartyPopper,
PencilLine,
Phone,
PiggyBank,
Pin,
Plane,
Plus,
Presentation,
Printer,
Puzzle,
MoreHorizontal,
QrCode,
Quote,
Receipt,
Redo2,
RefreshCw,
Repeat,
RotateCcw,
Rocket,
Ruler,
Scale,
School,
ScrollText,
Search,
Send,
Settings,
Shapes,
Share2,
ShieldCheck,
ShoppingBag,
Sigma,
SlidersHorizontal,
Smartphone,
Sparkle,
Sparkles,
SquarePen,
Stamp,
Star,
Stethoscope,
Store,
Sun,
Tablet,
Tag,
Target,
TestTube,
ThumbsUp,
Timer,
Trash2,
TrendingDown,
Trophy,
Tv,
Umbrella,
Underline,
Undo2,
UnfoldVertical,
Upload,
User,
Users,
Video,
Wallet,
WandSparkles,
Wifi,
WifiOff,
Wrench,
X,
Zap,
type LucideIcon,
} from "lucide-react";

/* Form inputs take their limits (maxLength, min, required, …) from
   the server actions' own request schemas, so the page and the
   server can never disagree about what a field accepts. */

type Shortcut = ApiResponse<typeof api, "listShortcuts">["shortcuts"][number];

/* The reply-source choices in the editor: the services' own
   English names, verbatim — the same fixed list the server
   validates against. Empty string = no source recorded. (The
   "Text Blaze" entry is only a source label here; the removed
   extension/sidebar item stays removed.) */
const REPLY_SOURCES = ["Chatwoot", "Text Blaze", "Google Sheets", "Google Docs"] as const;
type FolderRowT = ApiResponse<typeof api, "listFolders">["folders"][number];
type SmartFolderT = ApiResponse<typeof api, "listSmartFolders">["smartFolders"][number];
type User = NonNullable<ApiResponse<typeof api, "me">["user"]>;

/* One placement snapshot of the whole tree — what undo/redo restores
   and what every drag & drop move is computed from. */
type TreeSnapshot = {
  folders: Array<{ id: number; parentId: number | null; sortOrder: number }>;
  shortcuts: Array<{
    id: number;
    folderId: number | null;
    category: string;
    sortOrder: number;
  }>;
};

const KNOWN_CATEGORIES = [
  "ترحيب",
  "مميزات وأسئلة",
  "أسعار",
  "بكالوريا",
  "دفع",
  "فودافون كاش",
  "دعم فني",
  "مدرسين",
  "مواعيد",
  "قواعد",
  "معلومات عامة",
  "عام",
];

type ViewMode = "default" | "favorites" | "most" | "least" | "recent" | "used" | "unused" | "history" | "trash";

/* How dense the reply list is. Compact is the working default — one
   reply per row, copy always visible — comfortable is the classic
   card, grid tiles comfortable cards for browsing. The choice
   persists on this device. */
type ListDensity = "compact" | "comfortable" | "grid";

/* How a folder's contents are ordered in the folder view: manual is
   the user's own drag order (sortOrder), the rest are one-tap
   re-readings of the same rows — name, last modified, most used.
   The choice persists on this device. */
type FolderSort = "manual" | "name" | "updated" | "usage";
const FOLDER_SORTS: Array<{ key: FolderSort; label: string }> = [
  { key: "manual", label: "يدوي — ترتيبك بالسحب" },
  { key: "name", label: "الاسم" },
  { key: "updated", label: "تاريخ التعديل" },
  { key: "usage", label: "الأكثر استخداماً" },
];

const TOKEN_KEY = "is-session-token";
/* The login identifier (email or mobile) is kept on this device after
   a successful sign-in, so the login form comes back already filled —
   the user never re-types which account is his. Only the identifier
   is stored, never the password (the browser's own password manager
   may offer that separately via the form's autocomplete). */
const SAVED_ID_KEY = "is-saved-login-id";

/* ---------- icons (Lucide) ---------- */
const I = {
  copy: Copy,
  check: Check,
  pin: Pin,
  search: Search,
  plus: Plus,
  download: Download,
  upload: Upload,
  trash: Trash2,
  edit: SquarePen,
  x: X,
  zap: Zap,
  keyboard: Keyboard,
  chevron: ChevronDown,
  file: FileText,
  dup: CopyPlus,
  moon: Moon,
  sun: Sun,
  flame: Flame,
  clock: Clock,
  logout: LogOut,
  user: User,
  phone: Phone,
  lock: Lock,
  eye: Eye,
  eyeOff: EyeOff,
  shield: ShieldCheck,
  layers: Layers,
  puzzle: Puzzle,
  devices: MonitorSmartphone,
  link: Link2,
  refresh: RefreshCw,
  history: History,
  sparkles: Sparkles,
  mail: Mail,
  command: Command,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  enter: CornerDownLeft,
  circleCheck: CircleCheck,
  home: House,
  menu: Menu,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  railClose: PanelRightClose,
  railOpen: PanelRightOpen,
  clipboard: ClipboardList,
  camera: Camera,
  wrench: Wrench,
  archive: Archive,
  star: Star,
  folder: FolderOpen,
  moveTo: FolderInput,
  bold: Bold,
  italic: Italic,
  underline: Underline,
  list: List,
  listOrdered: ListOrdered,
  braces: Braces,
  trendDown: TrendingDown,
  sliders: SlidersHorizontal,
  restore: RotateCcw,
  eraser: Eraser,
  hourglass: Hourglass,
  wand: WandSparkles,
  info: Info,
};

function Icon({
  d: Cmp,
  size = 18,
  strokeWidth = 1.75,
}: {
  d: LucideIcon;
  size?: number;
  strokeWidth?: number;
}) {
  return <Cmp size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

/* The «المصادر» section mark (v72 born, v81 developed at the
   owner's call — «جامد ومتحرك ومناسب ومعبّر»): a crafted emblem,
   not a generic link/folder glyph. A khatam star (the library)
   sits at the centre; around it an orbit ring carries four
   satellite points at the cardinal directions — the four sources
   gathered around one centre. The satellites breathe in sequence
   (a slow pulse travelling around the ring, source after source
   flowing in), the orbit ring turns a quarter-turn with a spring
   when the section opens, and the star answers with its own
   quarter-turn — the whole mark is alive but calm. The heart
   rides the chosen accent like everything else on the site;
   motion lives in tokens.css (.sources-glyph), geometry here. */
function SourcesGlyph({ size = 20, open = false }: { size?: number; open?: boolean }) {
  return (
    <span className="sources-glyph" data-open={open} aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        focusable="false"
        style={{ display: "block", flex: "none" }}
      >
        <g className="sources-glyph-orbit">
          <circle
            cx="12"
            cy="12"
            r="9.6"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity="0.45"
            strokeDasharray="4.5 2.6"
            strokeLinecap="round"
          />
          <circle className="sources-glyph-dot" style={{ animationDelay: "0ms" }} cx="12" cy="1.7" r="1.05" fill="currentColor" />
          <circle className="sources-glyph-dot" style={{ animationDelay: "700ms" }} cx="22.3" cy="12" r="1.05" fill="currentColor" />
          <circle className="sources-glyph-dot" style={{ animationDelay: "1400ms" }} cx="12" cy="22.3" r="1.05" fill="currentColor" />
          <circle className="sources-glyph-dot" style={{ animationDelay: "2100ms" }} cx="1.7" cy="12" r="1.05" fill="currentColor" />
        </g>
        <g className="sources-glyph-star" stroke="currentColor" strokeWidth="1.25">
          <rect x="7.4" y="7.4" width="9.2" height="9.2" />
          <rect x="7.4" y="7.4" width="9.2" height="9.2" transform="rotate(45 12 12)" />
        </g>
        <circle cx="12" cy="12" r="1.5" fill="var(--accent)" />
      </svg>
    </span>
  );
}

/* Escape dismisses any floating layer — the keyboard twin of
   click-outside. Every modal and sheet wires its own close (or its
   unsaved-changes guard) through this one hook, so dismissal
   behaves identically everywhere. */
function useEscapeClose(onEscape: () => void) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/* Click-outside dismissal for the header/filter popovers: a press
   anywhere outside the popover's root closes it. Escape is wired
   separately through useEscapeClose, as everywhere else. */
function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      const root = ref.current;
      if (root && !root.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ref, active, close]);
}

/* Quiet relative date for card meta rows: today / yesterday /
   "N days ago" inside a month, the plain locale date beyond it.
   Display only — the stored instant never changes. */
function relDateLabel(iso: string | number | Date, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days <= 0) return lang === "en" ? "Today" : "اليوم";
  if (days === 1) return lang === "en" ? "Yesterday" : "أمس";
  if (days < 30) return lang === "en" ? `${days} days ago` : `منذ ${days} يوم`;
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG", { day: "numeric", month: "short" });
}

/* Each folder gets its own soft hue from a small harmonious,
   low-saturation palette, hashed from its name so the same folder
   always wears the same colour (classes .fhue-0…5 in tokens.css). */
function folderHueClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `fhue-${h % 6}`;
}

/* The folder icon-colour palette the owner picks from in the
   folder settings / icon picker: each folder may carry its OWN
   chosen colour for its icon and tile, stored server-side per
   folder. Keys mirror FOLDER_COLOR_KEYS in the server actions;
   the .fcol-<key> classes in tokens.css set the same --fhue the
   automatic name-hash hue uses, so a chosen colour flows through
   every tile that already reads --fhue. On top of the twenty
   named colours the picker offers a free colour wheel: any hex
   the owner picks is stored verbatim and applied as an inline
   --fhue (folderColorStyle) — literally any colour, no list.
   Null = automatic (the name-hash hue above). */
const FOLDER_COLOR_OPTIONS: Array<{ key: string; ar: string; en: string; swatch: string }> = [
  { key: "royal", ar: "أزرق ملكي", en: "Royal blue", swatch: "#1668C4" },
  { key: "sky", ar: "سماوي", en: "Sky", swatch: "#0284C7" },
  { key: "cyan", ar: "فيروزي", en: "Cyan", swatch: "#0891B2" },
  { key: "navy", ar: "كحلي", en: "Navy", swatch: "#1E40AF" },
  { key: "teal", ar: "مخضر", en: "Teal", swatch: "#0F766E" },
  { key: "emerald", ar: "زمردي", en: "Emerald", swatch: "#059669" },
  { key: "green", ar: "أخضر", en: "Green", swatch: "#15803D" },
  { key: "lime", ar: "ليموني", en: "Lime", swatch: "#65A30D" },
  { key: "indigo", ar: "نيلي", en: "Indigo", swatch: "#4F46E5" },
  { key: "violet", ar: "بنفسجي", en: "Violet", swatch: "#7C3AED" },
  { key: "purple", ar: "أرجواني", en: "Purple", swatch: "#9333EA" },
  { key: "fuchsia", ar: "فوشيا", en: "Fuchsia", swatch: "#C026D3" },
  { key: "rose", ar: "وردي", en: "Rose", swatch: "#E11D63" },
  { key: "pink", ar: "زهري", en: "Pink", swatch: "#EC4899" },
  { key: "red", ar: "أحمر", en: "Red", swatch: "#DC2626" },
  { key: "orange", ar: "برتقالي", en: "Orange", swatch: "#EA580C" },
  { key: "amber", ar: "كهرماني", en: "Amber", swatch: "#B45309" },
  { key: "gold", ar: "ذهبي", en: "Gold", swatch: "#CA8A04" },
  { key: "brown", ar: "بني", en: "Brown", swatch: "#92400E" },
  { key: "slate", ar: "رمادي", en: "Slate", swatch: "#64748B" },
];
const FOLDER_COLOR_KEYS_CLIENT = new Set(FOLDER_COLOR_OPTIONS.map((o) => o.key));

/* A custom colour is stored as its hex string ("#rrggbb") — the
   one shape that is neither a palette key nor «automatic». */
const CUSTOM_COLOR_RE_CLIENT = /^#[0-9a-fA-F]{6}$/;
function isCustomColor(v: string | null | undefined): v is string {
  return typeof v === "string" && CUSTOM_COLOR_RE_CLIENT.test(v);
}

/* The colour class a folder's tiles wear: its chosen colour when
   it has one, otherwise the automatic name-hash hue. A custom hex
   has no class of its own — folderColorStyle below carries it. */
function folderColorClass(folder: { name: string; iconColor?: string | null }): string {
  return folder.iconColor && FOLDER_COLOR_KEYS_CLIENT.has(folder.iconColor)
    ? `fcol-${folder.iconColor}`
    : folderHueClass(folder.name);
}

/* The inline --fhue for a folder wearing a CUSTOM hex colour —
   spread onto the same tiles that take folderColorClass. Named
   colours need nothing here (their .fcol class sets --fhue). */
function folderColorStyle(folder: { iconColor?: string | null }): React.CSSProperties | undefined {
  return isCustomColor(folder.iconColor)
    ? ({ "--fhue": folder.iconColor } as React.CSSProperties)
    : undefined;
}

/* Dialog focus care — one hook for every modal and sheet: when a
   dialog opens, focus lands inside it (its first field when it has
   one, otherwise its first control), Tab cycles within it instead
   of wandering the page behind, and closing returns focus to the
   control that opened it. If focus is already inside on mount —
   an autoFocus field got there first — it is left exactly where
   it is. This is standard dialog behaviour, not a site shortcut:
   no key triggers any action, Tab/Shift+Tab just stay home. */
function useDialogFocus(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const prev = document.activeElement as HTMLElement | null;
    if (!prev || !root.contains(prev)) {
      const field = root.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled])",
      );
      const first = root.querySelector<HTMLElement>(
        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      );
      (field ?? first)?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [ref, active]);
}

/* One neutral glyph per category. No colour coding — the brand has a
   single gold accent, reserved for primary actions and active states. */
const CATEGORY_META: Record<string, { icon: LucideIcon }> = {
  "ترحيب": { icon: HeartHandshake },
  "مميزات وأسئلة": { icon: WandSparkles },
  "أسعار": { icon: BadgePercent },
  "بكالوريا": { icon: GraduationCap },
  "دفع": { icon: Wallet },
  "فودافون كاش": { icon: Smartphone },
  "دعم فني": { icon: LifeBuoy },
  "مدرسين": { icon: Users },
  "مواعيد": { icon: CalendarDays },
  "قواعد": { icon: Landmark },
  "معلومات عامة": { icon: Info },
  "عام": { icon: MessagesSquare },
};
const CATEGORY_FALLBACK = { icon: BookOpenText };
function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_FALLBACK;
}

/* ---------- folder icons ----------
   Every folder can carry its own chosen icon, picked from this one
   catalogue when the folder is created (main or subfolder) and
   changeable later from the folder's settings. The key is what the
   server stores; null means "automatic" — the icon that matches the
   folder's name/subject (CATEGORY_META), then the plain folder
   glyph. The keys mirror FOLDER_ICON_KEYS in the server actions. */
const FOLDER_ICON_OPTIONS: Array<{ key: string; icon: LucideIcon; ar: string; en: string }> = [
  { key: "folder", icon: Folder, ar: "مجلد", en: "Folder" },
  { key: "star", icon: Star, ar: "نجمة", en: "Star" },
  { key: "heart", icon: Heart, ar: "ترحيب", en: "Welcome" },
  { key: "messages", icon: MessagesSquare, ar: "محادثات", en: "Chats" },
  { key: "sparkles", icon: WandSparkles, ar: "مميزات", en: "Features" },
  { key: "percent", icon: BadgePercent, ar: "أسعار وخصومات", en: "Prices & offers" },
  { key: "graduation", icon: GraduationCap, ar: "دراسة", en: "Study" },
  { key: "wallet", icon: Wallet, ar: "دفع ومحفظة", en: "Payments" },
  { key: "smartphone", icon: Smartphone, ar: "موبايل", en: "Mobile" },
  { key: "lifebuoy", icon: LifeBuoy, ar: "دعم فني", en: "Support" },
  { key: "users", icon: Users, ar: "أشخاص", en: "People" },
  { key: "calendar", icon: CalendarDays, ar: "مواعيد", en: "Schedule" },
  { key: "landmark", icon: Landmark, ar: "قواعد رسمية", en: "Official" },
  { key: "info", icon: Info, ar: "معلومات", en: "Info" },
  { key: "book", icon: BookOpenText, ar: "كتاب", en: "Book" },
  { key: "clipboard", icon: ClipboardList, ar: "قائمة", en: "Checklist" },
  { key: "archive", icon: Archive, ar: "أرشيف", en: "Archive" },
  { key: "zap", icon: Zap, ar: "سريع", en: "Quick" },
  { key: "shield", icon: ShieldCheck, ar: "حماية", en: "Shield" },
  { key: "clock", icon: Clock, ar: "وقت", en: "Time" },
  { key: "phone", icon: Phone, ar: "اتصال", en: "Calls" },
  { key: "mail", icon: Mail, ar: "رسائل", en: "Mail" },
  { key: "globe", icon: Globe, ar: "عام", en: "General" },
  { key: "flame", icon: Flame, ar: "مهم", en: "Hot" },
  { key: "layers", icon: Layers, ar: "أقسام", en: "Sections" },
  { key: "file", icon: FileText, ar: "مستندات", en: "Documents" },
  { key: "handshake", icon: HeartHandshake, ar: "اتفاق", en: "Deal" },
  { key: "home", icon: House, ar: "رئيسي", en: "Home" },
  { key: "message-circle", icon: MessageCircle, ar: "رسالة", en: "Message" },
  { key: "message-heart", icon: MessageSquareHeart, ar: "رسالة ودودة", en: "Friendly message" },
  { key: "send", icon: Send, ar: "إرسال", en: "Send" },
  { key: "inbox", icon: Inbox, ar: "وارد", en: "Inbox" },
  { key: "bell", icon: Bell, ar: "تنبيه", en: "Bell" },
  { key: "bell-ring", icon: BellRing, ar: "إشعارات", en: "Notifications" },
  { key: "megaphone", icon: Megaphone, ar: "إعلان", en: "Announcement" },
  { key: "headset", icon: Headset, ar: "سماعة دعم", en: "Headset" },
  { key: "headphones", icon: Headphones, ar: "سماعات", en: "Headphones" },
  { key: "mic", icon: Mic, ar: "صوت", en: "Voice" },
  { key: "video", icon: Video, ar: "فيديو", en: "Video" },
  { key: "share", icon: Share2, ar: "مشاركة", en: "Share" },
  { key: "quote", icon: Quote, ar: "اقتباس", en: "Quote" },
  { key: "thumbs-up", icon: ThumbsUp, ar: "تمام", en: "Approved" },
  { key: "question", icon: CircleQuestionMark, ar: "أسئلة", en: "Questions" },
  { key: "banknote", icon: Banknote, ar: "نقدي", en: "Cash" },
  { key: "coins", icon: Coins, ar: "عملات", en: "Coins" },
  { key: "piggy", icon: PiggyBank, ar: "توفير", en: "Savings" },
  { key: "credit-card", icon: CreditCard, ar: "بطاقة", en: "Card" },
  { key: "receipt", icon: Receipt, ar: "إيصال", en: "Receipt" },
  { key: "hand-coins", icon: HandCoins, ar: "تحصيل", en: "Collect" },
  { key: "dollar", icon: CircleDollarSign, ar: "مبلغ", en: "Amount" },
  { key: "qr", icon: QrCode, ar: "كود دفع", en: "QR code" },
  { key: "calculator", icon: Calculator, ar: "حسابات", en: "Calculator" },
  { key: "chart", icon: ChartLine, ar: "تقارير", en: "Reports" },
  { key: "backpack", icon: Backpack, ar: "طالب", en: "Student" },
  { key: "school", icon: School, ar: "مدرسة", en: "School" },
  { key: "library", icon: Library, ar: "مكتبة", en: "Library" },
  { key: "notebook", icon: NotebookPen, ar: "ملاحظات", en: "Notes" },
  { key: "pencil", icon: PencilLine, ar: "كتابة", en: "Writing" },
  { key: "ruler", icon: Ruler, ar: "هندسة", en: "Geometry" },
  { key: "atom", icon: Atom, ar: "فيزياء", en: "Physics" },
  { key: "flask", icon: FlaskConical, ar: "كيمياء", en: "Chemistry" },
  { key: "sigma", icon: Sigma, ar: "رياضيات", en: "Maths" },
  { key: "languages", icon: Languages, ar: "لغات", en: "Languages" },
  { key: "book-a", icon: BookA, ar: "لغة عربية", en: "Arabic" },
  { key: "test-tube", icon: TestTube, ar: "تجارب", en: "Experiments" },
  { key: "presentation", icon: Presentation, ar: "شرح", en: "Lessons" },
  { key: "award", icon: Award, ar: "جائزة", en: "Award" },
  { key: "trophy", icon: Trophy, ar: "تفوق", en: "Excellence" },
  { key: "medal", icon: Medal, ar: "تكريم", en: "Honours" },
  { key: "target", icon: Target, ar: "هدف", en: "Goal" },
  { key: "lightbulb", icon: Lightbulb, ar: "أفكار", en: "Ideas" },
  { key: "bookmark", icon: Bookmark, ar: "محفوظ", en: "Saved" },
  { key: "briefcase", icon: Briefcase, ar: "عمل", en: "Work" },
  { key: "settings", icon: Settings, ar: "إعدادات", en: "Settings" },
  { key: "wrench", icon: Wrench, ar: "صيانة", en: "Maintenance" },
  { key: "flag", icon: Flag, ar: "علامة", en: "Flag" },
  { key: "pin", icon: Pin, ar: "مثبت", en: "Pinned" },
  { key: "paperclip", icon: Paperclip, ar: "مرفقات", en: "Attachments" },
  { key: "printer", icon: Printer, ar: "طباعة", en: "Print" },
  { key: "folder-open", icon: FolderOpen, ar: "مجلد مفتوح", en: "Open folder" },
  { key: "folder-heart", icon: FolderHeart, ar: "مجلد مفضل", en: "Favourite folder" },
  { key: "file-check", icon: FileCheck, ar: "تم", en: "Done file" },
  { key: "scroll", icon: ScrollText, ar: "نصوص", en: "Texts" },
  { key: "stamp", icon: Stamp, ar: "ختم", en: "Stamp" },
  { key: "key", icon: KeyRound, ar: "مفتاح", en: "Key" },
  { key: "lock", icon: LockKeyhole, ar: "خاص", en: "Private" },
  { key: "laptop", icon: Laptop, ar: "لابتوب", en: "Laptop" },
  { key: "monitor", icon: Monitor, ar: "شاشة", en: "Screen" },
  { key: "tablet", icon: Tablet, ar: "تابلت", en: "Tablet" },
  { key: "tv", icon: Tv, ar: "بث", en: "Broadcast" },
  { key: "camera", icon: Camera, ar: "صور", en: "Photos" },
  { key: "wifi", icon: Wifi, ar: "إنترنت", en: "Internet" },
  { key: "computer", icon: Computer, ar: "كمبيوتر", en: "Computer" },
  { key: "coffee", icon: Coffee, ar: "استراحة", en: "Break" },
  { key: "gift", icon: Gift, ar: "هدية", en: "Gift" },
  { key: "crown", icon: Crown, ar: "مميز", en: "Premium" },
  { key: "gem", icon: Gem, ar: "قيّم", en: "Valuable" },
  { key: "rocket", icon: Rocket, ar: "انطلاق", en: "Launch" },
  { key: "plane", icon: Plane, ar: "سفر", en: "Travel" },
  { key: "car", icon: Car, ar: "تنقل", en: "Transport" },
  { key: "map-pin", icon: MapPin, ar: "مكان", en: "Place" },
  { key: "compass", icon: Compass, ar: "اتجاه", en: "Direction" },
  { key: "sun", icon: Sun, ar: "صباحي", en: "Morning" },
  { key: "moon", icon: Moon, ar: "مسائي", en: "Evening" },
  { key: "leaf", icon: Leaf, ar: "طبيعة", en: "Nature" },
  { key: "flower", icon: Flower2, ar: "ورد", en: "Flowers" },
  { key: "cat", icon: Cat, ar: "لطيف", en: "Cute" },
  { key: "gamepad", icon: Gamepad2, ar: "ترفيه", en: "Fun" },
  { key: "dumbbell", icon: Dumbbell, ar: "رياضة", en: "Sports" },
  { key: "stethoscope", icon: Stethoscope, ar: "طبي", en: "Medical" },
  { key: "baby", icon: Baby, ar: "أطفال", en: "Kids" },
  { key: "store", icon: Store, ar: "متجر", en: "Store" },
  { key: "shopping", icon: ShoppingBag, ar: "شراء", en: "Shopping" },
  { key: "umbrella", icon: Umbrella, ar: "احتياطي", en: "Backup plan" },
  { key: "hourglass", icon: Hourglass, ar: "انتظار", en: "Waiting" },
  { key: "timer", icon: Timer, ar: "مؤقت", en: "Timer" },
  { key: "alarm", icon: AlarmClock, ar: "منبه", en: "Reminder" },
  { key: "calendar-check", icon: CalendarCheck, ar: "تم الحجز", en: "Booked" },
  { key: "repeat", icon: Repeat, ar: "متكرر", en: "Recurring" },
  { key: "heart-pulse", icon: HeartPulse, ar: "متابعة", en: "Follow-up" },
  { key: "hand-heart", icon: HandHeart, ar: "رعاية", en: "Care" },
  { key: "party", icon: PartyPopper, ar: "احتفال", en: "Celebration" },
  { key: "sparkle", icon: Sparkle, ar: "جديد", en: "New" },
  { key: "palette", icon: Palette, ar: "تصميم", en: "Design" },
  { key: "shapes", icon: Shapes, ar: "متنوع", en: "Variety" },
  { key: "scale", icon: Scale, ar: "عدالة", en: "Fairness" },
  { key: "earth", icon: Earth, ar: "عالمي", en: "Worldwide" },
];
const FOLDER_ICON_BY_KEY = new Map(FOLDER_ICON_OPTIONS.map((o) => [o.key, o.icon]));

/* Arabic-aware subject rules for automatic folder icons. The
   folder's name is folded with the same normaliser the search
   uses (diacritics dropped, ة/ه, ى/ي and إ/ا folded together),
   then the first rule whose keyword appears anywhere in the name
   wins — so «الترحيب بالطلاب» still reads as a greeting folder
   and «أسعار البكالوريا» as a prices folder, instead of both
   falling back to the plain folder glyph. Rules run
   most-specific first: a brand or a school subject outranks the
   generic money/time/support words it may also contain. */
const FOLDER_ICON_RULES: Array<{ keys: string[]; icon: LucideIcon }> = [
  { keys: ["فودافون", "vodafone"], icon: Smartphone },
  { keys: ["ترحيب", "اهلا", "سلام", "welcome"], icon: HeartHandshake },
  { keys: ["فيزيا", "physics"], icon: Atom },
  { keys: ["كيميا", "chemistry"], icon: FlaskConical },
  { keys: ["رياضيات", "maths"], icon: Sigma },
  { keys: ["عربي", "arabic"], icon: BookA },
  { keys: ["لغات", "انجليزي", "english", "language"], icon: Languages },
  { keys: ["بكالوريا", "ثانوي"], icon: GraduationCap },
  { keys: ["مدرس", "معلم", "teacher"], icon: Users },
  { keys: ["طالب", "طلاب", "تلميذ", "student"], icon: Backpack },
  { keys: ["ابتدائي", "اعدادي", "مدرسه", "school"], icon: School },
  { keys: ["امتحان", "اختبار", "exam"], icon: ClipboardList },
  { keys: ["نتيجه", "نتائج", "result"], icon: Trophy },
  { keys: ["قواعد", "شروط", "سياسه", "rules"], icon: ScrollText },
  { keys: ["اسعار", "سعر", "اشتراك", "price", "pricing"], icon: BadgePercent },
  { keys: ["خصم", "عروض", "offer", "discount"], icon: BadgePercent },
  { keys: ["دفع", "سداد", "تحويل", "كاش", "محفظه", "payment", "cash"], icon: Wallet },
  { keys: ["مواعيد", "موعد", "جدول", "حجز", "schedule", "booking"], icon: CalendarDays },
  { keys: ["دعم", "مشكله", "مشاكل", "فني", "support"], icon: LifeBuoy },
  { keys: ["اسئله", "استفسار", "question"], icon: CircleQuestionMark },
  { keys: ["مميزات", "مزايا", "features"], icon: WandSparkles },
  { keys: ["معلومات", "معلومه", "info"], icon: Info },
  { keys: ["رسائل", "محادثات", "شات", "chat", "message"], icon: MessagesSquare },
  { keys: ["مستند", "ملفات", "ملف", "اوراق", "document", "file"], icon: FileText },
  { keys: ["ارشيف", "archive"], icon: Archive },
  { keys: ["متابعه", "follow"], icon: HeartPulse },
  { keys: ["شكر", "thanks"], icon: HandHeart },
  { keys: ["هديه", "هدايا", "مكافاه", "gift"], icon: Gift },
  { keys: ["تنبيه", "اشعار", "notification"], icon: Bell },
];

/* Every automatic icon a name could take, best first: the curated
   exact-name match, then each keyword rule that hits. */
function autoIconCandidates(name: string): LucideIcon[] {
  const out: LucideIcon[] = [];
  const exact = CATEGORY_META[name]?.icon;
  if (exact) out.push(exact);
  const norm = normalizeSearchText(name);
  if (norm) {
    for (const rule of FOLDER_ICON_RULES) {
      if (rule.keys.some((k) => norm.includes(normalizeSearchText(k))) && !out.includes(rule.icon)) {
        out.push(rule.icon);
      }
    }
  }
  return out;
}

/* The icon a folder actually shows: its own chosen icon first,
   then the subject icons its name matches. `avoid` is the icon
   the folder's PARENT shows: an automatic icon never repeats
   the parent's shape — the next matching subject wins, and if
   every match is the parent's shape, the open-folder variant
   stands in so parent and child still read differently. A
   hand-picked icon is the owner's own choice and always wins. */
function folderIconOf(
  folder: { name: string; icon?: string | null },
  avoid?: LucideIcon,
): LucideIcon {
  if (folder.icon) {
    const chosen = FOLDER_ICON_BY_KEY.get(folder.icon);
    if (chosen) return chosen;
  }
  for (const candidate of autoIconCandidates(folder.name)) {
    if (candidate !== avoid) return candidate;
  }
  return avoid === Folder ? FolderOpen : Folder;
}

/* ---------- source brand marks ----------
   Each source (the same fixed list as REPLY_SOURCES) carries a
   faithful recreation of the service's real logo, drawn as
   inline SVG in the brand's own shapes and colours — Chatwoot's
   blue speech bubble with its three white dots, Text Blaze's
   orange-red flame with its pale inner flame, Google Sheets'
   green document with the white table and its header row, and
   Google Docs' blue document with its white text lines — so a
   source reads as itself at a glance wherever it is shown: the
   sidebar «المصادر» section, the source's main folder, the
   folder source selector, and a reply's source in its details.
   No external assets; the geometry is drawn here. */
function SourceMark({ source, size = 18 }: { source: string; size?: number }) {
  const gradId = useId();
  if (source === "Chatwoot") {
    /* The real mark: a full, slightly squared speech bubble in
       Chatwoot blue (#1F93FF), tail sweeping down-left, three
       white dots across its middle. */
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
        <path
          fill="#1F93FF"
          d="M12 2.7c5.25 0 9.5 3.62 9.5 8.1s-4.25 8.1-9.5 8.1c-1.05 0-2.06-.15-3-.42L3.35 21.3a.55.55 0 0 1-.9-.6l.83-3.02A8.02 8.02 0 0 1 2.5 10.8c0-4.48 4.25-8.1 9.5-8.1Z"
        />
        <circle cx="7.4" cy="10.8" r="1.45" fill="#fff" />
        <circle cx="12" cy="10.8" r="1.45" fill="#fff" />
        <circle cx="16.6" cy="10.8" r="1.45" fill="#fff" />
      </svg>
    );
  }
  if (source === "Text Blaze") {
    /* The real mark: a tall flame leaning into its tip, orange
       at the crown burning down to red at the base, with the
       pale inner flame nested inside it. */
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#FF9E00" />
            <stop offset="55%" stopColor="#FF6A00" />
            <stop offset="100%" stopColor="#FF3D2E" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${gradId})`}
          d="M13.1 1.9c.25 3.05 1.3 4.95 2.62 6.83 1.24 1.77 2.5 3.55 2.5 5.87a6.35 6.35 0 1 1-12.7 0c0-2.03.83-3.78 1.97-5.5.38 1.02 1.06 1.86 2.06 2.44-.28-2.35.32-4.62 1.5-6.6.47-.8 1.13-1.63 2.05-2.04Z"
        />
        <path
          fill="#FFD23F"
          d="M11.87 21.55a3.35 3.35 0 0 1-3.35-3.35c0-1.72 1.2-3.3 2.42-4.9l.93-1.24.93 1.24c1.22 1.6 2.42 3.18 2.42 4.9a3.35 3.35 0 0 1-3.35 3.35Z"
        />
      </svg>
    );
  }
  if (source === "Google Sheets" || source === "Google Docs") {
    /* The real marks: the Google document silhouette — tall
       page, folded top-right corner in the lighter tint — with
       Sheets' white table (filled header row, one column split)
       or Docs' three white lines, the last one short. */
    const sheets = source === "Google Sheets";
    const main = sheets ? "#34A853" : "#4285F4";
    const fold = sheets ? "#81C995" : "#8AB4F8";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
        <path fill={main} d="M7 2h7l4 4v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
        <path fill={fold} d="M14 2l4 4h-3a1 1 0 0 1-1-1V2Z" />
        {sheets ? (
          <g>
            <rect x="8.6" y="10.2" width="6.8" height="2.3" fill="#fff" />
            <g fill="none" stroke="#fff" strokeWidth="1.3">
              <rect x="8.6" y="10.2" width="6.8" height="6.9" rx="0.3" />
              <path d="M12 12.5v4.6M8.6 14.8h6.8" />
            </g>
          </g>
        ) : (
          <g stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8.8 10.7h6.4M8.8 13.9h6.4M8.8 17.1h4.2" />
          </g>
        )}
      </svg>
    );
  }
  return null;
}

/* A folder's glyph: only a source's MAIN folder wears the
   source's brand mark — the main folder IS the source, so the
   mark is its own suitable shape. Every other folder, sourced
   or not, shows the icon of its OWN subject (folderIconOf):
   a subfolder under Google Docs named «ترحيب» shows the
   greeting handshake, never the Docs document its parent
   wears. The folder's source stays visible as the small
   source label beside its name, not as its glyph. `avoidIcon`
   is the parent folder's glyph, forwarded to folderIconOf so
   an automatic icon never repeats the parent's shape. */
function FolderGlyph({
  folder,
  size = 18,
  avoidIcon,
}: {
  folder: {
    name: string;
    icon?: string | null;
    source?: string | null;
    isSourceMain?: boolean | null;
  };
  size?: number;
  avoidIcon?: LucideIcon;
}) {
  if (
    folder.isSourceMain &&
    folder.source &&
    (REPLY_SOURCES as readonly string[]).includes(folder.source)
  ) {
    return <SourceMark source={folder.source} size={size} />;
  }
  return <Icon d={folderIconOf(folder, avoidIcon)} size={size} />;
}

/* The «المصدر» control: a small menu that lists «مش محدد» plus
   the four sources, each with its REAL brand mark beside its
   name — never a plain-text list. Used for folders (picking a
   source applies at once: the server moves the folder under
   that source's main folder in the same call; «مش محدد» only
   clears the label) and for a reply's source in the editor
   (record-keeping only — nothing moves). Closes on outside
   click and on Escape, like every floating layer on the site. */
function FolderSourceControl({
  value,
  onPick,
  lang,
  variant = "field",
  busy = false,
  note,
  dropUp,
  ariaLabel: ariaLabelProp,
  menuLabel: menuLabelProp,
  tip: tipProp,
}: {
  value: string;
  onPick: (source: string) => void;
  lang: Lang;
  variant?: "field" | "chip";
  busy?: boolean;
  /* The menu's footnote. Undefined keeps the folder default (the
     «picking moves the folder» note); null hides it; a string
     replaces it. The reply editor passes null — a reply's source
     moves nothing. */
  note?: string | null;
  /* Menu direction. Undefined keeps the standing behaviour (the
     field variant opens upward, the chip downward); the reply
     editor passes false to open downward. */
  dropUp?: boolean;
  ariaLabel?: string;
  menuLabel?: string;
  tip?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, open, () => setOpen(false));
  useEscapeClose(() => setOpen(false));
  const current = (REPLY_SOURCES as readonly string[]).includes(value) ? value : "";
  const pick = (s: string) => {
    setOpen(false);
    if (s !== current) onPick(s);
  };
  const options: Array<{ value: string; label: string }> = [
    { value: "", label: lang === "en" ? "Not specified" : "مش محدد" },
    ...REPLY_SOURCES.map((s) => ({ value: s as string, label: s })),
  ];
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabelProp ?? (lang === "en" ? "Folder source" : "مصدر المجلد")}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-tip={tipProp ?? (lang === "en" ? "Where this folder belongs — picking a source moves it under that source's main folder" : "المجلد ده تابع لأنهي مصدر — اختيار مصدر بينقله تحت المجلد الرئيسي بتاعه")}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "chip"
            ? "lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-2 text-sm font-bold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-60"
            : "folder-field-btn lux-btn flex w-full items-center gap-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-start outline-none focus:border-[var(--accent)] disabled:opacity-60"
        }
      >
        {current ? (
          <SourceMark source={current} size={variant === "chip" ? 16 : 19} />
        ) : (
          <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--faint)]" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {variant === "chip" && (
            <span className="font-semibold text-[var(--faint)]">{lang === "en" ? "Source: " : "المصدر: "}</span>
          )}
          {current ? (
            <span dir="ltr" className="font-bold">{current}</span>
          ) : (
            <span className="font-bold">{lang === "en" ? "Not specified" : "مش محدد"}</span>
          )}
        </span>
        <span aria-hidden="true" className={`flex shrink-0 text-[var(--faint)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <Icon d={I.chevron} size={16} />
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={menuLabelProp ?? (lang === "en" ? "Choose the folder source" : "اختيار مصدر المجلد")}
          className={`animate-menu elev-pop absolute start-0 z-30 w-60 max-w-[80vw] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 ${(dropUp ?? variant !== "chip") ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          {options.map((o) => {
            const active = o.value === current;
            return (
              <button
                key={o.value || "none"}
                type="button"
                role="option"
                aria-selected={active}
                aria-label={o.value ? (lang === "en" ? `Source ${o.label}` : `المصدر ${o.label}`) : lang === "en" ? "No source" : "بدون مصدر"}
                onClick={() => pick(o.value)}
                className={`lux-btn flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-start text-sm font-bold hover:bg-[var(--surface-alt)] ${active ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : ""}`}
              >
                {o.value ? (
                  <SourceMark source={o.value} size={18} />
                ) : (
                  <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--faint)]" />
                )}
                <span className="min-w-0 flex-1 truncate" dir={o.value ? "ltr" : undefined}>{o.label}</span>
                {active && (
                  <span className="flex shrink-0 text-[var(--accent)]">
                    <Icon d={I.check} size={16} />
                  </span>
                )}
              </button>
            );
          })}
          {note !== null && (
            <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-medium leading-relaxed text-[var(--faint)]">
              {note ??
                (lang === "en"
                  ? "Picking a source moves this folder under that source's main folder right away."
                  : "اختيار مصدر بينقل المجلد ده تحت المجلد الرئيسي بتاع المصدر على طول.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- dashboard sections ---------- */
type Section = "home" | "account" | "privacy";

const SECTIONS: Array<{ key: Section; label: string; icon: LucideIcon; tip: string }> = [
  { key: "home", label: "الرئيسية", icon: House, tip: "الرئيسية — كل ردودك ومجلداتك والمفضلة في مكان واحد" },
  { key: "account", label: "حسابي", icon: User, tip: "حسابي — الاسم وكلمة المرور والجلسات" },
];

/* ---------- rich text ----------
   Reply bodies stay plain text (they paste into Chatwoot / WhatsApp), but
   the editor supports light formatting markers that the in-app preview
   renders: *عريض* and _مائل_ use WhatsApp's own markers, so they paste
   already formatted into WhatsApp/Chatwoot; __تحته خط__ is preview-only.
   "• " bullet lines and "1. " numbered lines complete the set. Dynamic placeholders like {الاسم} و{التاريخ} are
   inserted as tokens; the simulator fills {التاريخ} و{الوقت} live. */
const VARIABLES: Array<{ token: string; label: string; tip: string }> = [
  { token: "{الاسم}", label: "الاسم", tip: "مكان ديناميكي لاسم اللي بترد عليه" },
  { token: "{التاريخ}", label: "التاريخ", tip: "بيتملى تلقائياً بتاريخ النهاردة في المحاكي" },
  { token: "{الوقت}", label: "الوقت", tip: "بيتملى تلقائياً بالوقت الحالي في المحاكي" },
  { token: "{السنة الدراسية}", label: "السنة الدراسية", tip: "مكان ديناميكي للسنة الدراسية" },
  { token: "{رقم الموبايل}", label: "رقم الموبايل", tip: "مكان ديناميكي لرقم موبايل الطالب" },
];

function fillDynamic(text: string): string {
  const now = new Date();
  return text
    .replaceAll("{التاريخ}", now.toLocaleDateString("ar-EG"))
    .replaceAll(
      "{الوقت}",
      now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    );
}

/* Distinct {…} placeholders in a body, in first-appearance order. */
function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(/\{[^{}\n]+\}/g)) {
    const token = m[0];
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/* Time-aware greeting in the viewer's own local time — the dashboard
   greets the signed-in user by their real name, morning or evening. */
/* ---------- smart search ----------
   One matching engine for the home list and the command palette:
   Arabic-aware normalization (alef forms, teh marbuta, yeh, diacritics
   and tatweel all fold together, whitespace collapses), then a
   relevance score in the brief's order — exact title, title part,
   tags, folder name, body — with real usage as a tiebreak.
   Everything is computed over the already-loaded library, so results
   are instant even with thousands of replies. */
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTags(tags: string): string[] {
  return tags
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

type SearchableReply = {
  title: string;
  body: string;
  category: string;
  tags: string;
  usageCount: number;
  pinned: boolean;
};

/** -1 when the reply does not match at all; otherwise a score where
    title matches beat everything, per the product's ranking rules. */
function searchScore(s: SearchableReply, rawQuery: string): number {
  const q = normalizeSearchText(rawQuery);
  if (!q) return 0;
  const title = normalizeSearchText(s.title);
  const tags = normalizeSearchText(s.tags);
  const folder = normalizeSearchText(s.category);
  const body = normalizeSearchText(s.body);
  let score = -1;
  if (title === q) score = 100;
  else if (title.startsWith(q)) score = 85;
  else if (title.includes(q)) score = 70;
  if (tags.includes(q)) score = Math.max(score, 55);
  if (folder.includes(q)) score = Math.max(score, 45);
  if (body.includes(q)) score = Math.max(score, 30);
  if (score < 0) {
    // Multi-word queries also match when every word appears somewhere
    // across title + tags + folder + body, even if not as one phrase.
    const words = q.split(" ").filter(Boolean);
    if (words.length > 1) {
      const hay = `${title} ${tags} ${folder} ${body}`;
      if (words.every((w) => hay.includes(w))) score = 25;
    }
  }
  if (score < 0 && q.length >= 3 && !q.includes(" ")) {
    // Last resort: the query's letters appear in order inside the
    // title — a typo-tolerant subsequence match, so a slip of the
    // finger still finds the reply instead of an empty list.
    let i = 0;
    for (const ch of title) {
      if (ch === q.charAt(i)) i += 1;
      if (i >= q.length) break;
    }
    if (i >= q.length) score = 20;
  }
  if (score < 0) return -1;
  return score + Math.min(10, s.usageCount) * 0.3 + (s.pinned ? 1 : 0);
}

/** Renders text with the search-matched part highlighted. Matching
    runs on the normalized text, but the highlight is drawn on the
    original characters wherever the raw query appears verbatim;
    when only the normalized form matches (ة/ه, إ/ا…), the text is
    rendered plain rather than highlighted in the wrong place. */
function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/** A short window of body text around the first match, so a search
    result previews the matching part instead of always the start. */
function snippetAround(body: string, query: string, radius = 60): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const q = query.trim();
  if (!q) return flat.slice(0, 140);
  const idx = flat.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) {
    const nIdx = normalizeSearchText(flat).indexOf(normalizeSearchText(q));
    if (nIdx < 0) return flat.slice(0, 140);
    const start = Math.max(0, nIdx - radius);
    return `${start > 0 ? "…" : ""}${flat.slice(start, nIdx + q.length + radius)}…`;
  }
  const start = Math.max(0, idx - radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, idx + q.length + radius)}…`;
}

/* (The time-aware greeting that used to head the home page was
   retired at the owner's request — a Quranic verse stands in its
   place now.) */

/* The one-line identity shown under the user's name: their login email
   when they have one, otherwise their mobile number. */
function loginIdLabel(user: User): string {
  return user.email ?? user.phone ?? "";
}

/* The account's face, everywhere it appears (header, account menu,
   sidebar card, account page): the uploaded profile picture when one
   is set, and the name's first letter on the accent gradient
   otherwise. Both states carry the same .avatar-face treatment — a
   subtle gradient ring (surface gap, brass, a whisper of accent) —
   so the avatar keeps one Midnight Library identity with or without
   a photo. The picture is decorative next to the visible name, so it
   carries an empty alt and the surrounding control keeps the
   accessible name. */
function AvatarFace({
  user,
  displayName,
  size,
  textClass = "text-sm",
}: {
  user: User;
  displayName: string;
  size: number;
  textClass?: string;
}) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="avatar-face shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`avatar-face flex shrink-0 items-center justify-center rounded-full bg-[var(--accent)] bg-[linear-gradient(150deg,var(--accent),var(--accent-strong))] font-bold text-[var(--accent-ink)] ${textClass}`}
      style={{ width: size, height: size }}
    >
      {displayName.charAt(0) || "؟"}
    </span>
  );
}

/* ---------- CSV backup (import / export) ----------
   Same four fields as the JSON backup, in a spreadsheet-friendly shape.
   Export quotes per RFC 4180; import parses quoted fields, embedded
   commas/newlines and doubled quotes. */
function toCsv(shortcuts: Shortcut[]): string {
  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const rows = shortcuts.map((s) =>
    [s.title, s.category, s.body, s.tags].map(esc).join(","),
  );
  return ["title,category,body,tags", ...rows].join("\r\n");
}

function parseCsv(
  text: string,
): Array<{ title: string; body: string; category: string; tags: string }> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src.charAt(i + 1) === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  const items: Array<{ title: string; body: string; category: string; tags: string }> = [];
  /* The column layout comes from the header row when there is one:
     current backups are title,category,body,tags. Older backups led
     with a shortcut-word column — it is simply not read anymore,
     and a missing tags column defaults to "". */
  let col = { title: 0, category: 1, body: 2, tags: 3 };
  let start = 0;
  const head = rows[0];
  if (
    head &&
    head.some((c) =>
      ["trigger", "title", "category", "body", "tags"].includes(c.trim().toLowerCase()),
    )
  ) {
    const names = head.map((c) => c.trim().toLowerCase());
    const at = (n: string, d: number) => {
      const i = names.indexOf(n);
      return i === -1 ? d : i;
    };
    col = {
      title: at("title", 0),
      category: at("category", 1),
      body: at("body", 2),
      tags: at("tags", 3),
    };
    start = 1;
  }
  for (let r = start; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const body = row[col.body] ?? "";
    if (!body.trim()) continue;
    const titleRaw = (row[col.title] ?? "").trim();
    items.push({
      title: titleRaw || body.trim().split("\n")[0]?.slice(0, 60) || "رد مستورد",
      category: (row[col.category] ?? "").trim() || "عام",
      body,
      tags: (row[col.tags] ?? "").trim(),
    });
  }
  return items;
}

function renderRichInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /\*([^*\n]+)\*|__([^_\n]+)__|_([^_\n]+)_|(\{[^}\n]+\})/g;
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${k++}`;
    if (m[1] !== undefined) out.push(<strong key={key} className="font-bold">{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<u key={key}>{m[2]}</u>);
    else if (m[3] !== undefined) out.push(<em key={key}>{m[3]}</em>);
    else if (m[4] !== undefined)
      out.push(
        <span
          key={key}
          className="mx-0.5 inline-block rounded-[4px] bg-[var(--cyan-soft)] px-1.5 py-px align-baseline text-[0.85em] font-bold text-[var(--cyan)]"
        >
          {m[4]}
        </span>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Renders a reply body with the editor's formatting markers applied. */
function RichPreview({ body, className = "" }: { body: string; className?: string }) {
  const lines = body.split("\n");
  return (
    <div className={`text-[15px] leading-[1.9] ${className}`}>
      {lines.map((line, i) => {
        const key = `l${i}`;
        if (!line.trim()) return <div key={key} className="h-2.5" />;
        const bullet = line.match(/^\s*[•\-]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={key} className="flex gap-2">
              <span aria-hidden="true" className="shrink-0 text-[var(--accent)]">•</span>
              <span>{renderRichInline(bullet[1] ?? "", key)}</span>
            </p>
          );
        }
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (numbered) {
          return (
            <p key={key} className="flex gap-2">
              <span dir="ltr" className="shrink-0 font-bold text-[var(--accent)]">
                {numbered[1]}.
              </span>
              <span>{renderRichInline(numbered[2] ?? "", key)}</span>
            </p>
          );
        }
        return <p key={key}>{renderRichInline(line, key)}</p>;
      })}
    </div>
  );
}

/* ---------- IS logo ----------
   The official logo: Concept 04 — Modern Architectural,
   the monogram the owner chose himself from the concept
   board and re-confirmed since: a tall serif I woven into
   a THIN frame outline (open where the letters cross it,
   with the filled corner wedge at the top right), and the
   S drawn as a flowing DOUBLE ribbon — two gold bands with
   a fine channel between them — tapering to points at both
   terminals and spilling just past the frame at the lower
   right. This geometry is not hand-invented: it was traced
   from the approved board image itself (colour-unmixed,
   marching-squares contours, simplified and smoothed;
   working files in logo-arch-work/, see trace_board.py),
   after two hand-drawn approximations were rejected as
   cheap and wrong. Drawn as pure vector shapes on
   transparency: no tile, no backing, no background colour,
   no name text beside it. The mark's colours FOLLOW the
   chosen accent, like everything else on the site: the
   frame + I + wedge take the deep shade of the accent
   (--logo-deep; an ivory tint of it at night), the ribbon
   takes the accent gradient (--logo-hi/mid/lo). Nothing is
   locked to navy or gold, and the favicon is generated
   from these same shapes. */
const LOGO_NAVY_D =
  "M76.4 7.7 L93.5 7.7 L93.9 9.7 Q94.3 11.6 93.9 12.0 Q93.5 12.4 80.4 12.5 L67.4 12.6 L67.4 113.3 Q67.4 213.9 67.8 214.2 Q68.1 214.7 85.8 214.4 Q103.4 214.1 103.8 214.6 Q104.2 214.9 104.2 217.0 L104.2 219.1 L83.8 219.2 Q63.5 219.3 59.1 218.8 Q54.6 218.3 48.9 216.5 Q43.2 214.7 39.3 212.6 Q35.5 210.5 31.6 207.7 Q27.7 204.8 24.4 201.6 Q21.2 198.3 18.3 194.4 Q15.5 190.5 13.9 187.7 Q12.4 184.8 10.8 180.7 Q9.3 176.5 8.2 171.6 Q7.2 166.7 7.4 111.4 Q7.7 56.2 9.8 49.5 Q11.9 42.7 14.4 38.0 Q17.0 33.4 21.6 28.0 Q26.1 22.7 31.8 18.6 Q37.5 14.4 42.2 12.4 Q46.9 10.3 53.1 9.0 Q59.3 7.7 76.4 7.7 Z M232.2 104.3 L232.0 148.8 L231.2 143.7 Q230.2 138.7 228.9 135.3 Q227.6 131.9 227.6 95.9 Q227.6 59.8 226.1 53.6 Q224.5 47.4 222.2 42.7 Q219.8 38.0 217.0 34.2 Q214.1 30.3 212.0 28.0 Q209.7 25.9 209.1 25.8 L208.4 25.6 L208.4 48.2 L208.4 70.7 L206.5 71.1 Q204.5 71.5 204.2 71.1 Q203.8 70.7 202.7 64.2 Q201.7 57.8 200.1 53.3 Q198.6 48.9 196.2 44.5 Q193.9 40.1 190.0 35.2 Q186.1 30.3 181.0 25.8 Q176.0 21.2 169.3 17.3 Q162.5 13.4 158.1 11.9 Q153.7 10.3 147.2 9.0 L140.7 7.7 L161.0 7.7 Q181.2 7.7 187.7 9.3 Q194.2 10.8 198.6 12.9 Q203.0 15.0 206.1 17.0 Q209.2 19.1 213.2 22.9 Q217.3 26.6 220.9 31.6 Q224.5 36.5 227.1 42.2 Q229.7 47.9 231.0 53.9 Q232.3 59.8 232.2 104.3 Z M35.1 113.4 L34.9 204.3 L29.6 199.5 Q24.3 194.7 21.7 191.1 Q19.1 187.4 17.3 183.8 Q15.5 180.2 13.7 173.4 Q11.9 166.7 12.1 111.7 Q12.4 56.7 13.7 52.1 Q15.0 47.4 17.3 42.7 Q19.6 38.0 22.5 34.2 Q25.3 30.3 29.9 26.3 Q34.4 22.2 34.8 22.3 L35.2 22.5 L35.1 113.4 Z M82.0 163.9 L82.1 131.2 L84.0 131.2 Q85.8 131.2 86.1 131.6 Q86.5 131.9 86.5 135.0 Q86.5 138.2 87.3 141.8 Q88.1 145.4 88.1 152.9 Q88.1 160.5 89.4 167.5 Q90.7 174.5 94.1 184.3 Q97.4 194.2 100.7 200.6 L103.9 206.9 L99.0 205.1 Q94.1 203.2 88.0 200.0 Q81.9 196.8 82.0 163.9 Z";
const LOGO_GOLD_D =
  "M123.1 9.5 Q130.9 7.7 136.6 7.7 Q142.3 7.7 146.2 8.5 Q150.1 9.3 152.3 10.2 L154.5 11.1 L154.1 11.4 Q153.7 11.9 147.2 12.1 Q140.7 12.4 136.9 13.4 Q133.0 14.4 129.1 16.5 Q125.2 18.6 122.2 21.6 Q119.2 24.6 116.9 29.2 Q114.6 33.9 114.0 39.1 Q113.5 44.3 114.3 47.6 Q115.1 51.0 117.4 54.9 Q119.7 58.8 124.3 62.8 Q128.8 66.8 134.0 69.9 Q139.2 73.1 146.5 76.4 Q153.7 79.8 168.0 85.5 Q182.2 91.2 189.8 94.8 Q197.3 98.5 201.4 101.1 Q205.6 103.7 207.7 105.2 Q209.7 106.8 215.3 112.9 Q220.9 119.0 222.7 121.8 Q224.5 124.7 227.1 130.6 Q229.7 136.6 231.0 142.3 Q232.3 148.0 232.6 154.8 Q232.8 161.5 232.3 165.9 Q231.8 170.3 230.7 174.2 Q229.7 178.1 227.1 183.8 Q224.5 189.5 221.4 193.9 Q218.3 198.3 212.7 203.4 Q207.1 208.4 202.7 211.0 Q198.3 213.6 192.1 215.7 Q185.9 217.8 180.7 218.5 Q175.5 219.3 162.5 219.1 Q149.6 218.8 140.0 217.3 Q130.4 215.7 118.7 212.1 Q107.0 208.4 105.3 207.3 Q103.7 206.1 101.3 202.0 Q99.0 197.8 96.4 191.3 Q93.8 184.8 92.3 179.6 Q90.7 174.5 89.4 167.2 Q88.1 159.9 88.1 156.3 Q88.1 152.7 88.5 152.3 L88.9 151.9 L91.3 158.7 Q93.8 165.6 95.9 169.5 Q98.0 173.4 101.6 178.9 Q105.2 184.3 109.0 188.3 Q112.7 192.4 116.4 195.5 Q120.0 198.6 124.9 202.0 Q129.9 205.3 134.8 207.7 Q139.7 210.0 145.9 211.8 Q152.2 213.6 158.4 214.1 Q164.6 214.7 167.7 214.1 Q170.8 213.6 175.2 211.8 Q179.6 210.0 181.2 209.0 Q182.8 207.9 185.7 204.7 Q188.7 201.4 190.0 199.1 Q191.3 196.8 192.1 194.2 Q192.9 191.6 193.1 186.7 Q193.4 181.7 192.9 179.6 Q192.4 177.6 190.3 173.4 Q188.2 169.3 185.0 165.8 Q181.7 162.3 177.6 159.4 Q173.4 156.6 167.2 153.5 Q161.0 150.3 141.5 142.6 Q122.1 134.8 114.6 130.9 Q107.0 127.0 103.4 124.7 Q99.8 122.3 97.2 120.3 Q94.6 118.2 90.8 113.9 Q87.1 109.6 84.7 105.7 Q82.4 101.8 80.3 97.2 Q78.2 92.5 76.7 86.0 Q75.1 79.5 74.9 73.3 Q74.6 67.1 75.4 61.4 Q76.2 55.7 77.5 51.5 Q78.8 47.4 80.6 43.5 Q82.4 39.6 85.5 34.9 Q88.6 30.3 92.7 26.3 Q96.7 22.2 100.5 19.4 Q104.4 16.5 109.9 13.9 Q115.3 11.3 123.1 9.5 Z M191.6 212.1 Q185.4 214.7 183.0 215.2 Q180.7 215.7 178.5 215.6 L176.3 215.4 L182.1 213.2 Q187.9 211.0 192.4 207.9 Q196.8 204.8 200.8 200.0 Q204.8 195.2 206.9 190.8 Q209.0 186.4 209.7 182.8 Q210.5 179.1 210.3 172.4 Q210.0 165.6 208.4 161.0 Q206.9 156.3 204.5 152.4 Q202.2 148.5 196.6 143.0 Q191.1 137.4 183.3 133.2 Q175.5 129.1 152.2 120.5 Q128.8 112.0 118.2 106.8 Q107.6 101.6 103.7 98.7 Q99.8 95.9 96.3 92.4 Q92.8 88.9 90.7 85.8 Q88.6 82.7 86.8 78.0 Q85.0 73.3 84.2 69.2 Q83.4 65.0 83.7 59.6 Q84.0 54.1 85.5 48.7 Q87.1 43.2 89.1 39.3 Q91.2 35.5 94.1 31.8 Q96.9 28.2 101.7 24.2 Q106.5 20.2 110.4 17.8 Q114.3 15.5 118.4 13.9 Q122.6 12.4 126.7 11.6 Q130.9 10.8 132.1 10.9 L133.2 11.1 L128.1 12.8 Q123.1 14.4 117.9 17.6 Q112.7 20.7 107.9 26.0 Q103.1 31.3 101.1 35.2 Q99.0 39.1 98.0 42.5 Q96.9 45.8 96.9 53.9 Q96.9 61.9 98.5 66.6 Q100.0 71.2 102.6 75.4 Q105.2 79.5 110.3 84.4 Q115.3 89.1 122.1 92.8 Q128.8 96.4 155.0 106.3 Q181.2 116.1 189.2 120.3 Q197.3 124.4 201.7 127.5 Q206.1 130.6 209.6 134.2 Q213.1 137.6 215.7 141.3 Q218.3 144.9 220.4 149.8 Q222.4 154.8 223.0 157.1 Q223.5 159.4 223.5 166.7 Q223.5 173.9 222.4 177.8 Q221.4 181.7 219.3 186.1 Q217.3 190.5 214.4 194.4 Q211.5 198.3 207.8 201.8 Q204.0 205.3 200.9 207.4 Q197.8 209.5 191.6 212.1 Z";

function Logo({ size = 44 }: { size?: number; full?: boolean }) {
  /* .logo-modern gives the bare mark its soft accent-derived
     shadow — following the shapes' own silhouette; no tile
     or backing behind the mark, ever. The traced shapes
     already carry the board's exact weave (which parts of
     the S pass over the frame and the I), so the navy group
     is painted first and the ribbon over it. */
  const gradId = useId();
  const h = Math.round((size * 227) / 240);
  return (
    <span
      className="logo-modern"
      style={{ width: size, height: h }}
      role="img"
      aria-label="IS"
    >
      <svg
        viewBox="0 0 240 227"
        width={size}
        height={h}
        aria-hidden="true"
        className="block"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--logo-hi)" />
            <stop offset="0.5" stopColor="var(--logo-mid)" />
            <stop offset="1" stopColor="var(--logo-lo)" />
          </linearGradient>
        </defs>
        <path d={LOGO_NAVY_D} fill="var(--logo-deep)" fillRule="evenodd" />
        <path d={LOGO_GOLD_D} fill={`url(#${gradId})`} fillRule="evenodd" />
      </svg>
    </span>
  );
}

/* Shades a #rrggbb colour toward black (f < 1) or toward
   white (f > 1) — used to print the favicon's deep frame
   shade and ribbon gradient from the accent's own swatch,
   so the tab icon carries the same colour the user picked
   in the page, exactly like the logo itself. */
function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* The favicon is the same Concept 04 mark, generated as
   an SVG data URI from the chosen accent's swatch — deep
   shade for the frame + I, a three-stop gradient of the
   same family for the ribbon, on transparency, exactly
   like the page logo. Changing the accent regenerates it. */
function logoFaviconHref(accentHex: string): string {
  const deep = shadeHex(accentHex, 0.3);
  const hi = shadeHex(accentHex, 1.45);
  const lo = shadeHex(accentHex, 0.78);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 227'>` +
    `<defs>` +
    `<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${hi}'/>` +
    `<stop offset='.5' stop-color='${accentHex}'/>` +
    `<stop offset='1' stop-color='${lo}'/>` +
    `</linearGradient></defs>` +
    `<path d='${LOGO_NAVY_D}' fill='${deep}' fill-rule='evenodd'/>` +
    `<path d='${LOGO_GOLD_D}' fill='url(#g)' fill-rule='evenodd'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* The logo stands alone — no brand name text anywhere beside it. */
function Brand({ compact = false }: { compact?: boolean }) {
  return <Logo size={compact ? 40 : 52} />;
}

/* Quiet subheading that opens a related group inside a page: a small
   bold label, an optional hint, and a hairline running to the edge —
   the one grouping device used on every inner page. */
function GroupHead({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="shrink-0 text-[15px] font-bold">{label}</h2>
      {hint && <span className="shrink-0 text-xs text-[var(--dim)]">{hint}</span>}
      <span aria-hidden="true" className="h-px min-w-4 flex-1 self-center bg-[var(--border)]" />
    </div>
  );
}

/* ---------- helpers ---------- */
function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* Writes text to the clipboard, falling back to a temporary
   textarea + execCommand where the async clipboard API is not
   available. Resolves true only when the text actually landed on
   the clipboard, so callers never show a false «اتنسخ». */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ألوان التمييز الاثنا عشر — مفاتيحها تطابق [data-accent] في الثيم */
const ACCENTS: Array<{ key: string; label: string; swatch: string }> = [
  { key: "royal", label: "أزرق ملكي", swatch: "#1668C4" },
  { key: "amber", label: "عنبري", swatch: "#D97706" },
  { key: "sky", label: "سماوي", swatch: "#0284C7" },
  { key: "cyan", label: "فيروزي", swatch: "#0891B2" },
  { key: "teal", label: "مخضر", swatch: "#0F766E" },
  { key: "emerald", label: "زمردي", swatch: "#059669" },
  { key: "indigo", label: "نيلي", swatch: "#4F46E5" },
  { key: "violet", label: "بنفسجي", swatch: "#7C3AED" },
  { key: "fuchsia", label: "فوشيا", swatch: "#C026D3" },
  { key: "rose", label: "وردي", swatch: "#E11D63" },
  { key: "red", label: "أحمر", swatch: "#DC2626" },
  { key: "orange", label: "برتقالي", swatch: "#EA580C" },
];

/* ألوان الأيقونات العامة — عائلة ألوان التمييز نفسها +
   الرمادي؛ «auto» (مش مفتاح هنا) يعني سيب الأيقونات بألوانها
   الحالية. المفاتيح دي هي قيم [data-icon-tone] في الثيم.
   وفوق القائمة فيه لون حر: أي درجة من عجلة الألوان بتتحفظ
   بالشكل "custom:#rrggbb" وبتتطبق كقيمة --icon-tone مباشرة. */
const ICON_TONES: Array<{ key: string; label: string; swatch: string }> = [
  ...ACCENTS,
  { key: "slate", label: "رمادي", swatch: "#64748B" },
];

/* The custom icon tone's hex, when the stored value carries one. */
function customToneOf(v: string): string | null {
  return v.startsWith("custom:") && isCustomColor(v.slice("custom:".length))
    ? v.slice("custom:".length)
    : null;
}

function ahkEscape(body: string): string {
  return body
    .replace(/%/g, "`%")
    .replace(/`/g, "``")
    .replace(/#/g, "`#")
    .replace(/!/g, "`!")
    .replace(/\^/g, "`^")
    .replace(/\+/g, "`+")
    .replace(/\{/g, "`{")
    .replace(/\}/g, "`}")
    .replace(/\r?\n/g, "`n");
}

function buildAhk(shortcuts: Shortcut[]): string {
  const lines = [
    "#Requires AutoHotkey v2.0",
    "#SingleInstance Force",
    "; ردود IS — اتولّدت من موقع IS",
    "; دوس Win + Shift + S في أي برنامج (Chatwoot / واتساب / فيسبوك) واختار الرد من القائمة وهيتكتب كامل فوراً",
    "",
  ];
  const menuItems = shortcuts
    .map(
      (s) =>
        `  m.Add("${s.title.replace(/"/g, "")}", (*) => SendText("${ahkEscape(s.body).replace(/"/g, '`"')}"))`,
    )
    .join("\n");
  lines.push("+#s:: {");
  lines.push("  m := Menu()");
  lines.push(menuItems);
  lines.push("  m.Show()");
  lines.push("}");
  return lines.join("\n");
}


/* Theme preference: light / dark / system. The stored value is the
   MODE (the same key the binary toggle used — "light"/"dark" values
   carry over untouched, "system" is simply a third value). The
   effective darkness follows the OS while the mode is "system".
   Switching runs through the View Transitions API with a circular
   reveal expanding from the control that asked for it, and falls
   back to a plain switch where the API is missing or the user
   prefers reduced motion. */
type ThemeMode = "light" | "dark" | "system";

function useDarkMode() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = window.localStorage.getItem("is-theme-v3");
      if (saved === "light" || saved === "dark" || saved === "system") return saved;
    } catch { /* ignore */ }
    return "system";
  });
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { /* ignore */ }
    return false;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const dark = mode === "system" ? systemDark : mode === "dark";
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    try {
      window.localStorage.setItem("is-theme-v3", mode);
    } catch { /* ignore */ }
  }, [dark, mode]);
  const setMode = (next: ThemeMode, origin?: { x: number; y: number }) => {
    const apply = () => setModeState(next);
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!origin || reduced || typeof doc.startViewTransition !== "function") {
      apply();
      return;
    }
    try {
      const transition = doc.startViewTransition(() => flushSync(apply));
      transition.ready
        .then(() => {
          const radius = Math.hypot(
            Math.max(origin.x, window.innerWidth - origin.x),
            Math.max(origin.y, window.innerHeight - origin.y),
          );
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${origin.x}px ${origin.y}px)`,
                `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
              ],
            },
            {
              duration: 420,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => { /* the plain switch already happened */ });
    } catch {
      apply();
    }
  };
  return {
    dark,
    mode,
    setMode,
    toggle: () => setModeState((m) => (m === "system" ? (systemDark ? "light" : "dark") : m === "dark" ? "light" : "dark")),
  };
}

/* ---------- interface language (Arabic / English) ----------
   The site's own chrome — labels, buttons, menus, hints, empty
   states — speaks Arabic or English, switchable from the top bar
   and remembered on this device. The user's content is NEVER
   translated: reply titles and bodies, folder names and tags stay
   exactly as their owner wrote them (the replies stay Arabic).
   Switching flips the layout direction with the language, so the
   interface reads naturally in both. Strings without an English
   entry fall back to the Arabic original. */
type Lang = "ar" | "en";

const EN: Record<string, string> = {
  // greetings & general
  "صباح الخير": "Good morning",
  "نهارك سعيد": "Good afternoon",
  "مساء الخير": "Good evening",
  "بنفتح حسابك…": "Opening your account…",
  "حاول تاني": "Try again",
  "حصلت مشكلة في التحميل": "Something went wrong while loading",
  "إعادة المحاولة": "Retry",
  "إلغاء": "Cancel",
  "حفظ": "Save",
  "إغلاق": "Close",
  "حذف": "Delete",
  "تعديل": "Edit",
  "نسخ": "Copy",
  "اتنسخ": "Copied",
  "بيتنسخ…": "Copying…",
  "نسخ الرد": "Copy reply",
  "اتنسخ — الصقه في أي شات": "Copied — paste it in any chat",
  "فتح تفاصيل الرد": "Open reply details",
  "معاينة سريعة": "Quick preview",
  "تكرار الرد": "Duplicate reply",
  "متأكد؟": "Sure?",
  "دوس تاني لتأكيد الحذف": "Click again to confirm delete",
  "تثبيت في الأعلى": "Pin to top",
  "إلغاء التثبيت": "Unpin",
  "إضافة للمفضلة": "Add to favorites",
  "إزالة من المفضلة": "Remove from favorites",
  "دوس زرار النجمة على أي رد مهم عندك، وهيظهر هنا على طول — والدبوس لوحده بيخليه ثابت في أول مجلده.": "Tap the star on any reply that matters to you and it shows up here — the pin on its own keeps it at the top of its folder.",
  "الأقل استخداماً": "Least used",
  "لم تُستخدم": "Never used",
  "سلة المهملات": "Trash",
  "الكلمات المفتاحية": "Tags",
  "اعرض الرد كامل": "Show full reply",
  "اقفل": "Collapse",
  "مثبّت في الأعلى": "Pinned to top",
  "اسحب لإعادة الترتيب أو النقل لمجلد تاني": "Drag to reorder or move to another folder",
  "اسحب للنقل أو إعادة الترتيب": "Drag to move or reorder",
  "اسحب المجلد للنقل أو إعادة الترتيب": "Drag the folder to move or reorder it",
  "اسحب المجلد عشان ترتّبه أو تدخّله جوه مجلد تاني": "Drag a folder by its handle to reorder it or drop it inside another folder",
  // top bar
  "فتح قائمة التنقل": "Open navigation menu",
  "القائمة — كل الأقسام والمجموعات والمجلدات": "Menu — all sections, groups and folders",
  "الرجوع إلى الرئيسية": "Back to home",
  "الرئيسية — كل ردودك": "Home — all your replies",
  "دوّر باسم الرد أو أي كلمة منه": "Search by reply name or any word in it",
  "دوّر في الردود": "Search replies",
  "دوّر باسم الرد أو كلمة منه…": "Search by reply name or a word in it…",
  "مسح البحث": "Clear search",
  "فتح لوحة الأوامر والبحث السريع": "Open the quick search panel",
  "بحث وأوامر سريعة في كل الموقع": "Quick search across the whole site",
  "بحث سريع": "Quick search",
  "حسابي — الاسم وكلمة المرور والجلسات": "My account — name, password and sessions",
  "تفعيل الوضع النهاري": "Switch to light mode",
  "تفعيل الوضع الليلي": "Switch to dark mode",
  "التبديل إلى الوضع النهاري": "Switch to light mode",
  "التبديل إلى الوضع الليلي": "Switch to dark mode",
  "تسجيل الخروج": "Sign out",
  "خروج": "Sign out",
  "تسجيل الخروج من الجهاز ده": "Sign out on this device",
  "التبديل إلى الإنجليزية": "Switch to English",
  "Switch to Arabic": "التبديل إلى العربية",
  // navigation
  "التنقل الرئيسي": "Main navigation",
  "مسار التنقل": "Breadcrumb",
  "أقسام الموقع": "Site sections",
  "الرئيسية": "Home",
  "إضافة المتصفح": "Browser extension",
  "حسابي": "My account",
  "توسيع القائمة الجانبية للبحث فيها": "Expand the sidebar to search it",
  "توسيع القائمة والبحث عن أي مجلد أو صفحة": "Expand the sidebar and search for any folder or page",
  "توسيع القائمة الجانبية": "Expand the sidebar",
  "دوّر عن أي مجلد أو صفحة أو رد في الشجرة": "Search the tree for any folder, page or reply",
  "البحث في الشجرة عن مجلد أو صفحة أو رد": "Search the tree for a folder, page or reply",
  "دوّر في الشجرة…": "Search the tree…",
  "مسح بحث الشجرة": "Clear the tree search",
  "مجلد جديد في المستوى الرئيسي": "New folder at the top level",
  "إنشاء مجلد جديد في المستوى الرئيسي": "Create a new folder at the top level",
  "مجلد جديد": "New folder",
  "التراجع عن آخر نقل": "Undo the last move",
  "تراجع عن آخر نقل أو إعادة ترتيب": "Undo the last move or reorder",
  "إعادة آخر نقل": "Redo the last move",
  "إعادة النقل اللي اتلغى": "Redo the undone move",
  "فتح كل المجلدات": "Open all folders",
  "فتح كل المجلدات والمجموعات مرة واحدة": "Open all folders and groups at once",
  "طي كل المجلدات": "Collapse all folders",
  "طي كل المجلدات والمجموعات مرة واحدة": "Collapse all folders and groups at once",
  "نقل الردود المحددة إلى مجلد": "Move the selected replies to a folder",
  "اختار مجلد عشان تنقل الردود المحددة كلها مرة واحدة": "Pick a folder to move all the selected replies at once",
  "نقل إلى مجلد…": "Move to folder…",
  "المستوى الرئيسي": "Top level",
  "مسح التحديد": "Clear selection",
  "شجرة المجلدات والصفحات": "Folder and page tree",
  "مفيش مجلد أو صفحة أو رد بالاسم ده في الشجرة.": "No folder, page or reply with that name in the tree.",
  "فتح حسابي من القائمة": "Open my account from the menu",
  "تصغير القائمة الجانبية إلى أيقونات": "Collapse the sidebar to icons",
  "تصغير القائمة — الأيقونات بس": "Collapse the sidebar — icons only",
  "تصغير القائمة": "Collapse sidebar",
  "المكتبة": "Library",
  "المصادر": "Sources",
  "الأدوات": "Tools",
  "الحساب": "Account",
  "بحث": "Search",
  "عرض": "View",
  "المجلدات": "Folders",
  "مؤخراً": "Recent",
  "الأكثر": "Top",
  "السجل": "History",
  "توسيع": "Expand",
  "الإضافة": "Extension",
  "النسخ": "Backup",
  "الخصوصية": "Privacy",
  "تغيير عرض القائمة الجانبية بالسحب": "Drag to resize the sidebar",
  "اسحب لتفريد القائمة أو ضمها بالمقاس اللي يناسبك": "Drag to expand or collapse the sidebar to any size you like",
  "توسيع القائمة الجانبية — أو اسحب حافتها لأي عرض": "Expand the sidebar — or drag its edge to any width",
  "الردود اللي نسختها أو استخدمتها مؤخراً": "Replies you copied or used recently",
  "سجل كل عمليات النسخ الناجحة بوقتها": "A log of every successful copy with its time",
  "المفضلة": "Favorites",
  "الأحدث": "Newest",
  "استُخدمت مؤخراً": "Recently used",
  "الأكثر استخداماً": "Most used",
  "سجل النسخ": "Copy history",
  "الكل": "All",
  "سياسة الخصوصية": "Privacy policy",
  "إضافة جماعية": "Bulk add",
  "ويندوز والنسخ الاحتياطي": "Windows & backup",
  "المكتبة — الرئيسية وكل مجلداتك وردودك، اسحب أي عنصر عشان تنقله أو ترتبه": "The library — home, all your folders and replies; drag any item to move or reorder it",
  "الأدوات — البحث وكل الأدوات في مكان واحد": "Tools — search and every tool in one place",
  "الحساب — ملفك وسياسة الخصوصية": "Account — your profile and the privacy policy",
  "الرئيسية — كل ردودك مرتبة في مجلداتها، والمفضلة والمستخدمة مؤخراً والأكثر استخداماً من أزرار العرض فوق القائمة": "Home — all your replies arranged in their folders; favorites, recently used and most used are view buttons above the list",
  "ملف AutoHotkey والنسخ الاحتياطية والاستيراد — في آخر الرئيسية": "The AutoHotkey file, backups and import — at the end of Home",
  "سياسة خصوصية الموقع": "Privacy policy of the site",
  "الرئيسية — كل ردودك ومجلداتك والمفضلة في مكان واحد": "Home — all your replies, folders and favorites in one place",
  // home toolbar & views
  "إضافة اختصار جديد": "Add a new reply",
  "إضافة اختصار جديد إلى مكتبتك": "Add a new reply to your library",
  "جديد": "New",
  "إضافة جماعية بلصق مجموعة ردود": "Bulk-add by pasting several replies",
  "إضافة مجموعة ردود مرة واحدة باللصق": "Add several replies at once by pasting",
  "جماعية": "Bulk add",
  "أدوات المكتبة": "Library tools",
  // folder view
  "المجلدات الفرعية": "Subfolders",
  "فاضي": "Empty",
  "تصدير المجلد": "Export folder",
  "كثافة عرض الردود": "Reply list density",
  "مضغوط": "Compact",
  "مريح": "Comfortable",
  "شبكة": "Grid",
  "عرض مضغوط": "Compact view",
  "عرض مريح": "Comfortable view",
  "عرض شبكة": "Grid view",
  "قائمة مضغوطة — رد في كل سطر، الأسرع مع مئات الردود": "Compact list — one reply per row, fastest with hundreds of replies",
  "بطاقات مريحة — معاينة أطول لكل رد": "Comfortable cards — a longer preview per reply",
  "شبكة بطاقات — للتصفح البصري": "Card grid — for visual browsing",
  "نطاق البحث:": "Search scope:",
  "البحث في المكتبة كلها": "Search the whole library",
  "البحث في كل الردود وكل المجلدات": "Search all replies and all folders",
  "البحث في المجلد الحالي بس": "Search this folder only",
  "ترتيب الردود": "Sort replies",
  "يدوي — ترتيبك بالسحب": "Manual — your drag order",
  "يدوي": "Manual",
  "كل الردود — المثبت أولاً، ثم الأكثر استخداماً": "All replies — pinned first, then most used",
  "الردود المثبتة بس — اللي بترجع لها على طول": "Pinned replies only — the ones you keep coming back to",
  "الردود اللي نسختها أو استخدمتها مؤخراً — آخر استخدام الأول": "Replies you copied or used recently — last used first",
  "رتّب حسب عدد مرات الاستخدام": "Sort by number of uses",
  "رتّب حسب الأحدث إضافة": "Sort by newest added",
  "الاسم": "Name",
  "تاريخ التعديل": "Last modified",
  // grouped list
  "عرض المجلد": "Open folder",
  "طي المجلد": "Collapse folder",
  "فتح المجلد": "Expand folder",
  "عرض المزيد من الردود": "Show more replies",
  "الرجوع لفوق": "Back to top",
  "الرجوع لأول الصفحة": "Back to the top of the page",
  "عرض ٣٠ رداً كمان": "Show 30 more replies",
  "بنحمّل اختصاراتك…": "Loading your replies…",
  // empty states
  "مكتبتك فاضية — ابدأ من هنا": "Your library is empty — start here",
  "اعمل أول اختصار بنفسك، أو حمّل حزمة ردود الخطة الجاهزة وعدّل عليها زي ما تحب.": "Create your first reply yourself, or load the ready-made reply pack and edit it as you like.",
  "إضافة أول اختصار": "Add your first reply",
  "اختصار جديد": "New reply",
  "تحميل حزمة ردود الخطة الجاهزة": "Load the ready-made reply pack",
  "تحميل الردود الجاهزة": "Load ready replies",
  "مفيش مفضلة لسه": "No favorites yet",
  "دوس زرار الدبوس على أي رد مهم عندك، وهيتثبت هنا وفي مقدمة مكتبتك.": "Tap the pin on any important reply and it will stay here and at the top of your library.",
  "لسه ما استخدمتش أي رد": "You haven't used any reply yet",
  "أول ما تنسخ رد من هنا، هيظهر هنا بترتيب آخر استخدام — عشان ترجع له بضغطة واحدة.": "Once you copy a reply here, it appears here in last-used order — one tap to get back to it.",
  "مفيش نتيجة مطابقة لبحثك": "No results match your search",
  "مفيش ردود في العرض ده لسه.": "No replies in this view yet.",
  // auth
  "تسجيل الدخول": "Sign in",
  "حساب جديد": "New account",
  "اختصاراتك خاصة بيك": "Your replies are private to you",
  "رد في لحظة واحدة": "A reply in one moment",
  "عدد غير محدود": "Unlimited replies",
  // toasts & moves
  "اتنقل المجلد واتحفظ مكانه": "Folder moved and saved",
  "مينفعش تنقل مجلد جوه نفسه أو جوه مجلد تابع ليه": "A folder can't be moved inside itself or one of its subfolders",
  "اتلغى آخر نقل": "Last move undone",
  "اتعاد النقل": "Move redone",
  "اسحب المجلد على مجلد تاني أو على مجموعة «المجلدات»": "Drag the folder onto another folder or the Folders group",
};

type LangState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (ar: string) => string;
};
const LangCtx = createContext<LangState>({
  lang: "ar",
  setLang: () => {},
  t: (s) => s,
});
const useLang = () => useContext(LangCtx);

function useLangState(): LangState {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return window.localStorage.getItem("is-lang") === "en" ? "en" : "ar";
    } catch {
      return "ar";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang === "ar" ? "ar" : "en";
    root.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      window.localStorage.setItem("is-lang", lang);
    } catch { /* ignore */ }
  }, [lang]);
  const t = useMemo(
    () => (ar: string) => (lang === "en" ? (EN[ar] ?? ar) : ar),
    [lang],
  );
  return { lang, setLang, t };
}

/* The top-bar language switch: a compact segmented control with
   both languages visible and the current one seated on a raised
   segment — the choice reads at a glance instead of naming only
   the language you would leave for. */
function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const seg = (active: boolean) =>
    `lux-btn rounded-full px-3 py-1.5 text-[13px] font-bold ${
      active
        ? "bg-[var(--surface-elevated)] text-[var(--text)] shadow-[var(--shadow-1)] ring-1 ring-[var(--border)]"
        : "text-[var(--dim)] hover:text-[var(--text)]"
    }`;
  return (
    <div
      role="group"
      aria-label={t("لغة الواجهة")}
      data-tip={t("لغة الواجهة — الردود والمجلدات بتفضل زي ما هي")}
      data-tip-pos="below"
      data-tip-align="start"
      className={`flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--surface-alt)] p-1 ${className}`}
    >
      <button
        type="button"
        aria-label="العربية"
        aria-pressed={lang === "ar"}
        onClick={() => setLang("ar")}
        className={seg(lang === "ar")}
      >
        عربي
      </button>
      <button
        type="button"
        aria-label="English"
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
        className={seg(lang === "en")}
      >
        EN
      </button>
    </div>
  );
}

/* ---------- small UI pieces ---------- */
/* One toast for the whole workspace, in three honest kinds: a
   success carries the check, a failure carries an alert in the
   danger colour (a failed save used to wear the same green check
   as a success — the icon now always matches what happened), and
   an info note carries the info mark. role="status" lets screen
   readers announce it without moving focus. */
type ToastKind = "success" | "error" | "info";
type ToastState = { text: string; kind: ToastKind } | null;

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-6 z-[var(--z-toast)] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="toast-card animate-pop elev-pop flex max-w-full items-center gap-2 rounded-[var(--radius)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-[var(--navy-ink)]"
      >
        <span
          className={
            toast.kind === "error"
              ? "text-[var(--danger)]"
              : toast.kind === "info"
                ? "text-[var(--navy-ink)]"
                : "text-[var(--cyan)]"
          }
        >
          <Icon
            d={toast.kind === "error" ? CircleAlert : toast.kind === "info" ? Info : I.check}
            size={16}
          />
        </span>
        {toast.text}
      </div>
    </div>
  );
}

/* ---------- root: auth gate ---------- */
export function App() {
  const { dark, toggle, mode, setMode } = useDarkMode();
  const langState = useLangState();
  const queryClient = useQueryClient();
  /* صفحة المعاينة البصرية (#/preview): طلبها صاحب الموقع لأن
     الفحص الآلي يصل لصفحة الدخول فقط — تعرض الهوية الجديدة
     ببيانات تجريبية مطابقة الشكل، بلا أي اتصال بالخادم. */
  const [pvHash, setPvHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setPvHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  /* Border Glow: مستمع pointer واحد خامل يغذّي --mx/--my لأي
     كارت رد تحت المؤشر، وtokens.css يرسم النور على حدّ الكارت. */
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const onMove = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const card = t?.closest?.(".lux-card") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
  const isPreview = pvHash.startsWith("#/preview");
  const [token, setToken] = useState<string>(() => {
    try {
      // "Remember me" sessions live in localStorage (permanent, sliding
      // renewal); a session started without it lives in sessionStorage
      // and ends with the browser session.
      return (
        window.localStorage.getItem(TOKEN_KEY) ??
        window.sessionStorage.getItem(TOKEN_KEY) ??
        ""
      );
    } catch {
      return "";
    }
  });

  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: () => api.me({ token }),
    enabled: token.length > 0,
  });
  const user = meQuery.data?.user ?? null;

  const handleAuthed = (newToken: string, remember = true) => {
    try {
      if (remember) {
        window.localStorage.setItem(TOKEN_KEY, newToken);
        window.sessionStorage.removeItem(TOKEN_KEY);
      } else {
        window.sessionStorage.setItem(TOKEN_KEY, newToken);
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch { /* ignore */ }
    setToken(newToken);
  };

  const handleLogout = async () => {
    const t = token;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
    setToken("");
    queryClient.clear();
    if (t) {
      try {
        await api.logout({ token: t });
      } catch { /* session already gone */ }
    }
  };

  if (isPreview) {
    return <PreviewPage dark={dark} onToggleDark={toggle} />;
  }

  return (
    <LangCtx.Provider value={langState}>
      <div dir={langState.lang === "ar" ? "rtl" : "ltr"} className="app-shell min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <SafeAreaTopScrim backgroundColor="var(--bg)" />
        {token && meQuery.isPending ? (
          <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-4">
            <Brand />
            <p className="text-sm text-[var(--dim)]">{langState.t("بنفتح حسابك…")}</p>
          </div>
        ) : user && token ? (
          <Workspace
            token={token}
            user={user}
            themeMode={mode}
            onThemeMode={setMode}
            onLogout={handleLogout}
          />
        ) : (
          <AuthPage dark={dark} onToggleDark={toggle} onAuthed={handleAuthed} />
        )}
      </div>
    </LangCtx.Provider>
  );
}

/* ---------- auth page ----------
   Registration follows the premium flow: full name, email, password with
   a live strength meter, confirm password, an optional Egyptian mobile,
   and terms acceptance. Login takes ONE identifier — email or mobile —
   so every existing phone-only account signs in exactly as before.
   "Remember me" is on by default (permanent sliding session); turning
   it off keeps the session only until the browser closes. There is no
   email recovery channel for this product, so instead of a dead
   "forgot password" link the login form explains honestly how access is
   restored: stay signed in, or ask the owner to reset the password from
   «حسابي» on any signed-in device. */
/* Fold Arabic-Indic (٠١٢٣) and Eastern Arabic (۰۱۲۳) digits to
   Western 0-9 — mirrors the server's normalizeDigits, so a mobile
   number typed on an Arabic keyboard validates (and signs in)
   exactly like the same number typed with Western digits. */
function foldDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹０-９]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x660 && code <= 0x669) return String(code - 0x660);
    if (code >= 0x6f0 && code <= 0x6f9) return String(code - 0x6f0);
    return String(code - 0xff10);
  });
}

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  const label =
    pw.length === 0
      ? ""
      : score <= 1
        ? "ضعيفة"
        : score === 2
          ? "مقبولة"
          : score === 3
            ? "قوية"
            : "ممتازة";
  return { score, label };
}

function AuthPage({
  dark,
  onToggleDark,
  onAuthed,
}: {
  dark: boolean;
  onToggleDark: () => void;
  onAuthed: (token: string, remember: boolean) => void;
}) {
  const { lang, t } = useLang();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState(() => {
    try {
      return window.localStorage.getItem(SAVED_ID_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  /* The remember-me explanation lives behind a small info
     popover (v78 brief): the row itself carries only the short
     label, the full text opens on demand. */
  const [rememberInfoOpen, setRememberInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Auto sign-in (owner's request): in login mode, once the typed
     identifier + password pair settles for a beat it is tried on
     its own — a correct password walks straight in with a short
     welcome flourish, no button press. Each pair is auto-tried at
     most once: a wrong pair stays quiet until either field is
     edited (a new pair), and a manual press marks the pair too,
     so an attempt never doubles or loops. */
  const [entering, setEntering] = useState(false);
  const autoPairRef = useRef("");

  const strength = passwordStrength(password);

  const authMut = useMutation({
    mutationFn: async () => {
      if (mode === "register") {
        return await api.register({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        });
      }
      return await api.login({ identifier: identifier.trim(), password });
    },
    onSuccess: (res) => {
      if (res.ok && res.token) {
        /* Save which account this is on this device, so the next
           visit's login form is already filled with it. */
        try {
          const id =
            mode === "register"
              ? email.trim() || phone.trim()
              : identifier.trim();
          if (id) window.localStorage.setItem(SAVED_ID_KEY, id);
        } catch {
          /* storage unavailable — the form just won't prefill */
        }
        /* A short, elegant welcome beat — the success flourish
           plays, then the workspace opens. */
        const token = res.token;
        setEntering(true);
        window.setTimeout(() => onAuthed(token, remember), 850);
      } else {
        setError(res.error ?? "حصلت مشكلة — حاول تاني");
      }
    },
    onError: () => setError("الاتصال متمّش — اتأكد من النت وحاول تاني"),
  });

  const submit = () => {
    if (mode === "register") {
      if (name.trim().length < 2) {
        return setError("اكتب اسمك الكامل الأول");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        return setError("اكتب بريد إلكتروني صحيح (مثال: name@gmail.com)");
      }
      if (phone.trim() && !/^01[0-9]{9}$/.test(foldDigits(phone).replace(/[\s\-()]/g, "").replace(/^\+20/, "0").replace(/^0020/, "0"))) {
        return setError("رقم الموبايل اختياري — لو هتكتبه، اكتبه رقم مصري صحيح بيبدأ بـ 01 وطوله 11 رقم");
      }
      if (!password) {
        return setError("اكتب كلمة المرور");
      }
      if (confirm !== password) {
        return setError("تأكيد كلمة المرور مش مطابق لكلمة المرور");
      }
      if (!terms) {
        return setError("لازم توافق على الشروط والخصوصية عشان تكمل");
      }
    } else {
      if (identifier.trim().length < 3) {
        return setError("اكتب بريدك الإلكتروني أو رقم موبايلك");
      }
      if (!password) {
        return setError("اكتب كلمة المرور");
      }
    }
    setError(null);
    if (mode === "login")
      autoPairRef.current = `${identifier.trim()}\n${password}`;
    authMut.mutate();
  };

  /* The auto sign-in beat: 700ms after the login pair last changed,
     try it — silently, once per pair (see autoPairRef above). */
  useEffect(() => {
    if (mode !== "login" || entering || authMut.isPending) return;
    const id = identifier.trim();
    if (id.length < 3 || !password) return;
    const pair = `${id}\n${password}`;
    if (autoPairRef.current === pair) return;
    const t = window.setTimeout(() => {
      autoPairRef.current = pair;
      setError(null);
      authMut.mutate();
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, identifier, password, entering, authMut.isPending]);

  const field =
    "auth-input w-full py-3 pe-3 ps-11 text-base outline-none";
  const fieldPw =
    "auth-input w-full py-3 pe-11 ps-11 text-base outline-none";
  const fieldIcon =
    "auth-field-icon pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--dim)]";

  return (
    <div className="auth-modern auth-v78 auth-v79 auth-v81 relative min-h-screen w-full">
      {/* v78/v79 shaped this page (light segmented control
          with a sliding thumb, 52px fields, remember-me
          explanation in an info popover, one quiet privacy
          line, cool pearl ground with a living aurora).
          v80 removes the brand panel entirely at the
          owner's explicit call: one centered form column at
          every width — no side panel, no compact brand
          block, no value points. All behaviour (auto
          sign-in, remember me, saved identifier, toggles)
          is exactly as before — presentation only.
          v81 adds ONE thing, at the owner's explicit call:
          a watermark bearing his name across the foot of
          THIS page only (the .auth-watermark layer in
          tokens.css) — decorative, aria-hidden, behind the
          form, never anywhere else in the app. */}
      <span className="auth-watermark" aria-hidden="true">
        Ibrahim SOBHY
      </span>
    <header className="auth-topbar auth-in" style={{ "--d": "0ms" } as React.CSSProperties}>
      <div className="flex items-center justify-end px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1.5">
          <LangToggle />
          <button
            type="button"
            aria-label={dark ? t("تفعيل الوضع النهاري") : t("تفعيل الوضع الليلي")}
            aria-pressed={dark}
            onClick={onToggleDark}
            className="lux-btn rounded-full p-2.5 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]" data-tip={dark ? t("التبديل إلى الوضع النهاري") : t("التبديل إلى الوضع الليلي")} data-tip-pos="below" data-tip-align="start"
          >
            <Icon d={dark ? I.sun : I.moon} size={18} />
          </button>
        </div>
      </div>
    </header>
    <div className="auth-split">
      {/* v80 (owner's explicit call): the brand panel is
          REMOVED from this page entirely — no side panel on
          desktop, no compact logo+verse block above the form
          on mobile, no value-points list or line. The login
          page is now one clean centered column at every
          width: greeting, segmented control, fields, submit.
          The IS mark and the verse live on everywhere else
          in the app (header, sidebar, home H1) — untouched. */}
    <main className="auth-form-side">
      <div className="auth-form-card">
      {/* The bare IS mark alone at the head of the card — mark
          only, no panel, no verse, no wordmark (the v80 removal
          of the brand PANEL stands; the owner's logo brief for
          the new ribbon mark names this page explicitly, and the
          mark by itself is not the panel he removed). */}
      <div className="auth-in mb-5 flex justify-center" style={{ "--d": "20ms" } as React.CSSProperties}>
        <Logo size={64} />
      </div>
      <div className="auth-in auth-greeting" style={{ "--d": "40ms" } as React.CSSProperties}>
        <h1 className="auth-title">
          {mode === "login" ? (lang === "en" ? "Welcome back" : "أهلاً بعودتك") : lang === "en" ? "Your private IS account" : "حسابك الخاص في IS"}
        </h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? lang === "en" ? "Sign in to reach your saved shortcuts." : "سجّل دخولك عشان توصل لاختصاراتك المحفوظة"
            : lang === "en" ? "Create your account and keep your shortcuts private to you." : "اعمل حسابك واحفظ اختصاراتك الخاصة بيك"}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={lang === "en" ? "Sign-in method" : "طريقة الدخول"}
        data-active={mode}
        className="auth-in auth-tabs auth-seg"
        style={{ "--d": "130ms" } as React.CSSProperties}
      >
        <span className="auth-seg-thumb" aria-hidden="true" />
        {(
          [
            { key: "login", label: "تسجيل الدخول" },
            { key: "register", label: "حساب جديد" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={mode === tab.key}
            aria-label={t(tab.label)} data-tip={tab.key === "login" ? (lang === "en" ? "Have an account? Sign in" : "عندك حساب؟ سجّل دخولك") : lang === "en" ? "New here? Create your account" : "لسه جديد؟ اعمل حسابك"}
            onClick={() => {
              setMode(tab.key);
              setError(null);
            }}
            className="auth-seg-btn"
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {entering ? (
        <div
          role="status"
          className="auth-in auth-entering"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          <span className="btn-lux flex h-[72px] w-[72px] items-center justify-center rounded-full text-[var(--accent-ink)]">
            <span className="animate-copy-pop flex">
              <Icon d={I.check} size={34} strokeWidth={2} />
            </span>
          </span>
          <p className="animate-rise mt-5 text-xl font-extrabold">
            {mode === "register"
              ? lang === "en" ? "Account created" : "اتعمل حسابك"
              : lang === "en" ? "You're in" : "تمام — دخلت"}
          </p>
          <p className="animate-rise mt-1.5 text-sm font-semibold text-[var(--dim)]">
            {lang === "en" ? "Opening your library…" : "بنفتح مكتبتك…"}
          </p>
        </div>
      ) : (
      <form
        key={mode}
        className={`auth-in auth-form auth-mode-swap${error ? " auth-shake" : ""}`}
        style={{ "--d": "180ms" } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {mode === "register" && (
          <label className="block" data-tip={lang === "en" ? "Your full name — it appears in your account" : "اسمك الكامل — بيظهر في الترحيب وفي حسابك"}>
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Full name" : "الاسم الكامل"}</span>
            <span className="relative block">
              <span className={fieldIcon}>
                <Icon d={I.user} size={18} />
              </span>
              <input
                {...FIELDS.register.name}
                aria-label={lang === "en" ? "Full name" : "الاسم الكامل"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === "en" ? "e.g. Ibrahim Sobhi" : "مثال: إبراهيم صبحي"}
                autoComplete="name"
                className={field}
              />
            </span>
          </label>
        )}
        {mode === "register" ? (
          <>
            <label className="block" data-tip={lang === "en" ? "Your email — you'll sign in with it" : "بريدك الإلكتروني — هتسجّل دخولك بيه"}>
              <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Email" : "البريد الإلكتروني"}</span>
              <span className="relative block">
                <span className={fieldIcon}>
                  <Icon d={I.mail} size={18} />
                </span>
                <input
                  {...FIELDS.register.email}
                  aria-label={lang === "en" ? "Email" : "البريد الإلكتروني"}
                  dir="ltr"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className={`${field} text-left font-mono tracking-wide`}
                />
              </span>
            </label>
            <label className="block" data-tip={lang === "en" ? "Your Egyptian mobile — optional, and a second way to sign in" : "رقم موبايلك المصري — اختياري، وبيبقى طريقة دخول تانية"}>
              <span className="mb-1.5 block text-sm font-bold">
                {lang === "en" ? "Mobile number" : "رقم الموبايل"} <span className="font-semibold text-[var(--dim)]">{lang === "en" ? "(optional)" : "(اختياري)"}</span>
              </span>
              <span className="relative block">
                <span className={fieldIcon}>
                  <Icon d={I.phone} size={18} />
                </span>
                <input
                  {...FIELDS.register.phone}
                  aria-label={lang === "en" ? "Mobile number (optional)" : "رقم الموبايل (اختياري)"}
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className={`${field} text-left font-mono tracking-wide`}
                />
              </span>
              <span className="auth-helper">
                {lang === "en" ? "If you add it, you can also sign in with it alongside your email." : "لو كتبته، هتقدر تسجّل دخولك بيه كمان جنب البريد."}
              </span>
            </label>
          </>
        ) : (
          <label className="block" data-tip={lang === "en" ? "Your email or your mobile number — both work" : "بريدك الإلكتروني أو رقم موبايلك — الاتنين شغالين"}>
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Email or mobile number" : "البريد الإلكتروني أو رقم الموبايل"}</span>
            <span className="relative block">
              <span className={fieldIcon}>
                <Icon d={I.mail} size={18} />
              </span>
              <input
                {...FIELDS.login.identifier}
                aria-label={lang === "en" ? "Email or mobile number" : "البريد الإلكتروني أو رقم الموبايل"}
                dir="ltr"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@gmail.com"
                className={`${field} text-left font-mono tracking-wide`}
              />
            </span>
            <span className="auth-helper">
              {lang === "en" ? "Your old mobile account works as it is." : "حسابك القديم برقم الموبايل شغال زي ما هو."}
            </span>
          </label>
        )}
        <label className="block" data-tip={lang === "en" ? "Your password — nobody knows it but you" : "كلمة المرور بتاعتك — محدش يعرفها غيرك"}>
          <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Password" : "كلمة المرور"}</span>
          <span className="relative block">
            <span className={fieldIcon}>
              <Icon d={I.lock} size={18} />
            </span>
            {mode === "register" ? (
              <input
                {...FIELDS.register.password}
                aria-label={lang === "en" ? "Password" : "كلمة المرور"}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={lang === "en" ? "Any password you choose — even a short one" : "أي كلمة مرور تختارها — حتى لو قصيرة"}
                className={fieldPw}
              />
            ) : (
              <input
                {...FIELDS.login.password}
                aria-label={lang === "en" ? "Password" : "كلمة المرور"}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={lang === "en" ? "Your password" : "كلمة المرور بتاعتك"}
                className={fieldPw}
              />
            )}
            <button
              type="button"
              aria-label={showPassword ? (lang === "en" ? "Hide password" : "إخفاء كلمة المرور") : lang === "en" ? "Show password" : "إظهار كلمة المرور"} data-tip={showPassword ? (lang === "en" ? "Hide password" : "إخفاء كلمة المرور") : lang === "en" ? "Show password" : "إظهار كلمة المرور"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-[var(--radius)] p-2 text-[var(--dim)]"
            >
              <Icon d={showPassword ? I.eyeOff : I.eye} size={18} />
            </button>
          </span>
          {mode === "register" && password.length > 0 && (
            <span className="mt-2 block" aria-live="polite">
              <span className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      i <= strength.score
                        ? strength.score <= 1
                          ? "bg-[var(--danger)]"
                          : strength.score === 2
                            ? "bg-[var(--gold)]"
                            : "bg-[var(--cyan)]"
                        : "bg-[var(--surface-alt)]"
                    }`}
                  />
                ))}
              </span>
              <span className="mt-1 block text-xs font-semibold text-[var(--dim)]">
                {lang === "en" ? "Password strength: " : "قوة كلمة المرور: "}{lang === "en" ? ({ "ضعيفة": "Weak", "مقبولة": "Fair", "قوية": "Strong", "ممتازة": "Excellent" }[strength.label] ?? strength.label) : strength.label}
                {strength.score < 4 && (lang === "en" ? " — make it longer and mix letters and digits to strengthen it" : " — زوّد طولها واخلط حروف وأرقام عشان تقوى")}
              </span>
            </span>
          )}
        </label>

        {mode === "register" && (
          <label className="block" data-tip={lang === "en" ? "Type the password again to confirm" : "اكتب كلمة المرور تاني للتأكيد"}>
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Confirm password" : "تأكيد كلمة المرور"}</span>
            <span className="relative block">
              <span className={fieldIcon}>
                <Icon d={I.shield} size={18} />
              </span>
              <input
                aria-label={lang === "en" ? "Confirm password" : "تأكيد كلمة المرور"}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={lang === "en" ? "Type it again exactly" : "اكتبها تاني زي ما هي"}
                className={fieldPw}
              />
              <button
                type="button"
                aria-label={showConfirm ? (lang === "en" ? "Hide confirmation" : "إخفاء تأكيد كلمة المرور") : lang === "en" ? "Show confirmation" : "إظهار تأكيد كلمة المرور"} data-tip={showConfirm ? (lang === "en" ? "Hide confirmation" : "إخفاء التأكيد") : lang === "en" ? "Show confirmation" : "إظهار التأكيد"}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-[var(--radius)] p-2 text-[var(--dim)]"
              >
                <Icon d={showConfirm ? I.eyeOff : I.eye} size={18} />
              </button>
            </span>
            {confirm.length > 0 && (
              <span
                className={`mt-1 block text-xs font-semibold ${
                  confirm === password ? "text-[var(--cyan)]" : "text-[var(--danger)]"
                }`}
              >
                {confirm === password ? (lang === "en" ? "Matches the password" : "مطابقة لكلمة المرور") : lang === "en" ? "Doesn't match yet" : "لسه مش مطابقة"}
              </span>
            )}
          </label>
        )}

        {mode === "login" ? (
          <div className="auth-remember-wrap">
            <div className="auth-remember-row">
              <span className="auth-remember-main">
                <label className="auth-remember-label">
                  <input
                    type="checkbox"
                    aria-label={lang === "en" ? "Remember me on this device" : "تذكّرني على الجهاز ده"}
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="auth-checkbox"
                  />
                  {lang === "en" ? "Stay signed in on this device" : "ابقَ مسجّلًا على هذا الجهاز"}
                </label>
                <button
                  type="button"
                  aria-label={lang === "en" ? "What does staying signed in mean?" : "يعني إيه ابقى مسجّلًا على هذا الجهاز؟"}
                  aria-expanded={rememberInfoOpen}
                  onClick={() => setRememberInfoOpen((v) => !v)}
                  className="auth-info-btn"
                >
                  <Icon d={I.info} size={16} />
                </button>
              </span>
              <button
                type="button"
                aria-label={lang === "en" ? "Forgot your password?" : "نسيت كلمة المرور؟"}
                aria-expanded={forgotOpen}
                onClick={() => setForgotOpen((v) => !v)}
                className="auth-forgot-link"
              >
                {lang === "en" ? "Forgot your password?" : "نسيت كلمة المرور؟"}
              </button>
            </div>
            {rememberInfoOpen && (
              <p className="auth-popover" role="note">
                {lang === "en"
                  ? "Your email or mobile is saved on this device and filled in for you next time — sign-in itself stays open until you sign out."
                  : "بريدك أو رقم موبايلك بيتحفظ على الجهاز ده وبيتملى لك تلقائيًا المرة الجاية — والدخول نفسه بيفضل مفتوح لحد ما تسجّل خروج بنفسك."}
              </p>
            )}
            {forgotOpen && (
              <p className="animate-rise rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-3 text-sm leading-relaxed text-[var(--dim)]">
                {lang === "en"
                  ? "Your account stays open on the devices you signed in from — open the site on any of them and change your password from «My account». If you lost all your devices, contact the platform owner to reset your password from their account."
                  : "حسابك بيظل مفتوحاً على أجهزتك اللي سجّلت دخولك منها — افتح الموقع من أي جهاز منهم وغيّر كلمة المرور من «حسابي». ولو فقدت كل أجهزتك، تواصل مع صاحب المنصة عشان يعيد تعيين كلمة مرورك من حسابه."}
              </p>
            )}
          </div>
        ) : (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed" data-tip={lang === "en" ? "Agree to the terms of use and privacy policy" : "الموافقة على شروط الاستخدام وسياسة الخصوصية"}>
            <input
              type="checkbox"
              aria-label={lang === "en" ? "I agree to the terms of use and privacy policy" : "أوافق على شروط الاستخدام وسياسة الخصوصية"}
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              {lang === "en"
                ? "I agree to the terms of use and privacy policy — my replies are private to me, saved in my account, and no other account can reach them."
                : "أوافق على شروط الاستخدام وسياسة الخصوصية — اختصاراتي خاصة بيا ومحفوظة في حسابي، ومفيش أي حساب تاني يقدر يوصل لها."}
            </span>
          </label>
        )}

        {error && (
          <p role="alert" aria-live="assertive" className="auth-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          aria-label={mode === "login" ? (lang === "en" ? "Sign in" : "دخول") : lang === "en" ? "Create account" : "إنشاء الحساب"} data-tip={mode === "login" ? (lang === "en" ? "Sign in to your account" : "تسجيل الدخول إلى حسابك") : lang === "en" ? "Create your account and enter right away" : "إنشاء حسابك والدخول فوراً"}
          disabled={authMut.isPending}
          className="btn-lux auth-submit disabled:opacity-60"
        >
          {authMut.isPending ? (
            <span className="auth-btn-loading">
              <span className="auth-spinner" aria-hidden="true" />
              {lang === "en" ? "One moment…" : "لحظة…"}
            </span>
          ) : mode === "login" ? (
            lang === "en" ? "Sign in" : "دخول"
          ) : lang === "en" ? (
            "Create account & enter"
          ) : (
            "إنشاء الحساب والدخول"
          )}
        </button>
      </form>
      )}

      {/* One quiet privacy line (merged): sessions live on
          this device only and stay open until sign-out. */}
      <p className="auth-in auth-privacy" style={{ "--d": "300ms" } as React.CSSProperties}>
        <Icon d={I.shield} size={15} />
        {lang === "en"
          ? "Your session lives on this device only, and stays open until you sign out yourself."
          : "جلستك على الجهاز ده بس، وبتفضل مفتوحة لحد ما تسجّل الخروج بنفسك."}
      </p>
      </div>
    </main>
    </div>
    </div>
  );
}

function Workspace({
  token,
  user,
  themeMode,
  onThemeMode,
  onLogout,
}: {
  token: string;
  user: User;
  themeMode: ThemeMode;
  onThemeMode: (mode: ThemeMode, origin?: { x: number; y: number }) => void;
  onLogout: () => void;
}) {
  const queryClient = useQueryClient();
  const { lang, t } = useLang();
  /* Direction-aware icons: in Arabic the «forward / into» chevron
     points left; in English it points right. */
  const chevDir = lang === "ar" ? I.chevronLeft : I.chevronRight;
  const [section, setSection] = useState<Section>("home");
  const [previewItem, setPreviewItem] = useState<Shortcut | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  /* The chosen view persists on this device, like the density and
     the folder sort already do — the site reopens on the view the
     user was actually using, not a reset default. */
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem("is-list-view");
      return v === "favorites" || v === "used" || v === "history" || v === "most" || v === "recent" || v === "least" || v === "unused"
        ? v
        : "default";
    } catch {
      return "default";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("is-list-view", view);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  }, [view]);
  const searchRef = useRef<HTMLInputElement>(null);
  /* Smart folders: the id of the smart folder whose live rules the
     list is currently showing (null = no smart view). The rules
     themselves live server-side; the list evaluates them against
     the loaded library, so a smart view is always current. */
  const [smartId, setSmartId] = useState<number | null>(null);
  const [smartEditor, setSmartEditor] = useState<{ open: boolean; item: SmartFolderT | null }>({ open: false, item: null });
  /* Advanced search filters — combinable on top of any view: tags
     (any-of), favorites only, pinned only, and a last-edited window.
     They live beside the view switcher and reset with «مسح الفلاتر». */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyPin, setOnlyPin] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const filtersActive = filterTags.length > 0 || onlyFav || onlyPin || dateRange !== "all";
  const clearFilters = () => {
    setFilterTags([]);
    setOnlyFav(false);
    setOnlyPin(false);
    setDateRange("all");
  };
  const [toast, setToast] = useState<ToastState>(null);
  const [editor, setEditor] = useState<{
    open: boolean;
    item: Shortcut | null;
    presetFolderId?: number | null;
    presetTitle?: string;
  }>({
    open: false,
    item: null,
  });
  const [guideOpen, setGuideOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [fillVarsItem, setFillVarsItem] = useState<Shortcut | null>(null);
  /* Folder-view ordering + its little menu (see FolderSort). */
  const [folderSort, setFolderSort] = useState<FolderSort>(() => {
    try {
      const v = localStorage.getItem("is-folder-sort");
      return v === "name" || v === "updated" || v === "usage" ? v : "manual";
    } catch {
      return "manual";
    }
  });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("is-folder-sort", folderSort);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  }, [folderSort]);
  useEscapeClose(() => setSortMenuOpen(false));
  /* لون التمييز: اختيار بصري من 12 لونًا — بيتلون بيه كل
     عنصر مميز في الواجهة (والشعار والفافيكون معاهم)،
     وبيتحفظ على الجهاز ده. الافتراضي هو الملكي بتاع
     NEBULA. */
  const [accent, setAccent] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("is-accent");
      /* ترحيل v89 (يصحّح قصور ترحيل v88): بناء الهوية الذهبية
         المرفوض فرض «العنبري» (ذهبيّ ذلك البناء) افتراضيًا
         وكتبه على الأجهزة من غير اختيار مقصود من قايمة
         المظهر. ترحيل v88 اعتمد على علمٍ منفصل
         (is-accent-nebula88) قد يكون اتعلّم على جهاز المالك
         بينما القيمة العنبرية نفسها فضلت محفوظة — ففضل شايف
         الهوية الذهبية المرفوضة وكأن شيئًا لم يتغيّر. القاعدة
         الآن أبسط وأقوى: أي قيمة محفوظة مش من قايمة الألوان
         الحالية تُشفى للملكي، والعنبري المحفوظ يُرحَّل للملكي
         ما لم يكن علم v89 (is-accent-nebula89) موجودًا — وهو
         لا يُكتب إلا هنا عند الترحيل أو عند اختيار مقصود من
         قايمة المظهر في هذا البناء نفسه (انظر زر اختيار
         اللون)، فأي اختيار عنبري مقصود بعد كده يفضل ثابتًا. */
      if (!stored || !ACCENTS.some((a) => a.key === stored)) {
        return "royal";
      }
      if (stored === "amber" && !localStorage.getItem("is-accent-nebula89")) {
        localStorage.setItem("is-accent-nebula89", "1");
        return "royal";
      }
      return stored;
    } catch { return "royal"; }
  });
  const [accentOpen, setAccentOpen] = useState(false);
  useEscapeClose(() => setAccentOpen(false));
  useEffect(() => {
    try {
      document.documentElement.dataset.accent = accent;
      localStorage.setItem("is-accent", accent);
      /* الفافيكون بيتولّد من نفس علامة القوس بلون التمييز
         المختار نفسه — بيتولّد من جديد مع كل تغيير لون،
         زي الشعار اللي في الصفحة بالظبط. */
      const iconLink =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (iconLink) {
        const swatch =
          ACCENTS.find((a) => a.key === accent)?.swatch ?? "#1668C4";
        iconLink.href = logoFaviconHref(swatch);
      }
    } catch { /* storage unavailable */ }
  }, [accent]);
  /* لون الأيقونات العام (v73): لون واحد يلوّن أيقونات الواجهة
     العامة (الهيدر، إجراءات الكروت، شريط التنقل السفلي، الأزرار
     الهادئة) — «auto» يعني الألوان الحالية كما هي. و«نمط بلاطات
     المجلدات»: ملوّنة كما هي أو شفافة بلا خلفية. الاختياران
     بصريان فقط وبيتحفظوا على الجهاز ده زي لون التمييز. */
  const [iconTone, setIconTone] = useState<string>(() => {
    try { return localStorage.getItem("is-icon-tone") || "auto"; } catch { return "auto"; }
  });
  const [iconStyle, setIconStyle] = useState<string>(() => {
    try { return localStorage.getItem("is-icon-style") || "tinted"; } catch { return "tinted"; }
  });
  useEffect(() => {
    try {
      const root = document.documentElement;
      /* A custom tone is stored as "custom:#rrggbb": the dataset
         carries the plain "custom" marker (so the :not(auto)
         colour rules apply) and the hex itself goes in as an
         inline --icon-tone, which outranks every named rule.
         Any named/auto choice clears the inline value again. */
      if (iconTone.startsWith("custom:#")) {
        root.dataset.iconTone = "custom";
        root.style.setProperty("--icon-tone", iconTone.slice("custom:".length));
      } else {
        root.dataset.iconTone = iconTone;
        root.style.removeProperty("--icon-tone");
      }
      localStorage.setItem("is-icon-tone", iconTone);
    } catch { /* storage unavailable */ }
  }, [iconTone]);
  useEffect(() => {
    try {
      document.documentElement.dataset.iconStyle = iconStyle;
      localStorage.setItem("is-icon-style", iconStyle);
    } catch { /* storage unavailable */ }
  }, [iconStyle]);
  /* Header popovers (المظهر/الحساب) و«المزيد» في شريط الفلاتر:
     إغلاق بالضغط خارجها — رفيق Escape القياسي في كل المنبثقات. */
  const appearanceRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  useEscapeClose(() => setAccountMenuOpen(false));
  useClickOutside(appearanceRef, accentOpen, () => setAccentOpen(false));
  useClickOutside(accountRef, accountMenuOpen, () => setAccountMenuOpen(false));
  const closeAccountMenu = () => {
    setAccountMenuOpen(false);
    accountBtnRef.current?.focus();
  };
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const morePopRef = useRef<HTMLDivElement>(null);
  const [morePos, setMorePos] = useState<{ top: number; right: number } | null>(null);
  useEscapeClose(() => setMoreOpen(false));
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (moreBtnRef.current?.contains(t) || morePopRef.current?.contains(t)) return;
      setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen]);
  /* Sliding thumbs for the filter pills and the density segmented
     control: measured from the live buttons (offsetLeft/Width), so
     the accent thumb glides to whichever pill is active in either
     direction, and hides when a «المزيد» view is the active one.
     The measuring effect itself lives below, after `density` and
     `shortcuts` are declared. */
  const pillTrackRef = useRef<HTMLDivElement>(null);
  const [pillThumb, setPillThumb] = useState<{ left: number; width: number } | null>(null);
  const densityTrackRef = useRef<HTMLDivElement>(null);
  const [densityThumb, setDensityThumb] = useState<{ left: number; width: number } | null>(null);
  /* مجلدات مطوية لثلاثة ردود في العرض المجمّع — «عرض المزيد»
     يفتح مجلدًا بعينه من غير ما يغيّر أي بيانات. */
  const [groupOpen, setGroupOpen] = useState<Set<string>>(new Set());
  const toggleGroupOpen = (name: string) =>
    setGroupOpen((p) => {
      const next = new Set(p);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  /* البانر العلوي: أخف من قبل وقابل للإخفاء — الاختيار بيتحفظ */
  const [heroHidden, setHeroHidden] = useState<boolean>(() => {
    try { return localStorage.getItem("is-hero-hidden") === "1"; } catch { return false; }
  });
  const toggleHero = (hide: boolean) => {
    setHeroHidden(hide);
    try { localStorage.setItem("is-hero-hidden", hide ? "1" : "0"); } catch { /* ignore */ }
  };
  /* Response-system state: the selected reply whose details panel is
     open, the list density, whether an active search runs over the
     whole library or only the current folder, the folder whose
     settings sheet is open, a parsed import waiting for its preview
     confirmation. */
  const [detailItem, setDetailItem] = useState<Shortcut | null>(null);
  const [density, setDensity] = useState<ListDensity>(() => {
    try {
      const v = localStorage.getItem("is-list-density");
      return v === "comfortable" || v === "grid" ? v : "compact";
    } catch {
      return "compact";
    }
  });
  const [searchScope, setSearchScope] = useState<"all" | "folder">("all");
  const [folderSettingsId, setFolderSettingsId] = useState<number | null>(null);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    items: Array<{
      title: string;
      body: string;
      category: string;
      tags?: string;
      extShortcut?: string;
      source?: string;
    }>;
  } | null>(null);
  const [treeFormError, setTreeFormError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  /* Hierarchical sidebar state — which groups are open, whether the
     sidebar is collapsed to its icon rail, and the in-sidebar search.
     Open groups and the rail choice persist on this device, so the
     sidebar comes back exactly as the user left it; several groups
     can stay open at once. */
  /* Sidebar width — the user drags the bar's edge to any width he
     likes (72–440px) and it is remembered on this device. At or
     below 120px the bar renders as the labelled icon rail; wider
     than that it renders the full tree. Older devices that only
     stored the rail flag start collapsed when that flag was set. */
  const [sideW, setSideW] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("is-sidebar-width"));
      if (Number.isFinite(v) && v >= 72 && v <= 440) return v;
      return localStorage.getItem("is-sidebar-rail") === "1" ? 72 : 268;
    } catch {
      return 268;
    }
  });
  const [sideDragging, setSideDragging] = useState(false);
  const rail = sideW <= 120;
  const setRail = (r: boolean) => setSideW(r ? 72 : 268);
  /* File-explorer tree state — which nodes are open. Every node
     toggles on its own, several branches can stay open at once, and
     the whole map persists on this device so the tree comes back
     exactly as the user left it after navigating anywhere. */
  const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("is-tree-open");
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* fall through to defaults */
    }
    return { "g:library": true, "g:sources": true, "g:tools": true, "g:account": true };
  });
  /* The folder a source assignment just moved: after the tree
     refetches, this folder's row flashes brass for a few seconds
     under its (now expanded) source main folder, so the move is
     SEEN, not just announced. Set by the setFolderSource
     mutation; cleared by its own timer. */
  const [flashFolderId, setFlashFolderId] = useState<number | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const flashFolder = (id: number) => {
    window.clearTimeout(flashTimer.current);
    setFlashFolderId(id);
    flashTimer.current = window.setTimeout(() => setFlashFolderId(null), 3400);
  };
  const [navQuery, setNavQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setVisibleCount(30);
  }, [search, category, view]);

  /* Scroll awareness: once the page moves, the header earns a soft
     shadow so it lifts off the content passing under it, and deep
     in a long list a back-to-top button surfaces — one tap home
     instead of a long scroll back. */
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setShowTop(window.scrollY > 700);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Connectivity honesty: when the connection drops, a slim banner
     says so plainly — browsing and copying keep working from what
     is already loaded, but a new save cannot reach the library
     until the connection is back. The browser's own online/offline
     events drive it; nothing is polled or faked. */
  const [offline, setOffline] = useState<boolean>(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("is-sidebar-width", String(sideW));
      localStorage.setItem("is-sidebar-rail", rail ? "1" : "0");
    } catch {
      /* storage unavailable — the width just won't persist */
    }
  }, [sideW, rail]);

  /* Dragging the sidebar edge (rebuilt in v81 — the old drag was
     the heart of the «القايمة مش بتتحرك كويس وبيحصل أخطاء»
     report):
     • The width no longer goes through React state on every
       pointer move. A move writes the width straight onto the
       <aside> DOM node (asideRef), so a drag costs no re-render
       of the whole workspace; the state is committed ONCE when
       the pointer is released, which is also the only moment
       the rail/full content mode can flip — no flicker while
       crossing the threshold mid-drag.
     • ONE pair of window-level move/up listeners drives the
       drag, registered by whichever path starts it (pointer or
       mouse). sideDown refuses to start a second drag while one
       is running, so the pointer path and the compatibility
       mouse path can never double-drive and reset each other's
       start point (the old jump/error). The up listener is on
       the window for BOTH pointer and mouse, and pointercancel
       ends the drag too — the bar can never be left stuck in
       the dragging state.
     • No setPointerCapture anymore: it threw in some webviews
       and was redundant once the listeners live on the window.
     The width follows the pointer exactly (RTL: the bar sits at
     the inline-start, so moving the pointer toward the content
     grows it), clamped to 72–440. Releasing under 130px snaps
     to the 72px rail so the collapsed state is always clean. */
  const asideRef = useRef<HTMLElement | null>(null);
  const sideDragRef = useRef<{ startX: number; startW: number; lastW: number } | null>(null);
  const sideCleanupRef = useRef<(() => void) | null>(null);
  const sideDown = (clientX: number) => {
    if (sideDragRef.current) return;
    sideDragRef.current = { startX: clientX, startW: sideW, lastW: sideW };
    setSideDragging(true);
    const move = (ev: PointerEvent | MouseEvent) => sideMove(ev.clientX);
    const up = () => sideUp();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    sideCleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  };
  const sideMove = (clientX: number) => {
    const d = sideDragRef.current;
    if (!d) return;
    const delta = (lang === "en" ? 1 : -1) * (clientX - d.startX);
    const w = Math.min(440, Math.max(72, Math.round(d.startW + delta)));
    d.lastW = w;
    const el = asideRef.current;
    if (el) el.style.width = `${w}px`;
  };
  const sideUp = () => {
    const d = sideDragRef.current;
    if (!d) return;
    sideDragRef.current = null;
    sideCleanupRef.current?.();
    sideCleanupRef.current = null;
    setSideDragging(false);
    setSideW(d.lastW < 130 ? 72 : d.lastW);
  };
  const onSideHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    sideDown(e.clientX);
  };
  /* Mouse fallback: some webviews deliver mouse events without
     pointer events. It only ever STARTS the drag when the
     pointer path never did (sideDown's guard), and from there
     the same shared window listeners drive it. */
  const onSideHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    sideDown(e.clientX);
  };
  /* If the workspace unmounts mid-drag, the window listeners go
     with it — nothing outlives the page. */
  useEffect(
    () => () => {
      sideCleanupRef.current?.();
      sideCleanupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem("is-tree-open", JSON.stringify(treeOpen));
    } catch {
      /* storage unavailable — tree state just won't persist */
    }
  }, [treeOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("is-list-density", density);
    } catch {
      /* storage unavailable — the density just won't persist */
    }
  }, [density]);

  /* Mobile navigation drawer: Esc closes it, and the page behind it
     does not scroll while it is open. */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  /* No custom keyboard shortcuts anywhere in the site — every
     action is reached with the mouse (or touch). The only key the
     app listens for globally is Escape, purely as a dismissal key
     for floating layers, which is standard dialog behaviour. */

  /* Esc closes the details panel — the lightest layer on screen. */
  useEffect(() => {
    if (!detailItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailItem]);

  const shortcutsQuery = useQuery({
    queryKey: ["shortcuts", token],
    queryFn: () => api.listShortcuts({ token }),
  });
  const shortcuts = useMemo(
    () => shortcutsQuery.data?.shortcuts ?? [],
    [shortcutsQuery.data],
  );

  /* قياس إبهامَي شريط الفلاتر المنزلقَين (انظر تعريف الحالتين فوق) */
  useLayoutEffect(() => {
    const measure = () => {
      const track = pillTrackRef.current;
      const btn =
        track && smartId === null
          ? track.querySelector<HTMLElement>(`[data-view-pill="${view}"]`)
          : null;
      setPillThumb(btn ? { left: btn.offsetLeft, width: btn.offsetWidth } : null);
      const dTrack = densityTrackRef.current;
      const dBtn = dTrack?.querySelector<HTMLElement>(`[data-density-seg="${density}"]`) ?? null;
      setDensityThumb(dBtn ? { left: dBtn.offsetLeft, width: dBtn.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, smartId, density, lang, shortcuts.length]);

  const showToast = (msg: string, kind: ToastKind = "success") => {
    setToast({ text: msg, kind });
    window.clearTimeout(toastTimer.current);
    /* A toast lives long enough to actually be read: the short
       confirmations keep their quick 2.2s, and a longer message
       stays proportionally longer instead of vanishing
       mid-sentence. */
    const ms = Math.min(6500, Math.max(2200, msg.length * 55));
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["shortcuts", token] });
    void queryClient.invalidateQueries({ queryKey: ["copyHistory", token] });
  };

  const recordUse = useMutation({
    mutationFn: (id: number) => api.recordUse({ token, id }),
    onSuccess: invalidate,
  });

  const togglePin = useMutation({
    mutationFn: async (s: Shortcut) =>
      await api.togglePin({ token, id: s.id, pinned: !s.pinned }),
    onSuccess: invalidate,
    onError: () => showToast("التثبيت متمّش — حاول تاني", "error"),
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: number) => await api.duplicateShortcut({ token, id }),
    onSuccess: (res) => {
      invalidate();
      showToast(`اتعملت نسخة: ${res.shortcut.title}`);
    },
    onError: () => showToast("التكرار متمّش — حاول تاني", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => await api.deleteShortcut({ token, id }),
    onSuccess: () => {
      invalidate();
      invalidateTrash();
      showToast("اتنقل الرد لسلة المهملات — تقدر ترجعه منها في أي وقت");
    },
    onError: () => showToast("الحذف متمّش — حاول تاني", "error"),
  });

  const importMut = useMutation({
    mutationFn: async (v: {
      items: Array<{ title: string; body: string; category: string; tags?: string }>;
      mode: "merge" | "replace";
    }) => await api.importShortcuts({ token, items: v.items, mode: v.mode }),
    onSuccess: (res, v) => {
      invalidate();
      setImportPreview(null);
      showToast(
        v.mode === "replace"
          ? `اتستبدلت المكتبة — اتستورد ${res.imported} رد`
          : `اتضافت ${res.imported} اختصار، واتتخطى ${res.skipped} موجود قبل كده`,
      );
    },
    onError: () => showToast("الاستيراد متمّش — حاول تاني", "error"),
  });

  /* Copy history — real server log of successful copies (site and
     extension report into it). */
  const historyQuery = useQuery({
    queryKey: ["copyHistory", token],
    queryFn: () => api.listCopyHistory({ token }),
    enabled: view === "history",
  });
  const clearHistoryMut = useMutation({
    mutationFn: async () => await api.clearCopyHistory({ token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["copyHistory", token] });
      showToast("اتمسح سجل النسخ");
    },
    onError: () => showToast("مسح السجل متمّش — حاول تاني", "error"),
  });

  /* Favorites — a state of their own, separate from pinning. */
  const toggleFavorite = useMutation({
    mutationFn: async (s: Shortcut) =>
      await api.toggleFavorite({ token, id: s.id, favorite: !s.favorite }),
    onSuccess: (_res, s) => {
      invalidate();
      showToast(s.favorite ? `اتشال «${s.title}» من المفضلة` : `اتضاف «${s.title}» للمفضلة`);
    },
    onError: () => showToast("تغيير المفضلة متمّش — حاول تاني", "error"),
  });

  /* Smart folders — the saved rule sets. */
  const smartQuery = useQuery({
    queryKey: ["smartFolders", token],
    queryFn: () => api.listSmartFolders({ token }),
  });
  const smartFolders = useMemo(
    () => smartQuery.data?.smartFolders ?? [],
    [smartQuery.data],
  );
  const invalidateSmart = () =>
    void queryClient.invalidateQueries({ queryKey: ["smartFolders", token] });
  const deleteSmartMut = useMutation({
    mutationFn: async (id: number) => await api.deleteSmartFolder({ token, id }),
    onSuccess: () => {
      invalidateSmart();
      setSmartId(null);
      showToast("اتحذف المجلد الذكي — الردود نفسها متأثرتش");
    },
    onError: () => showToast("حذف المجلد الذكي متمّش — حاول تاني", "error"),
  });

  /* Trash — soft-deleted replies and folders, restorable until the
     user deletes them forever or empties the trash. */
  const trashQuery = useQuery({
    queryKey: ["trash", token],
    queryFn: () => api.listTrash({ token }),
    enabled: view === "trash",
  });
  const invalidateTrash = () =>
    void queryClient.invalidateQueries({ queryKey: ["trash", token] });
  const restoreShortcutMut = useMutation({
    mutationFn: async (id: number) => await api.restoreShortcut({ token, id }),
    onSuccess: () => {
      invalidate();
      invalidateTrash();
      showToast("رجع الرد لمكانه في المكتبة");
    },
    onError: () => showToast("الاستعادة متمّتش — حاول تاني", "error"),
  });
  const restoreFolderMut = useMutation({
    mutationFn: async (id: number) => await api.restoreFolder({ token, id }),
    onSuccess: () => {
      invalidate();
      invalidateFolders();
      invalidateTrash();
      showToast("رجع المجلد بكل اللي جواه");
    },
    onError: () => showToast("الاستعادة متمّتش — حاول تاني", "error"),
  });
  const foreverShortcutMut = useMutation({
    mutationFn: async (id: number) => await api.deleteShortcutForever({ token, id }),
    onSuccess: () => {
      invalidateTrash();
      showToast("اتحذف الرد نهائياً");
    },
    onError: () => showToast("الحذف النهائي متمّش — حاول تاني", "error"),
  });
  const foreverFolderMut = useMutation({
    mutationFn: async (id: number) => await api.deleteFolderForever({ token, id }),
    onSuccess: () => {
      invalidateTrash();
      showToast("اتحذف المجلد نهائياً بكل اللي جواه");
    },
    onError: () => showToast("الحذف النهائي متمّش — حاول تاني", "error"),
  });
  const emptyTrashMut = useMutation({
    mutationFn: async () => await api.emptyTrash({ token }),
    onSuccess: (res) => {
      invalidate();
      invalidateFolders();
      invalidateTrash();
      showToast(res.removed > 0 ? `اتفرّغت سلة المهملات — اتحذف ${res.removed} عنصر نهائياً` : "سلة المهملات فاضية أصلاً");
    },
    onError: () => showToast("تفريغ السلة متمّش — حاول تاني", "error"),
  });

  /* Folder duplicate — the whole subtree with its replies. */
  const duplicateFolderMut = useMutation({
    mutationFn: async (id: number) => await api.duplicateFolder({ token, id }),
    onSuccess: (res) => {
      invalidate();
      invalidateFolders();
      showToast(`اتعملت نسخة من المجلد: ${res.folder.name}`);
    },
    onError: () => showToast("تكرار المجلد متمّش — حاول تاني", "error"),
  });

  /* Bulk operations over the current multi-selection. */
  const bulkMut = useMutation({
    mutationFn: async (v: { ids: number[]; op: "pin" | "unpin" | "favorite" | "unfavorite" | "trash" | "addTag"; tag?: string }) =>
      await api.bulkUpdateShortcuts({ token, ids: v.ids, op: v.op, ...(v.tag ? { tag: v.tag } : {}) }),
    onSuccess: (res, v) => {
      invalidate();
      if (v.op === "trash") invalidateTrash();
      setSelectedIds(new Set());
      showToast(
        v.op === "trash"
          ? `اتنقل ${res.changed} رد لسلة المهملات — تقدر ترجعهم منها`
          : v.op === "addTag"
            ? `اتضاف الوسم «${v.tag}» لـ ${res.changed} رد`
            : `اتنفذت العملية على ${res.changed} رد`,
      );
    },
    onError: () => showToast("العملية الجماعية متمّتش — حاول تاني", "error"),
  });

  const starterMut = useMutation({
    mutationFn: async () => await api.loadStarterPack({ token }),
    onSuccess: (res) => {
      invalidate();
      /* The pack's replies arrive grouped in folders the server creates
         from their categories — refresh the folder tree too, or the new
         folders only appear after a manual reload. */
      void queryClient.invalidateQueries({ queryKey: ["folders", token] });
      showToast(
        res.seeded > 0
          ? `اتحملت ${res.seeded} رد جاهز في مكتبتك`
          : "المكتبة فيها ردود بالفعل",
      );
    },
    onError: () => showToast("التحميل متمّش — حاول تاني", "error"),
  });

  const copyFilled = async (s: Shortcut, text: string): Promise<boolean> => {
    const ok = await copyText(text);
    if (ok) {
      recordUse.mutate(s.id);
      showToast(`اتنسخ «${s.title}» — الصقه في أي شات`);
    } else {
      showToast("النسخ متعذر هنا — افتح الرد وانسخه يدوي", "error");
    }
    return ok;
  };

  /* Returns true only when text actually landed on the clipboard, so
     the card's «اتنسخ» state never claims a copy that did not happen
     (e.g. when the fill-in sheet opens instead). */
  const handleCopy = async (s: Shortcut): Promise<boolean> => {
    // Smart variables: anything the user must supply (الاسم، السنة
    // الدراسية، …) opens the fill-in sheet with a live preview first.
    // {التاريخ} و{الوقت} fill themselves, so they never block a copy.
    const manual = extractVariables(s.body).filter(
      (v) => v !== "{التاريخ}" && v !== "{الوقت}",
    );
    if (manual.length > 0) {
      setFillVarsItem(s);
      return false;
    }
    return copyFilled(s, fillDynamic(s.body));
  };

  const categories = useMemo(() => {
    const present = new Set(shortcuts.map((s) => s.category));
    const ordered = KNOWN_CATEGORIES.filter((c) => present.has(c));
    const extras = [...present].filter((c) => !KNOWN_CATEGORIES.includes(c));
    return ["الكل", ...ordered, ...extras];
  }, [shortcuts]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shortcuts) map.set(s.category, (map.get(s.category) ?? 0) + 1);
    return map;
  }, [shortcuts]);

  /* Every distinct tag in the library — the advanced filter's chips
     and the smart-folder editor's tag choices both read this list. */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of shortcuts) for (const tg of parseTags(s.tags)) set.add(tg);
    return [...set].sort((a, b) => a.localeCompare(b, "ar"));
  }, [shortcuts]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const searching = q.length > 0;
    const list = shortcuts.filter((s) => {
      if (view === "favorites" && !s.favorite) return false;
      if (view === "used" && !s.lastUsedAt) return false;
      if (view === "unused" && s.lastUsedAt) return false;
      /* Advanced filters combine with every view and search. */
      if (onlyFav && !s.favorite) return false;
      if (onlyPin && !s.pinned) return false;
      if (filterTags.length > 0) {
        const mine = parseTags(s.tags);
        if (!filterTags.some((tg) => mine.includes(tg))) return false;
      }
      if (dateRange !== "all") {
        const upd = new Date(s.updatedAt).getTime();
        if (dateRange === "today" && new Date(s.updatedAt).toDateString() !== new Date().toDateString()) return false;
        if (dateRange === "week" && Date.now() - upd > 7 * 86400000) return false;
        if (dateRange === "month" && Date.now() - upd > 30 * 86400000) return false;
      }
      // A search runs over the whole library by default (the brief's
      // rule); only the explicit «المجلد الحالي» scope keeps the
      // folder filter while searching.
      if (category !== "الكل" && s.category !== category && !(searching && searchScope === "all")) return false;
      if (!searching) return true;
      return searchScore(s, q) >= 0;
    });
    if (searching) {
      return [...list].sort((a, b) => searchScore(b, q) - searchScore(a, q));
    }
    if (view === "most") {
      return [...list].sort((a, b) => b.usageCount - a.usageCount || b.id - a.id);
    }
    if (view === "least") {
      return [...list].sort(
        (a, b) =>
          a.usageCount - b.usageCount ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    if (view === "unused") {
      return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    if (view === "used") {
      return [...list].sort(
        (a, b) =>
          new Date(b.lastUsedAt ?? 0).getTime() -
          new Date(a.lastUsedAt ?? 0).getTime(),
      );
    }
    if (view === "recent") {
      return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    /* Inside one folder, the folder's own sort control rules the
       list (الترتيب داخل المجلد): manual is the user's drag order,
       the others re-read the same rows by name / last edit / usage.
       Pinned replies stay on top in every mode, like everywhere
       else in the library. */
    if (view === "default" && category !== "الكل") {
      const pinFirst = (a: Shortcut, b: Shortcut) =>
        Number(b.pinned) - Number(a.pinned);
      if (folderSort === "name") {
        return [...list].sort(
          (a, b) => pinFirst(a, b) || a.title.localeCompare(b.title, "ar"),
        );
      }
      if (folderSort === "updated") {
        return [...list].sort(
          (a, b) =>
            pinFirst(a, b) ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      }
      if (folderSort === "usage") {
        return [...list].sort(
          (a, b) =>
            pinFirst(a, b) ||
            b.usageCount - a.usageCount ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      }
      return [...list].sort(
        (a, b) => pinFirst(a, b) || a.sortOrder - b.sortOrder || a.id - b.id,
      );
    }
    return list;
  }, [shortcuts, search, category, view, searchScope, folderSort, filterTags, onlyFav, onlyPin, dateRange]);

  // The registered name is shown at the top everywhere. Accounts whose
  // name is still blank fall back to their email, then their mobile
  // number, until they add a name from «حسابي».
  const displayName = user.name.trim()
    ? user.name.trim()
    : (user.email ?? user.phone ?? "حسابك");
  /* The home head no longer greets by name — the owner replaced the
     greeting line with a Quranic verse (rendered where the greeting
     used to be). */

  const folderCount = useMemo(
    () => new Set(shortcuts.map((s) => s.category)).size,
    [shortcuts],
  );

  const goCategory = (c: string) => {
    setSmartId(null);
    setCategory(c);
    setSection("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => {
    setSmartId(null);
    setView("default");
    setCategory("الكل");
    setSearch("");
    setSection("home");
    window.scrollTo({ top: 0 });
  };

  /* Open a smart folder: the list shows whichever replies match
     its rules right now — nothing is copied or moved. */
  const goSmart = (sf: SmartFolderT) => {
    setSmartId(sf.id);
    setView("default");
    setCategory("الكل");
    setSearch("");
    setSection("home");
    window.scrollTo({ top: 0 });
  };

  const goTrash = () => {
    setSmartId(null);
    setView("trash");
    setSection("home");
    window.scrollTo({ top: 0 });
  };

  const goSection = (s: Section) => {
    setSection(s);
    window.scrollTo({ top: 0 });
  };

  /* ---------- file-explorer tree ----------
     The whole site as one nested tree, like a professional file
     explorer: main groups are folders, user folders nest inside
     each other without a depth limit, and every reply is a leaf
     page inside its folder. Every node opens and closes on its own
     (state persisted on this device), arrows rotate to show the
     state, indentation grows one quiet step per level, and folders
     and replies drag between levels with the new order saved
     automatically — with undo/redo for every move. */
  const foldersQuery = useQuery({
    queryKey: ["folders", token],
    queryFn: () => api.listFolders({ token }),
  });
  const folders = useMemo(
    () => foldersQuery.data?.folders ?? [],
    [foldersQuery.data],
  );
  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders],
  );
  const folderNameOf = (id: number | null): string =>
    id !== null ? (folderById.get(id)?.name ?? "عام") : "عام";

  /* The full path of a folder («أسعار / ثانوي / عام»), so any reply
     can say exactly where it lives — in its details, in search
     results, everywhere. */
  const folderPathOf = (folderId: number | null): string => {
    if (folderId === null) return "المستوى الرئيسي";
    const parts: string[] = [];
    let cur = folderById.get(folderId);
    const guard = new Set<number>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parentId !== null ? folderById.get(cur.parentId) : undefined;
    }
    return parts.length > 0 ? parts.join(" / ") : "المستوى الرئيسي";
  };

  const childFolders = useMemo(() => {
    const m = new Map<number | null, FolderRowT[]>();
    for (const f of folders) {
      const arr = m.get(f.parentId) ?? [];
      arr.push(f);
      m.set(f.parentId, arr);
    }
    for (const arr of m.values())
      arr.sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          a.sortOrder - b.sortOrder ||
          a.id - b.id,
      );
    return m;
  }, [folders]);

  const folderShortcuts = useMemo(() => {
    const m = new Map<number | null, Shortcut[]>();
    for (const s of shortcuts) {
      const key = s.folderId ?? null;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    return m;
  }, [shortcuts]);

  /* The smart folder currently open (if any) and the list the main
     area actually renders: the view/search/filter pipeline first,
     then the smart folder's rules on top. A smart folder copies
     nothing — it is a live reading of the same rows. */
  const activeSmart = useMemo(
    () => (smartId !== null ? (smartFolders.find((f) => f.id === smartId) ?? null) : null),
    [smartId, smartFolders],
  );
  const displayList = useMemo(() => {
    if (!activeSmart) return filtered;
    const sf = activeSmart;
    let scope: Set<number> | null = null;
    if (sf.folderId !== null) {
      scope = new Set<number>();
      const walk = (fid: number) => {
        scope?.add(fid);
        for (const c of childFolders.get(fid) ?? []) walk(c.id);
      };
      walk(sf.folderId);
    }
    const ruleTags = parseTags(sf.tags);
    const now = Date.now();
    return filtered.filter((s) => {
      if (scope && (s.folderId === null || !scope.has(s.folderId))) return false;
      if (ruleTags.length > 0) {
        const mine = parseTags(s.tags);
        if (!ruleTags.some((tg) => mine.includes(tg))) return false;
      }
      if (sf.pinnedOnly && !s.pinned) return false;
      if (sf.favoriteOnly && !s.favorite) return false;
      if (sf.minUses !== null && s.usageCount < sf.minUses) return false;
      if (sf.unusedDays !== null) {
        if (!s.lastUsedAt) return true;
        return now - new Date(s.lastUsedAt).getTime() >= sf.unusedDays * 86400000;
      }
      return true;
    });
  }, [filtered, activeSmart, childFolders]);

  /* A one-line human summary of a smart folder's rules, shown in
     its header so the view explains itself. */
  const smartRuleSummary = (sf: SmartFolderT): string => {
    const parts: string[] = [];
    const tags = parseTags(sf.tags);
    if (tags.length > 0) parts.push(lang === "en" ? `tags: ${tags.join(", ")}` : `وسوم: ${tags.join("، ")}`);
    if (sf.folderId !== null) parts.push(lang === "en" ? `inside «${folderNameOf(sf.folderId)}» and its subfolders` : `داخل «${folderNameOf(sf.folderId)}» ومجلداته الفرعية`);
    if (sf.pinnedOnly) parts.push(lang === "en" ? "pinned only" : "المثبتة بس");
    if (sf.favoriteOnly) parts.push(lang === "en" ? "favorites only" : "المفضلة بس");
    if (sf.minUses !== null) parts.push(lang === "en" ? `used at least ${sf.minUses} times` : `اتستخدمت ${sf.minUses} مرة على الأقل`);
    if (sf.unusedDays !== null) parts.push(lang === "en" ? `not used for ${sf.unusedDays} days` : `مش مستخدمة من ${sf.unusedDays} يوم`);
    return parts.length > 0
      ? parts.join(lang === "en" ? " · " : " · ")
      : lang === "en" ? "No rules yet — showing the whole library" : "لسه مفيش شروط — بيعرض المكتبة كلها";
  };

  /* Direct reply count per folder — shown in every folder picker
     and move menu, so choosing a folder shows what already lives
     in it. */
  const folderReplyCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of shortcuts) {
      if (s.folderId !== null) m.set(s.folderId, (m.get(s.folderId) ?? 0) + 1);
    }
    return m;
  }, [shortcuts]);

  const descendantCount = (fid: number): number => {
    let n = (folderShortcuts.get(fid) ?? []).length;
    for (const c of childFolders.get(fid) ?? [])
      n += 1 + descendantCount(c.id);
    return n;
  };

  const isDescendantOf = (ancestor: number, id: number): boolean => {
    let cur: number | null = id;
    const seen = new Set<number>();
    while (cur !== null && !seen.has(cur)) {
      if (cur === ancestor) return true;
      seen.add(cur);
      cur = folderById.get(cur)?.parentId ?? null;
    }
    return false;
  };

  /* ----- placement snapshots: drag & drop, sort, undo/redo ----- */
  const takeSnapshot = (): TreeSnapshot => ({
    folders: folders.map((f) => ({
      id: f.id,
      parentId: f.parentId,
      sortOrder: f.sortOrder,
    })),
    shortcuts: shortcuts.map((s) => ({
      id: s.id,
      folderId: s.folderId,
      category: s.category,
      sortOrder: s.sortOrder,
    })),
  });

  const undoStack = useRef<TreeSnapshot[]>([]);
  const redoStack = useRef<TreeSnapshot[]>([]);
  const [histTick, setHistTick] = useState(0);
  void histTick;
  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const applyTreeMut = useMutation({
    mutationFn: async (snap: TreeSnapshot) =>
      await api.applyTreeOrder({ token, folders: snap.folders, shortcuts: snap.shortcuts }),
    onSuccess: (res) => {
      if (!res.ok) showToast(res.error ?? "النقل متمّش — حاول تاني");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["folders", token] });
    },
    onError: () => showToast("النقل متمّش — حاول تاني", "error"),
  });

  const applySnapshot = (snap: TreeSnapshot) => {
    undoStack.current.push(takeSnapshot());
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
    setHistTick((t) => t + 1);
    applyTreeMut.mutate(snap);
  };

  const doUndo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(takeSnapshot());
    setHistTick((t) => t + 1);
    applyTreeMut.mutate(prev);
    showToast(t("اتلغى آخر نقل"));
  };
  const doRedo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(takeSnapshot());
    setHistTick((t) => t + 1);
    applyTreeMut.mutate(next);
    showToast(t("اتعاد النقل"));
  };

  const moveFolderTo = (
    fid: number,
    newParent: number | null,
    beforeId: number | null,
  ) => {
    if (newParent !== null && isDescendantOf(fid, newParent)) {
      showToast(t("مينفعش تنقل مجلد جوه نفسه أو جوه مجلد تابع ليه"));
      return;
    }
    const snap = takeSnapshot();
    const moved = snap.folders.find((f) => f.id === fid);
    if (!moved) return;
    const oldParent = moved.parentId;
    if (oldParent === newParent && beforeId === fid) return;
    const sibs = snap.folders
      .filter((f) => f.parentId === newParent && f.id !== fid)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    let idx = beforeId === null ? sibs.length : sibs.findIndex((f) => f.id === beforeId);
    if (idx < 0) idx = sibs.length;
    moved.parentId = newParent;
    sibs.splice(idx, 0, moved);
    sibs.forEach((f, i) => {
      f.sortOrder = i;
    });
    snap.folders
      .filter((f) => f.parentId === oldParent && f.id !== fid)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .forEach((f, i) => {
        f.sortOrder = i;
      });
    applySnapshot(snap);
    showToast(t("اتنقل المجلد واتحفظ مكانه"));
  };

  const moveShortcutsTo = (
    ids: number[],
    targetFolder: number | null,
    beforeId: number | null,
  ) => {
    if (ids.length === 0) return;
    const snap = takeSnapshot();
    const moving = ids
      .map((id) => snap.shortcuts.find((s) => s.id === id))
      .filter((s): s is TreeSnapshot["shortcuts"][number] => !!s);
    if (moving.length === 0) return;
    const oldFolders = new Set(moving.map((s) => s.folderId));
    const target = snap.shortcuts
      .filter((s) => (s.folderId ?? null) === targetFolder && !ids.includes(s.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    let idx = beforeId === null ? target.length : target.findIndex((s) => s.id === beforeId);
    if (idx < 0) idx = target.length;
    const cat = folderNameOf(targetFolder);
    for (const m of moving) {
      m.folderId = targetFolder;
      m.category = cat;
    }
    target.splice(idx, 0, ...moving);
    target.forEach((s, i) => {
      s.sortOrder = i;
    });
    for (const old of oldFolders) {
      if (old === targetFolder) continue;
      snap.shortcuts
        .filter((s) => (s.folderId ?? null) === old && !ids.includes(s.id))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .forEach((s, i) => {
          s.sortOrder = i;
        });
    }
    applySnapshot(snap);
    showToast(
      moving.length > 1
        ? lang === "en" ? `${moving.length} replies moved and saved` : `اتنقل ${moving.length} رد واتحفظ مكانهم`
        : lang === "en" ? "Reply moved and saved" : "اتنقل الرد واتحفظ مكانه",
    );
  };

  const sortFolderContents = (fid: number | null, mode: "name" | "date") => {
    const snap = takeSnapshot();
    const byId = new Map(shortcuts.map((s) => [s.id, s]));
    const items = snap.shortcuts.filter((s) => (s.folderId ?? null) === fid);
    items.sort((a, b) =>
      mode === "name"
        ? (byId.get(a.id)?.title ?? "").localeCompare(byId.get(b.id)?.title ?? "", "ar")
        : new Date(byId.get(b.id)?.createdAt ?? 0).getTime() -
          new Date(byId.get(a.id)?.createdAt ?? 0).getTime(),
    );
    items.forEach((s, i) => {
      s.sortOrder = i;
    });
    applySnapshot(snap);
    showToast(mode === "name" ? "اترتبت الردود أبجدياً" : "اترتبت الردود من الأحدث");
  };

  const sortSiblingFolders = (parent: number | null) => {
    const snap = takeSnapshot();
    const byId = new Map(folders.map((f) => [f.id, f]));
    const items = snap.folders.filter((f) => f.parentId === parent);
    items.sort((a, b) =>
      (byId.get(a.id)?.name ?? "").localeCompare(byId.get(b.id)?.name ?? "", "ar"),
    );
    items.forEach((f, i) => {
      f.sortOrder = i;
    });
    applySnapshot(snap);
    showToast("اترتبت المجلدات أبجدياً");
  };

  /* ----- folder create / rename / delete ----- */
  const invalidateFolders = () => {
    void queryClient.invalidateQueries({ queryKey: ["folders", token] });
    invalidate();
  };
  const createFolderMut = useMutation({
    mutationFn: async (v: {
      name: string;
      parentId: number | null;
      icon: string | null;
      iconColor: string | null;
      description: string | null;
      shortcutIds: number[];
    }) =>
      await api.createFolder({
        token,
        name: v.name,
        parentId: v.parentId,
        icon: v.icon,
        iconColor: v.iconColor,
        description: v.description,
        shortcutIds: v.shortcutIds,
      }),
    onSuccess: (res) => {
      invalidateFolders();
      setTreeOpen((p) => ({
        ...p,
        [`f:${res.folder.parentId ?? "root"}`]: true,
      }));
      setFolderCreateError(null);
      setCreatingIn(null);
      showToast(
        res.moved > 0
          ? lang === "en"
            ? `Folder created — ${res.moved} replies moved into it`
            : `اتعمل المجلد — واتنقل ليه ${res.moved} رد`
          : lang === "en"
            ? "Folder created"
            : "اتعمل المجلد",
      );
    },
    onError: (e) =>
      setFolderCreateError(
        e instanceof Error ? e.message : lang === "en" ? "The folder was not created" : "إنشاء المجلد متمّش",
      ),
  });
  const renameFolderMut = useMutation({
    mutationFn: async (v: { id: number; name: string; description?: string | null; icon?: string | null; iconColor?: string | null }) =>
      await api.renameFolder({
        token,
        id: v.id,
        name: v.name,
        ...(v.description !== undefined ? { description: v.description } : {}),
        ...(v.icon !== undefined ? { icon: v.icon } : {}),
        ...(v.iconColor !== undefined ? { iconColor: v.iconColor } : {}),
      }),
    onSuccess: () => {
      invalidateFolders();
      showToast("اتغيّر اسم المجلد");
    },
    onError: (e) =>
      showToast(e instanceof Error ? e.message : "إعادة التسمية متمّتش"),
  });
  const deleteFolderMut = useMutation({
    mutationFn: async (id: number) => await api.deleteFolder({ token, id }),
    onSuccess: () => {
      invalidate();
      invalidateFolders();
      invalidateTrash();
      showToast("اتنقل المجلد لسلة المهملات بكل اللي جواه — تقدر ترجعه منها");
    },
    onError: () => showToast("حذف المجلد متمّش", "error"),
  });
  const toggleFolderPinMut = useMutation({
    mutationFn: async (v: { id: number; pinned: boolean }) =>
      await api.toggleFolderPin({ token, id: v.id, pinned: v.pinned }),
    onSuccess: (_res, v) => {
      invalidateFolders();
      showToast(v.pinned ? "اتثبّت المجلد — هيظهر قبل إخواته" : "اتلغى تثبيت المجلد");
    },
    onError: () => showToast("تثبيت المجلد متمّش — حاول تاني", "error"),
  });
  /* Folder source: picking a source on a folder labels it AND
     moves it under that source's main folder in the same server
     call (the main folder is created on first use). «مش محدد»
     only clears the label — the folder stays where it is. */
  const setFolderSourceMut = useMutation({
    mutationFn: async (v: { id: number; source: string }) =>
      await api.setFolderSource({
        token,
        id: v.id,
        source: v.source as "" | (typeof REPLY_SOURCES)[number],
      }),
    onSuccess: (res, v) => {
      invalidateFolders();
      if (!v.source) {
        showToast("اتشال مصدر المجلد — والمجلد فضل في مكانه");
      } else if (res.moved) {
        showToast(`اتنقل المجلد تحت المجلد الرئيسي لـ ${v.source} بكل اللي جواه`);
      } else {
        showToast(`اتحفظ مصدر المجلد: ${v.source}`);
      }
      /* Make the move visible the moment the tree lands: open
         the «المصادر» section and the destination main folder,
         and flash the moved folder's row under it — the user
         watches it arrive instead of hunting for it. */
      if (v.source && res.mainFolderId !== null) {
        setTreeOpen((p) => ({
          ...p,
          "g:library": true,
          "g:sources": true,
          [`f:${res.mainFolderId}`]: true,
        }));
        flashFolder(v.id);
      }
    },
    onError: (e) =>
      showToast(e instanceof Error ? e.message : "حفظ مصدر المجلد متمّش — حاول تاني", "error"),
  });

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [creatingIn, setCreatingIn] = useState<{ parent: number | null } | null>(null);
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null);
  const [moveIntoId, setMoveIntoId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) =>
    setSelectedIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /* Enter submits and explains a blank name instead of silently
     doing nothing; leaving the field blank just cancels. */
  const commitRename = (submit: boolean) => {
    const name = renameVal.trim();
    if (renamingId !== null && !name && submit) {
      setTreeFormError("اكتب اسم المجلد الأول — الاسم الفاضي مش بيتحفظ");
      return;
    }
    if (renamingId !== null && name) {
      const cur = folderById.get(renamingId);
      if (cur && cur.name !== name) renameFolderMut.mutate({ id: renamingId, name });
    }
    setTreeFormError(null);
    setRenamingId(null);
  };
  /* ----- tree model ----- */
  type TNode = {
    key: string;
    kind: "group" | "folder" | "page" | "shortcut";
    label: string;
    icon: LucideIcon;
    tip: string;
    depth: number;
    count?: number | null;
    active?: boolean;
    pinned?: boolean;
    folderId?: number;
    /* A folder with a source wears the source's brand mark in the
       tree instead of its Lucide glyph. */
    sourceName?: string;
    /* Just moved here by a source assignment: the row flashes
       brass briefly so the move is seen where it landed. */
    flash?: boolean;
    parentFolderId?: number | null;
    shortcutId?: number;
    synthetic?: boolean;
    /* A crafted emblem instead of a Lucide glyph — currently
       only the «المصادر» section mark (SourcesGlyph). */
    glyph?: "sources";
    children?: TNode[];
    run?: () => void;
  };

  const scrollToTools = () => {
    setSection("home");
    window.setTimeout(() => {
      document
        .getElementById("home-tools")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };
  /* The sidebar tree holds folders only — replies live in the main
     content list where they can be read and copied (the brief's
     explicit rule: never list every reply inside the sidebar). A
     folder's count still covers everything inside it, replies and
     subfolders alike, so nothing about its contents is hidden. */
  const folderNode = (f: FolderRowT, depth: number, parentIcon?: LucideIcon): TNode => {
    /* Each folder carries the glyph of its own subject (prices →
       percent badge, support → life buoy, teachers → people…), so
       the tree and the rail can be read by icon alone. The
       parent's glyph is passed down as `avoid`: a subfolder's
       automatic icon never repeats its parent's shape. Only a
       source's MAIN folder wears the brand mark (sourceName);
       a sourced subfolder keeps its own subject glyph. */
    const myIcon = folderIconOf(f, parentIcon);
    return {
      key: `f:${f.id}`,
      kind: "folder",
      label: f.name,
      icon: myIcon,
      tip: `مجلد «${f.name}» — دوس على الاسم لعرض محتوياته في الصفحة، والسهم للفتح والطي في الشجرة، واسحب من المقبض للنقل`,
      depth,
      count: descendantCount(f.id),
      active: section === "home" && category === f.name,
      pinned: f.pinned,
      sourceName: f.isSourceMain ? f.source || undefined : undefined,
      flash: flashFolderId === f.id,
      folderId: f.id,
      parentFolderId: f.parentId,
      /* Source main folders never nest inside the library tree —
         they live under the «المصادر» group (see buildTree), so a
         main folder dragged inside another folder still shows in
         exactly one place: its source's home. */
      children: (childFolders.get(f.id) ?? [])
        .filter((c) => !c.isSourceMain)
        .map((c) => folderNode(c, depth + 1, myIcon)),
    };
  };

  /* The glyph a folder's parent shows, for the surfaces that
     render one folder at a time (header tile, folder cards):
     a subfolder's automatic icon steers away from it. A source
     main parent wears a brand mark, not a Lucide glyph, so it
     imposes no shape to avoid. */
  const parentIconOf = (f: FolderRowT): LucideIcon | undefined => {
    if (f.parentId == null) return undefined;
    const p = folders.find((x) => x.id === f.parentId);
    if (!p || p.isSourceMain) return undefined;
    return folderIconOf(p);
  };

  const pageNode = (
    key: string,
    label: string,
    icon: LucideIcon,
    tip: string,
    active: boolean,
    count: number | null,
    run: () => void,
    depth = 1,
  ): TNode => ({ key, kind: "page", label, icon, tip, depth, active, count, run });

  /* «المصادر» — the sources' own home in the sidebar (v72 placed
     it under the library; v81, at the owner's explicit call,
     makes it a top-level group of its own, still seated directly
     under the library block, so folding the library can never
     hide it): a crafted section wearing its own emblem
     (SourcesGlyph) instead of a generic glyph — one row per
     source, wearing its real brand mark. A source whose main
     folder exists shows that folder right here (expandable, with
     everything moved under it), and clicking it opens the folder.
     A source never assigned yet shows as a quiet placeholder —
     its main folder is created the moment the source is put on
     any folder, and the row becomes the real folder then. */
  const sourcesNode: TNode = {
    key: "g:sources",
    kind: "group",
    label: "المصادر",
    icon: I.link,
    glyph: "sources",
    tip: lang === "en" ? "Sources — every source's main folder lives here, under your library; assigning a source to a folder moves it under its main folder at once" : "المصادر — المجلد الرئيسي لكل مصدر عايش هنا تحت مكتبتك؛ وحط مصدر على أي مجلد بينقله تحت مجلده الرئيسي على طول",
    depth: 0,
    count: folders.filter((f) => f.isSourceMain).length,
    children: REPLY_SOURCES.map((source) => {
      const main = folders.find((f) => f.isSourceMain && f.source === source);
      if (main) return folderNode(main, 1);
      const node = pageNode(
        `src:${source}`,
        source,
        I.link,
        lang === "en"
          ? `The ${source} main folder is created here the moment you put this source on any folder`
          : `المجلد الرئيسي لـ ${source} بيتكون هنا أول ما تحط المصدر ده على أي مجلد`,
        false,
        null,
        () =>
          showToast(
            lang === "en"
              ? `No ${source} main folder yet — put the ${source} source on any folder and it will be created here at once`
              : `لسه مفيش مجلد رئيسي لـ ${source} — حط مصدر ${source} على أي مجلد وهيتكون هنا على طول`,
          ),
        1,
      );
      node.sourceName = source;
      return node;
    }),
  };

  /* The tree's shape (v81, owner's explicit call): «الرئيسية»
     and «المصادر» are TOP-LEVEL stops of their own, outside
     every collapsible group — folding «المكتبة» (or folding
     everything) can never hide them; they stay present and
     tappable at all times, in the full tree and in the rail.
     «المصادر» still sits directly under the library block,
     exactly where it has always been — it is simply no longer
     INSIDE the library's fold. The library group holds every
     folder and loose reply (dropping onto it = the top level);
     tools holds every tool in one flat list; account stays as
     it was. Favorites / most-used / recent are views inside
     Home now, not separate destinations. */
  const buildTree = (): TNode[] => [
    pageNode("p:home", "الرئيسية", I.home, "الرئيسية — كل ردودك مرتبة في مجلداتها، والمفضلة والمستخدمة مؤخراً والأكثر استخداماً من أزرار العرض فوق القائمة", section === "home" && view === "default" && category === "الكل" && !search.trim() && smartId === null, shortcuts.length, goHome, 0),
    {
      key: "g:library",
      kind: "group",
      label: "المكتبة",
      icon: I.layers,
      tip: "المكتبة — كل مجلداتك وردودك، اسحب أي عنصر عشان تنقله أو ترتبه",
      depth: 0,
      count: folders.length,
      children: [
        ...smartFolders.map((sf) =>
          pageNode(
            `sf:${sf.id}`,
            sf.name,
            FOLDER_ICON_OPTIONS.find((o) => o.key === sf.icon)?.icon ?? I.wand,
            lang === "en" ? `Smart folder — shows live replies matching: ${smartRuleSummary(sf)}` : `مجلد ذكي — بيعرض الردود اللي بتطابق شروطه دلوقتي: ${smartRuleSummary(sf)}`,
            section === "home" && smartId === sf.id,
            null,
            () => goSmart(sf),
          ),
        ),
        pageNode("p:new-smart", lang === "en" ? "New smart folder" : "مجلد ذكي جديد", I.sparkles, lang === "en" ? "Create a smart folder — a live view over your replies by tags, folder, pinning or usage, without copying anything" : "إنشاء مجلد ذكي — عرض حي فوق ردودك بالوسوم أو المجلد أو التثبيت أو الاستخدام، من غير نسخ أي رد", false, null, () => setSmartEditor({ open: true, item: null })),
        ...(childFolders.get(null) ?? [])
          .filter((f) => !f.isSourceMain)
          .map((f) => folderNode(f, 1)),
        pageNode("p:trash", lang === "en" ? "Trash" : "سلة المهملات", I.trash, lang === "en" ? "Trash — deleted replies and folders stay restorable here until you delete them forever" : "سلة المهملات — الردود والمجلدات المحذوفة بتفضل قابلة للاستعادة من هنا لحد ما تحذفها نهائياً", section === "home" && view === "trash", null, goTrash),
      ],
    },
    sourcesNode,
    {
      key: "g:tools",
      kind: "group",
      label: "الأدوات",
      icon: I.wrench,
      tip: "الأدوات — البحث وكل الأدوات في مكان واحد",
      depth: 0,
      children: [
        pageNode("p:bulk", "إضافة جماعية", I.upload, "إضافة مجموعة ردود مرة واحدة باللصق", false, null, () => setBulkOpen(true)),
        pageNode("p:home-tools", "ويندوز والنسخ الاحتياطي", I.archive, "ملف AutoHotkey والنسخ الاحتياطية والاستيراد — في آخر الرئيسية", false, null, scrollToTools),
      ],
    },
    {
      key: "g:account",
      kind: "group",
      label: "الحساب",
      icon: I.user,
      tip: "الحساب — ملفك وسياسة الخصوصية",
      depth: 0,
      children: [
        pageNode("p:account", "حسابي", I.user, "حسابي — الاسم وكلمة المرور والجلسات", section === "account", null, () => goSection("account")),
        pageNode("p:privacy", "سياسة الخصوصية", I.shield, "سياسة خصوصية الموقع", section === "privacy", null, () => goSection("privacy")),
        pageNode("p:logout", "تسجيل الخروج", I.logout, "تسجيل الخروج من الجهاز ده", false, null, onLogout),
      ],
    },
  ];

  const isNodeOpen = (key: string, kind: TNode["kind"]): boolean =>
    treeOpen[key] ?? kind === "group";
  const toggleNodeOpen = (node: TNode) =>
    setTreeOpen((p) => ({ ...p, [node.key]: !(p[node.key] ?? node.kind === "group") }));

  /* Open every level at once, or fold the whole tree away: every
     group and folder key in the tree gets the same state, and the
     home list's folder sections (same folders, `c:` keys) follow —
     one gesture tidies the entire site, and the choice persists
     with the rest of the tree state. */
  const setAllNodesOpen = (open: boolean) => {
    const next: Record<string, boolean> = {};
    const walk = (nodes: TNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) next[n.key] = open;
        if (n.children) walk(n.children);
      }
    };
    walk(buildTree());
    for (const c of categories) {
      if (c !== "الكل") next[`c:${c}`] = open;
    }
    setTreeOpen((p) => ({ ...p, ...next }));
  };

  /* ----- drag & drop ----- */
  type DragPayload = { kind: "folder" | "shortcut"; id: number; ids: number[] };
  const dragRef = useRef<DragPayload | null>(null);
  const [dragArmed, setDragArmed] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    key: string;
    pos: "before" | "after" | "inside";
  } | null>(null);
  const autoOpenTimer = useRef<number | undefined>(undefined);

  const clearDrag = () => {
    dragRef.current = null;
    setDragArmed(null);
    setDraggingKey(null);
    setDropTarget(null);
    window.clearTimeout(autoOpenTimer.current);
  };

  const siblingFolderAfter = (parent: number | null, id: number): number | null => {
    const sibs = childFolders.get(parent) ?? [];
    const i = sibs.findIndex((f) => f.id === id);
    return i >= 0 && i + 1 < sibs.length ? (sibs[i + 1]?.id ?? null) : null;
  };
  const siblingShortcutAfter = (
    folder: number | null,
    id: number,
  ): number | null => {
    const sibs = folderShortcuts.get(folder) ?? [];
    const i = sibs.findIndex((s) => s.id === id);
    return i >= 0 && i + 1 < sibs.length ? (sibs[i + 1]?.id ?? null) : null;
  };

  const executeDrop = (node: TNode, pos: "before" | "after" | "inside") => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "folder") {
      const fid = drag.id;
      if (node.kind === "folder" && node.folderId !== undefined && !node.synthetic) {
        if (pos === "inside") moveFolderTo(fid, node.folderId, null);
        else if (pos === "before")
          moveFolderTo(fid, node.parentFolderId ?? null, node.folderId);
        else
          moveFolderTo(
            fid,
            node.parentFolderId ?? null,
            siblingFolderAfter(node.parentFolderId ?? null, node.folderId),
          );
      } else if (node.key === "g:library") {
        moveFolderTo(fid, null, null);
      } else if (node.kind === "shortcut") {
        showToast(t("اسحب المجلد على مجلد تاني أو على مجموعة «المجلدات»"));
      }
      return;
    }
    // shortcut payload (one or many selected)
    const ids = drag.ids.length > 0 ? drag.ids : [drag.id];
    if (node.kind === "folder" && !node.synthetic) {
      moveShortcutsTo(ids, node.folderId ?? null, null);
    } else if (node.kind === "shortcut" && node.shortcutId !== undefined) {
      if (pos === "before")
        moveShortcutsTo(ids, node.parentFolderId ?? null, node.shortcutId);
      else if (pos === "after")
        moveShortcutsTo(
          ids,
          node.parentFolderId ?? null,
          siblingShortcutAfter(node.parentFolderId ?? null, node.shortcutId),
        );
      else moveShortcutsTo(ids, node.parentFolderId ?? null, null);
    } else if (node.key === "g:library") {
      moveShortcutsTo(ids, null, null);
    }
    if (ids.length > 1) setSelectedIds(new Set());
  };

  /* ----- right-click / actions menu ----- */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: TNode } | null>(null);
  const [ctxMoveOpen, setCtxMoveOpen] = useState(false);
  const openCtx = (e: React.MouseEvent, node: TNode) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMoveOpen(false);
    setCtxMenu({
      x: Math.min(e.clientX, window.innerWidth - 280),
      y: Math.min(e.clientY, window.innerHeight - 420),
      node,
    });
  };

  /* ----- search filter: a node survives when it or any descendant
     matches; ancestors of a match stay visible and open. ----- */
  const filterNodes = (nodes: TNode[], q: string): TNode[] => {
    const out: TNode[] = [];
    for (const n of nodes) {
      const kids = n.children ? filterNodes(n.children, q) : undefined;
      if (n.label.toLowerCase().includes(q) || (kids && kids.length > 0)) {
        out.push({ ...n, children: kids ?? n.children });
      }
    }
    return out;
  };


  /* Breadcrumbs — where the user is inside the tree, with every
     parent one tap away. */
  type Crumb = { label: string; run?: () => void };
  const crumbs: Crumb[] = (() => {
    if (section === "account") return [{ label: "الحساب" }, { label: "حسابي" }];
    if (section === "privacy")
      return [
        { label: "الحساب", run: () => goSection("account") },
        { label: "سياسة الخصوصية" },
      ];
    if (search.trim())
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: lang === "en" ? `Search: ${search.trim()}` : `بحث: ${search.trim()}` },
      ];
    if (view === "favorites")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "المفضلة" },
      ];
    if (view === "recent")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "الأحدث" },
      ];
    if (view === "used")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "استُخدمت مؤخراً" },
      ];
    if (view === "most")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "الأكثر استخداماً" },
      ];
    if (view === "least")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "الأقل استخداماً" },
      ];
    if (view === "unused")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "لم تُستخدم" },
      ];
    if (view === "trash")
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: "سلة المهملات" },
      ];
    if (activeSmart)
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        { label: activeSmart.name },
      ];
    if (category !== "الكل") {
      /* The full folder path — every ancestor is a real stop the
         user can jump back to in one tap, however deep the folder
         sits (الرئيسية / خدمة العملاء / الاشتراكات / مشاكل الدفع). */
      const chain: Array<{ label: string; run?: () => void }> = [];
      const cur = folders.find((f) => f.name === category) ?? null;
      if (cur) {
        const ancestors: FolderRowT[] = [];
        const guard = new Set<number>();
        let p = cur.parentId !== null ? folderById.get(cur.parentId) : undefined;
        while (p && !guard.has(p.id)) {
          guard.add(p.id);
          ancestors.unshift(p);
          p = p.parentId !== null ? folderById.get(p.parentId) : undefined;
        }
        for (const a of ancestors)
          chain.push({ label: a.name, run: () => goCategory(a.name) });
        chain.push({ label: cur.name });
      } else {
        chain.push({ label: category });
      }
      return [
        { label: "المكتبة", run: goHome },
        { label: "الرئيسية", run: goHome },
        ...chain,
      ];
    }
    return [{ label: "المكتبة" }, { label: "الرئيسية" }];
  })();

  /* ----- rendering ----- */
  const renderNode = (node: TNode, searching: boolean, onNavigate?: () => void): ReactNode => {
    const hasChildren = node.children !== undefined;
    const open = searching ? hasChildren : isNodeOpen(node.key, node.kind);
    const isFolderLike = node.kind === "group" || node.kind === "folder";
    const draggableNode =
      (node.kind === "folder" && !node.synthetic) || node.kind === "shortcut";
    const selected = node.shortcutId !== undefined && selectedIds.has(node.shortcutId);
    const NodeIcon =
      node.kind === "folder" && !node.synthetic && node.icon === Folder
        ? open
          ? FolderOpen
          : Folder
        : node.icon;
    const dropHere = dropTarget?.key === node.key ? dropTarget.pos : null;
    /* Group and page labels are interface chrome (translated);
       folder and reply labels are the user's own content (never
       translated). */
    const uiNode = node.kind === "group" || node.kind === "page";
    const label = uiNode ? t(node.label) : node.label;
    /* A folder with a chosen icon colour wears it in the tree
       too (the .fcol class sets --fhue; .tree-ficon reads it) —
       except while the row is active, where the accent state
       colour keeps signalling selection. */
    const nodeFolder = node.folderId != null ? folderById.get(node.folderId) : undefined;
    const nodeColorCls =
      !node.active && nodeFolder?.iconColor && FOLDER_COLOR_KEYS_CLIENT.has(nodeFolder.iconColor)
        ? `fcol-${nodeFolder.iconColor} tree-ficon`
        : !node.active && isCustomColor(nodeFolder?.iconColor)
          ? "tree-ficon"
          : "";
    const nodeColorStyle = !node.active ? folderColorStyle(nodeFolder ?? {}) : undefined;

    const onDragOverRow = (e: React.DragEvent) => {
      if (!dragRef.current) return;
      if (dragRef.current.kind === "folder" && node.kind === "page") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / Math.max(1, rect.height);
      let pos: "before" | "after" | "inside";
      if (isFolderLike) pos = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
      else pos = ratio < 0.5 ? "before" : "after";
      if (node.kind === "group" && node.key !== "g:library") pos = "inside";
      if (dropTarget?.key !== node.key || dropTarget.pos !== pos)
        setDropTarget({ key: node.key, pos });
      if (pos === "inside" && hasChildren && !open) {
        window.clearTimeout(autoOpenTimer.current);
        autoOpenTimer.current = window.setTimeout(() => {
          setTreeOpen((p) => ({ ...p, [node.key]: true }));
        }, 650);
      }
    };

    const rowKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const tree = (e.currentTarget as HTMLElement).closest('[role="tree"]');
        if (!tree) return;
        const rows = Array.from(tree.querySelectorAll<HTMLElement>("[data-tree-row]"));
        const i = rows.indexOf(e.currentTarget as HTMLElement);
        const next = rows[e.key === "ArrowDown" ? i + 1 : i - 1];
        next?.focus();
      } else if (e.key === "ArrowLeft" && hasChildren && !open) {
        e.preventDefault();
        setTreeOpen((p) => ({ ...p, [node.key]: true }));
      } else if (e.key === "ArrowRight" && hasChildren && open) {
        e.preventDefault();
        setTreeOpen((p) => ({ ...p, [node.key]: false }));
      } else if (e.key === "F2" && node.kind === "folder" && !node.synthetic && node.folderId !== undefined) {
        e.preventDefault();
        setRenameVal(node.label);
        setRenamingId(node.folderId);
      }
    };

    return (
      <div
        key={node.key}
        className={node.key === "g:sources" ? "tree-node tree-node-sources" : node.kind === "group" ? "tree-node tree-node-group" : "tree-node"}
        data-dragging={draggingKey === node.key}
        data-drop-inside={dropHere === "inside"}
        style={{ "--depth": node.depth } as React.CSSProperties}
      >
        {dropHere === "before" && <span aria-hidden="true" className="tree-drop-line" style={{ top: -1 }} />}
        {dropHere === "after" && <span aria-hidden="true" className="tree-drop-line" style={{ bottom: -1 }} />}
        <div
          data-tree-row
          role="treeitem"
          aria-expanded={hasChildren ? open : undefined}
          aria-selected={selected || undefined}
          tabIndex={0}
          draggable={draggableNode && dragArmed === node.key}
          onDragStart={(e) => {
            if (!draggableNode) return;
            if (node.kind === "folder" && node.folderId !== undefined) {
              dragRef.current = { kind: "folder", id: node.folderId, ids: [node.folderId] };
            } else if (node.shortcutId !== undefined) {
              const ids = selectedIds.has(node.shortcutId)
                ? [...selectedIds]
                : [node.shortcutId];
              dragRef.current = { kind: "shortcut", id: node.shortcutId, ids };
            }
            e.dataTransfer.effectAllowed = "move";
            try {
              e.dataTransfer.setData("text/plain", node.label);
            } catch {
              /* some browsers restrict setData — the ref carries it */
            }
            setDraggingKey(node.key);
          }}
          onDragEnd={clearDrag}
          onDragOver={onDragOverRow}
          onDragLeave={() => {
            if (dropTarget?.key === node.key) setDropTarget(null);
            window.clearTimeout(autoOpenTimer.current);
          }}
          onDrop={(e) => {
            e.preventDefault();
            executeDrop(node, dropTarget?.key === node.key ? dropTarget.pos : "inside");
            clearDrag();
          }}
          onContextMenu={(e) => openCtx(e, node)}
          onKeyDown={rowKeyDown}
          className={`tree-row ${node.kind === "group" ? "tree-row-group" : ""} group/row relative flex items-center gap-1 rounded-[8px] py-[5px] pe-1.5 text-[14px] transition-colors ${
            node.active
              ? "nav-item-active bg-[var(--surface-selected)] font-bold text-[var(--accent-strong)]"
              : selected
                ? "bg-[var(--surface-selected)] text-[var(--text)]"
                : "text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          } ${node.kind === "group" ? "mt-3 font-bold text-[var(--text)] first:mt-0" : ""} ${node.flash ? "tree-flash" : ""}`}
          style={{ paddingInlineStart: 6 + node.depth * 16 }}
        >
          {draggableNode ? (
            <span
              aria-hidden="true"
              data-tip={t("اسحب للنقل أو إعادة الترتيب")}
              className="tree-grip flex shrink-0 items-center self-stretch px-0.5 text-[var(--faint)] opacity-0 transition-opacity group-hover/row:opacity-100"
              onMouseDown={() => setDragArmed(node.key)}
              onMouseUp={() => {
                if (draggingKey !== node.key) setDragArmed(null);
              }}
            >
              <Icon d={GripVertical} size={14} />
            </span>
          ) : (
            <span aria-hidden="true" className="w-[18px] shrink-0" />
          )}
          {hasChildren ? (
            <button
              type="button"
              aria-label={open ? (lang === "en" ? `Collapse «${label}»` : `طي «${label}»`) : lang === "en" ? `Expand «${label}»` : `فتح «${label}»`}
              aria-expanded={open}
              data-tip={open ? t("طي المجلد") : t("فتح المجلد")}
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeOpen(node);
              }}
              className="lux-btn flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[var(--faint)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              <span className="tree-chevron flex" data-open={open}>
                <Icon d={chevDir} size={15} />
              </span>
            </button>
          ) : (
            <span aria-hidden="true" className="w-[22px] shrink-0" />
          )}
          <span style={nodeColorStyle} className={`tree-icon ${node.sourceName ? "tree-icon-brand" : ""} flex shrink-0 ${node.active ? "text-[var(--accent)]" : isFolderLike ? "text-[var(--dim)]" : "text-[var(--faint)]"} ${nodeColorCls}`}>
            {node.glyph === "sources" ? (
              <SourcesGlyph size={20} open={open} />
            ) : node.sourceName ? (
              <SourceMark source={node.sourceName} size={16} />
            ) : (
              <Icon d={NodeIcon} size={node.kind === "group" ? 17 : 16} />
            )}
          </span>
          {renamingId !== null && node.folderId === renamingId ? (
            <input
              autoFocus
              {...FIELDS.renameFolder.name}
              aria-label="الاسم الجديد للمجلد"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(true);
                if (e.key === "Escape") {
                  setRenamingId(null);
                  setTreeFormError(null);
                }
                e.stopPropagation();
              }}
              onBlur={() => commitRename(false)}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-0.5 text-sm outline-none"
            />
          ) : (
            <button
              type="button"
              aria-label={node.kind === "page" ? label : node.kind === "shortcut" ? node.label : node.kind === "folder" && !node.synthetic ? (lang === "en" ? `Show contents of folder «${node.label}»` : `عرض محتويات مجلد «${node.label}»`) : lang === "en" ? `${open ? "Collapse" : "Expand"} «${label}»` : `${open ? "طي" : "فتح"} «${label}»`}
              data-tip={uiNode ? t(node.tip ?? "") : node.tip}
              onClick={() => {
                if (node.kind === "page" || node.kind === "shortcut") {
                  node.run?.();
                  onNavigate?.();
                } else if (node.kind === "folder" && !node.synthetic) {
                  /* Clicking a folder means «show me what's inside»:
                     it becomes the selected folder, its contents —
                     subfolders first, then its replies — render in
                     the main area at once, and the tree opens it so
                     the place stays visible. The chevron alone is
                     the pure open/close toggle. */
                  goCategory(node.label);
                  setTreeOpen((p) => ({ ...p, [node.key]: true }));
                  onNavigate?.();
                } else {
                  toggleNodeOpen(node);
                }
              }}
              onDoubleClick={() => {
                if (node.kind === "folder" && !node.synthetic && node.folderId !== undefined) {
                  setRenameVal(node.label);
                  setRenamingId(node.folderId);
                }
              }}
              className="min-w-0 flex-1 truncate py-0.5 text-start"
            >
              {label}
            </button>
          )}
          {node.kind === "shortcut" && node.shortcutId !== undefined && (selectedIds.size > 0 || selected) && (
            <button
              type="button"
              aria-label={selected ? `إلغاء تحديد «${node.label}»` : `تحديد «${node.label}» للنقل الجماعي`}
              aria-pressed={selected}
              data-tip={selected ? "إلغاء التحديد" : "تحديد للنقل الجماعي"}
              onClick={(e) => {
                e.stopPropagation();
                toggleSelect(node.shortcutId!);
              }}
              className={`lux-btn flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[5px] border ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                  : "border-[var(--border-strong)] text-transparent"
              }`}
            >
              <Icon d={I.check} size={13} />
            </button>
          )}
          {node.pinned && (
            <span className="flex shrink-0 text-[var(--accent)]" aria-label="مجلد مثبت" data-tip="مجلد مثبت — بيظهر قبل إخواته">
              <Icon d={I.pin} size={12} />
            </span>
          )}
          {node.count !== null && node.count !== undefined && (
            <span className="tree-count shrink-0 text-[11px] font-semibold text-[var(--faint)]">
              {node.count}
            </span>
          )}
          <button
            type="button"
            aria-label={`إجراءات «${node.label}»`}
            data-tip="إجراءات — إعادة تسمية، نقل، ترتيب، حذف"
            onClick={(e) => openCtx(e, node)}
            className="lux-btn flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] text-[var(--faint)] opacity-0 transition-opacity hover:bg-[var(--surface)] hover:text-[var(--text)] group-hover/row:opacity-100"
          >
            <Icon d={MoreHorizontal} size={16} />
          </button>
        </div>
        {hasChildren && (
          <div className="tree-children" data-open={open}>
            <div>
              {(node.children ?? []).map((c) => renderNode(c, searching, onNavigate))}
              {node.children && node.children.length === 0 && node.kind === "folder" && (
                <p
                  className="py-1 text-xs text-[var(--faint)]"
                  style={{ paddingInlineStart: 8 + (node.depth + 1) * 16 + 22 }}
                >
                  فاضي — لسه مفيش مجلدات فرعية
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNavTree = (railMode: boolean, onNavigate?: () => void) => {
    const tree = buildTree();
    if (railMode) {
      /* The rail is a working navigation bar, not a strip of
         identical folder glyphs: every stop carries its own subject
         icon and a tiny name under it, so the whole library can be
         driven from the collapsed bar. The layout is deliberately
         calm: every stop is the same fixed height, every name sits
         in the same two-line zone (long names wrap to a second
         line instead of truncating mid-word), and there are no
         floating count badges — counts live in the full tree and
         in the folder headers, where they have room to read. The
         quick views (favorites / recently used / most used / copy
         history) live here too, each with its own glyph. */
      const flat: TNode[] = [];
      for (const g of tree) {
        /* v81: «الرئيسية» is a top-level page node now (outside
           every group) so folding can never hide it — the flatten
           must pick top-level pages up directly, not only group
           children. */
        if (g.kind === "page") {
          flat.push(g);
          continue;
        }
        for (const c of g.children ?? []) {
          if (c.kind === "page") flat.push(c);
          else if (c.kind === "folder" && g.key === "g:library") flat.push(c);
          else if (c.kind === "folder") {
            for (const cc of c.children ?? []) if (cc.kind === "page") flat.push(cc);
          }
        }
      }
      const railFolders = flat.filter((i) => i.kind === "folder");
      const railPage = (key: string) => flat.find((i) => i.key === key);
      const shortLabel: Record<string, string> = {
        "p:home": "الرئيسية",
        "p:bulk": "جماعية",
        "p:home-tools": "النسخ",
        "p:account": "حسابي",
        "p:privacy": "الخصوصية",
        "p:logout": "خروج",
      };
      const railBtn = (
        key: string,
        icon: LucideIcon,
        label: string,
        opts: {
          active?: boolean;
          filled?: boolean;
          tip?: string;
          /* A crafted mark instead of a Lucide glyph (the sources'
             real brand marks) — rendered in the same 19px slot. */
          glyph?: ReactNode;
          onClick: () => void;
        },
      ) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-current={opts.active ? "page" : undefined}
          aria-pressed={opts.active}
          data-tip={opts.tip ?? label}
          data-tip-align="start"
          onClick={() => {
            opts.onClick();
            onNavigate?.();
          }}
          className={`lux-btn flex h-[60px] w-full flex-col items-center justify-center gap-[3px] rounded-[10px] px-0.5 ${
            opts.filled
              ? "btn-lux"
              : opts.active
                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
          }`}
        >
          {opts.glyph ?? <Icon d={icon} size={19} />}
          <span className="flex h-[26px] w-full items-start justify-center overflow-hidden text-center text-[10px] font-semibold leading-[13px]">
            <span className="line-clamp-2">{label}</span>
          </span>
        </button>
      );
      const railCaption = (text: string) => (
        <span aria-hidden="true" className="mt-3.5 block w-full first:mt-1">
          <span className="mx-auto mb-2 block h-px w-8 bg-[var(--border)]" />
          <span className="block w-full text-center text-[9.5px] font-bold tracking-wide text-[var(--faint)]">
            {text}
          </span>
        </span>
      );
      const railPageBtn = (key: string) => {
        const item = railPage(key);
        if (!item) return null;
        const label =
          item.kind === "page" ? t(shortLabel[key] ?? item.label) : item.label;
        return railBtn(key, item.icon, label, {
          active: item.active,
          tip: t(item.tip ?? item.label),
          onClick: () => item.run?.(),
        });
      };
      const goView = (v: ViewMode) => {
        goHome();
        setView(v);
      };
      return (
        <div className="flex flex-col items-center gap-1">
          {railBtn("rail-expand", I.railOpen, t("توسيع"), {
            tip: t("توسيع القائمة الجانبية — أو اسحب حافتها لأي عرض"),
            onClick: () => setRail(false),
          })}
          {railBtn("rail-new", I.plus, t("جديد"), {
            filled: true,
            tip: t("إضافة اختصار جديد إلى مكتبتك"),
            onClick: () => setEditor({ open: true, item: null }),
          })}
          {railBtn("rail-expand-search", I.search, t("بحث"), {
            tip: t("توسيع القائمة والبحث عن أي مجلد أو صفحة"),
            onClick: () => setRail(false),
          })}
          {railCaption(t("عرض"))}
          {railPageBtn("p:home")}
          {railBtn("rail-fav", I.star, t("المفضلة"), {
            active: section === "home" && view === "favorites",
            tip: t("الردود المثبتة بس — اللي بترجع لها على طول"),
            onClick: () => goView("favorites"),
          })}
          {railBtn("rail-used", I.history, t("مؤخراً"), {
            active: section === "home" && view === "used",
            tip: t("الردود اللي نسختها أو استخدمتها مؤخراً"),
            onClick: () => goView("used"),
          })}
          {railBtn("rail-most", I.flame, t("الأكثر"), {
            active: section === "home" && view === "most",
            tip: t("رتّب حسب عدد مرات الاستخدام"),
            onClick: () => goView("most"),
          })}
          {railBtn("rail-history", I.clipboard, t("السجل"), {
            active: section === "home" && view === "history",
            tip: t("سجل كل عمليات النسخ الناجحة بوقتها"),
            onClick: () => goView("history"),
          })}
          {railCaption(t("المجلدات"))}
          {railFolders.map((item) =>
            railBtn(item.key, item.icon, item.label, {
              active: item.active,
              tip: item.tip,
              onClick: () => {
                if (item.folderId !== undefined) goCategory(item.label);
              },
            }),
          )}
          {railCaption(t("المصادر"))}
          {REPLY_SOURCES.map((source) => {
            const main = folders.find((f) => f.isSourceMain && f.source === source);
            return railBtn(`rail-src:${source}`, I.link, source, {
              glyph: <SourceMark source={source} size={19} />,
              active: main ? section === "home" && category === main.name : false,
              tip: main
                ? lang === "en"
                  ? `The ${source} main folder — everything filed under this source`
                  : `المجلد الرئيسي لـ ${source} — كل اللي اتصنّف بالمصدر ده`
                : lang === "en"
                  ? `No ${source} main folder yet — put the ${source} source on any folder and it will be created at once`
                  : `لسه مفيش مجلد رئيسي لـ ${source} — حط مصدر ${source} على أي مجلد وهيتكون على طول`,
              onClick: () => {
                if (main) {
                  goCategory(main.name);
                } else {
                  setRail(false);
                  setTreeOpen((p) => ({ ...p, "g:sources": true }));
                  showToast(
                    lang === "en"
                      ? `No ${source} main folder yet — put the ${source} source on any folder and it will be created here at once`
                      : `لسه مفيش مجلد رئيسي لـ ${source} — حط مصدر ${source} على أي مجلد وهيتكون هنا على طول`,
                  );
                }
              },
            });
          })}
          {railCaption(t("الأدوات"))}
          {railPageBtn("p:bulk")}
          {railPageBtn("p:home-tools")}
          {railCaption(t("الحساب"))}
          {railPageBtn("p:account")}
          {railPageBtn("p:privacy")}
          {railPageBtn("p:logout")}
          <button
            type="button"
            aria-label={t("حسابي")}
            data-tip={displayName}
            data-tip-align="start"
            onClick={() => {
              goSection("account");
              onNavigate?.();
            }}
            className="lux-btn mt-1 flex h-10 w-10 items-center justify-center rounded-full"
          >
            <AvatarFace user={user} displayName={displayName} size={40} />
          </button>
        </div>
      );
    }

    const q = navQuery.trim().toLowerCase();
    const searching = q.length > 0;
    const visibleTree = searching ? filterNodes(tree, q) : tree;

    return (
      <div>
        {!onNavigate && (
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              aria-label={t("تصغير القائمة الجانبية إلى أيقونات")}
              data-tip={t("تصغير القائمة — الأيقونات بس")}
              data-tip-align="start"
              onClick={() => setRail(true)}
              className="lux-btn collapse-chip flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pe-3.5 ps-1.5 text-[13px] font-semibold text-[var(--dim)] hover:text-[var(--text)]"
            >
              <span className="collapse-chip-tile">
                <Icon d={I.railClose} size={14} />
              </span>
              {t("تصغير القائمة")}
            </button>
          </div>
        )}
        <button
          type="button"
          aria-label={t("إضافة اختصار جديد")}
          data-tip={t("إضافة اختصار جديد إلى مكتبتك")}
          data-tip-align="start"
          onClick={() => {
            setEditor({ open: true, item: null });
            onNavigate?.();
          }}
          className="btn-lux flex w-full items-center justify-center gap-2 rounded-[var(--radius)] py-3 px-5 font-bold"
        >
          <Icon d={I.plus} size={20} />
          {t("اختصار جديد")}
        </button>

        <div className="relative mt-4" data-tip={t("دوّر عن أي مجلد أو صفحة أو رد في الشجرة")}>
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]">
            <Icon d={I.search} size={16} />
          </span>
          <input
            aria-label={t("البحث في الشجرة عن مجلد أو صفحة أو رد")}
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder={t("دوّر في الشجرة…")}
            className="w-full rounded-[var(--radius)] border border-transparent bg-[var(--surface-alt)] py-2.5 pe-9 ps-9 text-sm outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--border-strong)] focus:bg-[var(--surface)]"
          />
          {navQuery && (
            <button
              type="button"
              aria-label={t("مسح بحث الشجرة")}
              data-tip={t("مسح بحث الشجرة")}
              onClick={() => setNavQuery("")}
              className="lux-btn absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--faint)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
            >
              <Icon d={I.x} size={14} />
            </button>
          )}
        </div>

        <div className="sidebar-tools mt-3 flex items-center gap-1">
          <button
            type="button"
            aria-label={t("مجلد جديد في المستوى الرئيسي")}
            data-tip={t("إنشاء مجلد جديد في المستوى الرئيسي")}
            data-tip-align="start"
            onClick={() => {
              setTreeOpen((p) => ({ ...p, "g:library": true }));
              setCreatingIn({ parent: null });
            }}
            className="lux-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
          >
            <Icon d={FolderPlus} size={15} />
            {t("مجلد جديد")}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            aria-label={t("التراجع عن آخر نقل")}
            data-tip={t("تراجع عن آخر نقل أو إعادة ترتيب")}
            data-tip-align="start"
            disabled={!canUndo}
            onClick={doUndo}
            className="lux-btn flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] disabled:opacity-35"
          >
            <Icon d={Undo2} size={16} />
          </button>
          <button
            type="button"
            aria-label={t("إعادة آخر نقل")}
            data-tip={t("إعادة النقل اللي اتلغى")}
            data-tip-align="start"
            disabled={!canRedo}
            onClick={doRedo}
            className="lux-btn flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] disabled:opacity-35"
          >
            <Icon d={Redo2} size={16} />
          </button>
          <span className="mx-0.5 h-5 w-px bg-[var(--border)]" aria-hidden="true" />
          <button
            type="button"
            aria-label={t("فتح كل المجلدات")}
            data-tip={t("فتح كل المجلدات والمجموعات مرة واحدة")}
            data-tip-align="start"
            onClick={() => setAllNodesOpen(true)}
            className="lux-btn flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
          >
            <Icon d={UnfoldVertical} size={16} />
          </button>
          <button
            type="button"
            aria-label={t("طي كل المجلدات")}
            data-tip={t("طي كل المجلدات والمجموعات مرة واحدة")}
            data-tip-align="start"
            onClick={() => setAllNodesOpen(false)}
            className="lux-btn flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
          >
            <Icon d={FoldVertical} size={16} />
          </button>
        </div>
        {treeFormError && (
          <p role="alert" className="animate-rise mt-2 rounded-[8px] bg-[var(--danger-soft)] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--danger)]">
            {treeFormError}
          </p>
        )}

        {selectedIds.size > 0 && (
          <div className="animate-rise mt-2 flex items-center gap-2 rounded-[var(--radius)] bg-[var(--accent-soft)] px-3 py-2">
            <span className="text-[13px] font-bold">{lang === "en" ? `${selectedIds.size} selected` : `${selectedIds.size} محدد`}</span>
            <MoveToFolderButton
              folders={folders}
              counts={folderReplyCounts}
              onMove={(folderId) => {
                moveShortcutsTo([...selectedIds], folderId, null);
                setSelectedIds(new Set());
              }}
              variant="bar"
              subject="الردود المحددة"
            />
            <button
              type="button"
              aria-label={t("مسح التحديد")}
              data-tip={t("مسح التحديد")}
              onClick={() => setSelectedIds(new Set())}
              className="lux-btn rounded-full p-1.5 text-[var(--dim)] hover:text-[var(--text)]"
            >
              <Icon d={I.x} size={14} />
            </button>
          </div>
        )}

        <div role="tree" aria-label={t("شجرة المجلدات والصفحات")} className="mt-2">
          {visibleTree.map((n) => renderNode(n, searching, onNavigate))}
          {searching && visibleTree.length === 0 && (
            <p className="px-2 py-3 text-sm leading-relaxed text-[var(--dim)]">
              {t("مفيش مجلد أو صفحة أو رد بالاسم ده في الشجرة.")}
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            aria-label={t("فتح حسابي من القائمة")}
            data-tip={t("حسابي — الاسم وكلمة المرور والجلسات")}
            data-tip-align="start"
            onClick={() => {
              goSection("account");
              onNavigate?.();
            }}
            className="lux-btn flex w-full items-center gap-3 rounded-[var(--radius)] px-2 py-2 text-start hover:bg-[var(--surface-alt)]"
          >
            <AvatarFace user={user} displayName={displayName} size={36} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-bold">{displayName}</span>
              <span dir="ltr" className="block truncate text-start font-mono text-[11px] text-[var(--faint)]">
                {loginIdLabel(user)}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={t("تسجيل الخروج")}
            data-tip={t("تسجيل الخروج من الجهاز ده")}
            data-tip-align="start"
            onClick={onLogout}
            className="lux-btn mt-1 flex w-full items-center gap-3 rounded-[var(--radius)] px-2 py-2 text-start text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
              <Icon d={I.logout} size={17} />
            </span>
            <span className="text-sm font-bold">{t("تسجيل الخروج")}</span>
          </button>
        </div>
      </div>
    );
  };

  /* Docs-style grouping: with no search and no folder picked, the home
     list renders one block per folder (category), so related replies
     always sit together in one place. The blocks follow the folder
     TREE's own order — a depth-first walk, parents before their
     children, siblings in the user's manual order — so the order the
     user arranges anywhere (tree, this list) is the order everywhere.
     A category with no folder row keeps the legacy seed order as a
     fallback rank, after every real folder. */
  const folderRank = useMemo(() => {
    const rank = new Map<string, number>();
    let n = 0;
    const walk = (parent: number | null, guard: Set<number>) => {
      for (const f of childFolders.get(parent) ?? []) {
        if (guard.has(f.id)) continue;
        guard.add(f.id);
        if (!rank.has(f.name)) rank.set(f.name, n++);
        walk(f.id, guard);
      }
    };
    walk(null, new Set());
    return rank;
  }, [childFolders]);
  const visibleItems = displayList.slice(0, visibleCount);
  const groupedView = category === "الكل" && search.trim() === "" && view === "default" && smartId === null;
  const groups = useMemo(() => {
    if (!groupedView) return [];
    const map = new Map<string, Shortcut[]>();
    for (const s of visibleItems) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    const rankOf = (name: string) => {
      const r = folderRank.get(name);
      if (r !== undefined) return r;
      const k = KNOWN_CATEGORIES.indexOf(name);
      return 10000 + (k >= 0 ? k : 500);
    };
    return [...map.keys()]
      .sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b, "ar"))
      .map((name) => ({ name, items: map.get(name) ?? [] }));
  }, [visibleItems, groupedView, folderRank]);

  /* Card drag & drop in the main list: drag a card by its grip to
     reorder it inside its folder, or drop it on another card or a
     folder section header to move it there. Same snapshot engine as
     the tree, so undo/redo covers these moves too. */
  const cardDragRef = useRef<number[] | null>(null);
  const [cardDragId, setCardDragId] = useState<number | null>(null);
  const [cardDrop, setCardDrop] = useState<{ id: number; pos: "before" | "after" } | null>(null);
  const [cardDropFolder, setCardDropFolder] = useState<string | null>(null);

  /* Folder drag & drop in the main list itself — the ask behind this
     pass: a grouped section header carries the same grip as a tree
     row. Dragging it onto another section's top or bottom edge
     reorders the folders; dropping it on the middle nests it inside
     that folder («ادخل حاجة جوا حاجة»). The subfolder cards in the
     folder view are draggable the same way. Both ride the shared
     tree payload (dragRef) and the same moveFolderTo engine, so a
     drag can start in the list and land in the tree or the other way
     round, and undo/redo covers every landing. A folder that just
     landed pulses once (landedFolder) so the eye finds its new home. */
  const [secArm, setSecArm] = useState<number | null>(null);
  const [secDragId, setSecDragId] = useState<number | null>(null);
  const [secDrop, setSecDrop] = useState<{ id: number; pos: "before" | "after" | "inside" } | null>(null);
  const [subArm, setSubArm] = useState<number | null>(null);
  const [subDrop, setSubDrop] = useState<{ id: number; pos: "before" | "after" | "inside" } | null>(null);
  const [landedFolder, setLandedFolder] = useState<number | null>(null);
  const landedTimer = useRef<number | undefined>(undefined);
  const noteLanded = (fid: number) => {
    setLandedFolder(fid);
    window.clearTimeout(landedTimer.current);
    landedTimer.current = window.setTimeout(() => setLandedFolder(null), 950);
  };
  const dropFolderOn = (
    dragId: number,
    target: FolderRowT,
    pos: "before" | "after" | "inside",
  ) => {
    if (dragId === target.id) return;
    if (pos === "inside") moveFolderTo(dragId, target.id, null);
    else if (pos === "before")
      moveFolderTo(dragId, target.parentId ?? null, target.id);
    else
      moveFolderTo(
        dragId,
        target.parentId ?? null,
        siblingFolderAfter(target.parentId ?? null, target.id),
      );
    noteLanded(dragId);
  };

  const listUlClass =
    density === "grid"
      ? "grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      : density === "compact"
        ? "flex flex-col gap-2"
        : "flex flex-col gap-6";

  const renderCard = (s: Shortcut, i = 0) => (
    <ShortcutCard
      key={s.id}
      item={s}
      density={density}
      enterDelay={search.trim() ? undefined : Math.min(i, 8) * 35}
      highlight={search.trim()}
      selected={selectedIds.has(s.id)}
      active={detailItem?.id === s.id}
      onSelect={() => setDetailItem(s)}
      onCopy={() => handleCopy(s)}
      onPin={() => togglePin.mutate(s)}
      onFavorite={() => toggleFavorite.mutate(s)}
      onEdit={() => setEditor({ open: true, item: s })}
      onDuplicate={() => duplicateMut.mutate(s.id)}
      onDelete={() => deleteMut.mutate(s.id)}
      onPreview={() => setPreviewItem(s)}
      onMove={(folderId) => moveShortcutsTo([s.id], folderId, null)}
      folders={folders}
      folderCounts={folderReplyCounts}
      dnd={{
        dragging: cardDragId === s.id,
        dropPos: cardDrop?.id === s.id ? cardDrop.pos : null,
        onDragStart: () => {
          cardDragRef.current = selectedIds.has(s.id) ? [...selectedIds] : [s.id];
          setCardDragId(s.id);
        },
        onDragEnd: () => {
          cardDragRef.current = null;
          setCardDragId(null);
          setCardDrop(null);
          setCardDropFolder(null);
        },
        onDragOver: (e) => {
          if (!cardDragRef.current || cardDragRef.current.includes(s.id)) return;
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const pos = (e.clientY - rect.top) / Math.max(1, rect.height) < 0.5 ? "before" : "after";
          if (cardDrop?.id !== s.id || cardDrop.pos !== pos) setCardDrop({ id: s.id, pos });
        },
        onDrop: (e) => {
          e.preventDefault();
          const ids = cardDragRef.current ?? [];
          if (ids.length > 0 && !ids.includes(s.id)) {
            const beforeId =
              cardDrop?.id === s.id && cardDrop.pos === "after"
                ? siblingShortcutAfter(s.folderId ?? null, s.id)
                : s.id;
            moveShortcutsTo(ids, s.folderId ?? null, beforeId);
            if (ids.length > 1) setSelectedIds(new Set());
          }
          cardDragRef.current = null;
          setCardDragId(null);
          setCardDrop(null);
        },
      }}
    />
  );

  /* The folder the main content is currently showing (picked from
     the tree, a category chip, or a grouped section header). */
  const activeFolder =
    category !== "الكل"
      ? (folders.find((f) => f.name === category) ?? null)
      : null;

  /* The open folder's contents, split the way the folder view
     presents them: its subfolders as their own section on top of
     the main area, then its replies in the list below — never
     mixed, never behind another window. The name sort re-orders
     the subfolder cards too; the other modes keep the tree order. */
  const subfolders = useMemo(() => {
    if (!activeFolder) return [];
    const kids = childFolders.get(activeFolder.id) ?? [];
    return folderSort === "name"
      ? [...kids].sort((a, b) => a.name.localeCompare(b.name, "ar"))
      : kids;
  }, [activeFolder, childFolders, folderSort]);
  const folderReplyCount = activeFolder
    ? (folderShortcuts.get(activeFolder.id) ?? []).length
    : 0;
  const inFolderView = !!activeFolder && view === "default" && !search.trim();

  /* Jump into a subfolder from the main area: it becomes the
     selected folder, and its whole ancestor chain opens in the
     tree so the user's place stays visible there too. */
  const openSubfolder = (f: FolderRowT) => {
    const opens: Record<string, boolean> = { "g:library": true };
    let cur: FolderRowT | undefined = f;
    const guard = new Set<number>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      opens[`f:${cur.id}`] = true;
      cur = cur.parentId !== null ? folderById.get(cur.parentId) : undefined;
    }
    setTreeOpen((p) => ({ ...p, ...opens }));
    goCategory(f.name);
  };

  const exportFolderJson = async (folder: FolderRowT) => {
    const ids = new Set<number>();
    const collect = (fid: number) => {
      ids.add(fid);
      for (const c of childFolders.get(fid) ?? []) collect(c.id);
    };
    collect(folder.id);
    const items = shortcuts.filter(
      (s) => s.folderId !== null && ids.has(s.folderId),
    );
    const exported = items.map((x) => ({
      title: x.title,
      body: x.body,
      category: x.category,
      tags: x.tags ?? "",
      extShortcut: x.extShortcut ?? "",
      source: x.source ?? "",
    }));
    downloadText(
      `is-folder-${folder.name}.json`,
      JSON.stringify({ folder: folder.name, shortcuts: exported }, null, 2),
      "application/json;charset=utf-8",
    );
    showToast(`اتصدّر مجلد «${folder.name}» — ${items.length} رد بصيغة JSON`);
  };

  const exportOneJson = (s: Shortcut) => {
    downloadText(
      `is-reply-${s.id}.json`,
      JSON.stringify(
        {
          shortcuts: [
            {
              title: s.title,
              body: s.body,
              category: s.category,
              tags: s.tags ?? "",
              extShortcut: s.extShortcut ?? "",
              source: s.source ?? "",
            },
          ],
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );
    showToast(`اتصدّر رد «${s.title}» بصيغة JSON`);
  };

  /* Export just the multi-selected replies, in the same backup
     shape as every other export, so the file imports back cleanly. */
  const exportSelected = () => {
    const items = shortcuts
      .filter((s) => selectedIds.has(s.id))
      .map((x) => ({
        title: x.title,
        body: x.body,
        category: x.category,
        tags: x.tags ?? "",
        extShortcut: x.extShortcut ?? "",
        source: x.source ?? "",
      }));
    if (items.length === 0) return;
    downloadText(
      `is-selected-${items.length}.json`,
      JSON.stringify({ shortcuts: items }, null, 2),
      "application/json;charset=utf-8",
    );
    showToast(`اتصدّر ${items.length} رد محدد بصيغة JSON`);
  };

  /* Import never writes on file pick: the file is parsed first and
     a preview shows exactly what will land (and what is already
     there) before the user chooses merge or replace. */
  const onImportFile = (file: File) => {
    file.text().then((text) => {
      try {
        // CSV backups (from the CSV export or a spreadsheet) import
        // through the same path as JSON.
        if (file.name.toLowerCase().endsWith(".csv") || (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("["))) {
          const items = parseCsv(text);
          if (items.length === 0) throw new Error("empty");
          setImportPreview({ fileName: file.name, items });
          return;
        }
        const parsed: unknown = JSON.parse(text);
        const arr = Array.isArray(parsed)
          ? parsed
          : (parsed as { shortcuts?: unknown[] }).shortcuts;
        if (!Array.isArray(arr)) throw new Error("bad");
        const items = arr
          .filter(
            (x): x is {
              title?: string;
              body: string;
              category?: string;
              tags?: string;
              extShortcut?: string;
              source?: string;
            } =>
              typeof x === "object" &&
              x !== null &&
              typeof (x as { body?: unknown }).body === "string" &&
              typeof (x as { title?: unknown }).title === "string",
          )
          .map((x) => ({
            title:
              typeof x.title === "string" && x.title ? x.title : "رد مستورد",
            body: x.body,
            category: typeof x.category === "string" && x.category ? x.category : "عام",
            tags: typeof x.tags === "string" ? x.tags : "",
            extShortcut: typeof x.extShortcut === "string" ? x.extShortcut : "",
            source:
              typeof x.source === "string" &&
              (REPLY_SOURCES as readonly string[]).includes(x.source)
                ? x.source
                : "",
          }));
        if (items.length === 0) throw new Error("empty");
        setImportPreview({ fileName: file.name, items });
      } catch {
        showToast("الملف مش صالح للاستيراد — لازم يكون نسخة JSON أو CSV من الموقع");
      }
    });
  };

  /* Last-backup stamp for THIS device: set the moment a backup file
     is actually downloaded, so the tools card can say honestly when
     the user last took one (per device, like every other local
     preference here). */
  const backupKey = `is-last-backup-${user.id}`;
  const [lastBackup, setLastBackup] = useState<string | null>(() => {
    try {
      return localStorage.getItem(backupKey);
    } catch {
      return null;
    }
  });
  const noteBackup = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(backupKey, now);
    } catch {
      /* storage unavailable — the stamp just won't persist */
    }
    setLastBackup(now);
  };

  /* Full backup for the host move: the server serializes every
     table in the importer's full-export shape (accounts with
     password hashes, folders with all settings, replies, trash,
     smart folders, copy history); the client fetches each
     profile picture and embeds its bytes as dataBase64, then
     the finished file downloads as one JSON. */
  const fullBackupMut = useMutation({
    mutationFn: async () => {
      const res = await api.exportFullBackup({ token });
      const data = JSON.parse(res.json) as Record<string, unknown>;
      const avatars: Array<{ userId: number; mimeType: string; dataBase64: string }> = [];
      for (const a of res.avatars) {
        const r = await fetch(a.url);
        if (!r.ok) throw new Error("avatar fetch failed");
        const blob = await r.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("avatar read failed"));
          fr.readAsDataURL(blob);
        });
        avatars.push({
          userId: a.userId,
          mimeType: a.mimeType,
          dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
        });
      }
      data.avatars = avatars;
      return { filename: res.filename, text: JSON.stringify(data, null, 2) };
    },
    onSuccess: (out) => {
      noteBackup();
      downloadText(out.filename, out.text, "application/json;charset=utf-8");
      showToast(
        lang === "en"
          ? "Full backup downloaded — keep it private: it holds every account with its password hash."
          : "نزلت النسخة الكاملة — احتفظ بيها في مكان خاص: فيها كل الحسابات وبصمات كلمات المرور.",
      );
    },
    onError: () => {
      showToast(
        lang === "en"
          ? "The full backup could not be built — try again."
          : "النسخة الكاملة ما اتعملتش — جرّب تاني.",
        "error",
      );
    },
  });

  /* تصفير الاستخدام (v73 addition): the owner's counts so far are
     test noise, so one confirmed action wipes the copy history and
     returns every reply's counter to zero. The server restricts it
     to the owner account; the dialog exists because it cannot be
     undone. */
  const [resetUsageOpen, setResetUsageOpen] = useState(false);
  useEscapeClose(() => setResetUsageOpen(false));
  const resetUsageMut = useMutation({
    mutationFn: async () => await api.resetUsageStats({ token }),
    onSuccess: (res) => {
      invalidate();
      setResetUsageOpen(false);
      showToast(
        lang === "en"
          ? `Usage reset — ${res.clearedHistory} history entries cleared and ${res.resetReplies} replies back to zero.`
          : `اتصفّر الاستخدام — اتمسح ${res.clearedHistory} سجل من تاريخ النسخ و${res.resetReplies} رد رجع عدّاده لصفر.`,
      );
    },
    onError: (e) => {
      setResetUsageOpen(false);
      showToast(
        e instanceof Error ? e.message : lang === "en" ? "The reset did not happen — try again." : "التصفير ما حصلش — جرّب تاني.",
        "error",
      );
    },
  });

  /* The details panel always renders the live row, so edits, pins
     and usage counts refresh inside it; once the reply is deleted
     the panel closes itself. */
  const detailFresh = detailItem
    ? (shortcuts.find((s) => s.id === detailItem.id) ?? null)
    : null;

  return (
    <>
      {offline && (
        <div
          role="alert"
          className="animate-fade flex items-center justify-center gap-2 bg-[var(--warning-soft)] px-4 py-2 text-center text-[13px] font-bold text-[var(--warning)]"
        >
          <Icon d={WifiOff} size={15} />
          {lang === "en"
            ? "You're offline — browsing and copying still work, but new saves won't go through until the connection is back."
            : "الاتصال انقطع — التصفح والنسخ شغالين عادي، بس أي حفظ جديد مش هيتم لحد ما الاتصال يرجع."}
        </div>
      )}
      {/* Top bar (v76 «Nebula») — a floating glass capsule
          detached from every screen edge: logo, one centred
          search, account. The sticky header carries a top
          offset (tokens.css .app-shell > header) so the
          capsule floats over the aurora ground. */}
      <header className="sticky top-0 z-40">
        <div className={`header-blur float-header mx-auto flex h-[68px] w-full max-w-[88rem] items-center gap-2 px-3 transition-shadow duration-300 sm:gap-3 sm:px-5 lg:px-6 ${scrolled ? "header-elevated" : ""}`}>
          <button
            type="button"
            aria-label={t("فتح قائمة التنقل")}
            data-tip={t("القائمة — كل الأقسام والمجموعات والمجلدات")}
            data-tip-pos="below"
            data-tip-align="end"
            onClick={() => setDrawerOpen(true)}
            className="lux-btn shrink-0 rounded-full p-2.5 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] lg:hidden"
          >
            <Icon d={I.menu} size={20} />
          </button>
          <button
            type="button"
            aria-label={t("الرجوع إلى الرئيسية")}
            data-tip={t("الرئيسية — كل ردودك")}
            data-tip-pos="below"
            data-tip-align="end"
            onClick={() => {
              setSection("home");
              window.scrollTo({ top: 0 });
            }}
            className="lux-btn shrink-0 rounded-[10px]"
          >
            <Logo size={40} />
          </button>
          <div className="relative mx-auto w-full min-w-0 max-w-2xl flex-1 transition-[max-width] duration-300 focus-within:max-w-[44rem]" data-tip={t("دوّر باسم الرد أو أي كلمة منه")}>
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--faint)]">
              <Icon d={I.search} size={19} />
            </span>
            <input
              ref={searchRef}
              aria-label={t("دوّر في الردود")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (section !== "home") setSection("home");
              }}
              onFocus={() => {
                if (section !== "home") setSection("home");
              }}
              placeholder={t("دوّر باسم الرد أو كلمة منه…")}
              className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pe-11 ps-12 text-[15px] shadow-[0_6px_20px_-8px_rgba(13,42,82,0.18)] outline-none transition-all placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:shadow-[0_10px_28px_-8px_rgba(22,104,196,0.35)]"
            />
            {search && (
              <button
                type="button"
                aria-label={t("مسح البحث")}
                data-tip={t("مسح البحث")}
                data-tip-pos="below"
                onClick={() => setSearch("")}
                className="lux-btn absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--faint)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
              >
                <Icon d={I.x} size={16} />
              </button>
            )}
          </div>
          {/* Sync status: a single quiet dot — green while the
              connection is live, amber while offline. */}
          <span
            role="img"
            aria-label={offline ? (lang === "en" ? "Offline" : "غير متصل") : lang === "en" ? "Synced" : "متزامن"}
            data-tip={offline ? (lang === "en" ? "Offline — changes wait for the connection" : "غير متصل — التغييرات بتستنى الاتصال") : lang === "en" ? "Synced — everything is saved" : "متزامن — كل حاجة محفوظة"}
            data-tip-pos="below"
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${offline ? "animate-pulse bg-[var(--warning)]" : "bg-[var(--success)]"}`}
          />
          {/* Appearance: theme mode + accent in ONE popover. */}
          <div className="relative shrink-0" ref={appearanceRef}>
            <button
              type="button"
              aria-label={t("المظهر")}
              aria-expanded={accentOpen}
              aria-haspopup="dialog"
              data-tip={t("المظهر — الثيم ولون التمييز ولون الأيقونات")}
              data-tip-pos="below"
              onClick={() => setAccentOpen((v) => !v)}
              className="lux-btn rounded-full p-2.5 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
            >
              <Palette size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {accentOpen && (
              <div className="pop-glass animate-menu absolute end-0 top-[calc(100%+8px)] z-[var(--z-menu)] w-60 rounded-[var(--r-md)] p-3" role="dialog" aria-label={t("المظهر")}>
                <p className="px-1 text-[12.5px] font-bold text-[var(--faint)]">{lang === "en" ? "Theme" : "الثيم"}</p>
                <div className="mt-1.5 flex items-center gap-0.5 rounded-full bg-[var(--surface-alt)] p-1" role="group" aria-label={lang === "en" ? "Theme mode" : "وضع الثيم"}>
                  {(
                    [
                      { key: "light", label: lang === "en" ? "Light" : "فاتح", icon: I.sun },
                      { key: "dark", label: lang === "en" ? "Dark" : "داكن", icon: I.moon },
                      { key: "system", label: lang === "en" ? "System" : "النظام", icon: I.devices },
                    ] as Array<{ key: ThemeMode; label: string; icon: LucideIcon }>
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      aria-label={m.label}
                      aria-pressed={themeMode === m.key}
                      onClick={(e) => onThemeMode(m.key, { x: e.clientX, y: e.clientY })}
                      className={`lux-btn flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[12.5px] font-bold ${
                        themeMode === m.key
                          ? "bg-[var(--surface-elevated)] text-[var(--text)] shadow-[var(--shadow-1)] ring-1 ring-[var(--border)]"
                          : "text-[var(--dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Icon d={m.icon} size={14} />
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3.5 px-1 text-[12.5px] font-bold text-[var(--faint)]">{lang === "en" ? "Accent colour" : "لون التمييز"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 pb-1" role="group" aria-label={t("اختيار لون التمييز")}>
                  {ACCENTS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      aria-label={a.label}
                      aria-pressed={accent === a.key}
                      data-tip={a.label}
                      data-tip-pos="below"
                      onClick={() => {
                        /* اختيار مقصود من القايمة في هذا البناء:
                           بيعلّم علم v89 عشان ترحيل العنبري
                           القسري (بقايا الهوية الذهبية المرفوضة)
                           ما يلغيش اختيار المالك أبدًا بعد كده. */
                        try { localStorage.setItem("is-accent-nebula89", "1"); } catch { /* ignore */ }
                        setAccent(a.key);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
                      style={{ background: a.swatch }}
                    >
                      {accent === a.key && <Icon d={I.check} size={15} />}
                    </button>
                  ))}
                </div>
                <p className="mt-3.5 px-1 text-[12.5px] font-bold text-[var(--faint)]">{lang === "en" ? "Icon colour" : "لون الأيقونات"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 pb-1" role="group" aria-label={lang === "en" ? "Icon colour choice" : "اختيار لون الأيقونات"}>
                  <button
                    type="button"
                    aria-label={lang === "en" ? "Automatic icon colour" : "لون أيقونات تلقائي"}
                    aria-pressed={iconTone === "auto"}
                    data-tip={lang === "en" ? "Automatic — icons keep their current colours" : "تلقائي — الأيقونات بألوانها الحالية"}
                    data-tip-pos="below"
                    onClick={() => setIconTone("auto")}
                    className={`lux-btn h-8 shrink-0 rounded-full px-3 text-xs font-bold ${iconTone === "auto" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                  >
                    {lang === "en" ? "Auto" : "تلقائي"}
                  </button>
                  {ICON_TONES.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      aria-label={a.label}
                      aria-pressed={iconTone === a.key}
                      data-tip={a.label}
                      data-tip-pos="below"
                      onClick={() => setIconTone(a.key)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
                      style={{ background: a.swatch }}
                    >
                      {iconTone === a.key && <Icon d={I.check} size={15} />}
                    </button>
                  ))}
                  <label
                    className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-transform hover:scale-110"
                    style={{
                      background: customToneOf(iconTone) ?? "conic-gradient(#ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #ef4444)",
                      boxShadow: customToneOf(iconTone) ? `0 0 0 2px var(--surface), 0 0 0 4px ${customToneOf(iconTone)}` : undefined,
                    }}
                    data-tip={lang === "en" ? "Any colour…" : "أي لون…"}
                    data-tip-pos="below"
                  >
                    {customToneOf(iconTone) ? <Icon d={I.check} size={15} /> : <Pipette size={14} aria-hidden="true" />}
                    <input
                      type="color"
                      aria-label={lang === "en" ? "Pick any icon colour" : "اختيار أي لون للأيقونات"}
                      value={customToneOf(iconTone) ?? "#1668C4"}
                      onChange={(e) => setIconTone(`custom:${e.target.value}`)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <p className="mt-3.5 px-1 text-[12.5px] font-bold text-[var(--faint)]">{lang === "en" ? "Folder tiles" : "بلاطات المجلدات"}</p>
                <div className="mt-1.5 flex items-center gap-0.5 rounded-full bg-[var(--surface-alt)] p-1" role="group" aria-label={lang === "en" ? "Folder tile style" : "نمط بلاطات المجلدات"}>
                  {(
                    [
                      { key: "tinted", label: lang === "en" ? "Tinted" : "ملوّنة" },
                      { key: "plain", label: lang === "en" ? "Plain" : "شفافة" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      aria-label={s.label}
                      aria-pressed={iconStyle === s.key}
                      onClick={() => setIconStyle(s.key)}
                      className={`lux-btn flex flex-1 items-center justify-center rounded-full px-2 py-1.5 text-[12.5px] font-bold ${
                        iconStyle === s.key
                          ? "bg-[var(--surface-elevated)] text-[var(--text)] shadow-[var(--shadow-1)] ring-1 ring-[var(--border)]"
                          : "text-[var(--dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <LangToggle />
          {/* Account: ONE avatar dropdown — identity, account page
              and logout live inside it. */}
          <div className="relative shrink-0" ref={accountRef}>
            <button
              ref={accountBtnRef}
              type="button"
              aria-label={t("حسابي")}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              data-tip={t("حسابي")}
              data-tip-pos="below"
              data-tip-align="start"
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="lux-btn flex max-w-[45vw] items-center gap-2 rounded-full py-1.5 pe-3 ps-1.5 hover:bg-[var(--surface-alt)]"
            >
              <AvatarFace user={user} displayName={displayName} size={32} />
              <span className="hidden min-w-0 text-start leading-tight min-[480px]:block">
                <span className="block truncate text-sm font-semibold">{displayName}</span>
                <span dir="ltr" className="block truncate text-left font-mono text-[11px] text-[var(--faint)]">
                  {loginIdLabel(user)}
                </span>
              </span>
            </button>
            {accountMenuOpen && (
              <div className="pop-glass animate-menu absolute end-0 top-[calc(100%+8px)] z-[var(--z-menu)] w-60 rounded-[var(--r-md)] p-2" role="menu" aria-label={t("حسابي")}>
                <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
                  <AvatarFace user={user} displayName={displayName} size={36} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-bold">{displayName}</p>
                    <p dir="ltr" className="truncate text-left font-mono text-[11px] text-[var(--faint)]">{loginIdLabel(user)}</p>
                  </div>
                </div>
                <div className="border-t border-[var(--border)] pt-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={t("حسابي")}
                    onClick={() => { closeAccountMenu(); setSection("account"); window.scrollTo({ top: 0 }); }}
                    className="lux-btn flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-start text-sm font-semibold text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                  >
                    <Icon d={I.user} size={16} />
                    {t("حسابي")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={t("تسجيل الخروج")}
                    onClick={() => { setAccountMenuOpen(false); onLogout(); }}
                    className="lux-btn flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-start text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  >
                    <Icon d={I.logout} size={16} />
                    {t("تسجيل الخروج")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-[88rem] items-stretch">
        {/* Sidebar — desktop (v76 «Nebula», organised in
            v77): a floating glass panel detached from every
            edge, the aurora ground glowing through its glass
            (tokens.css .modern-sidebar). Inside: the
            hierarchical tree on one calm rhythm — icon tiles,
            count pills, guide hairlines, section-header
            groups (tokens.css v77 tree rules). Groups open
            and close independently, the whole bar collapses
            to an icon rail, and its open state is remembered
            on this device. */}
        <aside
          ref={asideRef}
          className={`sticky top-[68px] hidden h-[calc(100dvh-68px)] shrink-0 self-start border-e border-[var(--border)] bg-[var(--bg-sidebar)] sidebar-panel modern-sidebar lg:block relative ${sideDragging ? "" : "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"}`}
          style={{ width: sideW }}
          aria-label="التنقل الرئيسي"
        >
          <div
            className={`side-scroll-fade h-full overflow-y-auto no-scrollbar py-5 ${
              rail ? "px-1.5" : "px-2.5"
            }`}
          >
            {renderNavTree(rail)}
          </div>
          {/* Resize handle: drag the bar's edge to any width from
              the 88px rail to 440px; a double-click toggles between
              the rail and the full tree. The width persists on this
              device. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("تغيير عرض القائمة الجانبية بالسحب")}
            aria-valuemin={72}
            aria-valuemax={440}
            aria-valuenow={sideW}
            tabIndex={0}
            onPointerDown={onSideHandleDown}
            onMouseDown={onSideHandleMouseDown}
            onDoubleClick={() => setRail(!rail)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const step = (e.key === "ArrowRight" ? 1 : -1) * (lang === "en" ? 16 : -16);
                setSideW((w) => Math.min(440, Math.max(72, w + step)));
              } else if (e.key === "Home") {
                e.preventDefault();
                setSideW(72);
              } else if (e.key === "End") {
                e.preventDefault();
                setSideW(268);
              }
            }}
            className={`sidebar-resize-handle absolute ${sideDragging ? "sidebar-resize-active" : ""}`}
          >
            <span aria-hidden="true" className="sidebar-resize-line" />
            <span
              aria-hidden="true"
              className="sidebar-resize-grip"
              data-tip={t("اسحب لتفريد القائمة أو ضمها بالمقاس اللي يناسبك")}
            >
              <Icon d={GripVertical} size={13} />
            </span>
          </div>
        </aside>

      <main className="min-w-0 flex-1 px-4 pb-24 sm:px-6 lg:px-8">
        {/* Breadcrumbs — the user's exact place in the tree; every
            parent is one tap away. */}
        <nav aria-label={t("مسار التنقل")} className="pt-5 lg:pt-6">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-[var(--faint)]">
                      <Icon d={chevDir} size={14} />
                    </span>
                  )}
                  {last || !c.run ? (
                    <span
                      aria-current={last ? "page" : undefined}
                      className={last ? "font-bold text-[var(--text)]" : "text-[var(--dim)]"}
                    >
                      {t(c.label)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={lang === "en" ? `Go to ${t(c.label)}` : `الانتقال إلى ${c.label}`}
                      data-tip={lang === "en" ? `Go to ${t(c.label)}` : `الانتقال إلى ${c.label}`}
                      data-tip-pos="below"
                      onClick={c.run}
                      className="lux-btn font-medium text-[var(--dim)] hover:text-[var(--text)]"
                    >
                      {t(c.label)}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Section nav — mobile / tablet quick rail; the full tree
            (groups + folders + search) lives in the drawer. */}
        <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 pt-4 sm:-mx-6 sm:px-6 lg:hidden" aria-label={t("أقسام الموقع")}>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-label={t(s.label)}
              aria-current={section === s.key ? "page" : undefined}
              data-tip={t(s.tip)}
              data-tip-pos="below"
              onClick={() => {
                setSection(s.key);
                window.scrollTo({ top: 0 });
              }}
              className={`lux-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${
                section === s.key
                  ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:text-[var(--text)]"
              }`}
            >
              <Icon d={s.icon} size={16} />
              {t(s.label)}
            </button>
          ))}
        </nav>

        {section === "home" && (
        <>
        {/* Home head: the verse the owner chose in place of the
            greeting — rendered verbatim, always in Arabic (it is
            content, not interface chrome, so the language switch
            never touches it). The plaque is sized TO the verse:
            snug padding, the verse centered and full-width with
            balanced wrapping so it fills the card evenly with no
            dead space, an accent-tinted wash (everything derives
            from the chosen accent, per the owner's consistency
            rule), one gradient edge, and a slow breathing glow
            plus a light sweep for motion. The counter line sits
            beneath the verse, inside the plaque. The styling
            lives in the .verse-hero rules in tokens.css, and
            collapsing still folds the plaque into the slim
            glass .hero-strip below. */}
        {heroHidden ? (
        <section className="hero-strip animate-rise mt-6 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5" aria-label={t("البانر مخفي")}>
          <p dir="rtl" lang="ar" className="verse min-w-0 truncate text-[17px] text-[var(--ink)]">نِعْمَةً مِّنْ عِندِنَا ۚ كَذَٰلِكَ نَجْزِي مَن شَكَرَ</p>
          <span className="hidden shrink-0 text-[13px] text-[var(--dim)] md:block">
            {lang === "en" ? `${shortcuts.length} replies in ${folderCount} folders` : `${shortcuts.length} رد في ${folderCount} مجلد`}
          </span>
          <button
            type="button"
            aria-label={t("إظهار البانر")}
            data-tip={t("إظهار بانر الآية من تاني")}
            data-tip-pos="below"
            onClick={() => toggleHero(false)}
            className="lux-btn flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-2 text-[13px] font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            <Icon d={I.eye} size={15} />
            {t("إظهار البانر")}
          </button>
        </section>
        ) : (
        <section className="verse-hero animate-rise relative mt-6 flex flex-col items-center text-center lg:mt-7">
          <button
            type="button"
            aria-label={t("إخفاء البانر")}
            data-tip={t("إخفاء البانر — بيظهر مكانه شريط صغير تقدر ترجعه منه")}
            data-tip-pos="below"
            data-tip-align="start"
            onClick={() => toggleHero(true)}
            className="hero-hide-btn lux-btn absolute end-3 top-3"
          >
            <Icon d={I.eyeOff} size={15} />
          </button>
          <h1
            dir="rtl"
            lang="ar"
            className="verse w-full text-[clamp(28px,4.6vw,44px)]"
          >
            نِعْمَةً مِّنْ عِندِنَا ۚ كَذَٰلِكَ نَجْزِي مَن شَكَرَ
          </h1>
          <p className="hero-counter mt-3">
            {lang === "en"
              ? `${shortcuts.length} replies in ${folderCount} folders — search from the top, and copy any reply in one click.`
              : `${shortcuts.length} رد في ${folderCount} مجلد — دوّر من فوق، وانسخ أي رد بضغطة واحدة.`}
          </p>
        </section>
        )}

        {/* Toolbar: add buttons, folder chips, sort views */}
        <section className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={t("إضافة اختصار جديد")} data-tip={t("إضافة اختصار جديد إلى مكتبتك")}
              onClick={() => setEditor({ open: true, item: null })}
              className="lux-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
            >
              <Icon d={I.plus} size={18} />
              {t("جديد")}
            </button>
            <button
              type="button"
              aria-label={t("إضافة جماعية بلصق مجموعة ردود")} data-tip={t("إضافة مجموعة ردود مرة واحدة باللصق")}
              onClick={() => setBulkOpen(true)}
              className="lux-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              <Icon d={I.upload} size={18} />
              {t("جماعية")}
            </button>
          </div>
          <div className="no-scrollbar -mx-4 -mb-9 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-11 sm:-mx-6 sm:px-6 lg:hidden">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={lang === "en" ? `Category ${c === "الكل" ? "All" : c}` : `تصنيف ${c}`} data-tip={c === "الكل" ? (lang === "en" ? "Show all replies" : "عرض كل الاختصارات") : lang === "en" ? `Show only «${c}» replies` : `عرض اختصارات «${c}» فقط`} data-tip-pos="below"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`lux-btn flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${
                  category === c
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                }`}
              >
                {c === "الكل" ? t("الكل") : c}
                <span
                  className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${
                    category === c
                      ? "bg-[var(--surface)] text-[var(--text)]"
                      : "bg-[var(--surface-alt)] text-[var(--dim)]"
                  }`}
                >
                  {c === "الكل" ? shortcuts.length : (categoryCounts.get(c) ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Filter bar — ONE sticky glass row under the header:
            four primary view pills with counters riding a sliding
            accent thumb, the remaining views gathered in a «المزيد»
            popover, the combinable «فلاتر» merged into the same
            row, and the density segmented control (its own sliding
            thumb) at the opposite end. On small screens the row
            scrolls sideways under faded edges. Every control drives
            the same view/filter state as before — only the
            arrangement changed. */}
        <div className="header-blur modern-switcher sticky top-[68px] z-30 -mx-4 mt-5 px-4 py-2.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="filter-scroll overflow-x-auto">
            <div className="flex w-max items-center gap-1.5">
              <div ref={pillTrackRef} className="relative flex items-center gap-1">
                {pillThumb && (
                  <span
                    aria-hidden="true"
                    className="pill-thumb"
                    style={{ left: pillThumb.left, width: pillThumb.width }}
                  />
                )}
                {(
                  [
                    { key: "default", label: "الكل", icon: I.layers, tip: "كل الردود — المثبت أولاً، ثم الأكثر استخداماً", count: shortcuts.length },
                    { key: "favorites", label: "المفضلة", icon: I.star, tip: "ردودك المفضلة — اللي علّمت عليها بنجمة", count: shortcuts.filter((s) => s.favorite).length },
                    { key: "used", label: "استُخدمت مؤخراً", icon: I.history, tip: "الردود اللي نسختها أو استخدمتها مؤخراً — آخر استخدام الأول", count: shortcuts.filter((s) => s.lastUsedAt).length },
                    { key: "recent", label: "الأحدث", icon: I.clock, tip: "رتّب حسب الأحدث إضافة", count: shortcuts.length },
                  ] as Array<{ key: ViewMode; label: string; icon: LucideIcon; tip: string; count: number }>
                ).map((v) => {
                  const on = view === v.key && smartId === null;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      data-view-pill={v.key}
                      aria-label={lang === "en" ? `View: ${t(v.label)}` : `عرض ${v.label}`}
                      data-tip={t(v.tip)}
                      aria-pressed={on}
                      onClick={() => {
                        setSmartId(null);
                        setView(v.key);
                      }}
                      className={`pill-btn lux-btn flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${
                        on ? "text-[var(--accent-ink)]" : "text-[var(--dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Icon d={v.icon} size={16} />
                      {t(v.label)}
                      <span
                        className={`rounded-full px-1.5 text-[12px] font-bold leading-5 ${
                          on
                            ? "bg-[oklch(1_0_0/0.22)] text-[var(--accent-ink)]"
                            : "bg-[var(--surface-alt)] text-[var(--dim)]"
                        }`}
                      >
                        {v.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                ref={moreBtnRef}
                type="button"
                aria-label={lang === "en" ? "More views" : "عروض إضافية"}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                data-tip={lang === "en" ? "Copy history, most used, least used, never used" : "سجل النسخ، الأكثر استخداماً، الأقل استخداماً، لم تُستخدم"}
                onClick={(e) => {
                  if (!moreOpen) {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMorePos({ top: r.bottom + 8, right: window.innerWidth - r.right });
                  }
                  setMoreOpen((v) => !v);
                }}
                className={`lux-btn flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${
                  smartId === null && (view === "history" || view === "most" || view === "least" || view === "unused")
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                }`}
              >
                {lang === "en" ? "More" : "المزيد"}
                <span className={`flex transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}>
                  <Icon d={I.chevron} size={15} />
                </span>
              </button>
              <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--border)]" aria-hidden="true" />
              <button
                type="button"
                aria-label={lang === "en" ? "Search filters" : "فلاتر البحث"}
                data-tip={lang === "en" ? "Combine filters: tags, favorites, pinned, last-edited window" : "اجمع أكتر من فلتر: وسوم، مفضلة، مثبتة، وفترة آخر تعديل"}
                aria-expanded={filtersOpen}
                aria-pressed={filtersActive}
                onClick={() => setFiltersOpen((v) => !v)}
                className={`lux-btn flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${
                  filtersActive
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                }`}
              >
                <Icon d={I.sliders} size={16} />
                {lang === "en" ? "Filters" : "فلاتر"}
                {filtersActive && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface)] px-1 text-[12px] font-extrabold text-[var(--accent-strong)]">
                    {filterTags.length + (onlyFav ? 1 : 0) + (onlyPin ? 1 : 0) + (dateRange !== "all" ? 1 : 0)}
                  </span>
                )}
              </button>
              <div
                ref={densityTrackRef}
                className="seg-track ms-1 flex shrink-0 items-center gap-0.5"
                role="group"
                aria-label={t("كثافة عرض الردود")}
              >
                {densityThumb && (
                  <span
                    aria-hidden="true"
                    className="seg-thumb"
                    style={{ left: densityThumb.left, width: densityThumb.width }}
                  />
                )}
                {(
                  [
                    { key: "compact", label: "مضغوط" },
                    { key: "comfortable", label: "مريح" },
                    { key: "grid", label: "شبكة" },
                  ] as Array<{ key: ListDensity; label: string }>
                ).map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    data-density-seg={d.key}
                    aria-label={lang === "en" ? `${t(d.label)} view` : `عرض ${d.label}`}
                    data-tip={t(d.key === "compact" ? "قائمة مضغوطة — رد في كل سطر، الأسرع مع مئات الردود" : d.key === "comfortable" ? "بطاقات مريحة — معاينة أطول لكل رد" : "شبكة بطاقات — للتصفح البصري")}
                    aria-pressed={density === d.key}
                    onClick={() => setDensity(d.key)}
                    className={`seg-btn lux-btn whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold ${
                      density === d.key ? "text-[var(--text)]" : "text-[var(--dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t(d.label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {moreOpen &&
            morePos &&
            createPortal(
              <div
                ref={morePopRef}
                className="pop-glass animate-menu fixed z-[var(--z-menu)] w-56 rounded-[var(--r-md)] p-1.5"
                style={{ top: morePos.top, right: morePos.right }}
                role="menu"
                aria-label={lang === "en" ? "More views" : "عروض إضافية"}
              >
                {(
                  [
                    { key: "history", label: "سجل النسخ", icon: I.clipboard, tip: "سجل كل عمليات النسخ الناجحة بوقتها" },
                    { key: "most", label: "الأكثر استخداماً", icon: I.flame, tip: "رتّب حسب عدد مرات الاستخدام — الأعلى الأول" },
                    { key: "least", label: "الأقل استخداماً", icon: I.trendDown, tip: "رتّب حسب عدد مرات الاستخدام — الأقل الأول، عشان تشوف الردود المهملة" },
                    { key: "unused", label: "لم تُستخدم", icon: I.hourglass, tip: "الردود اللي لسه ما اتنسختش ولا اتستخدمت ولا مرة" },
                  ] as Array<{ key: ViewMode; label: string; icon: LucideIcon; tip: string }>
                ).map((v) => {
                  const on = view === v.key && smartId === null;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      role="menuitem"
                      aria-label={lang === "en" ? `View: ${t(v.label)}` : `عرض ${v.label}`}
                      data-tip={t(v.tip)}
                      data-tip-align="start"
                      aria-pressed={on}
                      onClick={() => {
                        setSmartId(null);
                        setView(v.key);
                        setMoreOpen(false);
                      }}
                      className={`lux-btn flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-sm font-semibold ${
                        on
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Icon d={v.icon} size={16} />
                      <span className="flex-1 text-start">{t(v.label)}</span>
                      {on && <Icon d={I.check} size={15} />}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
          {(filtersOpen || filtersActive) && (
            <div className="animate-rise mt-2 border-t border-[var(--border)] pt-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-label={lang === "en" ? "Favorites only" : "المفضلة فقط"}
                  aria-pressed={onlyFav}
                  onClick={() => setOnlyFav((v) => !v)}
                  className={`lux-btn flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${onlyFav ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                >
                  <Icon d={I.star} size={14} />
                  {lang === "en" ? "Favorites" : "المفضلة"}
                </button>
                <button
                  type="button"
                  aria-label={lang === "en" ? "Pinned only" : "المثبتة فقط"}
                  aria-pressed={onlyPin}
                  onClick={() => setOnlyPin((v) => !v)}
                  className={`lux-btn flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${onlyPin ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                >
                  <Icon d={I.pin} size={14} />
                  {lang === "en" ? "Pinned" : "المثبتة"}
                </button>
                <span className="mx-0.5 h-5 w-px bg-[var(--border)]" aria-hidden="true" />
                {(
                  [
                    { key: "all", label: lang === "en" ? "Any time" : "أي وقت" },
                    { key: "today", label: lang === "en" ? "Edited today" : "اتعدلت النهاردة" },
                    { key: "week", label: lang === "en" ? "Last 7 days" : "آخر ٧ أيام" },
                    { key: "month", label: lang === "en" ? "Last 30 days" : "آخر ٣٠ يوم" },
                  ] as Array<{ key: typeof dateRange; label: string }>
                ).map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    aria-label={d.label}
                    aria-pressed={dateRange === d.key}
                    onClick={() => setDateRange(d.key)}
                    className={`lux-btn rounded-full px-3 py-1.5 text-[13px] font-semibold ${dateRange === d.key ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                  >
                    {d.label}
                  </button>
                ))}
                {filtersActive && (
                  <button
                    type="button"
                    aria-label={lang === "en" ? "Clear all filters" : "مسح كل الفلاتر"}
                    data-tip={lang === "en" ? "Remove every active filter" : "إلغاء كل الفلاتر الشغالة"}
                    onClick={clearFilters}
                    className="lux-btn ms-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  >
                    <Icon d={I.x} size={14} />
                    {lang === "en" ? "Clear filters" : "مسح الفلاتر"}
                  </button>
                )}
              </div>
              {allTags.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-bold text-[var(--faint)]">{lang === "en" ? "Tags:" : "الوسوم:"}</span>
                  {allTags.map((tg) => {
                    const on = filterTags.includes(tg);
                    return (
                      <button
                        key={tg}
                        type="button"
                        aria-label={lang === "en" ? `Filter by tag ${tg}` : `فلترة بوسم ${tg}`}
                        aria-pressed={on}
                        onClick={() =>
                          setFilterTags((p) => (on ? p.filter((x) => x !== tg) : [...p, tg]))
                        }
                        className={`lux-btn rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${on ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                      >
                        {tg}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Smart folder header: when a smart folder is open, it
            introduces itself like a folder does — name, its rules in
            plain words, the live match count, and its own actions
            (edit the rules, delete the view, close back to الكل).
            The replies below are the library's own rows, live. */}
        {activeSmart && view !== "trash" && (
          <section key={activeSmart.id} aria-label={lang === "en" ? `Smart folder ${activeSmart.name}` : `مجلد ذكي ${activeSmart.name}`} className="animate-rise elev-card mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span style={folderColorStyle(activeSmart)} className={activeSmart.iconColor ? `folder-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] ${folderColorClass(activeSmart)}` : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--accent-soft)] text-[var(--accent)]"}>
                <Icon d={FOLDER_ICON_OPTIONS.find((o) => o.key === activeSmart.icon)?.icon ?? I.wand} size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold leading-snug">
                  {activeSmart.name}
                  <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-strong)]">
                    <Icon d={I.sparkles} size={11} />
                    {lang === "en" ? "Smart" : "ذكي"}
                  </span>
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--dim)]">
                  {smartRuleSummary(activeSmart)}
                  {lang === "en" ? ` · ${displayList.length} matching replies right now` : ` · ${displayList.length} رد بيطابقوا الشروط دلوقتي`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-label={lang === "en" ? `Edit smart folder ${activeSmart.name}` : `تعديل المجلد الذكي ${activeSmart.name}`}
                  data-tip={lang === "en" ? "Change its rules" : "تغيير شروط المجلد الذكي"}
                  onClick={() => setSmartEditor({ open: true, item: activeSmart })}
                  className="lux-btn flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                >
                  <Icon d={I.edit} size={15} />
                  {lang === "en" ? "Edit rules" : "تعديل الشروط"}
                </button>
                <button
                  type="button"
                  aria-label={lang === "en" ? `Delete smart folder ${activeSmart.name}` : `حذف المجلد الذكي ${activeSmart.name}`}
                  data-tip={lang === "en" ? "Deletes the view only — no reply is touched" : "بيحذف العرض بس — ولا رد بيتأثر"}
                  onClick={() => deleteSmartMut.mutate(activeSmart.id)}
                  disabled={deleteSmartMut.isPending}
                  className="lux-btn flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-60"
                >
                  <Icon d={I.trash} size={15} />
                  {lang === "en" ? "Delete view" : "حذف العرض"}
                </button>
                <button
                  type="button"
                  aria-label={lang === "en" ? "Close the smart folder" : "قفل المجلد الذكي"}
                  data-tip={lang === "en" ? "Back to all replies" : "رجوع لكل الردود"}
                  onClick={() => setSmartId(null)}
                  className="lux-btn rounded-full p-2 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                >
                  <Icon d={I.x} size={16} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Folder header: when a folder is open, it introduces
            itself (name, description, real counts) with its own
            actions; the search scope sits in one quiet row above
            the list while a search runs. */}
        {activeFolder && view === "default" && !search.trim() && (
          <section key={activeFolder.id} aria-label={lang === "en" ? `Folder ${activeFolder.name}` : `مجلد ${activeFolder.name}`} className="animate-rise elev-card relative z-20 mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span style={folderColorStyle(activeFolder)} className={`folder-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] ${folderColorClass(activeFolder)}`}>
                <FolderGlyph folder={activeFolder} size={21} avoidIcon={parentIconOf(activeFolder)} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold leading-snug">
                  {activeFolder.name}
                  {activeFolder.pinned && (
                    <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-strong)]">
                      <Icon d={I.pin} size={11} />
                      {lang === "en" ? "Pinned" : "مثبت"}
                    </span>
                  )}
                  {activeFolder.source && (
                    <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--dim)]">
                      <SourceMark source={activeFolder.source} size={13} />
                      <span dir="ltr">{activeFolder.source}</span>
                      {activeFolder.isSourceMain && (
                        <span>{lang === "en" ? "· main folder" : "· المجلد الرئيسي"}</span>
                      )}
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--dim)]">
                  {activeFolder.description ??
                    (lang === "en"
                      ? `${(folderShortcuts.get(activeFolder.id) ?? []).length} replies in this folder · ${descendantCount(activeFolder.id)} items including everything inside`
                      : `${(folderShortcuts.get(activeFolder.id) ?? []).length} رد في المجلد ده · ${descendantCount(activeFolder.id)} عنصر بكل اللي جواه`)}
                </p>
                {activeFolder.description && (
                  <p className="text-xs text-[var(--faint)]">
                    {lang === "en"
                      ? `${(folderShortcuts.get(activeFolder.id) ?? []).length} replies in this folder · ${descendantCount(activeFolder.id)} items including everything inside`
                      : `${(folderShortcuts.get(activeFolder.id) ?? []).length} رد في المجلد ده · ${descendantCount(activeFolder.id)} عنصر بكل اللي جواه`}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={lang === "en" ? `Add a new reply in folder ${activeFolder.name}` : `إضافة رد جديد في مجلد ${activeFolder.name}`}
                data-tip={lang === "en" ? "The new reply is saved in this folder right away" : "الرد الجديد هيتحفظ في المجلد ده على طول"}
                onClick={() => setEditor({ open: true, item: null, presetFolderId: activeFolder.id })}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
              >
                <Icon d={I.plus} size={16} />
                {lang === "en" ? "New reply here" : "رد جديد هنا"}
              </button>
              <button
                type="button"
                aria-label={lang === "en" ? `Create a subfolder inside ${activeFolder.name}` : `إنشاء مجلد فرعي داخل ${activeFolder.name}`}
                data-tip={lang === "en" ? "A new folder inside this one" : "مجلد جديد جوه المجلد ده"}
                onClick={() => {
                  setTreeOpen((p) => ({ ...p, [`f:${activeFolder.id}`]: true, "g:library": true }));
                  setCreatingIn({ parent: activeFolder.id });
                  setTreeFormError(null);
                  setDrawerOpen(true);
                }}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-2 text-sm font-bold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <Icon d={FolderPlus} size={16} />
                {lang === "en" ? "Subfolder" : "مجلد فرعي"}
              </button>
              <button
                type="button"
                aria-label={lang === "en" ? `Move existing replies into ${activeFolder.name}` : `نقل ردود موجودة إلى ${activeFolder.name}`}
                data-tip={lang === "en" ? "Pick replies from another folder and move them here" : "اختار ردود من مجلد تاني وانقلها لهنا"}
                onClick={() => setMoveIntoId(activeFolder.id)}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-2 text-sm font-bold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <Icon d={I.enter} size={16} />
                {lang === "en" ? "Move replies in" : "نقل ردود إلى هنا"}
              </button>
              <button
                type="button"
                aria-label={activeFolder.pinned ? (lang === "en" ? `Unpin folder ${activeFolder.name}` : `إلغاء تثبيت مجلد ${activeFolder.name}`) : lang === "en" ? `Pin folder ${activeFolder.name}` : `تثبيت مجلد ${activeFolder.name}`}
                data-tip={activeFolder.pinned ? (lang === "en" ? "Unpin folder" : "إلغاء تثبيت المجلد") : lang === "en" ? "Pin folder — it appears before its siblings in the tree" : "تثبيت المجلد — بيظهر قبل إخواته في الشجرة"}
                aria-pressed={activeFolder.pinned}
                onClick={() => toggleFolderPinMut.mutate({ id: activeFolder.id, pinned: !activeFolder.pinned })}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-2 text-sm font-bold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <Icon d={I.pin} size={16} />
                {activeFolder.pinned ? (lang === "en" ? "Unpin" : "إلغاء التثبيت") : lang === "en" ? "Pin" : "تثبيت"}
              </button>
              <button
                type="button"
                aria-label={lang === "en" ? `Settings of folder ${activeFolder.name}` : `إعدادات مجلد ${activeFolder.name}`}
                data-tip={lang === "en" ? "Name, description and deleting the folder" : "الاسم والوصف وحذف المجلد"}
                onClick={() => setFolderSettingsId(activeFolder.id)}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-2 text-sm font-bold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <Icon d={I.edit} size={16} />
                {lang === "en" ? "Folder settings" : "إعدادات المجلد"}
              </button>
              <FolderSourceControl
                variant="chip"
                value={activeFolder.source}
                lang={lang}
                busy={setFolderSourceMut.isPending}
                onPick={(source) => setFolderSourceMut.mutate({ id: activeFolder.id, source })}
              />
              <button
                type="button"
                aria-label={lang === "en" ? `Export folder ${activeFolder.name} as JSON` : `تصدير مجلد ${activeFolder.name} بصيغة JSON`}
                data-tip={lang === "en" ? "Download this folder's replies and its subfolders in a JSON file" : "تنزيل ردود المجلد ده ومجلداته الفرعية في ملف JSON"}
                onClick={() => exportFolderJson(activeFolder)}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3.5 py-2 text-sm font-bold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <Icon d={I.download} size={16} />
                {t("تصدير المجلد")}
              </button>
            </div>
          </section>
        )}

        {/* Subfolders first: opening a folder shows everything inside
            it right here — its subfolders as one quiet section on
            top, then its replies in the list below. No separate
            window, no extra step. Each card says what's inside it
            and opens that folder in one tap. */}
        {activeFolder && view === "default" && !search.trim() && subfolders.length > 0 && (
          <section key={`subs-${activeFolder.id}`} aria-label={lang === "en" ? `Subfolders inside ${activeFolder.name}` : `مجلدات فرعية داخل ${activeFolder.name}`} className="mt-6">
            <GroupHead label={t("المجلدات الفرعية")} hint={lang === "en" ? `${subfolders.length} folders` : `${subfolders.length} مجلد`} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {subfolders.map((f, i) => {
                const repliesHere = (folderShortcuts.get(f.id) ?? []).length;
                const subsHere = (childFolders.get(f.id) ?? []).length;
                const parts = [
                  repliesHere > 0 ? (lang === "en" ? `${repliesHere} replies` : `${repliesHere} رد`) : null,
                  subsHere > 0 ? (lang === "en" ? `${subsHere} subfolders` : `${subsHere} مجلد فرعي`) : null,
                ].filter(Boolean);
                const fDrop = subDrop?.id === f.id ? subDrop.pos : null;
                const cardOver = cardDropFolder === f.name && !!cardDragRef.current;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-label={lang === "en" ? `Open folder ${f.name}` : `فتح مجلد ${f.name}`}
                    data-tip={lang === "en" ? `Open «${f.name}» and show its contents` : `فتح «${f.name}» وعرض محتوياته`}
                    onClick={() => openSubfolder(f)}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className={`lux-btn lux-card animate-rise group tree-node flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-start ${landedFolder === f.id ? "animate-land" : ""}`}
                    data-dragging={secDragId === f.id}
                    data-drop-inside={fDrop === "inside" || cardOver}
                    draggable={subArm === f.id}
                    onDragStart={(e) => {
                      if (subArm !== f.id) {
                        e.preventDefault();
                        return;
                      }
                      dragRef.current = { kind: "folder", id: f.id, ids: [f.id] };
                      e.dataTransfer.effectAllowed = "move";
                      try {
                        e.dataTransfer.setData("text/plain", f.name);
                      } catch {
                        /* the ref carries the payload */
                      }
                      setSecDragId(f.id);
                    }}
                    onDragEnd={() => {
                      setSubArm(null);
                      setSecDragId(null);
                      setSubDrop(null);
                      clearDrag();
                    }}
                    onDragOver={(e) => {
                      if (cardDragRef.current) {
                        e.preventDefault();
                        if (cardDropFolder !== f.name) setCardDropFolder(f.name);
                        return;
                      }
                      const drag = dragRef.current;
                      if (!drag || drag.kind !== "folder") return;
                      if (drag.id === f.id) {
                        if (subDrop) setSubDrop(null);
                        return;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const fromStart = (lang === "ar" ? rect.right - e.clientX : e.clientX - rect.left) / Math.max(1, rect.width);
                      const pos = fromStart < 0.3 ? "before" : fromStart > 0.7 ? "after" : "inside";
                      if (subDrop?.id !== f.id || subDrop.pos !== pos)
                        setSubDrop({ id: f.id, pos });
                    }}
                    onDragLeave={() => {
                      if (subDrop?.id === f.id) setSubDrop(null);
                      if (cardDropFolder === f.name) setCardDropFolder(null);
                    }}
                    onDrop={(e) => {
                      if (cardDragRef.current) {
                        e.preventDefault();
                        const ids = cardDragRef.current;
                        moveShortcutsTo(ids, f.id, null);
                        if (ids.length > 1) setSelectedIds(new Set());
                        cardDragRef.current = null;
                        setCardDragId(null);
                        setCardDropFolder(null);
                        return;
                      }
                      const drag = dragRef.current;
                      if (!drag || drag.kind !== "folder") return;
                      e.preventDefault();
                      if (drag.id !== f.id) {
                        dropFolderOn(drag.id, f, fDrop ?? "inside");
                        /* A manual landing switches the folder view to
                           the manual order, so the new arrangement is
                           what the user actually sees. */
                        if ((fDrop ?? "inside") !== "inside" && folderSort !== "manual")
                          setFolderSort("manual");
                      }
                      setSubDrop(null);
                      setSecDragId(null);
                      clearDrag();
                    }}
                  >
                    {fDrop === "before" && <span aria-hidden="true" className="tree-drop-line-v" style={{ insetInlineStart: -6 }} />}
                    {fDrop === "after" && <span aria-hidden="true" className="tree-drop-line-v" style={{ insetInlineEnd: -6 }} />}
                    <span
                      aria-hidden="true"
                      data-tip={t("اسحب المجلد للنقل أو إعادة الترتيب")}
                      className="tree-grip -ms-2 flex shrink-0 items-center self-stretch px-0.5 text-[var(--faint)] opacity-0 transition-opacity group-hover:opacity-100"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSubArm(f.id);
                      }}
                      onMouseUp={() => {
                        if (secDragId !== f.id) setSubArm(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon d={GripVertical} size={14} />
                    </span>
                    <span style={folderColorStyle(f)} className={`folder-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] ${folderColorClass(f)}`}>
                      <FolderGlyph folder={f} size={19} avoidIcon={parentIconOf(f)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-bold">{f.name}</span>
                        {f.pinned && (
                          <span className="flex shrink-0 text-[var(--accent)]">
                            <Icon d={I.pin} size={12} />
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--dim)]">
                        {parts.length > 0 ? parts.join(" · ") : t("فاضي")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[var(--faint)]">
                      <Icon d={chevDir} size={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* The density switch lives in the filter bar now (B2);
            this row keeps only the search scope while searching. */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {search.trim() && (
            <>
              <span className="text-[13px] font-semibold text-[var(--dim)]">{t("نطاق البحث:")}</span>
              <button
                type="button"
                aria-label={t("البحث في المكتبة كلها")}
                data-tip={t("البحث في كل الردود وكل المجلدات")}
                aria-pressed={searchScope === "all"}
                onClick={() => setSearchScope("all")}
                className={`lux-btn rounded-full px-3 py-1.5 text-[13px] font-bold ${
                  searchScope === "all"
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                }`}
              >
                {lang === "en" ? "Whole library" : "المكتبة كلها"}
              </button>
              <button
                type="button"
                aria-label={t("البحث في المجلد الحالي بس")}
                data-tip={category !== "الكل" ? (lang === "en" ? `Limit the search to folder «${category}»` : `حصر البحث في مجلد «${category}»`) : lang === "en" ? "Pick a folder first to limit the search to it" : "اختار مجلد الأول عشان تحصر البحث فيه"}
                aria-pressed={searchScope === "folder"}
                disabled={category === "الكل"}
                onClick={() => setSearchScope("folder")}
                className={`lux-btn rounded-full px-3 py-1.5 text-[13px] font-bold disabled:opacity-40 ${
                  searchScope === "folder"
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                }`}
              >
                {lang === "en" ? "Current folder" : "المجلد الحالي"}{category !== "الكل" ? ` «${category}»` : ""}
              </button>
            </>
          )}
        </div>

        {/* Folder view: the replies get their own headed row with the
            folder's sort control — subfolders above, replies below,
            each under its own heading, never mixed. The sort choice
            is remembered on this device and never touches the data:
            manual order is the user's own drag order underneath. */}
        {inFolderView && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h2 className="shrink-0 text-[15px] font-bold">{lang === "en" ? "Replies" : "الردود"}</h2>
            <span className="shrink-0 text-xs text-[var(--dim)]">
              {lang === "en" ? `${folderReplyCount} replies in this folder` : `${folderReplyCount} رد في المجلد ده`}
            </span>
            <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-[var(--border)]" />
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label={lang === "en" ? "Sort this folder's replies" : "ترتيب ردود المجلد"}
                aria-haspopup="menu"
                aria-expanded={sortMenuOpen}
                data-tip={lang === "en" ? "Sort the replies inside the folder — Manual is your drag order" : "ترتيب الردود جوه المجلد — اليدوي هو ترتيبك بالسحب"}
                data-tip-pos="below"
                onClick={() => setSortMenuOpen((v) => !v)}
                className="lux-btn flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              >
                <Icon d={ArrowUpDown} size={14} />
                {lang === "en" ? "Sort: " : "ترتيب: "}{t(FOLDER_SORTS.find((s) => s.key === folderSort)?.label.split(" — ")[0] ?? "")}
                <span className={sortMenuOpen ? "rotate-180 transition-transform" : "transition-transform"}>
                  <Icon d={I.chevron} size={14} />
                </span>
              </button>
              {sortMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label={lang === "en" ? "Close the sort menu" : "إغلاق قائمة الترتيب"}
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setSortMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    aria-label={lang === "en" ? "Folder reply sort options" : "خيارات ترتيب ردود المجلد"}
                    className="animate-menu elev-pop absolute end-0 top-[calc(100%+6px)] z-40 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5"
                  >
                    {FOLDER_SORTS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={folderSort === s.key}
                        aria-label={lang === "en" ? `Sort by ${t(s.label)}` : `ترتيب حسب ${s.label}`}
                        onClick={() => {
                          setFolderSort(s.key);
                          setSortMenuOpen(false);
                        }}
                        className={`lux-btn flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-start text-sm font-semibold ${
                          folderSort === s.key
                            ? "bg-[var(--surface-selected)] text-[var(--accent-strong)]"
                            : "text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                        }`}
                      >
                        <span className="flex-1">{t(s.label)}</span>
                        {folderSort === s.key && <Icon d={I.check} size={15} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <section className="mt-4">
          {view === "trash" ? (
            <TrashView
              folders={trashQuery.data?.folders ?? []}
              shortcuts={trashQuery.data?.shortcuts ?? []}
              isPending={trashQuery.isPending}
              isError={trashQuery.isError}
              onRetry={() => void trashQuery.refetch()}
              onRestoreShortcut={(id) => restoreShortcutMut.mutate(id)}
              onRestoreFolder={(id) => restoreFolderMut.mutate(id)}
              onForeverShortcut={(id) => foreverShortcutMut.mutate(id)}
              onForeverFolder={(id) => foreverFolderMut.mutate(id)}
              onEmpty={() => emptyTrashMut.mutate()}
              emptying={emptyTrashMut.isPending}
            />
          ) : view === "history" ? (
            <CopyHistoryView
              entries={historyQuery.data?.entries ?? []}
              isPending={historyQuery.isPending}
              isError={historyQuery.isError}
              onRetry={() => void historyQuery.refetch()}
              onClear={() => clearHistoryMut.mutate()}
              clearing={clearHistoryMut.isPending}
              onCopy={(entry) => {
                const s =
                  entry.shortcutId !== null
                    ? shortcuts.find((x) => x.id === entry.shortcutId)
                    : undefined;
                if (s) void handleCopy(s);
              }}
            />
          ) : shortcutsQuery.isPending ? (
            <div aria-busy="true">
              <span className="sr-only">{t("بنحمّل اختصاراتك…")}</span>
              <div className="flex flex-col gap-5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="skeleton-card rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-16 rounded-[4px] bg-[var(--surface-alt)]" />
                      <div className="h-4 w-20 rounded-[4px] bg-[var(--surface-alt)]" />
                    </div>
                    <div className="mt-3 h-5 w-2/5 rounded-[4px] bg-[var(--surface-alt)]" />
                    <div className="mt-3 h-4 w-full rounded-[4px] bg-[var(--surface-alt)]" />
                    <div className="mt-2 h-4 w-3/4 rounded-[4px] bg-[var(--surface-alt)]" />
                    <div className="mt-4 h-11 w-full rounded-[var(--radius)] bg-[var(--surface-alt)]" />
                  </div>
                ))}
              </div>
            </div>
          ) : shortcutsQuery.isError ? (
            <div className="py-10 text-center">
              <p className="text-[var(--danger)]">{t("حصلت مشكلة في التحميل")}</p>
              <button
                type="button"
                aria-label={t("إعادة المحاولة")} data-tip={lang === "en" ? "Reload your replies" : "إعادة تحميل اختصاراتك"}
                onClick={() => shortcutsQuery.refetch()}
                className="lux-btn lux-row mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold hover:border-[var(--border-strong)]"
              >
                {t("حاول تاني")}
              </button>
            </div>
          ) : displayList.length === 0 ? (
            <div className="pattern-star rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
              {activeFolder && view === "default" && !search.trim() ? (
                <>
                  <div className="mb-3 flex justify-center text-[var(--faint)]">
                    <FolderGlyph folder={activeFolder} size={40} avoidIcon={parentIconOf(activeFolder)} />
                  </div>
                  <p className="font-semibold">
                    {subfolders.length > 0
                      ? lang === "en" ? `No replies in «${activeFolder.name}» yet` : `مفيش ردود في «${activeFolder.name}» لسه`
                      : lang === "en" ? `Folder «${activeFolder.name}» is empty` : `مجلد «${activeFolder.name}» فاضي`}
                  </p>
                  <span aria-hidden="true" className="orn-divider"><i /></span>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {subfolders.length > 0
                      ? lang === "en" ? "Its subfolders are shown above — add the first reply here, or open a subfolder and continue inside it." : "المجلدات الفرعية بتاعته ظاهرة فوق — ضيف أول رد هنا، أو افتح مجلد فرعي وكمّل جواه."
                      : lang === "en" ? "No replies or subfolders here yet. Start by adding a reply, or create a subfolder for finer organization." : "لسه مفيش ردود ولا مجلدات فرعية هنا. ابدأ بإضافة رد، أو اعمل مجلد فرعي لتنظيم أدق."}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      aria-label={lang === "en" ? `Add a new reply in folder ${activeFolder.name}` : `إضافة رد جديد في مجلد ${activeFolder.name}`}
                      data-tip={lang === "en" ? "The new reply is saved in this folder right away" : "الرد الجديد هيتحفظ في المجلد ده على طول"}
                      onClick={() => setEditor({ open: true, item: null, presetFolderId: activeFolder.id })}
                      className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
                    >
                      <Icon d={I.plus} size={16} />
                      {lang === "en" ? "New reply here" : "رد جديد هنا"}
                    </button>
                    <button
                      type="button"
                      aria-label={lang === "en" ? `Create a subfolder inside ${activeFolder.name}` : `إنشاء مجلد فرعي داخل ${activeFolder.name}`}
                      data-tip={lang === "en" ? "A new folder inside this one" : "مجلد جديد جوه المجلد ده"}
                      onClick={() => {
                        setTreeOpen((p) => ({ ...p, [`f:${activeFolder.id}`]: true, "g:library": true }));
                        setCreatingIn({ parent: activeFolder.id });
                        setTreeFormError(null);
                        setDrawerOpen(true);
                      }}
                      className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                    >
                      <Icon d={FolderPlus} size={16} />
                      {lang === "en" ? "Subfolder" : "مجلد فرعي"}
                    </button>
                  </div>
                </>
              ) : shortcuts.length === 0 ? (
                <>
                  <div className="mb-4 flex justify-center">
                    <Logo size={52} />
                  </div>
                  <p className="font-semibold">{t("مكتبتك فاضية — ابدأ من هنا")}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {t("اعمل أول اختصار بنفسك، أو حمّل حزمة ردود الخطة الجاهزة وعدّل عليها زي ما تحب.")}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      aria-label={t("إضافة أول اختصار")} data-tip={lang === "en" ? "Add the first reply in your library" : "إضافة أول اختصار في مكتبتك"}
                      onClick={() => setEditor({ open: true, item: null })}
                      className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2.5 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)]"
                    >
                      <Icon d={I.plus} size={18} />
                      {t("اختصار جديد")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("تحميل حزمة ردود الخطة الجاهزة")} data-tip={lang === "en" ? "Load the ready-made replies into your library" : "تحميل ردود الخطة الجاهزة في مكتبتك"}
                      onClick={() => starterMut.mutate()}
                      disabled={starterMut.isPending}
                      className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)] disabled:opacity-60"
                    >
                      <Icon d={I.download} size={18} />
                      {starterMut.isPending ? (lang === "en" ? "Loading…" : "بيتحمّل…") : t("تحميل الردود الجاهزة")}
                    </button>
                  </div>
                </>
              ) : view === "favorites" ? (
                <>
                  <p className="font-semibold">{t("مفيش مفضلة لسه")}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {t("دوس زرار النجمة على أي رد مهم عندك، وهيظهر هنا على طول — والدبوس لوحده بيخليه ثابت في أول مجلده.")}
                  </p>
                </>
              ) : view === "unused" ? (
                <>
                  <p className="font-semibold">{lang === "en" ? "Every reply has been used" : "كل ردودك اتستخدمت"}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {lang === "en" ? "There is no reply in your library that was never copied or used — this view lists the ones still waiting for their first use." : "مفيش رد في مكتبتك لسه ما اتنسخش ولا اتستخدم ولا مرة — العرض ده بيجمع الردود اللي لسه مستنية أول استخدام."}
                  </p>
                </>
              ) : filtersActive ? (
                <>
                  <p className="font-semibold">{lang === "en" ? "No replies match these filters" : "مفيش ردود بتطابق الفلاتر دي"}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {lang === "en" ? "Try removing one filter — or clear them all and start over." : "جرّب تشيل فلتر منهم — أو امسح الفلاتر كلها وابدأ من الأول."}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      aria-label={lang === "en" ? "Clear all filters" : "مسح كل الفلاتر"}
                      onClick={clearFilters}
                      className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]"
                    >
                      <Icon d={I.x} size={16} />
                      {lang === "en" ? "Clear filters" : "مسح الفلاتر"}
                    </button>
                  </div>
                </>
              ) : view === "used" ? (
                <>
                  <p className="font-semibold">{t("لسه ما استخدمتش أي رد")}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {t("أول ما تنسخ رد من هنا، هيظهر هنا بترتيب آخر استخدام — عشان ترجع له بضغطة واحدة.")}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{t("مفيش نتيجة مطابقة لبحثك")}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
                    {search.trim()
                      ? searchScope === "folder" && category !== "الكل"
                        ? lang === "en" ? "Try widening the search scope to the whole library from the «Search scope» bar above the list, or change the search word." : `جرّب توسّع نطاق البحث للمكتبة كلها من شريط «نطاق البحث» فوق القائمة، أو غيّر كلمة البحث.`
                        : lang === "en" ? "Try a shorter word or part of a sentence from the reply — the search understands Arabic letter variations." : "جرّب كلمة أقصر أو جزء من جملة من الرد — البحث بيفهم اختلافات الحروف العربية."
                      : t("مفيش ردود في العرض ده لسه.")}
                  </p>
                  {search.trim() && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        aria-label={t("مسح البحث")}
                        onClick={() => setSearch("")}
                        className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]"
                      >
                        <Icon d={I.x} size={16} />
                        {t("مسح البحث")}
                      </button>
                      <button
                        type="button"
                        aria-label={lang === "en" ? `Create a reply named "${search.trim()}"` : `إنشاء رد باسم «${search.trim()}»`}
                        onClick={() => setEditor({ open: true, item: null, presetTitle: search.trim() })}
                        className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2.5 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
                      >
                        <Icon d={I.plus} size={16} />
                        {lang === "en" ? "Create it as a new reply" : "اعمله رد جديد بالاسم ده"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-[var(--dim)]">
                {search.trim()
                  ? lang === "en"
                    ? `Results for "${search.trim()}": ${displayList.length} replies — best matches first`
                    : `نتائج «${search.trim()}»: ${displayList.length} رد — الأقرب للمطابقة بيظهر الأول`
                  : lang === "en"
                  ? `Showing ${Math.min(visibleCount, displayList.length)} of ${displayList.length} replies${groupedView && groups.length > 0 ? ` · arranged in ${groups.length} folders` : ""}`
                  : `بيعرض ${Math.min(visibleCount, displayList.length)} من ${displayList.length} رد${groupedView && groups.length > 0 ? ` · مرتبة في ${groups.length} مجلد` : ""}`}
                {groupedView && groups.length > 1 && (
                  <span className="mt-0.5 block text-xs text-[var(--faint)]">
                    {t("اسحب المجلد عشان ترتّبه أو تدخّله جوه مجلد تاني")}
                  </span>
                )}
              </p>
              {groupedView ? (
                <div className="flex flex-col gap-10">
                  {groups.map((g, gi) => {
                    const gFolder = folders.find((f) => f.name === g.name) ?? null;
                    const gFolderId = gFolder?.id ?? null;
                    const gOpen = treeOpen[`c:${g.name}`] ?? true;
                    const gDrop = secDrop && gFolderId !== null && secDrop.id === gFolderId ? secDrop.pos : null;
                    return (
                      <section
                        key={g.name}
                        aria-label={lang === "en" ? `Folder ${g.name}` : `مجلد ${g.name}`}
                        className="folder-section animate-rise"
                        style={{ animationDelay: `${Math.min(gi, 8) * 45}ms` }}
                        data-drop-inside={cardDropFolder === g.name}
                        data-sec-dragging={secDragId !== null && secDragId === gFolderId}
                        onDragOver={(e) => {
                          if (!cardDragRef.current) return;
                          e.preventDefault();
                          if (cardDropFolder !== g.name) setCardDropFolder(g.name);
                        }}
                        onDragLeave={() => {
                          if (cardDropFolder === g.name) setCardDropFolder(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const ids = cardDragRef.current ?? [];
                          if (ids.length > 0) {
                            moveShortcutsTo(ids, gFolderId, null);
                            if (ids.length > 1) setSelectedIds(new Set());
                          }
                          cardDragRef.current = null;
                          setCardDragId(null);
                          setCardDropFolder(null);
                        }}
                      >
                        <div
                          className={`tree-node folder-bar mb-4 flex items-center gap-2.5 ${gFolderId !== null && landedFolder === gFolderId ? "animate-land" : ""}`}
                          data-dragging={secDragId !== null && secDragId === gFolderId}
                          data-drop-inside={gDrop === "inside"}
                          draggable={gFolderId !== null && secArm === gFolderId}
                          onDragStart={(e) => {
                            if (gFolderId === null || secArm !== gFolderId) {
                              e.preventDefault();
                              return;
                            }
                            dragRef.current = { kind: "folder", id: gFolderId, ids: [gFolderId] };
                            e.dataTransfer.effectAllowed = "move";
                            try {
                              e.dataTransfer.setData("text/plain", g.name);
                            } catch {
                              /* the ref carries the payload */
                            }
                            setSecDragId(gFolderId);
                          }}
                          onDragEnd={() => {
                            setSecArm(null);
                            setSecDragId(null);
                            setSecDrop(null);
                            clearDrag();
                          }}
                          onDragOver={(e) => {
                            const drag = dragRef.current;
                            if (!drag || drag.kind !== "folder" || gFolder === null) return;
                            if (drag.id === gFolder.id) {
                              if (secDrop) setSecDrop(null);
                              return;
                            }
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const ratio = (e.clientY - rect.top) / Math.max(1, rect.height);
                            const pos = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
                            if (secDrop?.id !== gFolder.id || secDrop.pos !== pos)
                              setSecDrop({ id: gFolder.id, pos });
                          }}
                          onDragLeave={() => {
                            if (gFolderId !== null && secDrop?.id === gFolderId) setSecDrop(null);
                          }}
                          onDrop={(e) => {
                            const drag = dragRef.current;
                            if (!drag || drag.kind !== "folder" || gFolder === null) return;
                            e.preventDefault();
                            e.stopPropagation();
                            if (drag.id !== gFolder.id)
                              dropFolderOn(drag.id, gFolder, gDrop ?? "inside");
                            setSecDrop(null);
                            setSecDragId(null);
                            clearDrag();
                          }}
                        >
                          {gDrop === "before" && <span aria-hidden="true" className="tree-drop-line" style={{ top: -6 }} />}
                          {gDrop === "after" && <span aria-hidden="true" className="tree-drop-line" style={{ bottom: -6 }} />}
                          {gFolderId !== null && (
                            <span
                              aria-hidden="true"
                              data-tip={t("اسحب المجلد للنقل أو إعادة الترتيب")}
                              className="tree-grip -ms-1 flex shrink-0 items-center self-stretch px-0.5 text-[var(--faint)]"
                              onMouseDown={() => setSecArm(gFolderId)}
                              onMouseUp={() => {
                                if (secDragId !== gFolderId) setSecArm(null);
                              }}
                            >
                              <Icon d={GripVertical} size={15} />
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label={gOpen ? (lang === "en" ? `Collapse folder ${g.name}` : `طي مجلد ${g.name}`) : lang === "en" ? `Expand folder ${g.name}` : `فتح مجلد ${g.name}`}
                            aria-expanded={gOpen}
                            data-tip={gOpen ? t("طي المجلد") : t("فتح المجلد")}
                            onClick={() =>
                              setTreeOpen((p) => ({ ...p, [`c:${g.name}`]: !gOpen }))
                            }
                            className="lux-btn flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] py-0.5 pe-1.5 ps-0.5 hover:bg-[var(--surface-hover)]"
                          >
                            <span className="tree-chevron flex text-[var(--faint)]" data-open={gOpen}>
                              <Icon d={chevDir} size={16} />
                            </span>
                            <span style={gFolder ? folderColorStyle(gFolder) : undefined} className={`folder-bar-icon ${gFolder ? folderColorClass(gFolder) : folderHueClass(g.name)}`}>
                              {gFolder ? <FolderGlyph folder={gFolder} size={21} /> : <Icon d={categoryMeta(g.name).icon} size={21} />}
                            </span>
                            <h2 className="folder-bar-title truncate">{g.name}</h2>
                          </button>
                          <span className="folder-bar-count">
                            {lang === "en" ? `${g.items.length} replies` : `${g.items.length} رد`}
                          </span>
                          <span aria-hidden="true" className="w-2 shrink-0" />
                          <button
                            type="button"
                            aria-label={lang === "en" ? `Show only folder ${g.name}` : `عرض مجلد ${g.name} بس`}
                            data-tip={lang === "en" ? `Show only «${g.name}» replies` : `عرض ردود «${g.name}» بس`}
                            onClick={() => setCategory(g.name)}
                            className="folder-bar-open"
                          >
                            {t("عرض المجلد")}
                            <span aria-hidden="true" className="folder-bar-arrow">
                              <Icon d={chevDir} size={15} />
                            </span>
                          </button>
                        </div>
                        <div className="tree-children" data-open={gOpen}>
                          <div>
                            {/* A folder section previews its first 3
                                replies; «عرض المزيد» unfolds the rest
                                of THIS folder only. Display state —
                                no data or order changes. */}
                            <ul className={listUlClass}>
                              {(groupOpen.has(g.name) ? g.items : g.items.slice(0, 3)).map(renderCard)}
                            </ul>
                            {g.items.length > 3 && (
                              <button
                                type="button"
                                aria-label={groupOpen.has(g.name) ? (lang === "en" ? `Show fewer replies in ${g.name}` : `عرض ردود أقل في ${g.name}`) : lang === "en" ? `Show all ${g.items.length} replies in ${g.name}` : `عرض كل ردود ${g.name} (${g.items.length})`}
                                aria-expanded={groupOpen.has(g.name)}
                                onClick={() => toggleGroupOpen(g.name)}
                                className="lux-btn mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] py-2.5 text-[13px] font-bold text-[var(--accent)] hover:border-[var(--border-strong)]"
                              >
                                {groupOpen.has(g.name)
                                  ? lang === "en" ? "Show less" : "عرض أقل"
                                  : lang === "en" ? `Show more (${g.items.length - 3} more)` : `عرض المزيد (${g.items.length - 3} كمان)`}
                                <span aria-hidden="true" className={`flex transition-transform duration-200 ${groupOpen.has(g.name) ? "rotate-180" : ""}`}>
                                  <Icon d={I.chevron} size={15} />
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <ul className={listUlClass}>
                  {visibleItems.map(renderCard)}
                </ul>
              )}
              {visibleCount < displayList.length && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    aria-label={t("عرض المزيد من الردود")} data-tip={t("عرض ٣٠ رداً كمان")}
                    onClick={() => setVisibleCount((n) => n + 30)}
                    className="lux-btn lux-row flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-3 font-semibold text-[var(--accent)] hover:border-[var(--border-strong)]"
                  >
                    {lang === "en" ? `Show more (${displayList.length - visibleCount} left)` : `عرض المزيد (${displayList.length - visibleCount} باقي)`}
                  </button>
                  <button
                    type="button"
                    aria-label={lang === "en" ? `Show all ${displayList.length} replies` : `عرض كل الردود (${displayList.length})`}
                    data-tip={lang === "en" ? "Show the whole list at once" : "عرض القائمة كلها مرة واحدة"}
                    onClick={() => setVisibleCount(displayList.length)}
                    className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-semibold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                  >
                    {lang === "en" ? `Show all (${displayList.length})` : `عرض الكل (${displayList.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Tools — one tidy card holding two side-by-side panels:
            running on Windows, and backup & import. Each panel has
            its own icon tile, title and hint chip, a short
            description, and its actions in one aligned row, so the
            whole place reads at a glance instead of sprawling. */}
        <section id="home-tools" className="elev-card mt-6 scroll-mt-24 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="folder-bar-icon">
              <Icon d={I.keyboard} size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug">أدوات المكتبة</h2>
              <p className="text-[13px] leading-relaxed text-[var(--dim)]">
                التشغيل على ويندوز والنسخ الاحتياطي — كل أداة في لوحتها الخاصة.
              </p>
            </div>
          </div>

          <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-card)]">
                <Icon d={I.devices} size={18} />
              </span>
              <h3 className="min-w-0 flex-1 text-[15px] font-bold leading-snug">التشغيل على ويندوز</h3>
              <span dir="ltr" className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--dim)] shadow-[var(--shadow-card)]">AutoHotkey</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
              نزّل ملف AutoHotkey وشغّله على ويندوز، وبعدها في أي برنامج (Chatwoot أو
              واتساب أو فيسبوك) دوس{" "}
              <span dir="ltr" className="font-mono font-bold">Win + Shift + S</span> واختار
              الرد من القائمة — هيتكتب كامل في لحظتها. الملف بيتصدّر من مكتبتك انت بس.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="تنزيل ملف AutoHotkey بكل الردود" data-tip="ملف بيخلي ردودك تتكتب في أي برنامج على ويندوز من قائمة سريعة"
                onClick={() => downloadText("is-shortcuts.ahk", buildAhk(shortcuts), "text/plain;charset=utf-8")}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2.5 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)]"
              >
                <Icon d={I.download} size={18} />
                تنزيل ملف AutoHotkey
              </button>
            </div>
            <button
              type="button"
              aria-label="خطوات تشغيل AutoHotkey على ويندوز" data-tip="عرض أو إخفاء خطوات التشغيل على ويندوز"
              aria-expanded={guideOpen}
              onClick={() => setGuideOpen((v) => !v)}
              className="lux-btn mt-3 flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              خطوات التشغيل على ويندوز
              <span className={guideOpen ? "rotate-180 transition-transform" : "transition-transform"}>
                <Icon d={I.chevron} size={16} />
              </span>
            </button>
            {guideOpen && (
              <ol className="animate-rise mt-3 list-decimal space-y-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] py-3 pe-4 ps-9 text-sm leading-relaxed text-[var(--dim)]">
                <li>
                  ثبّت برنامج AutoHotkey v2 من موقعه الرسمي{" "}
                  <a
                    href="https://www.autohotkey.com/"
                    target="_blank"
                    rel="noreferrer"
                    data-tip="الموقع الرسمي لبرنامج AutoHotkey" className="font-semibold text-[var(--accent)] underline"
                  >
                    autohotkey.com
                  </a>
                </li>
                <li>نزّل ملف الردود من الزرار اللي فوق.</li>
                <li>دبل كليك على الملف — هتظهر أيقونة خضرا جنب الساعة، وكده القائمة شغالة في كل البرامج.</li>
                <li>عشان يشتغل مع كل مرة تفتح الجهاز: حط الملف في فولدر Startup (دوس Win + R واكتب shell:startup).</li>
                <li>كل ما تعدّل رد هنا، نزّل الملف من جديد وشغّله بدل القديم.</li>
              </ol>
            )}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-card)]">
                <Icon d={I.archive} size={18} />
              </span>
              <h3 className="min-w-0 flex-1 text-[15px] font-bold leading-snug">النسخ الاحتياطي والاستيراد</h3>
              <span dir="ltr" className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--dim)] shadow-[var(--shadow-card)]">JSON · CSV</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
              نزّل نسخة احتياطية من مكتبتك واحتفظ بيها، أو استورد اختصارات من ملف نسخة
              سابقة — المكرر منها بيتخطى لوحده.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="تنزيل نسخة احتياطية JSON" data-tip="تنزيل نسخة احتياطية من مكتبتك (JSON)"
                onClick={() => {
                  noteBackup();
                  downloadText(
                    "is-shortcuts-backup.json",
                    JSON.stringify(
                      {
                        shortcuts: shortcuts.map((x) => ({
                          title: x.title,
                          body: x.body,
                          category: x.category,
                          tags: x.tags ?? "",
                          extShortcut: x.extShortcut ?? "",
                          source: x.source ?? "",
                        })),
                      },
                      null,
                      2,
                    ),
                    "application/json;charset=utf-8",
                  );
                }}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]"
              >
                <Icon d={I.file} size={18} />
                نسخة احتياطية
              </button>
              <button
                type="button"
                aria-label="تصدير نسخة كاملة من الموقع كله" data-tip="نسخة كاملة من الموقع كله: الحسابات والمجلدات والردود وسلة المهملات والصور — لنقل الموقع كله لمكان تاني"
                onClick={() => fullBackupMut.mutate()}
                disabled={fullBackupMut.isPending}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)] disabled:opacity-60"
              >
                <Icon d={I.archive} size={18} />
                {fullBackupMut.isPending ? "بيتجهّز…" : "تصدير نسخة كاملة"}
              </button>
              <button
                type="button"
                aria-label="تنزيل نسخة CSV لجداول البيانات" data-tip="تنزيل مكتبتك بصيغة CSV — بتتفتح في Excel وGoogle Sheets"
                onClick={() => {
                  noteBackup();
                  downloadText(
                    "is-shortcuts.csv",
                    "\uFEFF" + toCsv(shortcuts),
                    "text/csv;charset=utf-8",
                  );
                }}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]"
              >
                <Icon d={I.file} size={18} />
                تصدير CSV
              </button>
              <button
                type="button"
                aria-label="استيراد اختصارات من ملف" data-tip="استيراد اختصارات من ملف نسخة احتياطية (JSON أو CSV)"
                onClick={() => fileRef.current?.click()}
                className="lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]"
              >
                <Icon d={I.upload} size={18} />
                استيراد
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json,text/csv,.csv"
                aria-label="ملف الاستيراد (JSON أو CSV)"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--danger-soft)] text-[var(--danger)]">
                <Icon d={I.eraser} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">تصفير الاستخدام</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--dim)]">
                  بيمسح سجل النسخ كله ويرجّع عدّاد استخدام كل رد لصفر — عشان تبدأ العدّ من أول وجديد. الردود والمجلدات والحسابات زي ما هي، ومتاح لحساب صاحب الموقع بس.
                </p>
              </div>
              <button
                type="button"
                aria-label="تصفير الاستخدام — مسح سجل النسخ وتصفير عدّادات الردود"
                data-tip="بيحتاج تأكيد قبل التنفيذ — ومفيش تراجع بعده"
                onClick={() => setResetUsageOpen(true)}
                className="lux-btn shrink-0 rounded-[var(--radius)] border border-[var(--danger)] px-4 py-2.5 font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              >
                تصفير الاستخدام
              </button>
            </div>
            <div className="mt-4 border-t border-[var(--border)] pt-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--dim)]" aria-live="polite">
                <span className={`h-2 w-2 shrink-0 rounded-full ${lastBackup ? "bg-[var(--cyan)]" : "bg-[var(--gold)]"}`} aria-hidden="true" />
                {lastBackup
                  ? `آخر نسخة احتياطية من الجهاز ده: ${new Date(lastBackup).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}`
                  : "لسه ما نزلتش نسخة احتياطية من الجهاز ده — نزّل واحدة واحتفظ بيها في مكان آمن."}
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-[var(--faint)]">
                <span className="mt-0.5 shrink-0">
                  <Icon d={Info} size={13} />
                </span>
                الاستيراد بيوريك معاينة الأول — إيه اللي هيتضاف وإيه المكرر — وبتختار الدمج أو الاستبدال قبل ما أي حاجة تتكتب. ملف CSV بيحتفظ بالردود والتصنيفات بس، والـ JSON بيحتفظ بكل حاجة بما فيها المجلدات الفرعية.
              </p>
            </div>
          </div>
          </div>
        </section>

        </>
        )}

        {section === "account" && (
          <AccountSection
            token={token}
            user={user}
            displayName={displayName}
            onOpenFull={() => setAccountOpen(true)}
            onLogout={onLogout}
            showToast={showToast}
          />
        )}

        {section === "privacy" && (
          <PrivacySection onBack={() => setSection("home")} />
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-center gap-2.5 text-xs text-[var(--dim)]">
          <Logo size={20} />
          <span aria-hidden="true" className="text-[var(--faint)]">·</span>
          <span>مكتبة {displayName} الخاصة</span>
          <span aria-hidden="true" className="text-[var(--faint)]">·</span>
          <button
            type="button"
            aria-label="فتح سياسة الخصوصية"
            data-tip="سياسة خصوصية الموقع"
            onClick={() => setSection("privacy")}
            className="lux-btn font-bold text-[var(--dim)] hover:text-[var(--text)]"
          >
            سياسة الخصوصية
          </button>
        </footer>
      </main>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
        >
          <button
            type="button"
            aria-label="إغلاق قائمة التنقل"
            onClick={() => setDrawerOpen(false)}
            className="animate-fade absolute inset-0 h-full w-full cursor-default bg-[var(--scrim)]"
          />
          <div className="drawer-nav animate-drawer absolute inset-y-0 right-0 flex w-[300px] max-w-[86vw] flex-col bg-[var(--bg-sidebar)] sidebar-panel shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
              <Logo size={36} />
              <button
                type="button"
                aria-label="إغلاق القائمة"
                data-tip="إغلاق القائمة"
                data-tip-pos="below"
                data-tip-align="start"
                onClick={() => setDrawerOpen(false)}
                className="lux-btn rounded-full p-2 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
              >
                <Icon d={I.x} size={19} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {renderNavTree(false, () => setDrawerOpen(false))}
            </div>
          </div>
        </div>
      )}
      {bulkOpen && (
        <BulkModal
          onClose={() => setBulkOpen(false)}
          onImport={(items) => {
            importMut.mutate({ items, mode: "merge" });
            setBulkOpen(false);
          }}
        />
      )}
      {editor.open && (
        <EditorModal
          token={token}
          userId={user.id}
          item={editor.item}
          folders={folders}
          folderCounts={folderReplyCounts}
          initialFolderId={editor.presetFolderId}
          initialTitle={editor.presetTitle}

          onClose={() => setEditor({ open: false, item: null })}
          onSaved={() => {
            setEditor({ open: false, item: null });
            showToast("اتحفظ الاختصار");
          }}
        />
      )}
      {accountOpen && (
        <AccountModal
          token={token}
          user={user}
          onClose={() => setAccountOpen(false)}
          onLogout={onLogout}
          showToast={showToast}
        />
      )}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onCopy={() => handleCopy(previewItem)}
          onEdit={() => {
            setEditor({ open: true, item: previewItem });
            setPreviewItem(null);
          }}
        />
      )}
      {fillVarsItem && (
        <FillVariablesModal
          item={fillVarsItem}
          onClose={() => setFillVarsItem(null)}
          onCopy={(text) => {
            const item = fillVarsItem;
            setFillVarsItem(null);
            void copyFilled(item, text);
          }}
        />
      )}
      {selectedIds.size > 0 && section === "home" && (
        <BulkActionBar
          count={selectedIds.size}
          folders={folders}
          counts={folderReplyCounts}
          busy={bulkMut.isPending}
          onMove={(folderId) => {
            moveShortcutsTo([...selectedIds], folderId, null);
            setSelectedIds(new Set());
          }}
          onBulk={(op, tag) => bulkMut.mutate({ ids: [...selectedIds], op, ...(tag ? { tag } : {}) })}
          onExport={exportSelected}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
      {smartEditor.open && (
        <SmartFolderModal
          token={token}
          item={smartEditor.item}
          folders={folders}
          allTags={allTags}
          onClose={() => setSmartEditor({ open: false, item: null })}
          onSaved={(sf) => {
            setSmartEditor({ open: false, item: null });
            goSmart(sf);
          }}
        />
      )}
      {detailFresh && (
        <DetailsPanel
          item={detailFresh}
          folderPath={folderPathOf(detailFresh.folderId)}
          folders={folders}
          folderCounts={folderReplyCounts}
          onClose={() => setDetailItem(null)}
          onCopy={() => handleCopy(detailFresh)}
          onEdit={() => setEditor({ open: true, item: detailFresh })}
          onDuplicate={() => duplicateMut.mutate(detailFresh.id)}
          onDelete={() => {
            deleteMut.mutate(detailFresh.id);
            setDetailItem(null);
          }}
          onPin={() => togglePin.mutate(detailFresh)}
          onFavorite={() => toggleFavorite.mutate(detailFresh)}
          onMove={(folderId) => moveShortcutsTo([detailFresh.id], folderId, null)}
          onExport={() => exportOneJson(detailFresh)}
        />
      )}
      {resetUsageOpen && (
        <div
          className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lang === "en" ? "Confirm usage reset" : "تأكيد تصفير الاستخدام"}
          onClick={() => setResetUsageOpen(false)}
        >
          <div
            className="animate-sheet elev-pop glass-panel w-full max-w-md rounded-t-[20px] p-5 sm:rounded-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                <Icon d={I.eraser} size={19} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">{lang === "en" ? "Reset all usage?" : "تصفير الاستخدام؟"}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  {lang === "en"
                    ? "This clears the whole copy history and returns every reply's use count and last-used time to zero — the most-used, least-used and recently-used views start fresh. Replies, folders and accounts are untouched, and there is no undo."
                    : "ده هيمسح سجل النسخ كله ويرجّع عدّاد استخدام كل رد وآخر مرة اتستخدم فيها لصفر — عروض «الأكثر استخداماً» و«الأقل استخداماً» و«استُخدمت مؤخراً» هتبدأ من أول وجديد. الردود والمجلدات والحسابات مش هتتلمس، والتصفير ده مفيهوش تراجع."}
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                aria-label={lang === "en" ? "Cancel the reset" : "إلغاء التصفير"}
                onClick={() => setResetUsageOpen(false)}
                className="lux-btn flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-bold hover:border-[var(--border-strong)]"
              >
                {lang === "en" ? "Cancel" : "إلغاء"}
              </button>
              <button
                type="button"
                aria-label={lang === "en" ? "Yes, reset all usage to zero" : "أيوه، صفّر الاستخدام"}
                disabled={resetUsageMut.isPending}
                onClick={() => resetUsageMut.mutate()}
                className="lux-btn flex-1 rounded-[var(--radius)] bg-[var(--danger)] px-4 py-2.5 font-bold text-white disabled:opacity-60"
              >
                {resetUsageMut.isPending ? (lang === "en" ? "Resetting…" : "بيتصفّر…") : lang === "en" ? "Yes, reset usage" : "أيوه، صفّر الاستخدام"}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderSettingsId !== null && folderById.get(folderSettingsId) && (
        <FolderSettingsModal
          folder={folderById.get(folderSettingsId)!}
          replyCount={(folderShortcuts.get(folderSettingsId) ?? []).length}
          lang={lang}
          onClose={() => setFolderSettingsId(null)}
          onSave={(name, description, icon, iconColor) => {
            renameFolderMut.mutate({ id: folderSettingsId, name, description, icon, iconColor });
            setFolderSettingsId(null);
          }}
          onDelete={() => {
            deleteFolderMut.mutate(folderSettingsId);
            setFolderSettingsId(null);
          }}
          onSourceChange={(source) =>
            setFolderSourceMut.mutate({ id: folderSettingsId, source })
          }
          sourceBusy={setFolderSourceMut.isPending}
        />
      )}
      {creatingIn !== null && (
        <FolderCreateModal
          parentName={
            creatingIn.parent !== null
              ? (folderById.get(creatingIn.parent)?.name ?? null)
              : null
          }
          folders={folders}
          shortcuts={shortcuts}
          saving={createFolderMut.isPending}
          error={folderCreateError}
          lang={lang}
          onClose={() => {
            setCreatingIn(null);
            setFolderCreateError(null);
          }}
          onCreate={(v) =>
            createFolderMut.mutate({
              name: v.name,
              parentId: creatingIn.parent,
              icon: v.icon,
              iconColor: v.iconColor,
              description: v.description,
              shortcutIds: v.moveIds,
            })
          }
        />
      )}
      {moveIntoId !== null && folderById.get(moveIntoId) && (
        <MoveRepliesModal
          folder={folderById.get(moveIntoId)!}
          folders={folders}
          shortcuts={shortcuts}
          lang={lang}
          onClose={() => setMoveIntoId(null)}
          onMove={(ids) => {
            moveShortcutsTo(ids, moveIntoId, null);
            setMoveIntoId(null);
          }}
        />
      )}
      {importPreview && (
        <ImportPreviewModal
          fileName={importPreview.fileName}
          items={importPreview.items}
          existingKeys={new Set(shortcuts.map((s) => importKeyOf(s.title, s.body)))}
          importing={importMut.isPending}
          onCancel={() => setImportPreview(null)}
          onConfirm={(mode) =>
            importMut.mutate({ items: importPreview.items, mode })
          }
        />
      )}
      {ctxMenu && (
        <div className="fixed inset-0 z-[var(--z-menu)]" role="presentation" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
          <div
            role="menu"
            aria-label={`إجراءات ${ctxMenu.node.label}`}
            dir="rtl"
            className="animate-menu elev-pop absolute w-[248px] max-w-[86vw] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="truncate px-2.5 pb-1.5 pt-2 text-[13px] font-bold">{ctxMenu.node.label}</p>
            {(() => {
              const node = ctxMenu.node;
              const close = () => setCtxMenu(null);
              const itemCls = "lux-btn flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-start text-[13.5px] font-medium text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]";
              const items: ReactNode[] = [];
              if ((node.kind === "group" || node.kind === "folder") && node.children !== undefined) {
                const open = isNodeOpen(node.key, node.kind);
                items.push(
                  <button key="toggle" type="button" role="menuitem" aria-label={open ? "طي المجلد" : "فتح المجلد"} onClick={() => { toggleNodeOpen(node); close(); }} className={itemCls}>
                    <Icon d={open ? Folder : FolderOpen} size={15} />
                    {open ? "طي المجلد" : "فتح المجلد"}
                  </button>,
                );
              }
              if (node.kind === "page" || node.kind === "shortcut") {
                items.push(
                  <button key="open" type="button" role="menuitem" aria-label="فتح" onClick={() => { node.run?.(); close(); }} className={itemCls}>
                    <Icon d={I.eye} size={15} />
                    {node.kind === "shortcut" ? "معاينة الرد" : "فتح الصفحة"}
                  </button>,
                );
              }
              if (node.kind === "shortcut" && node.shortcutId !== undefined) {
                const s = shortcuts.find((x) => x.id === node.shortcutId);
                if (s) {
                  items.push(
                    <button key="copy" type="button" role="menuitem" aria-label="نسخ الرد" onClick={() => { void handleCopy(s); close(); }} className={itemCls}>
                      <Icon d={I.copy} size={15} />
                      نسخ الرد
                    </button>,
                    <button key="edit" type="button" role="menuitem" aria-label="تعديل الرد" onClick={() => { setEditor({ open: true, item: s }); close(); }} className={itemCls}>
                      <Icon d={I.edit} size={15} />
                      تعديل الرد
                    </button>,
                    <button key="fav" type="button" role="menuitem" aria-label={s.favorite ? "إزالة الرد من المفضلة" : "إضافة الرد للمفضلة"} onClick={() => { toggleFavorite.mutate(s); close(); }} className={itemCls}>
                      <Icon d={I.star} size={15} />
                      {s.favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                    </button>,
                    <button key="sel" type="button" role="menuitem" aria-label="تحديد للنقل الجماعي" onClick={() => { toggleSelect(s.id); close(); }} className={itemCls}>
                      <Icon d={I.check} size={15} />
                      {selectedIds.has(s.id) ? "إلغاء التحديد" : "تحديد للنقل الجماعي"}
                    </button>,
                    <button key="del" type="button" role="menuitem" aria-label="حذف الرد" onClick={() => { deleteMut.mutate(s.id); close(); }} className="lux-btn flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-start text-[13.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]">
                      <Icon d={I.trash} size={15} />
                      حذف الرد
                    </button>,
                  );
                }
              }
              if (node.kind === "folder" && !node.synthetic && node.folderId !== undefined) {
                const fid = node.folderId;
                const folderRow = folderById.get(fid);
                items.push(
                  <button key="view" type="button" role="menuitem" aria-label="عرض ردود المجلد" onClick={() => { goCategory(node.label); close(); }} className={itemCls}>
                    <Icon d={I.eye} size={15} />
                    عرض ردود المجلد
                  </button>,
                  <button key="pin" type="button" role="menuitem" aria-label={folderRow?.pinned ? "إلغاء تثبيت المجلد" : "تثبيت المجلد"} onClick={() => { toggleFolderPinMut.mutate({ id: fid, pinned: !folderRow?.pinned }); close(); }} className={itemCls}>
                    <Icon d={I.pin} size={15} />
                    {folderRow?.pinned ? "إلغاء تثبيت المجلد" : "تثبيت المجلد"}
                  </button>,
                  <button key="settings" type="button" role="menuitem" aria-label="إعدادات المجلد" onClick={() => { setFolderSettingsId(fid); close(); }} className={itemCls}>
                    <Icon d={I.edit} size={15} />
                    إعدادات المجلد (الاسم والوصف)
                  </button>,
                  <button key="sub" type="button" role="menuitem" aria-label="مجلد فرعي جديد" onClick={() => { setTreeOpen((p) => ({ ...p, [node.key]: true })); setCreatingIn({ parent: fid }); close(); }} className={itemCls}>
                    <Icon d={FolderPlus} size={15} />
                    مجلد فرعي جديد
                  </button>,
                  <button key="dupf" type="button" role="menuitem" aria-label="تكرار المجلد" onClick={() => { duplicateFolderMut.mutate(fid); close(); }} className={itemCls}>
                    <Icon d={I.dup} size={15} />
                    تكرار المجلد بكل اللي جواه
                  </button>,
                  <button key="rename" type="button" role="menuitem" aria-label="إعادة تسمية المجلد" onClick={() => { setRenameVal(node.label); setRenamingId(fid); close(); }} className={itemCls}>
                    <Icon d={I.edit} size={15} />
                    إعادة تسمية
                  </button>,
                  <button key="sortn" type="button" role="menuitem" aria-label="ترتيب الردود أبجدياً" onClick={() => { sortFolderContents(fid, "name"); close(); }} className={itemCls}>
                    <Icon d={I.list} size={15} />
                    ترتيب الردود أبجدياً
                  </button>,
                  <button key="sortd" type="button" role="menuitem" aria-label="ترتيب الردود حسب التاريخ" onClick={() => { sortFolderContents(fid, "date"); close(); }} className={itemCls}>
                    <Icon d={I.clock} size={15} />
                    ترتيب الردود حسب التاريخ
                  </button>,
                  <button key="delf" type="button" role="menuitem" aria-label="حذف المجلد" onClick={() => { deleteFolderMut.mutate(fid); close(); }} className="lux-btn flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-start text-[13.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]">
                    <Icon d={I.trash} size={15} />
                    نقل المجلد لسلة المهملات
                  </button>,
                );
              }
              if (node.key === "g:library") {
                items.push(
                  <button key="newf" type="button" role="menuitem" aria-label="مجلد جديد" onClick={() => { setCreatingIn({ parent: null }); close(); }} className={itemCls}>
                    <Icon d={FolderPlus} size={15} />
                    مجلد جديد
                  </button>,
                  <button key="sortf" type="button" role="menuitem" aria-label="ترتيب المجلدات أبجدياً" onClick={() => { sortSiblingFolders(null); close(); }} className={itemCls}>
                    <Icon d={I.list} size={15} />
                    ترتيب المجلدات أبجدياً
                  </button>,
                );
              }
              const movable =
                (node.kind === "folder" && !node.synthetic && node.folderId !== undefined) ||
                (node.kind === "shortcut" && node.shortcutId !== undefined);
              if (movable) {
                /* The same shared folder tree every other move
                   surface renders — indented, with icons, full
                   paths and counts — not a flat name list. A folder
                   never targets itself or its own subtree. */
                const excludeIds = new Set<number>();
                if (node.kind === "folder" && node.folderId !== undefined) {
                  excludeIds.add(node.folderId);
                  for (const f of folders)
                    if (isDescendantOf(node.folderId, f.id)) excludeIds.add(f.id);
                }
                const currentFolderId =
                  node.kind === "shortcut" && node.shortcutId !== undefined
                    ? (shortcuts.find((s) => s.id === node.shortcutId)?.folderId ?? null)
                    : node.kind === "folder"
                      ? (node.parentFolderId ?? null)
                      : undefined;
                const doMove = (target: number | null) => {
                  if (node.kind === "folder" && node.folderId !== undefined) moveFolderTo(node.folderId, target, null);
                  else if (node.shortcutId !== undefined) moveShortcutsTo(selectedIds.has(node.shortcutId) ? [...selectedIds] : [node.shortcutId], target, null);
                  close();
                };
                items.push(
                  <button key="move" type="button" role="menuitem" aria-label="نقل إلى مجلد آخر" aria-expanded={ctxMoveOpen} onClick={() => setCtxMoveOpen((v) => !v)} className={itemCls}>
                    <Icon d={I.moveTo} size={15} />
                    نقل إلى…
                    <span className={`ms-auto flex transition-transform ${ctxMoveOpen ? "rotate-180" : ""}`}>
                      <Icon d={I.chevron} size={14} />
                    </span>
                  </button>,
                );
                if (ctxMoveOpen) {
                  items.push(
                    <div key="targets" className="max-h-56 overflow-y-auto rounded-[8px] bg-[var(--surface-alt)] p-1">
                      <FolderTreeRows
                        folders={folders}
                        counts={folderReplyCounts}
                        value={currentFolderId}
                        onPick={doMove}
                        excludeIds={excludeIds}
                        rowRole="menuitem"
                      />
                    </div>,
                  );
                }
              }
              return items;
            })()}
          </div>
        </div>
      )}
      {showTop && !detailItem && !drawerOpen && (
        <button
          type="button"
          aria-label={t("الرجوع لفوق")}
          data-tip={t("الرجوع لأول الصفحة")}
          data-tip-align="end"
          onClick={() => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
          }}
          className="btn-lux animate-pop fixed bottom-24 end-5 z-30 flex h-11 w-11 items-center justify-center rounded-full sm:end-6 lg:bottom-6"
        >
          <Icon d={I.arrowUp} size={19} />
        </button>
      )}
      {/* شريط تنقل سفلي للموبايل — بديل السايدبار على الشاشات
          الصغيرة: أهم الوجهات بضغطة واحدة وبأهداف لمس مريحة */}
      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] lg:hidden" aria-label={t("التنقل السفلي")}>
        <div className="mx-auto flex max-w-xl items-stretch justify-around px-2">
          {([
            { key: "home", label: "الرئيسية", icon: I.home, active: section === "home" && view === "default" && smartId === null, run: () => { goHome(); window.scrollTo({ top: 0 }); } },
            { key: "fav", label: "المفضلة", icon: I.star, active: section === "home" && view === "favorites", run: () => { setSmartId(null); setView("favorites"); setSection("home"); window.scrollTo({ top: 0 }); } },
            { key: "new", label: "جديد", icon: I.plus, active: false, run: () => setEditor({ open: true, item: null }) },
            { key: "recent", label: "مؤخراً", icon: I.history, active: section === "home" && view === "used", run: () => { setSmartId(null); setView("used"); setSection("home"); window.scrollTo({ top: 0 }); } },
            { key: "menu", label: "القائمة", icon: I.menu, active: false, run: () => setDrawerOpen(true) },
          ] as Array<{ key: string; label: string; icon: LucideIcon; active: boolean; run: () => void }>).map((b) => (
            <button
              key={b.key}
              type="button"
              aria-label={t(b.label)}
              aria-current={b.active ? "page" : undefined}
              onClick={b.run}
              className={`flex min-h-[54px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-[10px] px-2 text-[12px] font-bold ${b.active ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
            >
              <Icon d={b.icon} size={21} />
              {t(b.label)}
            </button>
          ))}
        </div>
      </nav>
      <Toast toast={toast} />
    </>
  );
}

/* ---------- details panel ----------
   The optional third column of the product: selecting a reply shows
   everything about it — full text (selectable, so a part can be
   copied by hand), its folder path, tags, dates and real usage —
   with every action one tap away. It never blocks the list: a
   bottom sheet on phones, a quiet side panel on wide screens, and
   Esc or the close button dismisses it. */
function DetailsPanel({
  item,
  folderPath,
  folders,
  folderCounts,
  onClose,
  onCopy,
  onEdit,
  onDuplicate,
  onDelete,
  onPin,
  onFavorite,
  onMove,
  onExport,
}: {
  item: Shortcut;
  folderPath: string;
  folders: FolderRowT[];
  folderCounts: Map<number, number>;
  onClose: () => void;
  onCopy: () => Promise<boolean>;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPin: () => void;
  onFavorite: () => void;
  onMove: (folderId: number | null) => void;
  onExport: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /* Resizable on desktop: the panel's width is the user's own
     (300–600px, kept on this device), changed by dragging the
     handle on the edge that faces the content. On mobile the panel
     is a bottom sheet and the width simply does not apply. */
  const [panelW, setPanelW] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("is-details-width"));
      return v >= 300 && v <= 600 ? v : 372;
    } catch {
      return 372;
    }
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startW: panelW };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const rtl = document.documentElement.dir === "rtl";
    const delta = rtl ? e.clientX - d.startX : d.startX - e.clientX;
    setPanelW(Math.min(600, Math.max(300, d.startW + delta)));
  };
  const onHandleUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      localStorage.setItem("is-details-width", String(panelW));
    } catch { /* ignore */ }
  };
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const panelRef = useRef<HTMLDivElement>(null);
  /* Click-outside dismissal: pressing anywhere outside the panel
     closes it — the default close for a floating layer. Presses
     inside the panel (buttons, the move-to select) never close it,
     and the press that opened it lands before it mounts. */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })
      : "لسه ما اتستخدمش";
  const tags = parseTags(item.tags);
  const actBtn =
    "lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]";
  return (
    <div
      ref={panelRef}
      style={{ "--dw": `${panelW}px` } as React.CSSProperties}
      className="details-panel animate-sheet fixed inset-x-0 bottom-0 z-[var(--z-panel)] max-h-[86vh] overflow-y-auto rounded-t-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-pop)] lg:inset-x-auto lg:bottom-4 lg:top-[84px] lg:max-h-none lg:w-[var(--dw,372px)] lg:rounded-[var(--radius)] ltr:lg:right-4 rtl:lg:left-4"
      role="complementary"
      aria-label={`تفاصيل رد ${item.title}`}
    >
      {/* Resize handle — desktop only, on the edge facing the
          content; keyboard arrows work too (separator pattern). */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="تغيير عرض لوحة التفاصيل"
        data-tip="اسحب لتغيير عرض اللوحة"
        tabIndex={0}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onKeyDown={(e) => {
          const step = e.key === "ArrowLeft" || e.key === "ArrowRight" ? 16 : 0;
          if (!step) return;
          e.preventDefault();
          const rtl = document.documentElement.dir === "rtl";
          const dir = (e.key === "ArrowLeft") === rtl ? 1 : -1;
          setPanelW((w) => Math.min(600, Math.max(300, w + dir * step)));
        }}
        className="absolute inset-y-0 start-0 hidden w-[10px] cursor-col-resize touch-none lg:block"
      >
        <span className="absolute inset-y-0 start-[4px] w-[2px] rounded bg-[var(--border)] opacity-0 transition-opacity hover:opacity-100" aria-hidden="true" />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--faint)]">{item.category}</p>
          <h2 className="mt-0.5 text-lg font-bold leading-snug">{item.title}</h2>
        </div>
        <button
          type="button"
          aria-label="إغلاق لوحة التفاصيل"
          data-tip="إغلاق التفاصيل"
          data-tip-pos="below"
          onClick={onClose}
          className="lux-btn shrink-0 rounded-full p-2 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
        >
          <Icon d={I.x} size={18} />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="font-semibold text-[var(--faint)]">المجلد</dt>
        <dd className="font-semibold">{folderPath}</dd>
        <dt className="font-semibold text-[var(--faint)]">الحالة</dt>
        <dd className="font-semibold">
          {[
            item.pinned ? "مثبّت في الأعلى" : null,
            item.favorite ? "في المفضلة" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "عادي"}
        </dd>
        {item.extShortcut && (
          <>
            <dt className="font-semibold text-[var(--faint)]">الاختصار الخارجي</dt>
            <dd className="font-semibold">
              <span dir="ltr" className="font-mono">{item.extShortcut}</span>
            </dd>
          </>
        )}
        {item.source && (
          <>
            <dt className="font-semibold text-[var(--faint)]">المصدر</dt>
            <dd className="font-semibold">
              <span className="flex items-center gap-1.5">
                <SourceMark source={item.source} size={15} />
                <span dir="ltr">{item.source}</span>
              </span>
            </dd>
          </>
        )}
        <dt className="font-semibold text-[var(--faint)]">مرات النسخ</dt>
        <dd>{item.usageCount} مرة</dd>
        <dt className="font-semibold text-[var(--faint)]">آخر استخدام</dt>
        <dd>{fmt(item.lastUsedAt)}</dd>
        <dt className="font-semibold text-[var(--faint)]">اتعمل</dt>
        <dd>{fmt(item.createdAt)}</dd>
        <dt className="font-semibold text-[var(--faint)]">آخر تعديل</dt>
        <dd>{fmt(item.updatedAt)}</dd>
      </dl>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="الكلمات المفتاحية">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[12px] font-semibold text-[var(--dim)]">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1.5 text-[13px] font-bold text-[var(--dim)]">
          نص الرد كامل — تقدر تحدد أي جزء منه وتنسخه لوحده
        </p>
        <p className="max-h-64 select-text overflow-y-auto whitespace-pre-wrap rounded-[var(--radius)] bg-[var(--surface-alt)] p-3.5 text-[14.5px] leading-[1.9]">
          {item.body}
        </p>
      </div>

      <button
        type="button"
        aria-label={copied ? `اتنسخ رد ${item.title}` : `نسخ رد ${item.title}`}
        data-tip={copied ? "اتنسخ" : "نسخ الرد كامل بضغطة واحدة"}
        aria-live="polite"
        aria-busy={copying}
        disabled={copying}
        onClick={async () => {
          if (copying) return;
          setCopying(true);
          try {
            const ok = await onCopy();
            if (!ok) return;
            setCopied(true);
            window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
          } finally {
            setCopying(false);
          }
        }}
        className={`btn-lux mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold ${copied ? "btn-lux-success" : ""}`}
      >
        {copying ? (
          <>
            <span className="spinner" aria-hidden="true" />
            بيتنسخ…
          </>
        ) : copied ? (
          <>
            <span className="animate-copy-pop flex">
              <Icon d={I.check} size={18} />
            </span>
            اتنسخ
          </>
        ) : (
          <>
            <Icon d={I.copy} size={18} />
            نسخ الرد
          </>
        )}
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" aria-label={`تعديل ${item.title}`} data-tip="تعديل الرد" onClick={onEdit} className={actBtn}>
          <Icon d={I.edit} size={16} />
          تعديل
        </button>
        <button
          type="button"
          aria-label={item.pinned ? `إلغاء تثبيت ${item.title}` : `تثبيت ${item.title}`}
          data-tip={item.pinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}
          aria-pressed={item.pinned}
          onClick={onPin}
          className={actBtn}
        >
          <Icon d={I.pin} size={16} />
          {item.pinned ? "إلغاء التثبيت" : "تثبيت"}
        </button>
        <button
          type="button"
          aria-label={item.favorite ? `إزالة ${item.title} من المفضلة` : `إضافة ${item.title} للمفضلة`}
          data-tip={item.favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          aria-pressed={item.favorite}
          onClick={onFavorite}
          className={`${actBtn} ${item.favorite ? "border-[var(--favorite)] text-[var(--favorite)]" : ""}`}
        >
          <Icon d={I.star} size={16} />
          {item.favorite ? "في المفضلة" : "مفضلة"}
        </button>
        <button type="button" aria-label={`تكرار ${item.title}`} data-tip="عمل نسخة من الرد" onClick={onDuplicate} className={actBtn}>
          <Icon d={I.dup} size={16} />
          تكرار
        </button>
        <button type="button" aria-label={`تصدير ${item.title} بصيغة JSON`} data-tip="تنزيل الرد ده لوحده في ملف JSON" onClick={onExport} className={actBtn}>
          <Icon d={I.download} size={16} />
          تصدير
        </button>
        <button
          type="button"
          aria-label={confirmingDelete ? `تأكيد حذف ${item.title}` : `حذف ${item.title}`}
          data-tip={confirmingDelete ? "دوس تاني لتأكيد الحذف" : "حذف الرد"}
          onClick={() => {
            if (confirmingDelete) onDelete();
            else {
              setConfirmingDelete(true);
              window.setTimeout(() => setConfirmingDelete(false), 3000);
            }
          }}
          className={`lux-btn flex items-center gap-1.5 rounded-[var(--radius)] border px-3 py-2 text-[13px] font-bold ${
            confirmingDelete
              ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          }`}
        >
          <Icon d={I.trash} size={16} />
          {confirmingDelete ? "متأكد؟ دوس تاني" : "حذف"}
        </button>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[var(--dim)]">
          <Icon d={I.moveTo} size={16} />
          نقل إلى مجلد
        </span>
        <MoveToFolderButton
          folders={folders}
          counts={folderCounts}
          currentFolderId={item.folderId ?? null}
          onMove={onMove}
          variant="field"
          subject={item.title}
        />
      </div>
    </div>
  );
}

/* ---------- copy history view ---------- */
type CopyHistoryEntry = ApiResponse<typeof api, "listCopyHistory">["entries"][number];

/* ---------- smart folder editor ----------
   A smart folder is a named set of rules over the library — tags,
   an optional folder scope, pinned/favorite-only, a minimum use
   count, an unused-for window. Saving stores only the rules; the
   list evaluates them live, so no reply is ever copied or moved. */
function SmartFolderModal({
  token,
  item,
  folders,
  allTags,
  onClose,
  onSaved,
}: {
  token: string;
  item: SmartFolderT | null;
  folders: FolderRowT[];
  allTags: string[];
  onClose: () => void;
  onSaved: (sf: SmartFolderT) => void;
}) {
  const { lang } = useLang();
  const queryClient = useQueryClient();
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState<string | null>(item?.icon ?? null);
  const [iconColor, setIconColor] = useState<string | null>(item?.iconColor ?? null);
  const [pickedTags, setPickedTags] = useState<string[]>(() => parseTags(item?.tags ?? ""));
  const [folderId, setFolderId] = useState<number | null>(item?.folderId ?? null);
  const [pinnedOnly, setPinnedOnly] = useState(item?.pinnedOnly ?? false);
  const [favoriteOnly, setFavoriteOnly] = useState(item?.favoriteOnly ?? false);
  const [minUses, setMinUses] = useState(item?.minUses !== null && item?.minUses !== undefined ? String(item.minUses) : "");
  const [unusedDays, setUnusedDays] = useState(item?.unusedDays !== null && item?.unusedDays !== undefined ? String(item.unusedDays) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initial = useRef({ name, icon, iconColor, pickedTags, folderId, pinnedOnly, favoriteOnly, minUses, unusedDays });
  const dirty =
    name !== initial.current.name ||
    icon !== initial.current.icon ||
    iconColor !== initial.current.iconColor ||
    folderId !== initial.current.folderId ||
    pinnedOnly !== initial.current.pinnedOnly ||
    favoriteOnly !== initial.current.favoriteOnly ||
    minUses !== initial.current.minUses ||
    unusedDays !== initial.current.unusedDays ||
    pickedTags.join("|") !== initial.current.pickedTags.join("|");
  const attemptClose = () => {
    if (dirty && !saveMut.isPending) setConfirmDiscard(true);
    else onClose();
  };
  useEscapeClose(attemptClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        icon,
        iconColor,
        tags: pickedTags.join("، "),
        folderId,
        pinnedOnly,
        favoriteOnly,
        minUses: minUses.trim() ? Math.max(0, parseInt(minUses, 10) || 0) : null,
        unusedDays: unusedDays.trim() ? Math.max(1, parseInt(unusedDays, 10) || 1) : null,
      };
      if (item) {
        await api.updateSmartFolder({ token, id: item.id, ...payload });
        return { ...item, ...payload, icon: payload.icon ?? item.icon };
      }
      const res = await api.createSmartFolder({ token, ...payload });
      return res.smartFolder;
    },
    onSuccess: (sf) => {
      void queryClient.invalidateQueries({ queryKey: ["smartFolders", token] });
      onSaved(sf);
    },
    onError: (e) => setError(e instanceof Error ? e.message : lang === "en" ? "Saving failed — try again" : "الحفظ متمّش — حاول تاني"),
  });

  const submit = () => {
    if (!name.trim()) return setError(lang === "en" ? "Write the smart folder's name" : "اكتب اسم المجلد الذكي");
    setError(null);
    saveMut.mutate();
  };

  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";
  const toggleCls = (on: boolean) =>
    `lux-btn flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold ${on ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`;
  /* Folder options with their depth shown by indentation, so the
     scope choice is unambiguous (whole library vs one folder tree). */
  const depthOf = (f: FolderRowT): number => {
    let d = 0;
    let cur = f.parentId !== null ? folders.find((x) => x.id === f.parentId) : undefined;
    const guard = new Set<number>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      d += 1;
      const pid: number | null = cur.parentId;
      cur = pid !== null ? folders.find((x) => x.id === pid) : undefined;
    }
    return d;
  };

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={item ? (lang === "en" ? "Edit smart folder" : "تعديل مجلد ذكي") : lang === "en" ? "New smart folder" : "مجلد ذكي جديد"}
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div className="animate-sheet elev-pop flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--radius)] glass-panel sm:rounded-[var(--radius)]">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Icon d={I.wand} size={20} />
            {item ? (lang === "en" ? "Edit smart folder" : "تعديل مجلد ذكي") : lang === "en" ? "New smart folder" : "مجلد ذكي جديد"}
          </h2>
          <button type="button" aria-label={lang === "en" ? "Close" : "قفل"} data-tip={lang === "en" ? "Close" : "قفل"} data-tip-pos="below" onClick={attemptClose} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
            {lang === "en"
              ? "A smart folder is a live view: it shows whichever replies match its rules right now. Nothing is copied or moved — delete it any time and your replies stay exactly where they are."
              : "المجلد الذكي عرض حي: بيعرض الردود اللي بتطابق شروطه دلوقتي. مفيش حاجة بتتنسخ أو بتتنقل — احذفه في أي وقت وردودك هتفضل في أماكنها بالظبط."}
          </p>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Name" : "الاسم"}</span>
            <input
              {...FIELDS.createSmartFolder.name}
              aria-label={lang === "en" ? "Smart folder name" : "اسم المجلد الذكي"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === "en" ? "e.g. Payment replies" : "مثال: ردود الدفع"}
              className={field}
            />
          </label>

          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Tags — a reply matches if it carries any of them" : "الوسوم — الرد بيطابق لو شايل أي واحد منهم"}</span>
            {allTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tg) => {
                  const on = pickedTags.includes(tg);
                  return (
                    <button
                      key={tg}
                      type="button"
                      aria-label={lang === "en" ? `Tag ${tg}` : `وسم ${tg}`}
                      aria-pressed={on}
                      onClick={() => setPickedTags((p) => (on ? p.filter((x) => x !== tg) : [...p, tg]))}
                      className={`lux-btn rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                    >
                      {tg}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-[var(--faint)]">
                {lang === "en" ? "No tags in your library yet — add tags to replies first, then build smart folders on them." : "لسه مفيش وسوم في مكتبتك — ضيف وسوم للردود الأول، وبعدين اعمل مجلدات ذكية عليها."}
              </p>
            )}
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Scope" : "النطاق"}</span>
            <select
              aria-label={lang === "en" ? "Smart folder scope" : "نطاق المجلد الذكي"}
              value={folderId === null ? "" : String(folderId)}
              onChange={(e) => setFolderId(e.target.value === "" ? null : Number(e.target.value))}
              className={field}
            >
              <option value="">{lang === "en" ? "The whole library" : "المكتبة كلها"}</option>
              {folders.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {"— ".repeat(depthOf(f))}{f.name}{lang === "en" ? " (and its subfolders)" : " (ومجلداته الفرعية)"}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <button type="button" aria-label={lang === "en" ? "Pinned only" : "المثبتة بس"} aria-pressed={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)} className={toggleCls(pinnedOnly)}>
              <Icon d={I.pin} size={14} />
              {lang === "en" ? "Pinned only" : "المثبتة بس"}
            </button>
            <button type="button" aria-label={lang === "en" ? "Favorites only" : "المفضلة بس"} aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly((v) => !v)} className={toggleCls(favoriteOnly)}>
              <Icon d={I.star} size={14} />
              {lang === "en" ? "Favorites only" : "المفضلة بس"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Used at least (times)" : "اتستخدمت على الأقل (مرة)"}</span>
              <input
                {...FIELDS.createSmartFolder.minUses}
                aria-label={lang === "en" ? "Minimum number of uses" : "أقل عدد مرات استخدام"}
                type="number"
                dir="ltr"
                value={minUses}
                onChange={(e) => setMinUses(e.target.value)}
                placeholder={lang === "en" ? "Any" : "أي عدد"}
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Not used for (days)" : "مش مستخدمة من (يوم)"}</span>
              <input
                {...FIELDS.createSmartFolder.unusedDays}
                aria-label={lang === "en" ? "Days since last use" : "عدد الأيام من غير استخدام"}
                type="number"
                dir="ltr"
                value={unusedDays}
                onChange={(e) => setUnusedDays(e.target.value)}
                placeholder={lang === "en" ? "Off" : "مش شغال"}
                className={field}
              />
            </label>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Icon" : "الأيقونة"}</span>
            <FolderIconPicker value={icon} onChange={setIcon} lang={lang} compact colorValue={iconColor} onColorChange={setIconColor} />
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              {error}
            </p>
          )}
          {confirmDiscard && (
            <div role="alert" className="animate-rise mt-4 rounded-[var(--radius)] bg-[var(--warning-soft)] px-3.5 py-3">
              <p className="text-sm font-bold">{lang === "en" ? "You have unsaved changes to these rules" : "عندك تعديلات على الشروط لسه ما اتحفظتش"}</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  aria-label={lang === "en" ? "Discard changes and close" : "تجاهل التعديلات وقفل"}
                  onClick={onClose}
                  className="lux-btn rounded-[var(--radius)] bg-[var(--danger)] px-4 py-2 text-[13px] font-bold text-white"
                >
                  {lang === "en" ? "Discard and close" : "تجاهل وقفل"}
                </button>
                <button
                  type="button"
                  aria-label={lang === "en" ? "Keep editing" : "كمّل تحرير"}
                  onClick={() => setConfirmDiscard(false)}
                  className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-bold hover:border-[var(--border-strong)]"
                >
                  {lang === "en" ? "Keep editing" : "كمّل تحرير"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3.5">
          <button
            type="button"
            aria-label={lang === "en" ? "Save the smart folder" : "حفظ المجلد الذكي"}
            data-tip={lang === "en" ? "Save the rules" : "حفظ الشروط"}
            onClick={submit}
            disabled={saveMut.isPending}
            className="lux-btn flex-1 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)] disabled:opacity-60"
          >
            {saveMut.isPending ? (lang === "en" ? "Saving…" : "بيتحفظ…") : lang === "en" ? "Save" : "حفظ"}
          </button>
          <button
            type="button"
            aria-label={lang === "en" ? "Cancel" : "إلغاء"}
            data-tip={lang === "en" ? "Cancel" : "إلغاء والرجوع من غير حفظ"}
            data-tip-align="end"
            onClick={attemptClose}
            className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            {lang === "en" ? "Cancel" : "إلغاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- bulk action bar ----------
   The smart bar that surfaces the moment more than one reply is
   selected — in the main area, floating above the content, so it
   is reachable wherever the selection was made (cards, tree,
   folder view). Every action runs on the whole selection at once
   through one server call; the bar hides when the selection clears. */
function BulkActionBar({
  count,
  folders,
  counts,
  busy,
  onMove,
  onBulk,
  onExport,
  onClear,
}: {
  count: number;
  folders: FolderRowT[];
  counts: Map<number, number>;
  busy: boolean;
  onMove: (folderId: number | null) => void;
  onBulk: (op: "pin" | "unpin" | "favorite" | "unfavorite" | "trash" | "addTag", tag?: string) => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const { lang } = useLang();
  const [tagOpen, setTagOpen] = useState(false);
  const [tagVal, setTagVal] = useState("");
  const btn =
    "lux-btn flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] disabled:opacity-60";
  return (
    <div
      className="bulk-dock animate-pop fixed inset-x-3 bottom-3 z-[var(--z-panel)] mx-auto max-w-2xl rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-[var(--shadow-pop)] sm:inset-x-6"
      role="toolbar"
      aria-label={lang === "en" ? "Bulk actions for the selected replies" : "إجراءات جماعية للردود المحددة"}
    >
      <div className="flex flex-wrap items-center justify-center gap-1">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-[13px] font-extrabold text-[var(--accent-strong)]">
          <Icon d={I.check} size={14} />
          {lang === "en" ? `${count} selected` : `${count} محدد`}
        </span>
        <MoveToFolderButton
          folders={folders}
          counts={counts}
          onMove={onMove}
          variant="bar"
          subject={lang === "en" ? "the selected replies" : "الردود المحددة"}
        />
        <button type="button" aria-label={lang === "en" ? "Pin all selected" : "تثبيت كل المحدد"} data-tip={lang === "en" ? "Pin the whole selection" : "تثبيت التحديد كله في الأعلى"} disabled={busy} onClick={() => onBulk("pin")} className={btn}>
          <Icon d={I.pin} size={15} />
          {lang === "en" ? "Pin" : "تثبيت"}
        </button>
        <button type="button" aria-label={lang === "en" ? "Add all selected to favorites" : "إضافة كل المحدد للمفضلة"} data-tip={lang === "en" ? "Favorite the whole selection" : "إضافة التحديد كله للمفضلة"} disabled={busy} onClick={() => onBulk("favorite")} className={btn}>
          <Icon d={I.star} size={15} />
          {lang === "en" ? "Favorite" : "مفضلة"}
        </button>
        <button
          type="button"
          aria-label={lang === "en" ? "Add a tag to all selected" : "إضافة وسم لكل المحدد"}
          data-tip={lang === "en" ? "One tag, applied to the whole selection" : "وسم واحد بيتحط على التحديد كله"}
          aria-expanded={tagOpen}
          disabled={busy}
          onClick={() => setTagOpen((v) => !v)}
          className={btn}
        >
          <Icon d={I.sparkles} size={15} />
          {lang === "en" ? "Tag" : "وسم"}
        </button>
        <button type="button" aria-label={lang === "en" ? "Export the selected replies" : "تصدير الردود المحددة"} data-tip={lang === "en" ? "Download the selection as a JSON backup file" : "تنزيل التحديد في ملف نسخة احتياطية JSON"} disabled={busy} onClick={onExport} className={btn}>
          <Icon d={I.download} size={15} />
          {lang === "en" ? "Export" : "تصدير"}
        </button>
        <button type="button" aria-label={lang === "en" ? "Move all selected to the trash" : "نقل كل المحدد لسلة المهملات"} data-tip={lang === "en" ? "To the trash — restorable from there" : "لسلة المهملات — وتقدر ترجعهم منها"} disabled={busy} onClick={() => onBulk("trash")} className="lux-btn flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-60">
          <Icon d={I.trash} size={15} />
          {lang === "en" ? "Trash" : "حذف"}
        </button>
        <button type="button" aria-label={lang === "en" ? "Clear the selection" : "مسح التحديد"} data-tip={lang === "en" ? "Clear the selection" : "مسح التحديد"} onClick={onClear} className="lux-btn rounded-full p-2 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]">
          <Icon d={I.x} size={16} />
        </button>
      </div>
      {tagOpen && (
        <form
          className="animate-rise mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const tg = tagVal.trim();
            if (!tg) return;
            onBulk("addTag", tg);
            setTagVal("");
            setTagOpen(false);
          }}
        >
          <label className="sr-only" htmlFor="bulk-tag-input">{lang === "en" ? "Tag name" : "اسم الوسم"}</label>
          <input
            id="bulk-tag-input"
            value={tagVal}
            onChange={(e) => setTagVal(e.target.value)}
            placeholder={lang === "en" ? "Tag name — e.g. payments" : "اسم الوسم — مثال: دفع"}
            maxLength={60}
            className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            aria-label={lang === "en" ? "Apply the tag to the selection" : "تطبيق الوسم على التحديد"}
            disabled={!tagVal.trim() || busy}
            className="lux-btn shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {lang === "en" ? "Add to all" : "إضافة للكل"}
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- trash view ----------
   Everything the user deleted, kept restorable: replies deleted
   directly and folders deleted with their whole contents riding
   along (a trashed folder restores its subtree and replies in one
   go — they were never stamped individually). Permanent deletion
   is a deliberate two-step here, and only here. */
function TrashView({
  folders,
  shortcuts,
  isPending,
  isError,
  onRetry,
  onRestoreShortcut,
  onRestoreFolder,
  onForeverShortcut,
  onForeverFolder,
  onEmpty,
  emptying,
}: {
  folders: FolderRowT[];
  shortcuts: Shortcut[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onRestoreShortcut: (id: number) => void;
  onRestoreFolder: (id: number) => void;
  onForeverShortcut: (id: number) => void;
  onForeverFolder: (id: number) => void;
  onEmpty: () => void;
  emptying: boolean;
}) {
  const { lang } = useLang();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG", { day: "numeric", month: "short", year: "numeric" })
      : "";
  if (isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">{lang === "en" ? "Loading the trash…" : "بنحمّل سلة المهملات…"}</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-card h-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]" style={{ animationDelay: `${i * 120}ms` }} aria-hidden="true" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-10 text-center">
        <p className="text-[var(--danger)]">{lang === "en" ? "The trash could not be loaded" : "حصلت مشكلة في تحميل سلة المهملات"}</p>
        <button
          type="button"
          aria-label={lang === "en" ? "Retry loading the trash" : "إعادة تحميل سلة المهملات"}
          data-tip={lang === "en" ? "Retry" : "إعادة المحاولة"}
          onClick={onRetry}
          className="lux-btn lux-row mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold hover:border-[var(--border-strong)]"
        >
          {lang === "en" ? "Try again" : "حاول تاني"}
        </button>
      </div>
    );
  }
  const empty = folders.length === 0 && shortcuts.length === 0;
  if (empty) {
    return (
      <div className="pattern-star rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <div className="mb-3 flex justify-center text-[var(--faint)]">
          <Icon d={I.trash} size={40} />
        </div>
        <p className="font-semibold">{lang === "en" ? "The trash is empty" : "سلة المهملات فاضية"}</p>
        <span aria-hidden="true" className="orn-divider"><i /></span>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
          {lang === "en"
            ? "Anything you delete — a reply or a whole folder — lands here first and stays restorable until you delete it forever."
            : "أي حاجة بتحذفها — رد أو مجلد كامل — بتنزل هنا الأول وبتفضل قابلة للاستعادة لحد ما تحذفها نهائياً بنفسك."}
        </p>
      </div>
    );
  }
  const rowBtn =
    "lux-btn flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold";
  const foreverBtn = (key: string, label: string, run: () => void) =>
    confirmKey === key ? (
      <button
        type="button"
        aria-label={lang === "en" ? `Confirm permanently deleting ${label}` : `تأكيد حذف ${label} نهائياً`}
        data-tip={lang === "en" ? "This cannot be undone" : "الحذف ده مفيهوش رجوع"}
        onClick={() => {
          setConfirmKey(null);
          run();
        }}
        className={`${rowBtn} bg-[var(--danger)] text-white`}
      >
        {lang === "en" ? "Sure? Delete forever" : "متأكد؟ حذف نهائي"}
      </button>
    ) : (
      <button
        type="button"
        aria-label={lang === "en" ? `Delete ${label} forever` : `حذف ${label} نهائياً`}
        data-tip={lang === "en" ? "Permanent — no restore after this" : "نهائي — مفيش استعادة بعده"}
        onClick={() => setConfirmKey(key)}
        className={`${rowBtn} text-[var(--danger)] hover:bg-[var(--danger-soft)]`}
      >
        <Icon d={I.trash} size={14} />
        {lang === "en" ? "Delete forever" : "حذف نهائي"}
      </button>
    );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm leading-relaxed text-[var(--dim)]">
          {lang === "en"
            ? "Deleted items stay restorable here. A restored folder brings back everything inside it, exactly as it was."
            : "العناصر المحذوفة بتفضل قابلة للاستعادة من هنا. المجلد المستعاد بيرجع بكل اللي جواه زي ما كان بالظبط."}
        </p>
        {confirmEmpty ? (
          <button
            type="button"
            aria-label={lang === "en" ? "Confirm emptying the trash" : "تأكيد تفريغ سلة المهملات"}
            data-tip={lang === "en" ? "Deletes everything in the trash forever" : "بيحذف كل اللي في السلة نهائياً"}
            disabled={emptying}
            onClick={() => {
              setConfirmEmpty(false);
              onEmpty();
            }}
            className="lux-btn flex items-center gap-1.5 rounded-full bg-[var(--danger)] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
          >
            <Icon d={I.eraser} size={15} />
            {emptying ? (lang === "en" ? "Emptying…" : "بيتفرّغ…") : lang === "en" ? "Sure? Empty it all" : "متأكد؟ فرّغ الكل"}
          </button>
        ) : (
          <button
            type="button"
            aria-label={lang === "en" ? "Empty the trash" : "تفريغ سلة المهملات"}
            data-tip={lang === "en" ? "Permanently deletes everything below" : "حذف نهائي لكل اللي تحت"}
            onClick={() => setConfirmEmpty(true)}
            className="lux-btn flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          >
            <Icon d={I.eraser} size={15} />
            {lang === "en" ? "Empty trash" : "تفريغ السلة"}
          </button>
        )}
      </div>
      {folders.length > 0 && (
        <>
          <p className="mb-2 text-[13px] font-extrabold text-[var(--dim)]">
            {lang === "en" ? "Folders" : "مجلدات"} · {folders.length}
          </p>
          <ul className="mb-5 flex flex-col gap-1.5">
            {folders.map((f) => (
              <li key={f.id} className="lux-card elev-card flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--surface-alt)] text-[var(--dim)]">
                  <FolderGlyph folder={f} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{f.name}</span>
                  <span className="block text-xs text-[var(--faint)]">
                    {lang === "en" ? `Deleted ${fmtDate(f.deletedAt)} — restores with everything inside it` : `اتحذف ${fmtDate(f.deletedAt)} — الاستعادة بترجعه بكل اللي جواه`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={lang === "en" ? `Restore folder ${f.name}` : `استعادة مجلد ${f.name}`}
                  data-tip={lang === "en" ? "Bring it back with all its contents" : "رجوعه بكل محتوياته"}
                  onClick={() => onRestoreFolder(f.id)}
                  className={`${rowBtn} bg-[var(--accent-soft)] text-[var(--accent-strong)]`}
                >
                  <Icon d={I.restore} size={14} />
                  {lang === "en" ? "Restore" : "استعادة"}
                </button>
                {foreverBtn(`f:${f.id}`, f.name, () => onForeverFolder(f.id))}
              </li>
            ))}
          </ul>
        </>
      )}
      {shortcuts.length > 0 && (
        <>
          <p className="mb-2 text-[13px] font-extrabold text-[var(--dim)]">
            {lang === "en" ? "Replies" : "ردود"} · {shortcuts.length}
          </p>
          <ul className="flex flex-col gap-1.5">
            {shortcuts.map((s) => (
              <li key={s.id} className="lux-card elev-card flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{s.title}</span>
                  <span className="block text-xs text-[var(--faint)]">
                    {s.category} · {lang === "en" ? `Deleted ${fmtDate(s.deletedAt)}` : `اتحذف ${fmtDate(s.deletedAt)}`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={lang === "en" ? `Restore reply ${s.title}` : `استعادة رد ${s.title}`}
                  data-tip={lang === "en" ? "Back to its folder in the library" : "رجوعه لمجلده في المكتبة"}
                  onClick={() => onRestoreShortcut(s.id)}
                  className={`${rowBtn} bg-[var(--accent-soft)] text-[var(--accent-strong)]`}
                >
                  <Icon d={I.restore} size={14} />
                  {lang === "en" ? "Restore" : "استعادة"}
                </button>
                {foreverBtn(`s:${s.id}`, s.title, () => onForeverShortcut(s.id))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CopyHistoryView({
  entries,
  isPending,
  isError,
  onRetry,
  onClear,
  clearing,
  onCopy,
}: {
  entries: CopyHistoryEntry[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onClear: () => void;
  clearing: boolean;
  onCopy: (entry: CopyHistoryEntry) => void;
}) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  if (isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">بنحمّل سجل النسخ…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-card h-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]" style={{ animationDelay: `${i * 120}ms` }} aria-hidden="true" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-10 text-center">
        <p className="text-[var(--danger)]">حصلت مشكلة في تحميل سجل النسخ</p>
        <button
          type="button"
          aria-label="إعادة تحميل سجل النسخ"
          data-tip="إعادة المحاولة"
          onClick={onRetry}
          className="lux-btn lux-row mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold hover:border-[var(--border-strong)]"
        >
          حاول تاني
        </button>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="font-semibold">سجل النسخ فاضي</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
          كل نسخة ناجحة لرد من مكتبتك هتتسجل هنا بوقتها، عشان ترجع لها وتنسخها تاني بضغطة واحدة.
        </p>
      </div>
    );
  }
  /* Grouped by day — اليوم / أمس / the full date — so a long
     history scans like a diary instead of one endless list. Entries
     arrive newest-first, so groups form in a single pass. */
  const dayLabel = (d: Date) => {
    const startOf = (x: Date) =>
      new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
    if (diff === 0) return "اليوم";
    if (diff === 1) return "أمس";
    return d.toLocaleDateString("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const groups: Array<{ label: string; items: CopyHistoryEntry[] }> = [];
  for (const e of entries) {
    const label = dayLabel(new Date(e.copiedAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <p className="text-sm text-[var(--dim)]">
          آخر {entries.length} عملية نسخ ناجحة — الأحدث الأول
        </p>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={confirmingClear ? "تأكيد مسح سجل النسخ" : "مسح سجل النسخ"}
          data-tip={confirmingClear ? "دوس تاني لتأكيد المسح" : "مسح السجل كله"}
          disabled={clearing}
          onClick={() => {
            if (confirmingClear) {
              onClear();
              setConfirmingClear(false);
            } else {
              setConfirmingClear(true);
              window.setTimeout(() => setConfirmingClear(false), 3000);
            }
          }}
          className={`lux-btn rounded-full px-3 py-1.5 text-[13px] font-bold disabled:opacity-50 ${
            confirmingClear
              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
              : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
          }`}
        >
          {clearing ? "بيتمسح…" : confirmingClear ? "متأكد؟ دوس تاني للمسح" : "مسح السجل"}
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.label} className="mb-4 last:mb-0">
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-[var(--dim)]">
            {g.label}
            <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold">
              {g.items.length}
            </span>
            <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-[var(--border)]" />
          </p>
          <ul className="flex flex-col gap-1.5">
            {g.items.map((e) => (
          <li
            key={e.id}
            className="lux-card elev-card flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[var(--dim)]">
              <Icon d={I.history} size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{e.title}</span>
              <span className="block text-xs text-[var(--faint)]">
                {new Date(e.copiedAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                {e.shortcutId === null ? " · الرد ده اتمسح من المكتبة" : ""}
              </span>
            </span>
            <button
              type="button"
              aria-label={`نسخ «${e.title}» تاني`}
              data-tip={e.shortcutId === null ? "الرد اتمسح — النسخ مش متاح" : "نسخ الرد تاني"}
              disabled={e.shortcutId === null}
              onClick={() => onCopy(e)}
              className="lux-btn flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] disabled:opacity-40"
            >
              <Icon d={I.copy} size={16} />
              نسخ تاني
            </button>
          </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------- folder icon picker ----------
   One grid used by both the create sheet and the folder settings:
   «تلقائية» (null) first — the icon follows the folder's name —
   then every catalogue icon as a labelled tile. The selected tile
   wears the accent fill; the rest stay quiet hairline tiles. */
function FolderIconPicker({
  value,
  onChange,
  lang,
  compact = false,
  colorValue,
  onColorChange,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  lang: Lang;
  /* Compact = a shorter grid, used in the folder-create sheet so
     the sheet's other sections (above all: moving replies in) stay
     in view without a long scroll. */
  compact?: boolean;
  /* The folder's chosen icon colour (v73): when onColorChange is
     given, a colour row renders under the icon grid — «تلقائي»
     (null, the colour follows the folder's name) plus the fixed
     palette. The colour tints the folder's icon and tile
     everywhere they appear. */
  colorValue?: string | null;
  onColorChange?: (key: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const tile =
    "icon-tile flex flex-col items-center justify-center gap-1 rounded-[10px] border px-1 py-2 text-center";
  /* The colour wheel's state, derived once here: the folder's
     custom hex when it wears one, and the wheel's resting value
     (the named colour's swatch, so the wheel opens on the colour
     already in use). */
  const customColor = isCustomColor(colorValue) ? colorValue : null;
  const wheelValue =
    customColor ??
    FOLDER_COLOR_OPTIONS.find((o) => o.key === colorValue)?.swatch ??
    "#1668C4";
  const q = query.trim().toLowerCase();
  const visible = q
    ? FOLDER_ICON_OPTIONS.filter(
        (o) =>
          o.ar.includes(query.trim()) ||
          o.en.toLowerCase().includes(q) ||
          o.key.includes(q),
      )
    : FOLDER_ICON_OPTIONS;
  return (
    <div>
      <div className="relative mb-2">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--faint)]">
          <Icon d={Search} size={15} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === "en" ? "Search icons…" : "ابحث في الأيقونات…"}
          aria-label={lang === "en" ? "Search icons" : "بحث في الأيقونات"}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] py-2 pe-3 ps-9 text-sm text-[var(--text)] placeholder:text-[var(--faint)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>
    <div className={`grid ${compact ? "max-h-40" : "max-h-64"} grid-cols-4 gap-1.5 overflow-y-auto pe-0.5 sm:grid-cols-7`} role="radiogroup" aria-label={lang === "en" ? "Folder icon" : "أيقونة المجلد"}>
      {!q && (
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={lang === "en" ? "Automatic icon" : "أيقونة تلقائية"}
        data-tip={lang === "en" ? "Automatic — the icon follows the folder's name" : "تلقائية — الأيقونة بتتبع اسم المجلد وموضوعه"}
        onClick={() => onChange(null)}
        className={`${tile} ${value === null ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"}`}
      >
        <Icon d={Sparkles} size={19} />
        <span className="text-[10.5px] font-bold leading-none">{lang === "en" ? "Auto" : "تلقائية"}</span>
      </button>
      )}
      {visible.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={lang === "en" ? `Icon: ${o.en}` : `أيقونة: ${o.ar}`}
            data-tip={lang === "en" ? o.en : o.ar}
            onClick={() => onChange(o.key)}
            className={`${tile} ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"}`}
          >
            <Icon d={o.icon} size={19} />
            <span className="w-full truncate text-[10.5px] font-bold leading-none">{lang === "en" ? o.en : o.ar}</span>
          </button>
        );
      })}
      {q && visible.length === 0 && (
        <p className="col-span-full py-4 text-center text-sm text-[var(--faint)]">
          {lang === "en" ? "No icon matches your search." : "لا توجد أيقونة تطابق بحثك."}
        </p>
      )}
    </div>
    {onColorChange && (
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Icon colour" : "لون الأيقونة"}</span>
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={lang === "en" ? "Icon colour" : "لون الأيقونة"}>
          <button
            type="button"
            role="radio"
            aria-checked={!colorValue}
            aria-label={lang === "en" ? "Automatic colour" : "لون تلقائي"}
            data-tip={lang === "en" ? "Automatic — the colour follows the folder's name" : "تلقائي — اللون بيتبع اسم المجلد"}
            onClick={() => onColorChange(null)}
            className={`lux-btn rounded-full px-3 py-1.5 text-xs font-bold ${!colorValue ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--surface-alt)] text-[var(--dim)] hover:text-[var(--text)]"}`}
          >
            {lang === "en" ? "Auto" : "تلقائي"}
          </button>
          {FOLDER_COLOR_OPTIONS.map((c) => {
            const active = colorValue === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={lang === "en" ? `Icon colour: ${c.en}` : `لون الأيقونة: ${c.ar}`}
                data-tip={lang === "en" ? c.en : c.ar}
                onClick={() => onColorChange(c.key)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
                style={{ background: c.swatch, boxShadow: active ? `0 0 0 2px var(--surface), 0 0 0 4px ${c.swatch}` : undefined }}
              >
                {active && <Icon d={I.check} size={14} />}
              </button>
            );
          })}
          <label
            className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-transform hover:scale-110"
            style={{
              background: customColor ?? "conic-gradient(#ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #ef4444)",
              boxShadow: customColor ? `0 0 0 2px var(--surface), 0 0 0 4px ${customColor}` : undefined,
            }}
            data-tip={lang === "en" ? "Any colour…" : "أي لون…"}
          >
            {customColor ? <Icon d={I.check} size={14} /> : <Pipette size={13} aria-hidden="true" />}
            <input
              type="color"
              aria-label={lang === "en" ? "Pick any icon colour" : "اختيار أي لون للأيقونة"}
              value={wheelValue}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        <span className="mt-1.5 block text-xs leading-relaxed text-[var(--dim)]">
          {lang === "en"
            ? "This folder's own colour — it tints its icon and tile in the sidebar, its header and its cards. The colour wheel picks literally any colour. Auto keeps the colour that follows the folder's name."
            : "لون خاص بالمجلد ده — بيتلوّن بيه أيقونته وبلاطته في القائمة الجانبية ورأسه وكروته. عجلة الألوان بتختار أي لون حرفياً. «تلقائي» بيسيب اللون اللي بيتبع اسم المجلد."}
        </span>
      </div>
    )}
    </div>
  );
}

/* ---------- move-replies picker ----------
   The shared "bring replies from another folder" block: pick a
   source (any other folder, or the loose top-level replies), tick
   the replies to move, «تحديد الكل» for the whole source. Used by
   the create sheet (move into the folder being created) and by the
   folder view's «نقل ردود إلى هنا» sheet (move into an existing
   folder). Selection lives in the parent sheet. */
function MoveRepliesPicker({
  folders,
  shortcuts,
  excludeFolderId,
  selected,
  onToggle,
  onSelectMany,
  lang,
}: {
  folders: FolderRowT[];
  shortcuts: Shortcut[];
  excludeFolderId: number | null;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectMany: (ids: number[], select: boolean) => void;
  lang: Lang;
}) {
  const [source, setSource] = useState<string>("");
  const sources = folders.filter((f) => f.id !== excludeFolderId);
  const sourceItems = useMemo(() => {
    if (!source) return [];
    const fid = source === "root" ? null : Number(source);
    return shortcuts
      .filter((s) => (s.folderId ?? null) === fid && s.id !== undefined)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }, [source, shortcuts]);
  const allPicked =
    sourceItems.length > 0 && sourceItems.every((s) => selected.has(s.id));
  const pickedFolder = source && source !== "root"
    ? sources.find((f) => f.id === Number(source))
    : undefined;
  const SourceIcon = source
    ? source === "root"
      ? Layers
      : folderIconOf(pickedFolder ?? { name: "", icon: null })
    : Folder;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]">
          {pickedFolder?.source ? (
            <SourceMark source={pickedFolder.source} size={16} />
          ) : (
            <Icon d={SourceIcon} size={16} />
          )}
        </span>
        <select
          aria-label={lang === "en" ? "Source folder to move replies from" : "المجلد اللي هتنقل منه الردود"}
          data-tip={lang === "en" ? "Pick the folder whose replies you want to move" : "اختار المجلد اللي عايز تنقل ردوده"}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full appearance-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-2.5 pe-3 ps-9 text-sm font-semibold outline-none focus:border-[var(--accent)]"
        >
          <option value="">{lang === "en" ? "Choose a source folder…" : "اختار مجلد المصدر…"}</option>
          <option value="root">{lang === "en" ? "Top level (no folder)" : "المستوى الرئيسي (من غير مجلد)"}</option>
          {sources.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({shortcuts.filter((s) => s.folderId === f.id).length})
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[var(--faint)]">
          <Icon d={ChevronDown} size={15} />
        </span>
      </div>
      {source && sourceItems.length === 0 && (
        <p className="rounded-[var(--radius)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--dim)]">
          {lang === "en" ? "This source has no replies to move." : "المصدر ده مفيهوش ردود تتنقل."}
        </p>
      )}
      {sourceItems.length > 0 && (
        <>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[13px] font-bold text-[var(--dim)]">
              {lang === "en"
                ? `${sourceItems.filter((s) => selected.has(s.id)).length} of ${sourceItems.length} picked`
                : `اتحدد ${sourceItems.filter((s) => selected.has(s.id)).length} من ${sourceItems.length}`}
            </span>
            <button
              type="button"
              aria-label={allPicked ? (lang === "en" ? "Unselect all replies" : "إلغاء تحديد كل الردود") : lang === "en" ? "Select all replies" : "تحديد كل الردود"}
              data-tip={allPicked ? (lang === "en" ? "Unselect all" : "إلغاء تحديد الكل") : lang === "en" ? "Select every reply in this folder" : "تحديد كل ردود المجلد ده"}
              onClick={() => onSelectMany(sourceItems.map((s) => s.id), !allPicked)}
              className="lux-btn rounded-full px-2.5 py-1 text-[12.5px] font-bold text-[var(--accent)] hover:bg-[var(--surface-selected)]"
            >
              {allPicked ? (lang === "en" ? "Unselect all" : "إلغاء الكل") : lang === "en" ? "Select all" : "تحديد الكل"}
            </button>
          </div>
          <ul className="max-h-52 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)]">
            {sourceItems.map((s) => {
              const on = selected.has(s.id);
              return (
                <li key={s.id} className="border-b border-[var(--border)] last:border-b-0">
                  <label
                    className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors ${on ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-hover)]"}`}
                    data-tip={lang === "en" ? "Tick to move this reply" : "علّم على الرد عشان يتنقل"}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(s.id)}
                      aria-label={lang === "en" ? `Move reply ${s.title}` : `نقل رد ${s.title}`}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{s.title}</span>
                      <span className="block truncate text-xs text-[var(--dim)]">{s.body}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- new folder sheet ----------
   The one creation flow for every folder — main or subfolder:
   name, its own icon, an optional description, and (the point of
   this sheet) the option to move existing replies from another
   folder straight into the new one, in the same save. */
function FolderCreateModal({
  parentName,
  folders,
  shortcuts,
  saving,
  error,
  lang,
  onClose,
  onCreate,
}: {
  parentName: string | null;
  folders: FolderRowT[];
  shortcuts: Shortcut[];
  saving: boolean;
  error: string | null;
  lang: Lang;
  onClose: () => void;
  onCreate: (v: { name: string; icon: string | null; iconColor: string | null; description: string | null; moveIds: number[] }) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";
  const togglePick = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectMany = (ids: number[], select: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      for (const id of ids) {
        if (select) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  const submit = () => {
    if (!name.trim()) {
      setLocalError(lang === "en" ? "Write the folder name first — an empty name is not saved" : "اكتب اسم المجلد الأول — الاسم الفاضي مش بيتحفظ");
      return;
    }
    setLocalError(null);
    onCreate({
      name: name.trim(),
      icon,
      iconColor,
      description: description.trim() ? description.trim() : null,
      moveIds: [...picked],
    });
  };
  const shownError = localError ?? error;
  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={lang === "en" ? "New folder" : "مجلد جديد"}
      onClick={onClose}
    >
      <div
        className="animate-sheet elev-pop flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--radius)] glass-panel sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
       <div className="overflow-y-auto p-5 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span style={folderColorStyle({ iconColor })} className={`folder-bar-icon folder-bar-icon-sm ${iconColor && FOLDER_COLOR_KEYS_CLIENT.has(iconColor) ? `fcol-${iconColor}` : ""}`}>
              <Icon d={icon ? (FOLDER_ICON_BY_KEY.get(icon) ?? FolderPlus) : FolderPlus} size={18} />
            </span>
            {lang === "en" ? "New folder" : "مجلد جديد"}
          </h2>
          <button type="button" aria-label={lang === "en" ? "Close" : "قفل"} data-tip={lang === "en" ? "Close without saving" : "قفل من غير حفظ"} data-tip-pos="below" onClick={onClose} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        {parentName && (
          <p className="mt-2 text-sm text-[var(--dim)]">
            {lang === "en" ? <>Inside folder <strong className="text-[var(--text)]">«{parentName}»</strong></> : <>جوه مجلد <strong className="text-[var(--text)]">«{parentName}»</strong></>}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-4">
          <label className="block" data-tip={lang === "en" ? "The folder name — its replies take it as their category" : "اسم المجلد — ردوده هتاخد الاسم ده كتصنيف"}>
            <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Folder name" : "اسم المجلد"}</span>
            <input
              {...FIELDS.createFolder.name}
              autoFocus
              aria-label={lang === "en" ? "New folder name" : "اسم المجلد الجديد"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={lang === "en" ? "e.g. Subscriptions" : "مثال: الاشتراكات"}
              className={field}
            />
          </label>
          {/* Move existing replies — the heart of this sheet, so it
              sits directly under the name, fully open: pick a source
              folder and tick replies, and they land in the new
              folder the moment it is created. Never collapsed,
              never below a scroll fold. */}
          <section
            aria-label={lang === "en" ? "Move existing replies into the new folder" : "نقل ردود موجودة للمجلد الجديد"}
            className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--accent-soft)] p-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent)] text-[var(--accent-ink)]">
                <Icon d={I.enter} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold">{lang === "en" ? "Move existing replies into this folder" : "نقل ردود موجودة للمجلد الجديد"}</span>
                <span className="block text-xs text-[var(--dim)]">
                  {picked.size > 0
                    ? lang === "en" ? `${picked.size} replies will move into the new folder when you create it` : `${picked.size} رد هيتنقلوا للمجلد الجديد أول ما يتعمل`
                    : lang === "en" ? "Optional — bring replies from another folder right now" : "اختياري — هات ردود من مجلد تاني دلوقتي على طول"}
                </span>
              </span>
              {picked.size > 0 && (
                <span
                  className="folder-bar-count shrink-0"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  {picked.size}
                </span>
              )}
            </div>
            <div className="mt-3 rounded-[var(--radius)] bg-[var(--surface)] p-2.5">
              <MoveRepliesPicker
                folders={folders}
                shortcuts={shortcuts}
                excludeFolderId={null}
                selected={picked}
                onToggle={togglePick}
                onSelectMany={selectMany}
                lang={lang}
              />
            </div>
          </section>
          <div>
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Folder icon" : "أيقونة المجلد"}</span>
            <FolderIconPicker value={icon} onChange={setIcon} lang={lang} compact colorValue={iconColor} onColorChange={setIconColor} />
          </div>
          <label className="block" data-tip={lang === "en" ? "Optional one-liner shown in the folder header" : "وصف قصير اختياري بيظهر في رأس المجلد"}>
            <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Short description (optional)" : "وصف مختصر (اختياري)"}</span>
            <input
              {...FIELDS.createFolder.description}
              aria-label={lang === "en" ? "Folder description" : "وصف المجلد"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === "en" ? "What lives in this folder?" : "إيه اللي هيبقى في المجلد ده؟"}
              className={field}
            />
          </label>
          {shownError && (
            <p role="alert" className="rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              {shownError}
            </p>
          )}
        </div>
       </div>
        {/* Sticky footer: creating (and moving) is always one tap
            away, however far the sheet is scrolled. */}
        <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3.5">
          <button
            type="button"
            aria-label={lang === "en" ? "Create the folder" : "إنشاء المجلد"}
            data-tip={picked.size > 0 ? (lang === "en" ? "Create the folder and move the picked replies into it" : "إنشاء المجلد ونقل الردود المختارة ليه") : lang === "en" ? "Create the folder" : "إنشاء المجلد"}
            data-tip-pos="below"
            onClick={submit}
            disabled={saving}
            className="lux-btn flex-1 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {saving
              ? lang === "en" ? "Creating…" : "بيتعمل…"
              : picked.size > 0
                ? lang === "en" ? `Create folder & move ${picked.size} replies` : `إنشاء المجلد ونقل ${picked.size} رد`
                : lang === "en" ? "Create folder" : "إنشاء المجلد"}
          </button>
          <button
            type="button"
            aria-label={lang === "en" ? "Cancel" : "إلغاء"}
            data-tip={lang === "en" ? "Cancel and go back" : "إلغاء والرجوع من غير حفظ"}
            data-tip-pos="below"
            data-tip-align="end"
            onClick={onClose}
            className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            {lang === "en" ? "Cancel" : "إلغاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- move replies into an existing folder sheet ---------- */
function MoveRepliesModal({
  folder,
  folders,
  shortcuts,
  lang,
  onClose,
  onMove,
}: {
  folder: FolderRowT;
  folders: FolderRowT[];
  shortcuts: Shortcut[];
  lang: Lang;
  onClose: () => void;
  onMove: (ids: number[]) => void;
}) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const togglePick = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectMany = (ids: number[], select: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      for (const id of ids) {
        if (select) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={lang === "en" ? `Move replies into ${folder.name}` : `نقل ردود إلى ${folder.name}`}
      onClick={onClose}
    >
      <div
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span className="folder-bar-icon folder-bar-icon-sm">
              <FolderGlyph folder={folder} size={18} />
            </span>
            {lang === "en" ? `Move replies into «${folder.name}»` : `نقل ردود إلى «${folder.name}»`}
          </h2>
          <button type="button" aria-label={lang === "en" ? "Close" : "قفل"} data-tip={lang === "en" ? "Close without moving" : "قفل من غير نقل"} data-tip-pos="below" onClick={onClose} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
          {lang === "en"
            ? "Pick a source folder, tick the replies, and they move here at once — nothing is copied or duplicated."
            : "اختار مجلد المصدر وعلّم على الردود، وهتتنقل هنا مرة واحدة — من غير نسخ ولا تكرار."}
        </p>
        <div className="mt-4">
          <MoveRepliesPicker
            folders={folders}
            shortcuts={shortcuts}
            excludeFolderId={folder.id}
            selected={picked}
            onToggle={togglePick}
            onSelectMany={selectMany}
            lang={lang}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            aria-label={lang === "en" ? `Move the picked replies into ${folder.name}` : `نقل الردود المختارة إلى ${folder.name}`}
            data-tip={lang === "en" ? "Move the ticked replies into this folder" : "نقل الردود المعلّمة للمجلد ده"}
            onClick={() => onMove([...picked])}
            disabled={picked.size === 0}
            className="lux-btn flex-1 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {picked.size > 0
              ? lang === "en" ? `Move ${picked.size} replies here` : `نقل ${picked.size} رد لهنا`
              : lang === "en" ? "Pick replies first" : "اختار ردود الأول"}
          </button>
          <button
            type="button"
            aria-label={lang === "en" ? "Cancel" : "إلغاء"}
            data-tip={lang === "en" ? "Cancel and go back" : "إلغاء والرجوع من غير نقل"}
            onClick={onClose}
            className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            {lang === "en" ? "Cancel" : "إلغاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- folder settings sheet ---------- */
function FolderSettingsModal({
  folder,
  replyCount,
  lang,
  onClose,
  onSave,
  onDelete,
  onSourceChange,
  sourceBusy,
}: {
  folder: FolderRowT;
  replyCount: number;
  lang: Lang;
  onClose: () => void;
  onSave: (name: string, description: string | null, icon: string | null, iconColor: string | null) => void;
  onDelete: () => void;
  onSourceChange: (source: string) => void;
  sourceBusy: boolean;
}) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description ?? "");
  const [icon, setIcon] = useState<string | null>(folder.icon ?? null);
  const [iconColor, setIconColor] = useState<string | null>(folder.iconColor ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";
  const submit = () => {
    if (!name.trim()) {
      setError("اكتب اسم المجلد الأول — الاسم الفاضي مش بيتحفظ");
      return;
    }
    setError(null);
    onSave(name.trim(), description.trim() ? description.trim() : null, icon, iconColor);
  };
  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`إعدادات مجلد ${folder.name}`}
      onClick={onClose}
    >
      <div
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">إعدادات المجلد</h2>
          <button type="button" aria-label="قفل" data-tip="قفل من غير حفظ" data-tip-pos="below" onClick={onClose} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="block" data-tip="اسم المجلد — ردوده هتاخد الاسم الجديد كتصنيف">
            <span className="mb-1 block text-sm font-bold">اسم المجلد</span>
            <input
              {...FIELDS.renameFolder.name}
              aria-label="اسم المجلد"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </label>
          <label className="block" data-tip="وصف قصير اختياري بيظهر في رأس المجلد">
            <span className="mb-1 block text-sm font-bold">وصف مختصر (اختياري)</span>
            <input
              {...FIELDS.renameFolder.description}
              aria-label="وصف المجلد"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: ردود الأسعار والباقات للمرحلة الثانوية"
              className={field}
            />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-bold">{lang === "en" ? "Folder icon" : "أيقونة المجلد"}</span>
            <FolderIconPicker value={icon} onChange={setIcon} lang={lang} colorValue={iconColor} onColorChange={setIconColor} />
          </div>
          <div>
            <span className="mb-1 block text-sm font-bold">{lang === "en" ? "Source" : "المصدر"}</span>
            <FolderSourceControl
              value={folder.source}
              lang={lang}
              busy={sourceBusy}
              onPick={onSourceChange}
            />
            <span className="mt-1 block text-xs leading-relaxed text-[var(--dim)]">
              {lang === "en"
                ? "Picking a source moves this folder — with everything inside it — under that source's main folder right away. The main folder is created the first time its source is used. “Not specified” leaves the folder where it is."
                : "اختيار مصدر بينقل المجلد ده — بكل اللي جواه — تحت المجلد الرئيسي بتاع المصدر على طول، والمجلد الرئيسي بيتعمل أول مرة المصدر يتستخدم. «مش محدد» بتسيب المجلد في مكانه."}
            </span>
            {folder.isSourceMain && (
              <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)]">
                <SourceMark source={folder.source} size={14} />
                {lang === "en" ? "This is the main folder of its source." : "ده المجلد الرئيسي بتاع المصدر بتاعه."}
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="حفظ إعدادات المجلد"
              data-tip="حفظ الاسم والوصف والأيقونة ولونها"
              onClick={submit}
              className="lux-btn flex-1 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
            >
              حفظ
            </button>
            <button
              type="button"
              aria-label="إلغاء"
              data-tip="إلغاء والرجوع من غير حفظ"
              data-tip-align="end"
              onClick={onClose}
              className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
            >
              إلغاء
            </button>
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <button
              type="button"
              aria-label={confirmingDelete ? `تأكيد حذف مجلد ${folder.name}` : `حذف مجلد ${folder.name}`}
              data-tip={confirmingDelete ? "دوس تاني لتأكيد الحذف" : "المجلد بيتنقل لسلة المهملات بكل اللي جواه — وتقدر ترجعه منها"}
              onClick={() => {
                if (confirmingDelete) onDelete();
                else {
                  setConfirmingDelete(true);
                  window.setTimeout(() => setConfirmingDelete(false), 3000);
                }
              }}
              className={`lux-btn flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-bold ${
                confirmingDelete
                  ? "bg-[var(--danger)] text-white"
                  : "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              }`}
            >
              <Icon d={I.trash} size={16} />
              {confirmingDelete
                ? "متأكد؟ دوس تاني لنقل المجلد للمهملات"
                : `نقل المجلد لسلة المهملات (${replyCount} رد جواه هيرجعوا معاه لو استعدته)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* The duplicate key for imports, shared by the preview below and
   mirrored by the server's import action: a reply is a duplicate
   when a row with the same title AND the same body already exists. */
function importKeyOf(title: string, body: string): string {
  return title.trim().toLowerCase() + "\n" + body.trim();
}

/* ---------- import preview ----------
   Nothing is written when a file is picked: this sheet shows the
   parsed result first — how many replies are new, which ones
   already exist in the library — and the user picks merge (skip
   duplicates) or a clearly-confirmed replace before anything
   touches the library. */
function ImportPreviewModal({
  fileName,
  items,
  existingKeys,
  importing,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  items: Array<{
    title: string;
    body: string;
    category: string;
    tags?: string;
    extShortcut?: string;
    source?: string;
  }>;
  existingKeys: Set<string>;
  importing: boolean;
  onCancel: () => void;
  onConfirm: (mode: "merge" | "replace") => void;
}) {
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  useEscapeClose(onCancel);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const seenInFile = new Set<string>();
  const dupes: string[] = [];
  let fresh = 0;
  items.forEach((it) => {
    const key = importKeyOf(it.title, it.body);
    if (existingKeys.has(key) || seenInFile.has(key)) dupes.push(it.title);
    else fresh += 1;
    seenInFile.add(key);
  });
  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="معاينة الاستيراد"
      onClick={onCancel}
    >
      <div
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">معاينة الاستيراد</h2>
          <button type="button" aria-label="إلغاء الاستيراد" data-tip="إلغاء — مش هيتكتب أي حاجة" data-tip-pos="below" onClick={onCancel} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
          الملف <span dir="ltr" className="font-mono font-bold">{fileName}</span> فيه{" "}
          <strong className="text-[var(--text)]">{items.length} رد</strong> — منهم{" "}
          <strong className="text-[var(--text)]">{fresh} جديد</strong> و
          <strong className="text-[var(--text)]"> {dupes.length} رد موجود عندك بالفعل</strong>.
          لسه ما اتكتبش أي حاجة في مكتبتك.
        </p>
        {dupes.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[13px] font-bold text-[var(--dim)]">الردود المكررة:</p>
            <div className="flex flex-wrap gap-1.5">
              {dupes.slice(0, 12).map((t, i) => (
                <span key={`${t}-${i}`} className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[12px] font-semibold text-[var(--dim)]">
                  {t}
                </span>
              ))}
              {dupes.length > 12 && (
                <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[12px] font-semibold text-[var(--dim)]">
                  و{dupes.length - 12} كمان
                </span>
              )}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="طريقة الاستيراد">
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border p-3 ${mode === "merge" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}>
            <input
              type="radio"
              name="import-mode"
              aria-label="دمج مع المكتبة الحالية"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold">دمج مع مكتبتك (الأكثر أماناً)</span>
              <span className="block text-[13px] leading-relaxed text-[var(--dim)]">
                الجديد بس هو اللي هيتضاف، والمكرر هيتخطى — مكتبتك الحالية مش هتتغير.
              </span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border p-3 ${mode === "replace" ? "border-[var(--danger)] bg-[var(--danger-soft)]" : "border-[var(--border)]"}`}>
            <input
              type="radio"
              name="import-mode"
              aria-label="استبدال المكتبة بالكامل"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold text-[var(--danger)]">استبدال المكتبة بالكامل</span>
              <span className="block text-[13px] leading-relaxed text-[var(--dim)]">
                كل ردودك الحالية هتتمسح الأول، وبعدين الملف ده هيبقى مكتبتك. المجلدات نفسها هتفضل موجودة.
              </span>
            </span>
          </label>
        </div>
        {mode === "replace" && (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] bg-[var(--danger-soft)] p-3">
            <input
              type="checkbox"
              aria-label="أنا فاهم إن الاستبدال هيمسح ردودي الحالية"
              checked={confirmReplace}
              onChange={(e) => setConfirmReplace(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[13px] font-semibold leading-relaxed text-[var(--danger)]">
              أنا فاهم إن الاستبدال هيمسح كل ردودي الحالية قبل الاستيراد، ومفيش تراجع بعدها إلا من نسخة احتياطية.
            </span>
          </label>
        )}
        <div className="mt-4 flex gap-2 pb-1">
          <button
            type="button"
            aria-label="تأكيد الاستيراد"
            data-tip={mode === "replace" ? "استبدال المكتبة بالملف ده" : "استيراد الجديد ودمجه في مكتبتك"}
            disabled={importing || (mode === "replace" && !confirmReplace)}
            onClick={() => onConfirm(mode)}
            className={`lux-btn flex-1 rounded-[var(--radius)] py-3 font-semibold text-white disabled:opacity-50 ${
              mode === "replace"
                ? "bg-[var(--danger)]"
                : "bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]"
            }`}
          >
            {importing ? "بيتستورد…" : mode === "replace" ? "استبدال واستيراد" : `استيراد ${fresh} رد جديد`}
          </button>
          <button
            type="button"
            aria-label="إلغاء الاستيراد"
            data-tip="إلغاء — مش هيتكتب أي حاجة"
            data-tip-align="end"
            onClick={onCancel}
            className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- quick preview modal ---------- */
function PreviewModal({
  item,
  onClose,
  onCopy,
  onEdit,
}: {
  item: Shortcut;
  onClose: () => void;
  onCopy: () => Promise<boolean>;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة ${item.title}`}
      onClick={onClose}
    >
      <div
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--dim)]">{item.category}</span>
              {item.usageCount > 0 && (
                <span className="text-xs text-[var(--faint)]">اتستخدم {item.usageCount} مرة</span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold leading-snug">{item.title}</h2>
          </div>
          <button
            type="button"
            aria-label="قفل المعاينة"
            data-tip="قفل"
            data-tip-pos="below"
            onClick={onClose}
            className="lux-btn lux-row shrink-0 rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]"
          >
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <RichPreview body={item.body} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          دي المعاينة بالتنسيق — العريض والمائل بصيغة واتساب، فهيظهروا منسقين لما الرد يتلصق هناك.
        </p>
        <div className="flex gap-2 pb-2 pt-3">
          <button
            type="button"
            aria-label={copied ? `اتنسخ رد ${item.title}` : `نسخ رد ${item.title}`}
            data-tip={copied ? "اتنسخ" : "نسخ الرد"}
            aria-busy={copying}
            disabled={copying}
            onClick={async () => {
              if (copying) return;
              setCopying(true);
              try {
                const ok = await onCopy();
                if (!ok) return;
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              } finally {
                setCopying(false);
              }
            }}
            className={`btn-lux flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-bold ${copied ? "btn-lux-success" : ""}`}
          >
            {copying ? (
              <>
                <span className="spinner" aria-hidden="true" />
                بيتنسخ…
              </>
            ) : copied ? (
              <>
                <span className="animate-copy-pop flex"><Icon d={I.check} size={18} /></span>
                اتنسخ
              </>
            ) : (
              <>
                <Icon d={I.copy} size={18} />
                نسخ الرد
              </>
            )}
          </button>
          <button
            type="button"
            aria-label={`تعديل ${item.title}`}
            data-tip="تعديل"
            onClick={onEdit}
            className="lux-btn lux-row flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            <Icon d={I.edit} size={18} />
            تعديل
          </button>
        </div>
      </div>
    </div>
  );
}

/* The published privacy policy texts (Arabic + English) — the
   same texts the privacy page renders. */
const PRIVACY_POLICY_AR = `سياسة خصوصية إضافة IS للمتصفح

آخر تحديث: نوفمبر 2026

إضافة IS للمتصفح («الإضافة») تابعة لمنصة IS لإدارة الاختصارات النصية («الموقع»). السياسة دي بتشرح ببساطة إيه البيانات اللي بنتعامل معاها وليه.

١) البيانات اللي بنجمعها
• بيانات الحساب اللي بتسجل بيها على الموقع: الاسم، البريد الإلكتروني، رقم الموبايل (اختياري)، وكلمة المرور — وكلمة المرور بتتحفظ مشفرة ببصمة تجزئة مع ملح (salted hash)، مش كنص صريح أبداً.
• ردودك: العنوان ونص الرد والتصنيف وعدد مرات الاستخدام — دي المحتوى اللي انت بتحفظه بنفسك على حسابك.
• الإضافة نفسها بتخزن على جهازك بس: نسخة من مكتبتك ورمز جلسة تسجيل الدخول — عشان البحث والإدراج يشتغلوا فوراً وحتى من غير إنترنت.

٢) الإضافة بتعمل إيه على الصفحات؟
الإضافة بتشتغل على المواقع اللي بتفتحها عشان تكتشف خانات الكتابة وتدرج فيها الرد اللي بتختاره بنفسك من البحث السريع أو النافذة أو قائمة الزر الأيمن. محتوى الصفحات مش بيتبعت لأي مكان ومش بيتحفظ ومش بيستخدم لأي غرض تاني.

٣) المزامنة
لما بتسجل دخولك من الإضافة، رمز الجلسة بيتبعت لموقع IS بس عشان نجيب مكتبتك ونحدثها. مفيش أي بيانات بتروح لأي طرف تالت، ومفيش تتبع إعلاني ولا تحليلات من أطراف خارجية، ومفيش بيع بيانات — لا دلوقتي ولا بعدين.

٤) الأذونات وليه محتاجينها
• التخزين (storage): حفظ مكتبتك وإعداداتك ورمز الجلسة على جهازك.
• الوصول لكل المواقع (host permissions): الإدراج لازم يشتغل في أي موقع بتكتب فيه — ده غرض الإضافة الوحيد.
• قوائم الزر الأيمن (contextMenus): قائمة «إدراج رد جاهز» جوه خانات الكتابة.
• المنبهات (alarms): المزامنة الدورية كل ٣٠ دقيقة.
• التبويبات (tabs): توصيل الرد اللي اخترته لخانة الكتابة في التبويب الحالي وتنفيذ أوامر لوحة المفاتيح.
• الاتصال الخارجي (externally_connectable): موقع IS بس يقدر يسأل الإضافة إن كانت مثبتة عشان يعرض حالة التثبيت الحقيقية.

٥) حقوقك
تقدر تعدل ردودك أو تمسحها في أي وقت من الموقع، وتسجل خروجك من الإضافة يمسح رمز الجلسة من جهازك، ومسح الإضافة من المتصفح بيمسح كل بياناتها المحلية. لحذف حسابك وبياناته من الموقع كلياً، تواصل مع مالك الموقع من خلال الموقع نفسه.

٦) التعديلات
لو السياسة اتغيرت، هنحدث التاريخ اللي فوق وننشر النسخة الجديدة هنا على الموقع.`;

const PRIVACY_POLICY_EN = `IS Browser Extension — Privacy Policy

Last updated: November 2026

The IS browser extension (the "Extension") is part of the IS text-shortcut platform (the "Site"). This policy explains, plainly, what data we handle and why.

1) Data we collect
• Account data you register with on the Site: your name, email address, optional mobile number, and password — passwords are stored only as a salted hash, never in plain text.
• Your snippets: the title, reply text, category, and usage counts — content you save yourself on your account.
• The Extension stores, on your device only: a copy of your library and your sign-in session token — so search and insert work instantly and even offline.

2) What the Extension does on pages
The Extension runs on the websites you open to detect text fields and insert the reply you explicitly pick from the quick search, the popup, or the right-click menu. Page content is never transmitted anywhere, never stored, and never used for any other purpose.

3) Synchronization
When you sign in from the Extension, the session token is sent only to the IS Site to fetch and update your library. No data goes to any third party. There is no advertising tracking, no third-party analytics, and no sale of data — ever.

4) Permissions and why they are needed
• storage: keeps your library, settings, and session token on your device.
• Host permissions (all URLs): inserting the reply you pick has to work on any site you type on — that is the Extension's single purpose.
• contextMenus: the "insert a ready reply" right-click menu inside text fields.
• alarms: the periodic 30-minute sync.
• tabs: delivers the snippet you picked to the text field in your current tab and routes the keyboard commands.
• externally_connectable: only the IS Site may ask the Extension whether it is installed, so the Site can show a truthful installation state.

5) Your rights
You can edit or delete your snippets at any time on the Site. Signing out of the Extension removes the session token from your device, and removing the Extension from your browser deletes all of its local data. To delete your account and its data from the Site entirely, contact the Site owner through the Site.

6) Changes
If this policy changes, we will update the date above and publish the new version here on the Site.`;

/* ---------- privacy policy page ----------
   The extension's privacy policy, published on the site itself: the
   Chrome Web Store dashboard points at this site for it, and the exact
   same texts ship in the submission pack for pasting. Arabic first
   (the site's language), then the English version for store review. */
function PrivacySection({ onBack }: { onBack: () => void }) {
  return (
    <section className="animate-page pt-5 lg:pt-8">
      <button
        type="button"
        aria-label="رجوع لقسم إضافة المتصفح"
        data-tip="رجوع لقسم إضافة المتصفح"
        onClick={onBack}
        className="lux-btn lux-row inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] px-3.5 py-2 text-sm font-bold hover:border-[var(--border-strong)]"
      >
        <Icon d={I.chevron} size={16} />
        رجوع للإضافة
      </button>
      <h1 className="mt-5 flex items-center gap-2.5 text-[26px] font-bold leading-snug">
        <span className="text-[var(--accent)]">
          <Icon d={I.shield} size={24} />
        </span>
        سياسة خصوصية الإضافة
      </h1>
      <div className="elev-card mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <p className="whitespace-pre-wrap text-[15px] leading-[2]">{PRIVACY_POLICY_AR}</p>
      </div>
      <div className="elev-card mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <p dir="ltr" className="whitespace-pre-wrap text-left text-[15px] leading-[1.9]">
          {PRIVACY_POLICY_EN}
        </p>
      </div>
    </section>
  );
}

/* ---------- smart-variable fill-in ----------
   When a reply contains placeholders the user must supply ({الاسم}،
   {السنة الدراسية}، أي {…} تاني), copying opens this sheet: one field
   per variable, a live formatted preview with the values in place, and
   only then the copy. {التاريخ} و{الوقت} fill themselves and never
   appear here. */
function FillVariablesModal({
  item,
  onClose,
  onCopy,
}: {
  item: Shortcut;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  const vars = useMemo(
    () =>
      extractVariables(item.body).filter(
        (v) => v !== "{التاريخ}" && v !== "{الوقت}",
      ),
    [item.body],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = useMemo(() => {
    let out = item.body;
    for (const v of vars) {
      const val = (values[v] ?? "").trim();
      if (val) out = out.replaceAll(v, val);
    }
    return fillDynamic(out);
  }, [item.body, vars, values]);
  const missing = vars.filter((v) => !(values[v] ?? "").trim());
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";

  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`تعبئة متغيرات رد ${item.title}`}
      onClick={onClose}
    >
      <div
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-[var(--cyan)]">
              <Icon d={I.braces} size={19} />
            </span>
            كمّل البيانات — والرد يجهز
          </h2>
          <button
            type="button"
            aria-label="قفل تعبئة المتغيرات" data-tip="قفل" data-tip-pos="below"
            onClick={onClose}
            className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]"
          >
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          رد «{item.title}» فيه بيانات بتتغير كل مرة — اكتبها هنا وشوف الرد النهائي قبل ما يتنسخ.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {vars.map((v) => (
            <label key={v} className="block" data-tip={`قيمة المتغير ${v} في الرد ده`}>
              <span className="mb-1 flex items-center gap-2 text-sm font-bold">
                <span dir="ltr" className="rounded-[4px] bg-[var(--cyan-soft)] px-1.5 py-0.5 font-mono text-xs font-bold text-[var(--cyan)]">
                  {v}
                </span>
              </span>
              <input
                aria-label={`قيمة المتغير ${v}`}
                value={values[v] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                placeholder={`اكتب ${v.slice(1, -1)} هنا…`}
                className={field}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <p className="mb-2 text-xs font-bold text-[var(--dim)]">معاينة الرد النهائي</p>
          <RichPreview body={filled} />
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-[var(--dim)]">
            لسه فاضي: {missing.join("، ")} — لو نسخت دلوقتي هتفضل زي ما هي في الرد.
          </p>
        )}
        <div className="flex gap-2 pb-2 pt-4">
          <button
            type="button"
            aria-label={`نسخ رد ${item.title} بعد تعبئة المتغيرات`} data-tip="نسخ الرد النهائي بالبيانات اللي كتبتها"
            onClick={() => onCopy(filled)}
            className="lux-btn flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)]"
          >
            <Icon d={I.copy} size={18} />
            نسخ الرد
          </button>
          <button
            type="button"
            aria-label="إلغاء تعبئة المتغيرات" data-tip="إلغاء والرجوع من غير نسخ"
            onClick={onClose}
            className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- account section (حسابي) ---------- */
function AccountSection({
  token,
  user,
  displayName,
  onOpenFull,
  onLogout,
  showToast,
}: {
  token: string;
  user: User;
  displayName: string;
  onOpenFull: () => void;
  onLogout: () => void;
  showToast: (msg: string, kind?: ToastKind) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [email, setEmail] = useState(user.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmAllOut, setConfirmAllOut] = useState(false);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    setEmail(user.email ?? "");
  }, [user.email]);

  const nameMut = useMutation({
    mutationFn: async () => await api.updateProfile({ token, name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", token] });
      showToast("اتحدّث الاسم — هيظهر فوق في كل الموقع");
    },
    onError: () => showToast("التحديث متمّش — حاول تاني", "error"),
  });

  const emailMut = useMutation({
    mutationFn: async () => await api.setEmail({ token, email: email.trim() }),
    onSuccess: (res) => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["me", token] });
        setEmailError(null);
        showToast("اتحفظ البريد — هتقدر تسجّل دخولك بيه");
      } else {
        setEmailError(res.error ?? "الحفظ متمّش — حاول تاني");
      }
    },
    onError: () => setEmailError("الحفظ متمّش — اتأكد من النت وحاول تاني"),
  });

  const logoutAllMut = useMutation({
    mutationFn: async () => await api.logoutAll({ token }),
    onSuccess: () => onLogout(),
    onError: () => onLogout(),
  });

  /* ---- الصورة الشخصية ----
     اختيار صورة جديدة بيحفظها مباشرة: بتتصغّر على الجهاز
     لأطول ضلع 512px وبتتحفظ في الحساب نفسه، فبتظهر
     في الهيدر وقائمة الحساب على أي جهاز تدخل منه. */
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarMut = useMutation({
    mutationFn: async (img: {
      dataBase64: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    }) => await api.setAvatar({ token, dataBase64: img.dataBase64, mimeType: img.mimeType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", token] });
      setAvatarError(null);
      showToast("اتحفظت صورتك — هتظهر في حسابك على كل أجهزتك");
    },
    onError: () => setAvatarError("الحفظ متمّش — اتأكد من النت وحاول تاني"),
  });

  const avatarRemoveMut = useMutation({
    mutationFn: async () => await api.removeAvatar({ token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", token] });
      showToast("اتشالت الصورة — رجعت للحرف الأول من اسمك");
    },
    onError: () => showToast("الإزالة متمّتش — حاول تاني", "error"),
  });

  function handleAvatarFile(file: File) {
    setAvatarError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("الصورة لازم تكون JPG أو PNG أو WebP");
      return;
    }
    /* حفظ مباشر: الصورة بتتصغّر على الجهاز بحيث أطول ضلع
       فيها 512px مع الحفاظ على أبعادها الأصلية، وبعدين
       بتتحفظ في الحساب على طول. */
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const cx = canvas.getContext("2d");
      if (!cx) {
        setAvatarError("الصورة دي مقدرناش نجهّزها — جرّب صورة تانية");
        return;
      }
      cx.drawImage(img, 0, 0, w, h);
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, 0.88);
      avatarMut.mutate({
        dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
        mimeType,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setAvatarError("الصورة دي مقدرناش نقراها — جرّب صورة تانية");
    };
    img.src = url;
  }

  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";

  return (
    <section className="animate-page pt-5 lg:pt-8">
      <h1 className="flex items-center gap-2.5 text-[26px] font-bold leading-snug">
        <span className="text-[var(--accent)]"><Icon d={I.user} size={24} /></span>
        حسابي
      </h1>

      <div className="mt-8">
        <GroupHead label="الملف الشخصي" hint="اسمك وبيانات حسابك الأساسية" />
      </div>
      <div className="elev-card mt-5 flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <AvatarFace user={user} displayName={displayName} size={64} textClass="text-[26px]" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[20px] font-bold">{displayName}</p>
          <p dir="ltr" className="mt-1 truncate text-left font-mono text-sm text-[var(--dim)]">{loginIdLabel(user)}</p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            عضو من {new Date(user.createdAt).toLocaleDateString("ar-EG")}
          </p>
          {/* الصورة الشخصية: بتتحفظ في حسابك وبتظهر مكان الحرف
              الأول في الهيدر وقائمة الحساب على أي جهاز تدخل منه. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label="اختيار صورة شخصية"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleAvatarFile(f);
              }}
            />
            <button
              type="button"
              aria-label={user.avatarUrl ? "تغيير الصورة الشخصية" : "إضافة صورة شخصية"}
              data-tip="الصورة بتتحفظ في حسابك وبتظهر على كل أجهزتك"
              disabled={avatarMut.isPending}
              onClick={() => avatarInputRef.current?.click()}
              className="lux-btn flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-bold text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-60"
            >
              <Icon d={I.camera} size={15} />
              {avatarMut.isPending ? "بتتحفظ…" : user.avatarUrl ? "تغيير الصورة" : "إضافة صورة شخصية"}
            </button>
            {user.avatarUrl && (
              <button
                type="button"
                aria-label="إزالة الصورة الشخصية"
                data-tip="هترجع لعرض الحرف الأول من اسمك"
                disabled={avatarRemoveMut.isPending}
                onClick={() => avatarRemoveMut.mutate()}
                className="lux-btn flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-60"
              >
                <Icon d={I.trash} size={15} />
                {avatarRemoveMut.isPending ? "بتتشال…" : "إزالة الصورة"}
              </button>
            )}
          </div>
          {avatarError && (
            <p role="alert" className="mt-2 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              {avatarError}
            </p>
          )}
        </div>
        <Logo size={52} />
      </div>

      {!user.name.trim() && (
        <p role="alert" className="mt-4 rounded-[var(--radius)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold leading-relaxed">
          اسمك لسه مش مضاف — عشان كده بيظهر بريدك أو رقم موبايلك فوق مؤقتاً. اكتب اسمك هنا وهيظهر مكانه في كل الموقع.
        </p>
      )}

      <div className="mt-9">
        <GroupHead label="بيانات الدخول" hint="الاسم والبريد اللي بتدخل بيهم" />
      </div>
      <div className="elev-card mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="font-bold">الاسم الظاهر</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          الاسم ده بيظهر فوق في أعلى الموقع وفي بطاقة حسابك أول ما تسجّل دخولك.
        </p>
        <div className="mt-3 flex gap-2">
          <span className="relative flex-1" data-tip="اكتب اسمك الظاهر الجديد">
            <input
              {...FIELDS.updateProfile.name}
              aria-label="الاسم الظاهر"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: إبراهيم صبحي"
              className={field}
            />
          </span>
          <button
            type="button"
            aria-label="حفظ الاسم"
            data-tip="حفظ الاسم الجديد"
            onClick={() => {
              if (name.trim().length < 2) {
                setNameError("الاسم لازم يكون حرفين على الأقل — الاسم الفاضي مش بيتحفظ");
                return;
              }
              setNameError(null);
              nameMut.mutate();
            }}
            disabled={nameMut.isPending || name.trim() === user.name.trim()}
            className="lux-btn shrink-0 rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)] disabled:opacity-50"
          >
            {nameMut.isPending ? "بيتحفظ…" : "حفظ"}
          </button>
        </div>
        {nameError && (
          <p role="alert" className="mt-2 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {nameError}
          </p>
        )}
      </div>

      <div className="elev-card mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="font-bold">البريد الإلكتروني للدخول</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {user.email
            ? "ده البريد اللي بتسجّل دخولك بيه (جنب رقم موبايلك لو موجود). تقدر تغيّره من هنا."
            : "حسابك اتعمل برقم الموبايل بس. ضيف بريد إلكتروني وهتقدر تسجّل دخولك بيه كمان."}
        </p>
        <div className="mt-3 flex gap-2">
          <span className="relative flex-1" data-tip="بريدك الإلكتروني لتسجيل الدخول">
            <input
              {...FIELDS.setEmail.email}
              aria-label="البريد الإلكتروني للدخول"
              dir="ltr"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              className={`${field} text-left font-mono`}
            />
          </span>
          <button
            type="button"
            aria-label="حفظ البريد الإلكتروني"
            data-tip="حفظ البريد — هيبقى طريقة دخول لحسابك"
            onClick={() => emailMut.mutate()}
            disabled={emailMut.isPending || email.trim().toLowerCase() === (user.email ?? "")}
            className="lux-btn shrink-0 rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)] disabled:opacity-50"
          >
            {emailMut.isPending ? "بيتحفظ…" : "حفظ"}
          </button>
        </div>
        {emailError && (
          <p role="alert" className="mt-2 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {emailError}
          </p>
        )}
        {user.phone && (
          <p className="mt-2 text-xs text-[var(--dim)]">
            رقم موبايلك المسجل:{" "}
            <span dir="ltr" className="font-mono font-semibold">{user.phone}</span> — ولسه شغال
            كطريقة دخول زي ما هو.
          </p>
        )}
      </div>

      <div className="mt-9">
        <GroupHead label="الأمان" hint="كلمة المرور والجلسات" />
      </div>
      <div className="elev-card mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="font-bold">الأمان والجلسات</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          جلستك دائمة وبتتجدد لوحدها على الجهاز ده. غيّر كلمة المرور أو اخرج من كل الأجهزة من الإعدادات الكاملة.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            aria-label="فتح إعدادات الحساب الكاملة"
            data-tip="تغيير كلمة المرور وكل إعدادات الحساب"
            onClick={onOpenFull}
            className="lux-btn lux-row flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-3 font-bold hover:border-[var(--border-strong)]"
          >
            <Icon d={I.lock} size={18} />
            إعدادات الحساب الكاملة — كلمة المرور
          </button>
          <button
            type="button"
            aria-label="تسجيل الخروج من حسابي"
            data-tip="تسجيل الخروج من الجهاز ده بس"
            onClick={onLogout}
            className="lux-btn flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--danger-soft)] py-3 font-semibold text-[var(--danger)] hover:brightness-95"
          >
            <Icon d={I.logout} size={18} />
            تسجيل الخروج
          </button>
          <button
            type="button"
            aria-label="تسجيل الخروج من كل الأجهزة"
            data-tip="تسجيل الخروج من كل الأجهزة مرة واحدة"
            disabled={logoutAllMut.isPending}
            onClick={() => {
              if (confirmAllOut) {
                logoutAllMut.mutate();
              } else {
                setConfirmAllOut(true);
                window.setTimeout(() => setConfirmAllOut(false), 4000);
              }
            }}
            className={`lux-btn flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border py-3 font-semibold disabled:opacity-60 ${
              confirmAllOut
                ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            <Icon d={I.devices} size={18} />
            {logoutAllMut.isPending
              ? "بيخرج من كل الأجهزة…"
              : confirmAllOut
                ? "متأكد؟ هيخرج حسابك من كل الأجهزة"
                : "تسجيل الخروج من كل الأجهزة"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- account modal ---------- */
function AccountModal({
  token,
  user,
  onClose,
  onLogout,
  showToast,
}: {
  token: string;
  user: User;
  onClose: () => void;
  onLogout: () => void;
  showToast: (msg: string, kind?: ToastKind) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [confirmAllOut, setConfirmAllOut] = useState(false);
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  const logoutAllMut = useMutation({
    mutationFn: async () => await api.logoutAll({ token }),
    onSuccess: () => onLogout(),
    onError: () => onLogout(),
  });

  const nameMut = useMutation({
    mutationFn: async () => await api.updateProfile({ token, name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", token] });
      showToast("اتحدّث الاسم");
    },
    onError: () => showToast("التحديث متمّش — حاول تاني", "error"),
  });

  const pwMut = useMutation({
    mutationFn: async () =>
      await api.changePassword({
        token,
        currentPassword: currentPw,
        newPassword: newPw,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setPwOk(true);
        setPwMsg("اتغيّرت كلمة المرور بنجاح");
        setCurrentPw("");
        setNewPw("");
      } else {
        setPwOk(false);
        setPwMsg(res.error ?? "حصلت مشكلة — حاول تاني");
      }
    },
    onError: () => {
      setPwOk(false);
      setPwMsg("حصلت مشكلة — حاول تاني");
    },
  });

  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";

  return (
    <div
      ref={dialogRef}
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="حسابي"
      onClick={onClose}
    >
      <div
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold">
            <AvatarFace user={user} displayName={user.name.trim() || "؟"} size={40} />
            حسابي
          </h2>
          <button
            type="button"
            aria-label="قفل حسابي" data-tip="قفل" data-tip-pos="below"
            onClick={onClose}
            className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]"
          >
            <Icon d={I.x} size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm">
          {user.email && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--dim)]">البريد الإلكتروني (للدخول)</span>
              <span dir="ltr" className="truncate font-mono font-bold">{user.email}</span>
            </div>
          )}
          {user.phone && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[var(--dim)]">رقم الموبايل (للدخول)</span>
              <span dir="ltr" className="font-mono font-bold">{user.phone}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[var(--dim)]">عضو من</span>
            <span className="font-bold">
              {new Date(user.createdAt).toLocaleDateString("ar-EG")}
            </span>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 border-t border-[var(--border)] pt-2.5 text-xs leading-relaxed text-[var(--dim)]">
            <Icon d={I.shield} size={16} />
            اختصاراتك محفوظة في حسابك ده بس، ومفيش أي حساب تاني يقدر يشوفها أو يعدّل عليها.
          </p>
        </div>

        <div className="mt-5">
          <h3 className="font-semibold">الاسم الظاهر</h3>
          <div className="mt-2 flex gap-2">
            <span className="relative flex-1" data-tip="اكتب اسمك الظاهر الجديد">
            <input
              {...FIELDS.updateProfile.name}
              aria-label="الاسم الظاهر"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
            </span>
            <button
              type="button"
              aria-label="حفظ الاسم" data-tip="حفظ الاسم الجديد"
              onClick={() => {
                if (name.trim().length < 2) {
                  setNameMsg("الاسم لازم يكون حرفين على الأقل — الاسم الفاضي مش بيتحفظ");
                  return;
                }
                setNameMsg(null);
                nameMut.mutate();
              }}
              disabled={nameMut.isPending || name.trim() === user.name}
              className="lux-btn shrink-0 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2.5 font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)] disabled:opacity-50"
            >
              {nameMut.isPending ? "بيتحفظ…" : "حفظ"}
            </button>
          </div>
          {nameMsg && (
            <p role="alert" className="mt-2 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              {nameMsg}
            </p>
          )}
        </div>

        <div className="mt-5">
          <h3 className="font-semibold">تغيير كلمة المرور</h3>
          <div className="mt-2 flex flex-col gap-2.5">
            <span className="block" data-tip="كلمة المرور اللي بتستخدمها دلوقتي">
            <input
              {...FIELDS.changePassword.currentPassword}
              aria-label="كلمة المرور الحالية"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="كلمة المرور الحالية"
              className={field}
            />
            </span>
            <span className="block" data-tip="كلمة المرور الجديدة — أي طول تختاره">
            <input
              {...FIELDS.changePassword.newPassword}
              aria-label="كلمة المرور الجديدة"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="الجديدة — أي طول تختاره"
              className={field}
            />
            </span>
            {pwMsg && (
              <p
                role="alert"
                className={`rounded-[var(--radius)] px-3 py-2 text-sm font-semibold ${
                  pwOk
                    ? "bg-[var(--surface-alt)] text-[var(--text)]"
                    : "bg-[var(--danger-soft)] text-[var(--danger)]"
                }`}
              >
                {pwMsg}
              </p>
            )}
            <button
              type="button"
              aria-label="تغيير كلمة المرور" data-tip="تغيير كلمة المرور لحسابك"
              onClick={() => {
                if (!currentPw) return setPwMsg("اكتب كلمة المرور الحالية"), setPwOk(false);
                if (!newPw)
                  return setPwMsg("اكتب كلمة المرور الجديدة"), setPwOk(false);
                setPwMsg(null);
                pwMut.mutate();
              }}
              disabled={pwMut.isPending}
              className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-2.5 font-bold hover:border-[var(--border-strong)] disabled:opacity-60"
            >
              {pwMut.isPending ? "بيتغيّر…" : "تغيير كلمة المرور"}
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="تسجيل الخروج من حسابي" data-tip="تسجيل الخروج من الجهاز ده بس"
          onClick={onLogout}
          className="lux-btn mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--danger-soft)] py-3 font-semibold text-[var(--danger)] hover:brightness-95"
        >
          <Icon d={I.logout} size={18} />
          تسجيل الخروج
        </button>
        <button
          type="button"
          aria-label="تسجيل الخروج من كل الأجهزة" data-tip="تسجيل الخروج من كل الأجهزة مرة واحدة"
          disabled={logoutAllMut.isPending}
          onClick={() => {
            if (confirmAllOut) {
              logoutAllMut.mutate();
            } else {
              setConfirmAllOut(true);
              window.setTimeout(() => setConfirmAllOut(false), 4000);
            }
          }}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border py-3 font-semibold disabled:opacity-60 ${
            confirmAllOut
              ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          }`}
        >
          <Icon d={I.devices} size={18} />
          {logoutAllMut.isPending
            ? "بيخرج من كل الأجهزة…"
            : confirmAllOut
              ? "متأكد؟ هيخرج حسابك من كل الأجهزة"
              : "تسجيل الخروج من كل الأجهزة"}
        </button>
        <p className="mt-2 pb-2 text-center text-xs leading-relaxed text-[var(--dim)]">
          جلستك على الجهاز ده دائمة وبتتجدد لوحدها — الخروج من كل الأجهزة مفيد لو دخلت
          من جهاز مش بتاعك. اختصاراتك هتفضل محفوظة في حسابك في كل الأحوال.
        </p>
      </div>
    </div>
  );
}

/* ---------- shortcut card ---------- */
function ShortcutCard({
  item,
  density = "comfortable",
  enterDelay,
  highlight = "",
  selected,
  active,
  onSelect,
  onCopy,
  onPin,
  onFavorite,
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
  onMove,
  folders,
  folderCounts,
  dnd,
}: {
  item: Shortcut;
  density?: ListDensity;
  /* List entrance: a light per-item stagger (transform + opacity
     only, capped at eight steps) so a view's replies settle in one
     after another instead of flashing in at once. Undefined while
     searching — results must land instantly as the user types. */
  enterDelay?: number;
  highlight?: string;
  /* Marked state: the reply is ticked for a bulk move (selected)
     or its details panel is open (active) — either way the card
     wears the light .card-marked wash so it is always obvious
     which reply is marked and where the user is standing. */
  selected?: boolean;
  active?: boolean;
  onSelect?: () => void;
  onCopy: () => Promise<boolean>;
  onPin: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onMove?: (folderId: number | null) => void;
  folders?: FolderRowT[];
  folderCounts?: Map<number, number>;
  dnd?: {
    dragging: boolean;
    dropPos: "before" | "after" | null;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}) {
  const { lang, t } = useLang();
  const [dragArmedCard, setDragArmedCard] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  /* تموّج زر النسخ: دائرة تنطلق من نقطة المؤشر عند الضغط. */
  const [ripple, setRipple] = useState<{ x: number; y: number; size: number; id: number } | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  /* قائمة «⋯» على الموبايل: صف الأيقونات بيبقى مخفي وبيتفتح منها */
  const [menuOpen, setMenuOpen] = useState(false);
  const long = item.body.length > 220;
  const shown = expanded || !long ? item.body : item.body.slice(0, 220) + "…";

  const updated = new Date(item.updatedAt);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? ""
    : updated.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG", { day: "numeric", month: "short" });

  const iconBtn =
    "lux-btn rounded-full p-1.5 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]";

  const tags = parseTags(item.tags);
  /* v88: the card's identity tile — the reply's own folder glyph in
     the folder's colour when the folder is known, otherwise the
     category glyph. The tile is a real structural zone of the card
     (head / body / foot), not a decoration. */
  const cardFolder = folders?.find((f) => f.id === item.folderId) ?? null;
  const CatIcon = categoryMeta(item.category).icon;
  const doCopyClick = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const ok = await onCopy();
      if (!ok) return;
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } finally {
      setCopying(false);
    }
  };
  const grip = dnd ? (
    <span
      aria-hidden="true"
      data-tip={t("اسحب لإعادة الترتيب أو النقل لمجلد تاني")}
      className="tree-grip -ms-1 flex shrink-0 items-center self-stretch px-0.5 text-[var(--faint)]"
      onMouseDown={() => setDragArmedCard(true)}
      onMouseUp={() => setDragArmedCard(false)}
    >
      <Icon d={GripVertical} size={15} />
    </span>
  ) : null;

  /* The copy action — the one button this whole product exists
     for. On the comfortable/grid card it is a full-width bar
     (min 48px) seated at the card's bottom, under the strict
     hierarchy title → preview → meta → copy: tinted at rest, it
     fills with the accent gradient while its card is hovered or
     focused, ripples from the pointer on press, and morphs to
     the check + «اتنسخ» for 1.6s on success (the glass toast
     confirms it too). In the compact row it becomes the floating
     pill below. */
  const copyBtn = (
    <button
      type="button"
      aria-label={copied ? (lang === "en" ? `Copied reply ${item.title}` : `اتنسخ رد ${item.title}`) : lang === "en" ? `Copy reply ${item.title}` : `نسخ رد ${item.title}`}
      data-tip={copied ? t("اتنسخ — الصقه في أي شات") : t("نسخ الرد")}
      aria-live="polite"
      aria-busy={copying}
      disabled={copying}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setRipple({
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          size: Math.max(r.width, r.height) * 2.2,
          id: Date.now(),
        });
      }}
      onClick={doCopyClick}
      className={`copy-cta flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] px-5 text-[15px] font-bold ${copied ? "copy-cta-done" : ""}`}
    >
      {ripple && (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="copy-ripple"
          style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
          onAnimationEnd={() => setRipple(null)}
        />
      )}
      {copying ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {t("بيتنسخ…")}
        </>
      ) : copied ? (
        <>
          <span className="animate-copy-pop flex">
            <Icon d={I.check} size={17} />
          </span>
          {t("اتنسخ")}
        </>
      ) : (
        <>
          <Icon d={I.copy} size={17} />
          {t("نسخ الرد")}
        </>
      )}
    </button>
  );

  /* Compact density: copy is a crafted pill floating at the row's
     far edge — the premium primary treatment (gradient, top light
     line, soft shadow, sheen on hover) at a comfortable 44px
     height, in the exact same spot on every row, with air around
     it instead of a flat block welded to the card. The pin/edit
     ghosts stay with the title; copy stands on its own. */
  const copyStrip = (
    <div className="flex shrink-0 items-center pe-2 ps-0.5 sm:pe-3 sm:ps-1">
      <button
        type="button"
        aria-label={copied ? (lang === "en" ? `Copied reply ${item.title}` : `اتنسخ رد ${item.title}`) : lang === "en" ? `Copy reply ${item.title}` : `نسخ رد ${item.title}`}
        data-tip={copied ? t("اتنسخ — الصقه في أي شات") : t("نسخ الرد")}
        aria-live="polite"
        aria-busy={copying}
        disabled={copying}
        onClick={doCopyClick}
        className={`btn-lux flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-bold sm:px-5 ${copied ? "btn-lux-success" : ""}`}
      >
        {copying ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {t("بيتنسخ…")}
          </>
        ) : (
          <>
            <span className={`flex ${copied ? "animate-copy-pop" : ""}`}>
              <Icon d={copied ? I.check : I.copy} size={17} />
            </span>
            {copied ? t("اتنسخ") : t("نسخ")}
          </>
        )}
      </button>
    </div>
  );

  return (
    <li
      data-selected={selected || undefined}
      data-active={active || undefined}
      aria-current={active ? "true" : undefined}
      className={`group/card lux-card elev-card reply-card relative rounded-[var(--radius)] border bg-[var(--surface)] ${density === "grid" ? "h-full" : ""} ${selected || active ? "card-marked border-[var(--border-strong)]" : "border-[var(--border)]"} ${dnd?.dragging ? "card-dragging" : ""} ${enterDelay !== undefined ? "animate-rise" : ""}`}
      style={enterDelay !== undefined ? { animationDelay: `${enterDelay}ms` } : undefined}
      draggable={!!dnd && dragArmedCard}
      onDragStart={(e) => {
        if (!dnd) return;
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", item.title);
        } catch {
          /* the parent ref carries the payload */
        }
        dnd.onDragStart();
      }}
      onDragEnd={() => {
        setDragArmedCard(false);
        dnd?.onDragEnd();
      }}
      onDragOver={dnd?.onDragOver}
      onDrop={dnd?.onDrop}
    >
      {dnd?.dropPos === "before" && <span aria-hidden="true" className="tree-drop-line" style={{ top: -7 }} />}
      {dnd?.dropPos === "after" && <span aria-hidden="true" className="tree-drop-line" style={{ bottom: -7 }} />}
      {density === "compact" ? (
        <div className="flex items-stretch">
          {/* Content zone: grip, title + preview, then the two quiet
              secondary actions — everything readable and tappable
              stays together, and copy owns the edge on its own. */}
          <div className="compact-zone flex min-w-0 flex-1 items-center gap-0.5 px-2 py-2 sm:gap-1 sm:px-3">
            {grip}
            <span aria-hidden="true" className={`card-tile card-tile-sm ${cardFolder ? folderColorClass(cardFolder) : "card-tile-cat"}`} style={cardFolder ? folderColorStyle(cardFolder) : undefined}>
              {cardFolder ? <FolderGlyph folder={cardFolder} size={16} /> : <Icon d={CatIcon} size={16} />}
            </span>
            <button
              type="button"
              aria-label={lang === "en" ? `Details of reply ${item.title}` : `تفاصيل رد ${item.title}`}
              data-tip={lang === "en" ? "Open reply details — full text, dates and all actions" : "فتح تفاصيل الرد — النص كامل والتواريخ وكل الإجراءات"}
              onClick={onSelect}
              className="lux-btn min-w-0 flex-1 rounded-[6px] px-1.5 py-1 text-start"
            >
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-bold">
                  <HighlightText text={item.title} query={highlight} />
                </span>
                {item.pinned && (
                  <span className="flex shrink-0 text-[var(--accent)]">
                    <Icon d={I.pin} size={13} />
                  </span>
                )}
                {item.favorite && (
                  <span className="flex shrink-0 text-[var(--favorite)]">
                    <Icon d={I.star} size={13} />
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-[var(--dim)]">
                <HighlightText
                  text={
                    highlight
                      ? snippetAround(item.body, highlight, 42)
                      : item.body.replace(/\s+/g, " ").slice(0, 90)
                  }
                  query={highlight}
                />
              </span>
            </button>
            <button
              type="button"
              aria-label={item.pinned ? (lang === "en" ? `Unpin ${item.title}` : `إلغاء تثبيت ${item.title}`) : lang === "en" ? `Pin ${item.title}` : `تثبيت ${item.title}`}
              data-tip={item.pinned ? t("إلغاء التثبيت") : t("تثبيت في الأعلى")}
              aria-pressed={item.pinned}
              onClick={onPin}
              className={`lux-btn shrink-0 rounded-full p-2.5 ${item.pinned ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"}`}
            >
              <Icon d={I.pin} size={16} />
            </button>
            <button
              type="button"
              aria-label={item.favorite ? (lang === "en" ? `Remove ${item.title} from favorites` : `إزالة ${item.title} من المفضلة`) : lang === "en" ? `Add ${item.title} to favorites` : `إضافة ${item.title} للمفضلة`}
              data-tip={item.favorite ? t("إزالة من المفضلة") : t("إضافة للمفضلة")}
              aria-pressed={item.favorite}
              onClick={onFavorite}
              className={`lux-btn shrink-0 rounded-full p-2.5 ${item.favorite ? "bg-[var(--favorite-soft)] text-[var(--favorite)]" : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"}`}
            >
              <Icon d={I.star} size={16} />
            </button>
            <button
              type="button"
              aria-label={lang === "en" ? `Edit ${item.title}` : `تعديل ${item.title}`}
              data-tip={t("تعديل")}
              onClick={onEdit}
              className="lux-btn shrink-0 rounded-full p-2.5 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
            >
              <Icon d={I.edit} size={16} />
            </button>
            {onMove && folders && (
              <MoveToFolderButton
                folders={folders}
                counts={folderCounts}
                currentFolderId={item.folderId ?? null}
                onMove={onMove}
                subject={item.title}
                triggerClassName="p-2.5 shrink-0"
                iconPx={16}
              />
            )}
          </div>
          {copyStrip}
        </div>
      ) : (
      <div className={density === "grid" ? "flex h-full flex-col p-5 sm:p-6" : "flex flex-col p-5 sm:p-6"}>
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-[9rem] flex-1 items-start gap-2.5">
              {grip}
              <span aria-hidden="true" className={`card-tile ${cardFolder ? folderColorClass(cardFolder) : "card-tile-cat"}`} style={cardFolder ? folderColorStyle(cardFolder) : undefined}>
                {cardFolder ? <FolderGlyph folder={cardFolder} size={19} /> : <Icon d={CatIcon} size={19} />}
              </span>
              <div className="flex min-w-0 items-center gap-1.5 pt-[9px]">
                <h3 className="text-[17px] font-semibold leading-snug">
                  <button
                    type="button"
                    aria-label={lang === "en" ? `Details of reply ${item.title}` : `تفاصيل رد ${item.title}`}
                    data-tip={t("فتح تفاصيل الرد")}
                    onClick={onSelect}
                    className="lux-btn rounded-[4px] text-start hover:text-[var(--accent-strong)]"
                  >
                    <HighlightText text={item.title} query={highlight} />
                  </button>
                </h3>
                {/* الحالة كأيقونات فقط بجانب العنوان: دبوس للمثبّت
                    ونجمة ذهبية للمفضّل — مستقلتان تمامًا. */}
                {item.pinned && (
                  <span role="img" aria-label={t("مثبّت في الأعلى")} data-tip={t("مثبّت في الأعلى")} className="flex shrink-0 text-[var(--accent)]">
                    <Icon d={I.pin} size={15} />
                  </span>
                )}
                {item.favorite && (
                  <span role="img" aria-label={lang === "en" ? "Favorite" : "مفضّل"} data-tip={lang === "en" ? "Favorite" : "مفضّل"} className="flex shrink-0 text-[var(--favorite)]">
                    <Icon d={I.star} size={15} />
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label={lang === "en" ? `More actions for ${item.title}` : `إجراءات إضافية لرد ${item.title}`}
              data-tip={t("كل الإجراءات")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="card-menu-btn lux-btn shrink-0 items-center justify-center rounded-full p-2.5 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
            >
              <Icon d={MoreHorizontal} size={18} />
            </button>
            <div className={`card-actions flex shrink-0 gap-0.5 ${menuOpen ? "card-actions-open" : ""}`}>
              <button
                type="button"
                aria-label={lang === "en" ? `Quick preview of ${item.title}` : `معاينة سريعة لرد ${item.title}`} data-tip={t("معاينة سريعة")}
                onClick={onPreview}
                className={iconBtn}
              >
                <Icon d={I.eye} size={18} />
              </button>
              <button
                type="button"
                aria-label={item.pinned ? (lang === "en" ? `Unpin ${item.title}` : `إلغاء تثبيت ${item.title}`) : lang === "en" ? `Pin ${item.title}` : `تثبيت ${item.title}`} data-tip={item.pinned ? t("إلغاء التثبيت") : t("تثبيت في الأعلى")}
                aria-pressed={item.pinned}
                onClick={onPin}
                className={`lux-btn rounded-full p-1.5 ${item.pinned ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"}`}
              >
                <Icon d={I.pin} size={18} />
              </button>
              <button
                type="button"
                aria-label={item.favorite ? (lang === "en" ? `Remove ${item.title} from favorites` : `إزالة ${item.title} من المفضلة`) : lang === "en" ? `Add ${item.title} to favorites` : `إضافة ${item.title} للمفضلة`} data-tip={item.favorite ? t("إزالة من المفضلة") : t("إضافة للمفضلة")}
                aria-pressed={item.favorite}
                onClick={onFavorite}
                className={`lux-btn rounded-full p-1.5 ${item.favorite ? "bg-[var(--favorite-soft)] text-[var(--favorite)]" : "text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"}`}
              >
                <Icon d={I.star} size={18} />
              </button>
              <button
                type="button"
                aria-label={lang === "en" ? `Edit ${item.title}` : `تعديل ${item.title}`} data-tip={t("تعديل")}
                onClick={onEdit}
                className={iconBtn}
              >
                <Icon d={I.edit} size={18} />
              </button>
              <button
                type="button"
                aria-label={lang === "en" ? `Duplicate ${item.title}` : `تكرار ${item.title}`} data-tip={t("تكرار الرد")}
                onClick={onDuplicate}
                className={iconBtn}
              >
                <Icon d={I.dup} size={18} />
              </button>
              {onMove && folders && (
                <MoveToFolderButton
                  folders={folders}
                  counts={folderCounts}
                  currentFolderId={item.folderId ?? null}
                  onMove={onMove}
                  subject={item.title}
                />
              )}
              <button
                type="button"
                aria-label={confirmingDelete ? (lang === "en" ? `Confirm deleting ${item.title}` : `تأكيد حذف ${item.title}`) : lang === "en" ? `Delete ${item.title}` : `حذف ${item.title}`} data-tip={confirmingDelete ? t("دوس تاني لتأكيد الحذف") : t("حذف")}
                onClick={() => {
                  if (confirmingDelete) {
                    onDelete();
                  } else {
                    setConfirmingDelete(true);
                    window.setTimeout(() => setConfirmingDelete(false), 3000);
                  }
                }}
                className={`lux-btn rounded-full p-1.5 ${confirmingDelete ? "bg-[var(--danger-soft)] font-bold text-[var(--danger)]" : "text-[var(--dim)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"}`}
              >
                {confirmingDelete ? (
                  <span className="px-1 text-xs font-semibold">{t("متأكد؟")}</span>
                ) : (
                  <Icon d={I.trash} size={18} />
                )}
              </button>
            </div>
          </div>
      {/* Strict hierarchy: title → 3-line preview → one quiet meta
          line → the full-width copy bar at the bottom. In the grid
          the copy bar pins to the bottom (mt-auto) so every card in
          a row is the same height with its button on the same line. */}
      {highlight ? (
        <p className={`mt-2 text-[14.5px] leading-[1.75] text-[var(--dim)] ${density === "grid" ? "clamp-3" : ""}`}>
          <HighlightText text={snippetAround(item.body, highlight, 110)} query={highlight} />
        </p>
      ) : (
      <p className={`mt-2 whitespace-pre-wrap text-[14.5px] leading-[1.75] text-[var(--dim)] ${density === "grid" || !expanded ? "clamp-3" : ""}`}>
        {shown}
      </p>
      )}
      {long && !highlight && density !== "grid" && (
        <button
          type="button"
          aria-label={expanded ? (lang === "en" ? `Collapse reply ${item.title}` : `طي رد ${item.title}`) : lang === "en" ? `Show full reply ${item.title}` : `عرض رد ${item.title} كامل`} data-tip={expanded ? (lang === "en" ? "Collapse reply" : "طي الرد") : t("اعرض الرد كامل")}
          onClick={() => setExpanded((v) => !v)}
          className="lux-btn mt-1 self-start font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          {expanded ? t("اقفل") : t("اعرض الرد كامل")}
        </button>
      )}
          {/* One quiet meta line (STEP 2.2): plain text and dot
              separators only — no filled chips competing with the
              title and the copy bar. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-[var(--dim)]">
            <span className="font-bold">{item.category}</span>
            {tags.slice(0, 2).map((tg) => (
              <span key={tg}>
                <span aria-hidden="true" className="me-1.5 text-[var(--faint)]">·</span>
                {tg}
              </span>
            ))}
            {tags.length > 2 && <span className="font-semibold text-[var(--faint)]">+{tags.length - 2}</span>}
            {item.usageCount > 0 && <span><span aria-hidden="true" className="me-1.5 text-[var(--faint)]">·</span>{lang === "en" ? `Used ${item.usageCount} times` : `اتستخدم ${item.usageCount} مرة`}</span>}
            {updatedLabel && <span><span aria-hidden="true" className="me-1.5 text-[var(--faint)]">·</span>{relDateLabel(item.updatedAt, lang)}</span>}
          </div>
          <div className={density === "grid" ? "mt-auto pt-4" : "mt-4"}>
            {copyBtn}
          </div>
      </div>
      )}
    </li>
  );
}

/* ---------- rich text editor ----------
   A formatting layer over the plain-text body: toolbar buttons wrap the
   selection in markers (**عريض**, *مائل*, __تحته خط__), list buttons
   prefix lines, and variable chips insert dynamic placeholders at the
   cursor. A live preview renders exactly what the markers mean. The
   stored body stays plain text, so copy / AutoHotkey keep
   working unchanged. */
function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + before + placeholder + after);
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = value.slice(s, e) || placeholder;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };

  const insertAtCursor = (text: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    onChange(value.slice(0, s) + text + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + text.length, s + text.length);
    });
  };

  const prefixLines = (numbered: boolean) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
    let lineEnd = value.indexOf("\n", e);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const done = lines
      .map((l, i) => {
        const clean = l.replace(/^\s*(•\s+|\d+[.)]\s+)/, "");
        return numbered ? `${i + 1}. ${clean}` : `• ${clean}`;
      })
      .join("\n");
    onChange(value.slice(0, lineStart) + done + value.slice(lineEnd));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + done.length);
    });
  };

  const toolBtn =
    "lux-btn lux-row flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-bold text-[var(--dim)] hover:text-[var(--text)]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="أدوات تنسيق الرد">
        <button type="button" aria-label="نص عريض" data-tip="عريض بصيغة واتساب — بيظهر منسق لما يتلصق هناك" onClick={() => wrapSelection("*", "*", "نص عريض")} className={toolBtn}>
          <Icon d={I.bold} size={16} />
          عريض
        </button>
        <button type="button" aria-label="نص مائل" data-tip="مائل بصيغة واتساب — بيظهر منسق لما يتلصق هناك" onClick={() => wrapSelection("_", "_", "نص مائل")} className={toolBtn}>
          <Icon d={I.italic} size={16} />
          مائل
        </button>
        <button type="button" aria-label="نص تحته خط" data-tip="تحته خط — بيظهر في معاينة الموقع بس، لأن واتساب مفيهوش خط تحت النص" onClick={() => wrapSelection("__", "__", "نص مهم")} className={toolBtn}>
          <Icon d={I.underline} size={16} />
          تحته خط
        </button>
        <button type="button" aria-label="قائمة نقطية" data-tip="تحويل الأسطر المحددة إلى قائمة نقطية" onClick={() => prefixLines(false)} className={toolBtn}>
          <Icon d={I.list} size={16} />
          قائمة
        </button>
        <button type="button" aria-label="قائمة مرقمة" data-tip="تحويل الأسطر المحددة إلى قائمة مرقمة" onClick={() => prefixLines(true)} className={toolBtn}>
          <Icon d={I.listOrdered} size={16} />
          ترقيم
        </button>
        <button
          type="button"
          aria-label={showPreview ? "إخفاء المعاينة" : "إظهار المعاينة"}
          data-tip={showPreview ? "إخفاء معاينة التنسيق" : "معاينة الرد بالتنسيق قبل الحفظ"}
          aria-pressed={showPreview}
          onClick={() => setShowPreview((v) => !v)}
          className={`${toolBtn} ${showPreview ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
        >
          <Icon d={I.eye} size={16} />
          معاينة
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-xs font-bold text-[var(--dim)]">
          <Icon d={I.braces} size={14} />
          متغيرات ديناميكية:
        </span>
        {VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            aria-label={`إدراج متغير ${v.label}`}
            data-tip={v.tip}
            onClick={() => insertAtCursor(v.token)}
            className="lux-btn rounded-[4px] bg-[var(--cyan-soft)] px-2 py-1 font-mono text-xs font-bold text-[var(--cyan)] hover:brightness-110"
          >
            {v.token}
          </button>
        ))}
      </div>

      <textarea
        {...FIELDS.createShortcut.body}
        ref={taRef}
        aria-label="نص الرد"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={9}
        placeholder="النص الكامل اللي هيتكتب لما تستخدم الاختصار…"
        className="mt-2.5 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base leading-relaxed outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--dim)]">{value.length} حرف</span>
        <span className="text-xs text-[var(--faint)]">
          العريض والمائل بصيغة واتساب وبيظهروا منسقين لما يتلصقوا هناك — و«تحته خط» بيظهر في معاينة الموقع بس.
        </span>
      </div>
      {showPreview && (
        <div className="animate-rise mt-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <p className="mb-2 text-xs font-bold text-[var(--dim)]">معاينة الرد بالتنسيق</p>
          {value.trim() ? (
            <RichPreview body={value} />
          ) : (
            <p className="text-sm text-[var(--dim)]">اكتب نص الرد الأول عشان تشوف المعاينة.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- starter templates ----------
   A light starting point inside the new-shortcut editor only — picking
   one fills the form with an editable draft; nothing is saved until the
   user presses حفظ. Deliberately not a separate templates section. */
const STARTER_TEMPLATES: Array<{
  label: string;
  title: string;
  category: string;
  body: string;
}> = [
  {
    label: "ترحيب بعميل جديد",
    title: "ترحيب بعميل جديد",
    category: "عام",
    body: "أهلاً بيك يا {الاسم} 🤍\nسعيدين جداً بتواصلك معانا — قولّي أقدر أساعدك في إيه النهاردة؟",
  },
  {
    label: "متابعة طلب",
    title: "متابعة طلب",
    category: "عام",
    body: "أهلاً يا {الاسم}،\nحبيت أطمنك إن طلبك بيتم تجهيزه دلوقتي، وأول ما يتحرك هنبعتلك التفاصيل على طول 🤍",
  },
  {
    label: "شكر بعد الشراء",
    title: "شكر بعد الشراء",
    category: "عام",
    body: "شكراً لثقتك فينا يا {الاسم} 🤍\nلو احتجت أي حاجة بعد كده إحنا موجودين في أي وقت.",
  },
  {
    label: "اعتذار عن التأخير",
    title: "اعتذار عن التأخير في الرد",
    category: "عام",
    body: "أنا آسف على التأخير في الرد يا {الاسم} 🙏\nراجعت طلبك ودي التفاصيل: ",
  },
  {
    label: "تأكيد موعد",
    title: "تأكيد موعد",
    category: "عام",
    body: "أهلاً يا {الاسم}،\nبنأكد معادنا يوم {التاريخ} الساعة {الوقت} — لو في أي تغيير قولّي قبلها 🤍",
  },
];

/* ---------- shared folder tree (every «move / place» surface) ----------
   One tree model and one row list behind every place a reply can
   be filed from — the editor's folder picker, the reply cards'
   move button, the details panel, the multi-select bar and the
   tree's right-click menu all render these exact rows: the
   folder's own icon, its name, its full path when nested, and how
   many replies already live in it, indented by depth in the same
   sibling order the sidebar shows (pinned first, then the user's
   manual order). One list, one behaviour, everywhere. */
function useFolderTree(folders: FolderRowT[]) {
  const byId = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders],
  );
  const pathOf = (f: FolderRowT): string => {
    const parts: string[] = [];
    let cur: FolderRowT | undefined = f;
    const guard = new Set<number>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parentId !== null ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" / ");
  };
  const ordered = useMemo(() => {
    const children = new Map<number | null, FolderRowT[]>();
    for (const f of folders) {
      const arr = children.get(f.parentId) ?? [];
      arr.push(f);
      children.set(f.parentId, arr);
    }
    for (const arr of children.values())
      arr.sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          a.sortOrder - b.sortOrder ||
          a.id - b.id,
      );
    const out: Array<{ folder: FolderRowT; depth: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      for (const f of children.get(parentId) ?? []) {
        out.push({ folder: f, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [folders]);
  return { byId, pathOf, ordered };
}

/* Click-outside + Escape dismissal for the small popovers in this
   block — the site's one dismissal standard. Escape is swallowed
   (capture) so a layer behind the popover never closes with it. */
function usePopoverDismiss(
  open: boolean,
  ref:
    | React.RefObject<HTMLElement | null>
    | Array<React.RefObject<HTMLElement | null>>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    /* A popover floated in a portal lives outside its trigger's
       subtree, so «inside» means inside ANY of the given roots —
       the trigger's and the floated panel's alike. */
    const roots = Array.isArray(ref) ? ref : [ref];
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (roots.some((r) => r.current?.contains(t))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, ref, close]);
}

/* The rows themselves: «بدون مجلد» (the top level) first, then
   every folder in tree order. `value` is the current folder —
   undefined marks nothing (a mixed multi-select), null marks the
   top level. `excludeIds` hides rows that must not be offered
   (a folder's own subtree when the folder itself is moving). */
function FolderTreeRows({
  folders,
  counts,
  value,
  onPick,
  excludeIds,
  query = "",
  rowRole,
}: {
  folders: FolderRowT[];
  counts?: Map<number, number>;
  value: number | null | undefined;
  onPick: (folderId: number | null) => void;
  excludeIds?: Set<number>;
  query?: string;
  rowRole?: "option" | "menuitem";
}) {
  const { pathOf, ordered } = useFolderTree(folders);
  const q = normalizeSearchText(query.trim());
  const visible = ordered.filter(({ folder }) => {
    if (excludeIds?.has(folder.id)) return false;
    if (!q) return true;
    return (
      normalizeSearchText(folder.name).includes(q) ||
      normalizeSearchText(pathOf(folder)).includes(q)
    );
  });
  const rowCls = (active: boolean) =>
    `folder-row lux-btn flex w-full items-center gap-2.5 px-3 py-2 text-start ${
      active
        ? "bg-[var(--surface-selected)] font-bold text-[var(--text)]"
        : "font-semibold text-[var(--dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
    }`;
  return (
    <>
      <button
        type="button"
        role={rowRole}
        aria-selected={rowRole === "option" ? value === null : undefined}
        aria-label="بدون مجلد — المستوى الرئيسي"
        onClick={() => onPick(null)}
        className={rowCls(value === null)}
        style={{ animationDelay: "0ms" }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--dim)]">
          <Icon d={I.home} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px]">بدون مجلد</span>
          <span className="block truncate text-xs font-medium text-[var(--faint)]">
            المستوى الرئيسي
          </span>
        </span>
        {value === null && (
          <span className="flex shrink-0 text-[var(--accent)]">
            <Icon d={I.check} size={17} />
          </span>
        )}
      </button>
      {visible.map(({ folder, depth }, i) => {
        const active = value !== undefined && value === folder.id;
        const count = counts?.get(folder.id) ?? 0;
        return (
          <button
            key={folder.id}
            type="button"
            role={rowRole}
            aria-selected={rowRole === "option" ? active : undefined}
            aria-label={`مجلد ${pathOf(folder)}`}
            onClick={() => onPick(folder.id)}
            className={rowCls(active)}
            style={{
              paddingInlineStart: `${12 + depth * 18}px`,
              animationDelay: `${Math.min((i + 1) * 25, 200)}ms`,
            }}
          >
            <span className="folder-bar-icon folder-bar-icon-sm">
              <FolderGlyph folder={folder} size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{folder.name}</span>
              <span className="block truncate text-xs font-medium text-[var(--faint)]">
                {folder.parentId !== null ? pathOf(folder) : "مجلد رئيسي"}
                {count > 0 ? ` · ${count} رد` : ""}
              </span>
            </span>
            {active && (
              <span className="flex shrink-0 text-[var(--accent)]">
                <Icon d={I.check} size={17} />
              </span>
            )}
          </button>
        );
      })}
      {q && visible.length === 0 && (
        <p className="px-3 py-4 text-center text-sm font-semibold text-[var(--dim)]">
          مفيش مجلد بالاسم ده
        </p>
      )}
    </>
  );
}

/* The popover panel: an Arabic-aware search box over the shared
   rows, in a scrolling card. Used by the editor picker and every
   move button, so the folder list looks and behaves identically
   wherever it opens. */
function FolderListPanel({
  folders,
  counts,
  value,
  onPick,
  excludeIds,
  withSearch = true,
}: {
  folders: FolderRowT[];
  counts?: Map<number, number>;
  value: number | null | undefined;
  onPick: (folderId: number | null) => void;
  excludeIds?: Set<number>;
  withSearch?: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <div className="animate-menu elev-pop overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)]">
      {withSearch && (
        <div className="border-b border-[var(--border)] p-2">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-[var(--faint)]">
              <Icon d={I.search} size={15} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="بحث في المجلدات"
              placeholder="دوّر على مجلد…"
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] py-2 pe-3 ps-8 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      )}
      <div
        role="listbox"
        aria-label="كل المجلدات"
        className="max-h-64 overflow-y-auto py-1.5"
      >
        <FolderTreeRows
          folders={folders}
          counts={counts}
          value={value}
          onPick={onPick}
          excludeIds={excludeIds}
          query={query}
          rowRole="option"
        />
      </div>
    </div>
  );
}

/* ---------- floating folder panel ----------
   The folder list, floated: rendered in a portal at the document
   root and positioned with `position: fixed` against the trigger's
   real on-screen rectangle — never as an absolutely-positioned
   child of its host. The hosts (reply cards, whose entrance
   animation leaves a transform behind; the scrolling details
   panel; modal sheets) each form their own stacking context or
   clipping box, so an in-flow dropdown gets painted over by the
   next card or sliced by the sheet's scroll edge — the breakage
   in «لما بدوس على نقل إلى مجلد آخر بيعمل كده». Placement: under
   the trigger when the space below fits it, flipped above when
   it doesn't; the inline-end edge tracks the trigger's, clamped
   inside the viewport with an 8px margin; and while open it
   re-measures on scroll (any scroller, capture phase) and on
   resize, so it stays glued to its trigger. */
function FloatingFolderPanel({
  anchorRef,
  panelRef,
  width,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  /* A fixed pixel width, or "anchor" to take the trigger's own
     width (the field variants). */
  width: number | "anchor";
  children: ReactNode;
}) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const w =
        width === "anchor" ? a.width : Math.min(width, window.innerWidth - 16);
      const h = panel.offsetHeight;
      const rtl = getComputedStyle(anchor).direction === "rtl";
      let left = rtl ? a.left : a.right - w;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const below = a.bottom + 6;
      const top =
        below + h <= window.innerHeight - 8 || a.top - 6 - h < 8
          ? Math.min(below, Math.max(8, window.innerHeight - h - 8))
          : a.top - 6 - h;
      setStyle({ position: "fixed", top, left, width: w, visibility: "visible" });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef, panelRef, width]);
  return createPortal(
    <div
      ref={panelRef}
      className="z-[var(--z-menu)]"
      style={
        style ?? {
          position: "fixed",
          top: 0,
          left: 0,
          width:
            typeof width === "number"
              ? Math.min(width, window.innerWidth - 16)
              : undefined,
          visibility: "hidden",
        }
      }
    >
      {children}
    </div>,
    document.body,
  );
}

/* ---------- move-to-folder button ----------
   The one move control, worn by the reply cards (both densities),
   the details panel and the multi-select bar: same icon, same
   panel, same tree — pick a folder and the reply is filed there
   immediately. Variants only change the trigger's clothes:
   icon (a quiet round button among the card actions), field (a
   full-width folder field, in the details panel) and bar (the
   multi-select strip's labelled button). */
function MoveToFolderButton({
  folders,
  counts,
  currentFolderId,
  onMove,
  variant = "icon",
  subject,
  triggerClassName,
  iconPx = 18,
}: {
  folders: FolderRowT[];
  counts?: Map<number, number>;
  currentFolderId?: number | null;
  onMove: (folderId: number | null) => void;
  variant?: "icon" | "field" | "bar";
  subject: string;
  /* The icon variant matches its host row's button metrics —
     comfortable cards use p-2/18px, the compact row p-2.5/16px. */
  triggerClassName?: string;
  iconPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(open, [rootRef, panelRef], () => setOpen(false));
  const { byId, pathOf } = useFolderTree(folders);
  const current =
    currentFolderId !== null && currentFolderId !== undefined
      ? byId.get(currentFolderId)
      : undefined;
  const pick = (id: number | null) => {
    setOpen(false);
    /* Picking the folder the reply already lives in is a no-op —
       but an undefined current (a mixed multi-select) never is. */
    if (currentFolderId === undefined || id !== currentFolderId) onMove(id);
  };
  return (
    <div
      ref={rootRef}
      className={
        variant === "icon"
          ? "relative"
          : variant === "bar"
            ? "relative min-w-0 flex-1"
            : "relative w-full"
      }
    >
      {variant === "icon" && (
        <button
          ref={anchorRef}
          type="button"
          aria-label={`نقل رد ${subject} إلى مجلد آخر`}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-tip="نقل إلى مجلد آخر"
          onClick={() => setOpen((v) => !v)}
          className={`move-icon-btn lux-btn rounded-full text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] ${triggerClassName ?? "p-2"}`}
        >
          <Icon d={I.moveTo} size={iconPx} />
        </button>
      )}
      {variant === "field" && (
        <button
          ref={anchorRef}
          type="button"
          aria-label={`نقل رد ${subject} إلى مجلد آخر`}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-tip="نقل الرد لمجلد تاني — بيتحفظ مكانه الجديد على طول"
          onClick={() => setOpen((v) => !v)}
          className="folder-field-btn lux-btn flex w-full items-center gap-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-start outline-none focus:border-[var(--accent)]"
        >
          <span className="folder-bar-icon folder-bar-icon-sm">
            {current ? <FolderGlyph folder={current} size={16} /> : <Icon d={I.home} size={16} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold leading-snug">
              {current ? current.name : "بدون مجلد"}
            </span>
            <span className="block truncate text-xs text-[var(--faint)]">
              {current
                ? current.parentId !== null
                  ? pathOf(current)
                  : "مجلد رئيسي"
                : "المستوى الرئيسي — مش جوه أي مجلد"}
            </span>
          </span>
          <span
            className={`flex shrink-0 text-[var(--faint)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <Icon d={I.chevron} size={17} />
          </span>
        </button>
      )}
      {variant === "bar" && (
        <button
          ref={anchorRef}
          type="button"
          aria-label="نقل الردود المحددة إلى مجلد"
          aria-haspopup="listbox"
          aria-expanded={open}
          data-tip="اختار مجلد عشان تنقل الردود المحددة كلها مرة واحدة"
          onClick={() => setOpen((v) => !v)}
          className="lux-btn flex w-full min-w-0 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-start text-[13px] font-semibold outline-none focus:border-[var(--accent)]"
        >
          <Icon d={I.moveTo} size={15} />
          <span className="flex-1 truncate">نقل إلى مجلد…</span>
          <span
            className={`flex shrink-0 text-[var(--faint)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <Icon d={I.chevron} size={14} />
          </span>
        </button>
      )}
      {open && (
        <FloatingFolderPanel
          anchorRef={anchorRef}
          panelRef={panelRef}
          width={variant === "field" ? "anchor" : 288}
        >
          <FolderListPanel
            folders={folders}
            counts={counts}
            value={currentFolderId}
            onPick={pick}
          />
        </FloatingFolderPanel>
      )}
    </div>
  );
}

/* ---------- folder picker (the editor's placement field) ----------
   The editor's تصنيف, rebuilt as a choice, not a typing field:
   the trigger shows where the reply will live (icon, name, full
   path), and the panel is the shared folder tree — every folder
   in the library, searchable — so the right folder is picked,
   never misspelled into existence. */
function FolderPicker({
  folders,
  counts,
  value,
  onChange,
}: {
  folders: FolderRowT[];
  counts: Map<number, number>;
  value: number | null;
  onChange: (folderId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(open, [rootRef, panelRef], () => setOpen(false));
  const { byId, pathOf } = useFolderTree(folders);
  const selected = value !== null ? byId.get(value) : undefined;
  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        aria-label="اختيار مجلد الرد"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-tip="المجلد اللي الرد هيتحفظ جواه"
        onClick={() => setOpen((v) => !v)}
        className="folder-field-btn lux-btn flex w-full items-center gap-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-start outline-none focus:border-[var(--accent)]"
      >
        <span className="folder-bar-icon folder-bar-icon-sm">
          {selected ? <FolderGlyph folder={selected} size={17} /> : <Icon d={I.home} size={17} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold leading-snug">
            {selected ? selected.name : "بدون مجلد"}
          </span>
          <span className="block truncate text-xs text-[var(--faint)]">
            {selected
              ? selected.parentId !== null
                ? pathOf(selected)
                : "مجلد رئيسي"
              : "المستوى الرئيسي — مش جوه أي مجلد"}
          </span>
        </span>
        <span
          className={`flex shrink-0 text-[var(--faint)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <Icon d={I.chevron} size={18} />
        </span>
      </button>
      {open && (
        <FloatingFolderPanel anchorRef={anchorRef} panelRef={panelRef} width="anchor">
          <FolderListPanel
            folders={folders}
            counts={counts}
            value={value}
            onPick={pick}
          />
        </FloatingFolderPanel>
      )}
    </div>
  );
}

/* ---------- editor modal ----------
   Organized the way the site itself thinks about a reply: first
   the reply (its name and its text), then its organization (the
   folder it lives in — picked from the whole folder tree, never
   typed — and the keywords search finds it by). The header and the
   save row stay fixed while the middle scrolls, so حفظ is always
   one glance away. */
function EditorModal({
  token,
  userId,
  item,
  folders,
  folderCounts,
  initialFolderId,
  initialTitle,
  onClose,
  onSaved,
}: {
  token: string;
  userId: number;
  item: Shortcut | null;
  folders: FolderRowT[];
  folderCounts: Map<number, number>;
  initialFolderId?: number | null;
  /* A name the user was just searching for when the search found
     nothing: the new-reply editor opens with it already typed, so
     creating the missing reply is one step, not a retype. */
  initialTitle?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  // Autosave: an unfinished NEW shortcut is kept as a draft on this
  // device (per account) and restored when the editor reopens, so a
  // closed tab or an accidental tap never loses typed work.
  const draftKey = `is-editor-draft-${userId}`;
  const [draft] = useState<{
    title: string;
    body: string;
    folderId: number | null;
    tags: string;
    extShortcut: string;
    source: string;
  } | null>(() => {
    if (item) return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;
      const d = parsed as Record<string, unknown>;
      const title = typeof d.title === "string" ? d.title : "";
      const body = typeof d.body === "string" ? d.body : "";
      const tags = typeof d.tags === "string" ? d.tags : "";
      const extShortcut = typeof d.extShortcut === "string" ? d.extShortcut : "";
      const source =
        typeof d.source === "string" &&
        (REPLY_SOURCES as readonly string[]).includes(d.source)
          ? d.source
          : "";
      /* New drafts store the folder id; older ones stored the
         category name — resolve it to the folder carrying it. */
      let folderId: number | null = null;
      if (typeof d.folderId === "number") folderId = d.folderId;
      else if (typeof d.category === "string")
        folderId = folders.find((f) => f.name === d.category)?.id ?? null;
      if (!title && !body) return null;
      return { title, body, folderId, tags, extShortcut, source };
    } catch {
      return null;
    }
  });
  const [title, setTitle] = useState(item?.title ?? draft?.title ?? initialTitle ?? "");
  const [body, setBody] = useState(item?.body ?? draft?.body ?? "");
  const [folderId, setFolderId] = useState<number | null>(
    item
      ? (item.folderId ?? null)
      : draft
        ? draft.folderId
        : (initialFolderId ?? null),
  );
  const [tags, setTags] = useState(item?.tags ?? draft?.tags ?? "");
  /* The external-shortcut note: the word the user registered for
     this reply in programs outside the site, shown here in the
     editor so he can see it at a glance. Record-keeping only —
     it never drives expansion or copying. */
  const [extShortcut, setExtShortcut] = useState(
    item?.extShortcut ?? draft?.extShortcut ?? "",
  );
  /* Where this reply originally came from — one of the fixed
     REPLY_SOURCES names, or "" when never recorded. Chosen from
     a list in «التنظيم والبحث», saved with the reply and shown
     back on every edit. */
  const [source, setSource] = useState(
    item?.source ?? draft?.source ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  /* Unsaved-changes guard: the snapshot the editor opened with.
     Clicking the backdrop (or X / إلغاء) closes instantly when
     nothing changed, and asks first when it would lose edits —
     the one case where click-outside must not silently dismiss. */
  const [initial] = useState(() => ({ title, body, folderId, tags, extShortcut, source }));
  /* The last snapshot that is actually saved in the library. The
     dirty check runs against it (not the open-time snapshot), so
     once autosave lands an edit, the editor is clean again and
     closing needs no warning. */
  const [savedSnap, setSavedSnap] = useState(initial);
  const dirty =
    title !== savedSnap.title ||
    body !== savedSnap.body ||
    folderId !== savedSnap.folderId ||
    tags !== savedSnap.tags ||
    extShortcut !== savedSnap.extShortcut ||
    source !== savedSnap.source;
  /* Autosave status for an existing reply: the indicator in the
     footer always says where the text stands — never a silent
     maybe. New replies keep the device-draft line above instead. */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /* Why autosave is currently held (blank title/body) — shown in
     the footer status line, never a silent skip. */
  const [titleError, setTitleError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardRef = useRef<HTMLDivElement>(null);
  /* The warning renders above the action row, possibly below the
     sheet's fold — bring it into view the moment it appears so the
     user actually sees why the sheet did not close. */
  useEffect(() => {
    if (confirmDiscard) discardRef.current?.scrollIntoView({ block: "nearest" });
  }, [confirmDiscard]);
  const attemptClose = () => {
    if (dirty && !saveMut.isPending) setConfirmDiscard(true);
    else onClose();
  };
  const discardAndClose = () => {
    if (!item) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
    }
    onClose();
  };
  useEscapeClose(attemptClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  useEffect(() => {
    if (item) return;
    if (!title.trim() && !body.trim()) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
      setDraftSaved(false);
      return;
    }
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ title, body, folderId, tags, extShortcut, source }),
        );
        setDraftSaved(true);
      } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(t);
  }, [item, draftKey, title, body, folderId, tags, extShortcut, source]);

  const applyTemplate = (idx: number) => {
    const tpl = STARTER_TEMPLATES[idx];
    if (!tpl) return;
    setTitle(tpl.title);
    setFolderId(folders.find((f) => f.name === tpl.category)?.id ?? null);
    setBody(tpl.body);
    setError(null);
  };

  const buildPayload = () => {
    const selectedFolder =
      folderId !== null
        ? folders.find((f) => f.id === folderId)
        : undefined;
    return {
      title: title.trim(),
      body,
      category: selectedFolder?.name ?? "عام",
      tags: tags.trim(),
      extShortcut: extShortcut.trim(),
      source: source as "" | (typeof REPLY_SOURCES)[number],
      folderId,
    };
  };

  /* Autosave for an existing reply: 1.5s after the typing settles,
     the edit lands in the library on its own and the footer says
     so. It never closes the editor and never fires on invalid text
     (blank title/body stay for the explicit حفظ + the guard). */
  const autosaveMut = useMutation({
    mutationFn: async (snap: { title: string; body: string; folderId: number | null; tags: string; extShortcut: string; source: string }) => {
      if (!item) return;
      const selectedFolder =
        snap.folderId !== null
          ? folders.find((f) => f.id === snap.folderId)
          : undefined;
      await api.updateShortcut({
        token,
        id: item.id,
        title: snap.title.trim(),
        body: snap.body,
        category: selectedFolder?.name ?? "عام",
        tags: snap.tags.trim(),
        extShortcut: snap.extShortcut.trim(),
        source: snap.source as "" | (typeof REPLY_SOURCES)[number],
        folderId: snap.folderId,
      });
    },
    onSuccess: (_res, snap) => {
      setSavedSnap(snap);
      setSaveState("saved");
      setSavedAt(
        new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" }),
      );
      queryClient.invalidateQueries({ queryKey: ["shortcuts", token] });
      queryClient.invalidateQueries({ queryKey: ["folders", token] });
    },
    onError: () => setSaveState("error"),
  });
  const autosaveMutRef = useRef(autosaveMut);
  autosaveMutRef.current = autosaveMut;
  useEffect(() => {
    if (!item || !dirty) {
      setTitleError(null);
      setBodyError(null);
      return;
    }
    if (!title.trim()) {
      setTitleError("اكتب اسم الرد عشان الحفظ التلقائي يشتغل");
      return;
    }
    setTitleError(null);
    if (!body.trim()) {
      setBodyError("اكتب نص الرد عشان الحفظ التلقائي يشتغل");
      return;
    }
    setBodyError(null);
    setSaveState("saving");
    const t = window.setTimeout(() => {
      autosaveMutRef.current.mutate({ title, body, folderId, tags, extShortcut, source });
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, dirty, title, body, folderId, tags, extShortcut, source]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      let shortcutId: number;
      if (item) {
        await api.updateShortcut({ token, id: item.id, ...payload });
        shortcutId = item.id;
      } else {
        const created = await api.createShortcut({ token, ...payload });
        shortcutId = created.shortcut.id;
      }
      return shortcutId;
    },
    onSuccess: () => {
      try {
        window.localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
      queryClient.invalidateQueries({ queryKey: ["shortcuts", token] });
      queryClient.invalidateQueries({ queryKey: ["folders", token] });
      onSaved();
    },
    onError: () => setError("الحفظ متمّش — حاول تاني"),
  });

  const submit = () => {
    if (!title.trim()) return setError("اكتب اسم الرد");
    if (!body.trim()) return setError("اكتب نص الرد اللي هيتحفظ في مكتبتك");
    setError(null);
    saveMut.mutate();
  };

  const field =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]";

  /* v80: every section and field in this dialog carries an
     expressive icon in the site's unified tile — the section
     head's tile is filled, the field labels' tiles are soft,
     so the dialog reads at a glance: what each part IS. */
  const sectionHead = (icon: LucideIcon, label: string) => (
    <p className="flex items-center gap-2.5 text-[13px] font-extrabold text-[var(--dim)]">
      <span className="editor-head-icon">
        <Icon d={icon} size={14} />
      </span>
      {label}
      <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
    </p>
  );
  const labelWithIcon = (icon: LucideIcon, text: React.ReactNode) => (
    <span className="mb-1 flex items-center gap-2 text-sm font-bold">
      <span className="editor-label-icon">
        <Icon d={icon} size={14} />
      </span>
      {text}
    </span>
  );

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={item ? "تعديل رد" : "رد جديد"}
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div
        className="animate-sheet elev-pop flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--radius)] glass-panel sm:rounded-[var(--radius)]"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold">
            <span className="editor-head-icon editor-head-icon-lg">
              <Icon d={I.edit} size={17} />
            </span>
            {item ? "تعديل رد" : "رد جديد"}
          </h2>
          <button type="button" aria-label="قفل" data-tip="قفل" data-tip-pos="below" onClick={attemptClose} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {!item && (
            <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-3">
              <p className="flex items-center gap-2 text-xs font-bold text-[var(--dim)]">
                <span className="editor-label-icon">
                  <Icon d={I.sparkles} size={14} />
                </span>
                ابدأ من قالب جاهز — بيملأ النموذج، وتقدر تعدّل قبل الحفظ:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STARTER_TEMPLATES.map((tpl, i) => (
                  <button
                    key={tpl.label}
                    type="button"
                    aria-label={`استخدام قالب ${tpl.label}`}
                    data-tip="بيملأ النموذج بقالب تقدر تعدّله قبل الحفظ"
                    onClick={() => applyTemplate(i)}
                    className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-bold text-[var(--dim)] hover:text-[var(--text)]"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!item && (draftSaved || draft) && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--dim)]" aria-live="polite">
              <Icon d={I.circleCheck} size={14} />
              {draft && !draftSaved
                ? "كمّلنا من مسودة محفوظة تلقائياً على جهازك"
                : "المسودة بتتحفظ تلقائياً على جهازك وانت بتكتب"}
            </p>
          )}

          <div className="mt-5">
            {sectionHead(I.file, "الرد")}
            <div className="mt-3 flex flex-col gap-3">
              <label className="block" data-tip="اسم يوصف الرد عشان تلاقيه بسرعة">
                {labelWithIcon(I.edit, "اسم الرد")}
                <input
                  {...FIELDS.createShortcut.title}
                  aria-label="اسم الرد"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: خطوات الدفع — فوري"
                  className={field}
                />
              </label>
              <div data-tip="نص الرد الكامل — نسّقه من شريط الأدوات اللي فوق">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                  <span className="editor-label-icon">
                    <Icon d={NotebookPen} size={14} />
                  </span>
                  نص الرد
                </span>
                <RichTextEditor value={body} onChange={setBody} />
                {extractVariables(body).length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--dim)]">
                    <span className="editor-label-icon">
                      <Icon d={I.braces} size={14} />
                    </span>
                    متغيرات هتتملى وقت النسخ:
                    {extractVariables(body).map((v) => (
                      <span key={v} className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 font-bold text-[var(--gold-bright)]">
                        {v}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            {sectionHead(I.search, "التنظيم والبحث")}
            <div className="mt-3 flex flex-col gap-3">
              <div>
                {labelWithIcon(I.folder, "المجلد")}
                <FolderPicker
                  folders={folders}
                  counts={folderCounts}
                  value={folderId}
                  onChange={setFolderId}
                />
                <span className="mt-1 block text-xs text-[var(--dim)]">
                  الرد هيظهر جوه المجلد ده في مكتبتك — اختار مكانه المناسب من كل مجلداتك.
                </span>
              </div>
              <label className="block" data-tip="كلمات بتساعد البحث يلاقي الرد حتى لو مش في اسمه — افصل بينها بفاصلة">
                {labelWithIcon(Tag, "كلمات مفتاحية (اختياري)")}
                <input
                  {...FIELDS.createShortcut.tags}
                  aria-label="الكلمات المفتاحية"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="مثال: فوري، كود الدفع، تفعيل"
                  className={field}
                />
                <span className="mt-1 block text-xs text-[var(--dim)]">
                  البحث بيدوّر في الكلمات دي كمان — اكتب الكلمات اللي ممكن تدوّر بيها على الرد ده.
                </span>
              </label>
              <div className="block" data-tip="المكان اللي الرد ده جاي منه أصلاً">
                {labelWithIcon(Globe, "المصدر (اختياري)")}
                {/* The source is picked from the branded menu —
                    every source with its REAL logo beside its name
                    (the same FolderSourceControl the folders use),
                    never a plain-text native select. */}
                <FolderSourceControl
                  value={source}
                  onPick={setSource}
                  lang="ar"
                  variant="field"
                  ariaLabel="مصدر الرد"
                  menuLabel="اختيار مصدر الرد"
                  tip="المكان اللي الرد ده جاي منه أصلاً"
                  note={null}
                  dropUp={false}
                />
                <span className="mt-1 block text-xs text-[var(--dim)]">
                  اختار المكان اللي الرد ده جاي منه — بيتحفظ مع الرد وبيظهر لك كل ما تفتحه للتعديل.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {sectionHead(I.keyboard, "الاختصار الخارجي")}
            <div className="mt-3">
              <label className="block">
                {labelWithIcon(I.keyboard, "اختصار الرد في البرامج اللي برة (اختياري)")}
                <input
                  {...FIELDS.createShortcut.extShortcut}
                  aria-label="اختصار الرد في البرامج الخارجية"
                  dir="ltr"
                  value={extShortcut}
                  onChange={(e) => setExtShortcut(e.target.value)}
                  placeholder=";salam"
                  className={`${field} text-left font-mono`}
                />
                <span className="mt-1 block text-xs text-[var(--dim)]">
                  لو مسجّل الرد ده باختصار في برنامج برة الموقع، اكتبه هنا عشان تفتكره كل ما تفتح الرد — الخانة دي للتذكير بس، ومش بتأثر على النسخ من هنا.
                </span>
              </label>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              {error}
            </p>
          )}
          {confirmDiscard && (
            <div ref={discardRef} role="alert" className="animate-rise mt-4 rounded-[var(--radius)] bg-[var(--warning-soft)] px-3.5 py-3">
              <p className="text-sm font-bold">عندك تعديلات لسه ما اتحفظتش في المكتبة</p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--dim)]">لو قفلت دلوقتي التعديلات دي هتضيع. تقفل من غير حفظ؟</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  aria-label="تجاهل التعديلات وقفل المحرر"
                  data-tip="قفل وخسارة التعديلات غير المحفوظة"
                  onClick={discardAndClose}
                  className="lux-btn rounded-[var(--radius)] bg-[var(--danger)] px-4 py-2 text-[13px] font-bold text-white"
                >
                  تجاهل التعديلات وقفل
                </button>
                <button
                  type="button"
                  aria-label="كمّل تحرير"
                  data-tip="رجوع للمحرر وكمل شغلك"
                  onClick={() => setConfirmDiscard(false)}
                  className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-bold hover:border-[var(--border-strong)]"
                >
                  كمّل تحرير
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-[var(--border)] px-5 py-3.5">
          {item && (
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--dim)]" aria-live="polite">
              {(titleError ?? bodyError) ? (
                <span className="text-[var(--warning)]">{titleError ?? bodyError}</span>
              ) : saveState === "saving" || autosaveMut.isPending ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  بيتحفظ تلقائياً…
                </>
              ) : saveState === "saved" ? (
                <>
                  <Icon d={I.circleCheck} size={14} />
                  اتحفظ تلقائياً{savedAt ? ` · ${savedAt}` : ""} — تعديلاتك في المكتبة خلاص
                </>
              ) : saveState === "error" ? (
                <span className="text-[var(--danger)]">الحفظ التلقائي متمّش — دوس «حفظ» أو ما تقفلش لحد ما يتحفظ</span>
              ) : dirty ? (
                <>فيه تعديلات لسه ما اتحفظتش — هتتحفظ تلقائياً وانت واقف</>
              ) : (
                <>
                  <Icon d={I.circleCheck} size={14} />
                  كل التعديلات محفوظة في المكتبة
                </>
              )}
            </p>
          )}
          <div className="flex gap-2">
          <button
            type="button"
            aria-label="حفظ الرد" data-tip="حفظ الرد في مكتبتك"
            onClick={submit}
            disabled={saveMut.isPending}
            className="lux-btn flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)] disabled:opacity-60"
          >
            <Icon d={I.check} size={18} />
            {saveMut.isPending ? "بيتحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            aria-label="إلغاء"
            data-tip="إلغاء والرجوع من غير حفظ"
            data-tip-align="end"
            onClick={attemptClose}
            className="lux-btn lux-row flex items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            <Icon d={I.x} size={17} />
            إلغاء
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- bulk import modal ---------- */
type BulkItem = { title: string; body: string; category: string };

function parseBulk(text: string): { items: BulkItem[]; errors: number } {
  const trimmed = text.trim();
  if (!trimmed) return { items: [], errors: 0 };
  if (trimmed.startsWith("[")) {
    try {
      const arr: unknown = JSON.parse(trimmed);
      if (!Array.isArray(arr)) return { items: [], errors: 1 };
      const items: BulkItem[] = [];
      let errors = 0;
      for (const x of arr) {
        if (
          typeof x === "object" &&
          x !== null &&
          typeof (x as { body?: unknown }).body === "string"
        ) {
          const o = x as { title?: unknown; body: string; category?: unknown };
          const title = typeof o.title === "string" && o.title ? o.title : "";
          if (!title) {
            errors += 1;
            continue;
          }
          items.push({
            title,
            body: o.body,
            category: typeof o.category === "string" && o.category ? o.category : "عام",
          });
        } else {
          errors += 1;
        }
      }
      return { items, errors };
    } catch {
      return { items: [], errors: 1 };
    }
  }
  const blocks = trimmed.split(/^\s*---\s*$/m);
  const items: BulkItem[] = [];
  let errors = 0;
  for (const block of blocks) {
    const lines = block.split("\n");
    const firstIdx = lines.findIndex((l) => l.trim().length > 0);
    if (firstIdx === -1) continue;
    const rest = lines.slice(firstIdx);
    const title = (rest[0] ?? "").trim();
    const body = rest.slice(1).join("\n").trim();
    if (!title || !body) {
      errors += 1;
      continue;
    }
    items.push({ title, body, category: "عام" });
  }
  return { items, errors };
}

function BulkModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (items: BulkItem[]) => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseBulk(text), [text]);
  /* Click-outside closes the sheet — unless text was pasted and not
     imported yet, in which case it asks first instead of losing it. */
  const [confirmClose, setConfirmClose] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirmClose) confirmRef.current?.scrollIntoView({ block: "nearest" });
  }, [confirmClose]);
  const attemptClose = () => {
    if (text.trim()) setConfirmClose(true);
    else onClose();
  };
  useEscapeClose(attemptClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label="إضافة جماعية" onClick={attemptClose} ref={dialogRef}>
      <div className="animate-sheet elev-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">إضافة جماعية</h2>
          <button type="button" aria-label="قفل الإضافة الجماعية" data-tip="قفل" data-tip-pos="below" onClick={attemptClose} className="lux-btn lux-row rounded-[var(--radius)] p-2 text-[var(--dim)] hover:text-[var(--text)]">
            <Icon d={I.x} size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
          الصق مجموعة ردود مرة واحدة. كل رد بالشكل ده: أول سطر عنوان الرد،
          وبعده نص الرد (أي عدد أسطر)، وبين كل رد والتاني سطر فيه{" "}
          <span dir="ltr" className="font-mono font-bold">---</span> لوحده. أو الصق JSON بنفس
          شكل ملف النسخة الاحتياطية — والردود الموجودة عندك قبل كده هتتخطى تلقائياً.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-[var(--radius)] bg-[var(--surface-alt)] p-3 font-mono text-xs leading-relaxed">
{`ترحيب سريع
أهلاً بيك 🤍
---
عرض خاص
نص العرض كامل…`}
        </pre>
        <span className="block" data-tip="الصق الردود هنا — كل رد: عنوان، ثم النص">
        <textarea
          aria-label="نص الإضافة الجماعية"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="الصق الردود هنا…"
          className="mt-3 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base leading-relaxed outline-none focus:border-[var(--accent)]"
        />
        </span>
        <p className="mt-1.5 text-sm text-[var(--dim)]" aria-live="polite">
          {text.trim()
            ? `اتعرف على ${parsed.items.length} رد جاهز للإضافة${parsed.errors > 0 ? ` — و${parsed.errors} بلوك ناقص (هيتخطى)` : ""}`
            : "لسه مفيش نص ملصوق"}
        </p>
        {confirmClose && (
          <div ref={confirmRef} role="alert" className="animate-rise mt-2 rounded-[var(--radius)] bg-[var(--warning-soft)] px-3.5 py-3">
            <p className="text-sm font-bold">النص اللي لصقته لسه ما اتستوردش</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                aria-label="تجاهل النص وقفل"
                data-tip="قفل وخسارة النص الملصوق"
                onClick={onClose}
                className="lux-btn rounded-[var(--radius)] bg-[var(--danger)] px-4 py-2 text-[13px] font-bold text-white"
              >
                تجاهل وقفل
              </button>
              <button
                type="button"
                aria-label="كمّل الاستيراد"
                data-tip="رجوع للنص وكمل"
                onClick={() => setConfirmClose(false)}
                className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-bold hover:border-[var(--border-strong)]"
              >
                كمّل
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2 pb-2 pt-2">
          <button
            type="button"
            aria-label="استيراد الردود الملصوقة" data-tip="استيراد الردود اللي اتعرف عليها"
            disabled={parsed.items.length === 0}
            onClick={() => onImport(parsed.items)}
            className="lux-btn flex-1 rounded-[var(--radius)] bg-[var(--accent)] py-3 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] hover:text-[var(--bg)] disabled:opacity-50"
          >
            إضافة {parsed.items.length > 0 ? parsed.items.length : ""} رد
          </button>
          <button
            type="button"
            aria-label="إلغاء الإضافة الجماعية" data-tip="إلغاء والرجوع من غير استيراد" data-tip-align="end"
            onClick={attemptClose}
            className="lux-btn lux-row rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-bold hover:border-[var(--border-strong)]"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
