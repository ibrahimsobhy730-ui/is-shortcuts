"use client";

/* Folder icon picker — extracted from components/App.tsx (2026-11-26
   lightness split). The picker catalogue (FOLDER_ICON_OPTIONS, 128
   icons) only loads when the picker opens; App.tsx loads this file
   via next/dynamic. Shared leaf items come from "../App". */

import { useState } from "react";
import { Pipette, Search, Sparkles } from "lucide-react";
import {
  FOLDER_COLOR_OPTIONS,
  FOLDER_ICON_OPTIONS,
  I,
  Icon,
  isCustomColor,
} from "../App";
import type { Lang } from "../App";

/* ---------- folder icon picker ----------
   One grid used by both the create sheet and the folder settings:
   «تلقائية» (null) first — the icon follows the folder's name —
   then every catalogue icon as a labelled tile. The selected tile
   wears the accent fill; the rest stay quiet hairline tiles. */

export function FolderIconPicker({
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
    <div className={`grid ${compact ? "max-h-40" : "max-h-64"} grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain pe-0.5 sm:grid-cols-7`} role="radiogroup" aria-label={lang === "en" ? "Folder icon" : "أيقونة المجلد"}>
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
