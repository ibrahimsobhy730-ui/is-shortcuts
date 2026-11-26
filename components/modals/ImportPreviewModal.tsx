"use client";

/* Import preview modal — extracted from components/App.tsx (2026-11-26
   lightness split): loads on demand via next/dynamic in App.tsx.
   Shared leaf items come from "../App". */

import { useRef, useState } from "react";
import {
  I,
  Icon,
  REPLY_SOURCES,
  importKeyOf,
  useBodyScrollLock,
  useDialogFocus,
  useEscapeClose,
} from "../App";

/* ---------- import preview ----------
   Nothing is written when a file is picked: this sheet shows the
   parsed result first — how many replies are new, which ones
   already exist in the library — and the user picks merge (skip
   duplicates) or a clearly-confirmed replace before anything
   touches the library. */

export function ImportPreviewModal({
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
    trigger?: string;
    source?: "" | (typeof REPLY_SOURCES)[number];
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
  useBodyScrollLock(true);
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
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
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
          لسه ما اتكتبش أي حاجة في مكتبتك. ملف النسخة ده مش بيشمل صور أو فيديو —
          الردود المستوردة هتوصل من غير وسائط.
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
