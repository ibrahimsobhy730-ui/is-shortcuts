"use client";

/* Details panel — extracted from components/App.tsx (2026-11-26
   lightness split): the panel is a heavy modal (~320 lines) that
   only renders on demand, so it loads in its own chunk via
   next/dynamic in App.tsx. The shared leaf items (Icon, I,
   TriggerIcon, ShortcutCard, …) still live in App.tsx and are
   imported back from "../App" — the cycle is lazy-only (App never
   imports this file statically), so it costs nothing at eval time. */

import { useEffect, useRef, useState } from "react";
import { COPY_FILL_NOTE, copyButtonLabels } from "../copy-media";
import {
  I,
  Icon,
  MoveToFolderButton,
  ReplyMediaBlock,
  SourceMark,
  TriggerIcon,
  parseTags,
} from "../App";
import type { CopyResult, FolderRowT, Shortcut } from "../App";

/* ---------- details panel ----------
   The optional third column of the product: selecting a reply shows
   everything about it — full text (selectable, so a part can be
   copied by hand), its folder path, tags, dates and real usage —
   with every action one tap away. It never blocks the list: a
   bottom sheet on phones, a quiet side panel on wide screens, and
   Esc or the close button dismisses it. */

export function DetailsPanel({
  item,
  folderPath,
  folders,
  folderCounts,
  onClose,
  onCopy,
  onEdit,
  onPin,
  onFavorite,
  onDelete,
  onMove,
  onSaveTrigger,
  takenTriggers = [],
}: {
  item: Shortcut;
  folderPath: string;
  folders: FolderRowT[];
  folderCounts: Map<number, number>;
  onClose: () => void;
  onCopy: () => Promise<CopyResult>;
  onEdit: () => void;
  onPin: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onMove: (folderId: number | null) => void;
  onSaveTrigger: (s: Shortcut, trigger: string) => Promise<void>;
  /* The user's OTHER triggers — the client-side duplicate check
     inside the trigger pill. */
  takenTriggers?: string[];
}) {
  const [copied, setCopied] = useState(false);
  /* Neutral «كمّل البيانات…» state — see ShortcutCard. */
  const [fillNote, setFillNote] = useState(false);
  const [copying, setCopying] = useState(false);
  /* Two-tap delete confirm — same as the card: first tap arms
     «متأكد؟» for 3s, second tap deletes (moves to trash). */
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
  const fillTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(copiedTimer.current);
      window.clearTimeout(fillTimer.current);
    },
    [],
  );
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
  /* Copy-button labels for this reply's media (video wording —
     see ShortcutCard). */
  const copyLabels = copyButtonLabels(item.media);
  return (
    <div
      ref={panelRef}
      style={{ "--dw": `${panelW}px` } as React.CSSProperties}
      className="details-panel animate-sheet fixed inset-x-0 bottom-0 z-[var(--z-panel)] max-h-[86vh] overflow-y-auto overscroll-contain rounded-t-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-pop)] lg:inset-x-auto lg:bottom-4 lg:top-[84px] lg:max-h-none lg:w-[var(--dw,372px)] lg:rounded-[var(--radius)] ltr:lg:right-4 rtl:lg:left-4"
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
        <dt className="font-semibold text-[var(--faint)]">الاختصار</dt>
        <dd className="font-semibold">
          <TriggerIcon item={item} onSaveTrigger={onSaveTrigger} takenTriggers={takenTriggers} size="full" />
        </dd>
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
        <p className="max-h-64 select-text overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-[var(--radius)] bg-[var(--surface-alt)] p-3.5 text-[14.5px] leading-[1.9]">
          {item.body}
        </p>
      </div>

      {/* Attached image/video, full block: player + meta + download,
          and (video only) «نسخ رابط الفيديو» — a link, never the
          default copy. */}
      {item.media && (
        <div className="mt-3">
          <ReplyMediaBlock media={item.media} title={item.title} showCopyLink />
        </div>
      )}

      <button
        type="button"
        aria-label={copied ? `${copyLabels.done} — ${item.title}` : fillNote ? `${COPY_FILL_NOTE} — ${item.title}` : `${copyLabels.idle} — ${item.title}`}
        data-tip={copied ? "اتنسخ" : fillNote ? COPY_FILL_NOTE : "نسخ الرد كامل بضغطة واحدة"}
        aria-live="polite"
        aria-busy={copying}
        disabled={copying}
        onClick={async () => {
          if (copying) return;
          setCopying(true);
          try {
            const res = await onCopy();
            if (res === "failed") return;
            if (res === "fill") {
              setFillNote(true);
              window.clearTimeout(fillTimer.current);
              fillTimer.current = window.setTimeout(() => setFillNote(false), 2000);
              return;
            }
            setCopied(true);
            window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
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
            {copyLabels.done}
          </>
        ) : fillNote ? (
          <>{COPY_FILL_NOTE}</>
        ) : (
          <>
            <Icon d={I.copy} size={18} />
            {copyLabels.idle}
          </>
        )}
      </button>

      {/* إدارة الرد — نفس مجموعة البطاقة (2026-11-26): التثبيت
          والتعديل والحذف جنب بعض في حبّة واحدة مقسّمة؛ النجمة
          بتفضل برّاها لأنها حالة مش إجراء إدارة. التكرار
          والتصدير لسه على البطاقة. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="card-action-group" role="group" aria-label="إجراءات إدارة الرد">
          <button
            type="button"
            aria-label={item.pinned ? `إلغاء تثبيت ${item.title}` : `تثبيت ${item.title}`}
            data-tip={item.pinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}
            aria-pressed={item.pinned}
            onClick={onPin}
            className="lux-btn text-[13px] font-bold"
          >
            <Icon d={I.pin} size={16} />
            {item.pinned ? "إلغاء التثبيت" : "تثبيت"}
          </button>
          <button type="button" aria-label={`تعديل ${item.title}`} data-tip="تعديل الرد" onClick={onEdit} className="lux-btn text-[13px] font-bold">
            <Icon d={I.edit} size={16} />
            تعديل
          </button>
          <button
            type="button"
            aria-label={confirmingDelete ? `تأكيد حذف ${item.title}` : `حذف ${item.title}`}
            data-tip={confirmingDelete ? "دوس تاني لتأكيد الحذف" : "حذف"}
            onClick={() => {
              if (confirmingDelete) {
                onDelete();
              } else {
                setConfirmingDelete(true);
                window.setTimeout(() => setConfirmingDelete(false), 3000);
              }
            }}
            className={`lux-btn card-action-danger text-[13px] font-bold ${confirmingDelete ? "card-action-danger-confirm" : ""}`}
          >
            <Icon d={I.trash} size={16} />
            {confirmingDelete ? "متأكد؟" : "حذف"}
          </button>
        </div>
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
