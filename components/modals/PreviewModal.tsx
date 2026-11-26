"use client";

/* Quick preview modal — extracted from components/App.tsx (2026-11-26
   lightness split): loads on demand via next/dynamic in App.tsx.
   Shared leaf items come from "../App". */

import { useEffect, useRef, useState } from "react";
import { COPY_FILL_NOTE, copyButtonLabels } from "../copy-media";
import {
  I,
  Icon,
  ReplyMediaBlock,
  RichPreview,
  useBodyScrollLock,
  useDialogFocus,
  useEscapeClose,
} from "../App";
import type { CopyResult, Shortcut } from "../App";

/* ---------- quick preview modal ---------- */
export function PreviewModal({
  item,
  onClose,
  onCopy,
  onEdit,
}: {
  item: Shortcut;
  onClose: () => void;
  onCopy: () => Promise<CopyResult>;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  /* Neutral «كمّل البيانات…» state — see ShortcutCard. */
  const [fillNote, setFillNote] = useState(false);
  const [copying, setCopying] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const fillTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(copiedTimer.current);
      window.clearTimeout(fillTimer.current);
    },
    [],
  );
  /* Copy-button labels for this reply's media (see ShortcutCard). */
  const copyLabels = copyButtonLabels();
  useEscapeClose(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  useBodyScrollLock(true);
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
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
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
        {item.media.length > 0 && (
          <div className="mt-3">
            <ReplyMediaBlock media={item.media} title={item.title} />
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          دي المعاينة بالتنسيق — العريض والمائل بصيغة واتساب، فهيظهروا منسقين لما الرد يتلصق هناك.
        </p>
        <div className="flex gap-2 pb-2 pt-3">
          <button
            type="button"
            aria-label={copied ? `${copyLabels.done} — ${item.title}` : fillNote ? `${COPY_FILL_NOTE} — ${item.title}` : `${copyLabels.idle} — ${item.title}`}
            data-tip={copied ? "اتنسخ" : fillNote ? COPY_FILL_NOTE : "نسخ الرد"}
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
