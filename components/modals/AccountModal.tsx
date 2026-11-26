"use client";

/* Account modal — extracted from components/App.tsx (2026-11-26
   lightness split): loads on demand via next/dynamic in App.tsx.
   Shared leaf items come from "../App". */

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { FIELDS } from "../fields.generated";
import {
  AvatarFace,
  I,
  Icon,
  useBodyScrollLock,
  useDialogFocus,
  useEscapeClose,
} from "../App";
import type { ToastKind, User } from "../App";

/* ---------- account modal ---------- */
export function AccountModal({
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
  useBodyScrollLock(true);

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
        className="animate-sheet elev-pop max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[var(--radius)] glass-panel p-5 sm:rounded-[var(--radius)]"
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
