"use client";

/* Editor modal — extracted from components/App.tsx (2026-11-26
   lightness split): the biggest modal (~1,000 lines — editor,
   media upload, trigger suggestions) and the one that only ever
   renders on demand, so it loads in its own chunk via next/dynamic
   in App.tsx. Shared leaf items (Icon, I, RichTextEditor,
   FolderPicker, the media-upload helpers, …) still live in App.tsx
   and are imported back from "../App" — the cycle is lazy-only. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, NotebookPen, Tag, type LucideIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import { api } from "../api";
import { FIELDS } from "../fields.generated";
import { classifyUploadError, uploadErrorMessage } from "../media-upload";
import { MAX_IMAGES_PER_REPLY } from "../copy-media";
import {
  checkBlobReachable,
  countedStream,
  mintClientToken,
  uploadViaServer,
  uploadViaXhr,
} from "../media-upload";
import {
  FolderPicker,
  FolderSourceControl,
  I,
  Icon,
  REPLY_SOURCES,
  ReplyMediaBlock,
  RichTextEditor,
  extractVariables,
  normalizeTriggerInput,
  suggestTriggers,
  triggerCollisionHint,
  triggerError,
  useBodyScrollLock,
  useDialogFocus,
  useEscapeClose,
} from "../App";
import type { FolderRowT, Shortcut } from "../App";

/* ---------- editor modal ----------
   Organized the way the site itself thinks about a reply: first
   the reply (its name, its trigger, and its text), then its
   organization (the folder it lives in — picked from the whole
   folder tree, never typed — and the keywords search finds it by). The header and the
   save row stay fixed while the middle scrolls, so حفظ is always
   one glance away. */

export function EditorModal({
  token,
  userId,
  item,
  folders,
  folderCounts,
  takenTriggers = [],
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
  /* The user's OTHER triggers (not the edited reply's own) — the
     client-side duplicate check for the trigger field. */
  takenTriggers?: string[];
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
    trigger: string;
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
      const trigger = typeof d.trigger === "string" ? d.trigger : "";
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
      return { title, body, folderId, tags, extShortcut, trigger, source };
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
  /* The in-site trigger: any text the owner types in the site's
     search / shortcut bar to find this reply — Arabic, English,
     symbols, any case. "" = no trigger. Never copied from
     extShortcut — the two are unrelated words, one for programs
     outside the site, one for inside it. */
  const [trigger, setTrigger] = useState(
    item?.trigger ?? draft?.trigger ?? "",
  );
  /* Live trigger suggestions — the easiest free triggers for this
     reply, following the typed text as it changes (same engine as
     the inline pill editor). One tap fills the field. */
  const triggerSuggestions = useMemo(
    () =>
      suggestTriggers(
        { title, body, trigger: item?.trigger ?? null },
        takenTriggers,
        trigger,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, body, trigger, item, takenTriggers],
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
  const [initial] = useState(() => ({ title, body, folderId, tags, extShortcut, trigger, source }));
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
    trigger !== savedSnap.trigger ||
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
  useBodyScrollLock(true);

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
          JSON.stringify({ title, body, folderId, tags, extShortcut, trigger, source }),
        );
        setDraftSaved(true);
      } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(t);
  }, [item, draftKey, title, body, folderId, tags, extShortcut, trigger, source]);

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
      trigger: normalizeTriggerInput(trigger),
      source: source as "" | (typeof REPLY_SOURCES)[number],
      folderId,
    };
  };

  /* Autosave for an existing reply: 1.5s after the typing settles,
     the edit lands in the library on its own and the footer says
     so. It never closes the editor and never fires on invalid text
     (blank title/body stay for the explicit حفظ + the guard). */
  const autosaveMut = useMutation({
    mutationFn: async (snap: { title: string; body: string; folderId: number | null; tags: string; extShortcut: string; trigger: string; source: string }) => {
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
        trigger: normalizeTriggerInput(snap.trigger),
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
    /* A duplicate trigger never autosaves: the server would reject
       it, and the inline field error below explains why. */
    if (triggerError(trigger, takenTriggers)) return;
    setSaveState("saving");
    const t = window.setTimeout(() => {
      autosaveMutRef.current.mutate({ title, body, folderId, tags, extShortcut, trigger, source });
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, dirty, title, body, folderId, tags, extShortcut, trigger, source, takenTriggers]);

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
    onError: (e) => setError(e instanceof Error ? e.message : "الحفظ متمّش — حاول تاني"),
  });

  const submit = () => {
    if (!title.trim()) return setError("اكتب اسم الرد");
    if (!body.trim()) return setError("اكتب نص الرد اللي هيتحفظ في مكتبتك");
    const trigErr = triggerError(trigger, takenTriggers);
    if (trigErr) return setError(trigErr);
    setError(null);
    saveMut.mutate();
  };

  /* ---------- reply media ----------
     Up to 3 images attached to THIS reply (existing replies only —
     a new reply has no id yet, so attach needs it saved first).
     IMAGES ONLY — video upload was cancelled by the owner
     2026-11-26. The images are copied WITH the reply text in one
     clipboard write (see copy-media.ts).
     The file goes straight from the browser to Vercel Blob
     (upload() + the /api/media/upload token route); attachMedia
     then records the reference. Media is NOT part of
     buildPayload/autosave/draft — attach/remove are their own
     mutations, so the editor's save/dirty logic never sees them.
     Images are ordered by position (1–3); removing one deletes
     only that image's Blob when nothing else references it. */
  type MediaItem = Shortcut["media"][number];
  const [mediaList, setMediaList] = useState<MediaItem[]>(item?.media ?? []);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  /* "Sent, waiting for the server": all bytes are read and handed
     to the transport, only the Blob response is pending — the bar
     must say so instead of freezing at a percentage (the old bar
     froze at 79% / 0% because the SDK suppresses the 100%
     callback until the response arrives). */
  const [mediaWaiting, setMediaWaiting] = useState(false);
  /* Per-image removing state + per-image two-tap confirm, so
     removing one image never touches the others. */
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  /* True when the server said Blob storage is not connected yet
     (503 «التخزين مش متظبط…») — attach stays disabled with that
     exact hint until the store exists. */
  const [mediaStorageDown, setMediaStorageDown] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /* Downscale an image to at most 1600px on the longest edge
     (same canvas pattern as the avatar flow, which uses 512px),
     keeping its type (PNG stays PNG, everything else JPEG). */
  const prepareImage = (file: File): Promise<{ file: File; width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const cx = canvas.getContext("2d");
        if (!cx) return reject(new Error("prepare failed"));
        cx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (b) =>
            b
              ? resolve({ file: new File([b], "image", { type: mimeType }), width, height })
              : reject(new Error("toBlob failed")),
          mimeType,
          0.88,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("unreadable image"));
      };
      img.src = url;
    });

  const uploadMediaFile = async (file: File) => {
    if (!item) return;
    setMediaError(null);
    setMediaStorageDown(false);
    /* The cap is enforced here (instant feedback) AND server-side
       in attachMedia (the truth) — a 4th image is refused either
       way. */
    if (mediaList.length >= MAX_IMAGES_PER_REPLY) {
      setMediaError("الرد ده فيه 3 صور بالفعل — امسح واحدة الأول");
      return;
    }
    /* Stage tracking (2026-11-26): every failure names the stage
       it died in — «المرحلة: الرفع المباشر» — so the next
       screenshot diagnoses the failure instead of showing one of
       three different wordings for the same underlying problem.
       withStage is applied to every error this function shows. */
    let stage = "التحقق من الملف";
    const withStage = (m: string) => `${m} — المرحلة: ${stage}`;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setMediaError(
        withStage("الصورة لازم تكون JPG أو PNG أو WebP — الـ GIF مش مدعوم دلوقتي"),
      );
      return;
    }
    const cap = 8 * 1024 * 1024;
    if (file.size > cap) {
      setMediaError(withStage("الصورة أكبر من 8 ميجا — جرّب صورة أصغر"));
      return;
    }
    /* Preflight: the Blob endpoint either answers from this
       browser or it doesn't — find out before starting a doomed
       upload instead of parking the bar at 79% / 0%. */
    stage = "فحص الاتصال";
    if (!(await checkBlobReachable())) {
      setMediaError(withStage(uploadErrorMessage("unreachable")));
      return;
    }
    setMediaUploading(true);
    setMediaProgress(0);
    setMediaWaiting(false);
    /* Timeout + stall watchdog (2026-11-26 — the old code had
       neither, so a transport stall became an infinite silent
       stall): the direct PUT aborts after 30s, and if no byte is
       read for ~15s while bytes remain, the watchdog aborts it as
       "stalled". Once all bytes are read, only the overall timeout
       still applies — the server is answering, just slowly. */
    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const stalled = { current: false };
    const sent = { current: false };
    const triedFallback = { current: false };
    const lastProgressAt = { current: Date.now() };
    const watchdogId = window.setInterval(() => {
      if (!sent.current && Date.now() - lastProgressAt.current > 15000) {
        stalled.current = true;
        controller.abort();
      }
    }, 2000);
    const onRead = (loaded: number, total: number) => {
      lastProgressAt.current = Date.now();
      setMediaProgress(Math.round((loaded / Math.max(1, total)) * 100));
      if (loaded >= total) {
        sent.current = true;
        setMediaWaiting(true);
      }
    };
    try {
      let upFile = file;
      let width: number | null = null;
      let height: number | null = null;
      stage = "تجهيز الملف";
      const prepared = await prepareImage(file);
      upFile = prepared.file;
      width = prepared.width;
      height = prepared.height;
      const ext =
        upFile.type === "image/png"
          ? "png"
          : upFile.type === "image/webp"
            ? "webp"
            : "jpg";
      const pathname = `media/${userId}/${item.id}/${crypto.randomUUID()}.${ext}`;
      /* Probe first so the server's exact error surfaces (see
         mintClientToken), then the real client upload. */
      stage = "تجهيز الرفع";
      await mintClientToken(token, pathname, item.id);
      let blob: { url: string; pathname: string };
      try {
        stage = "الرفع المباشر";
        blob = await upload(pathname, countedStream(upFile, onRead), {
          access: "public",
          handleUploadUrl: "/api/media/upload",
          clientPayload: JSON.stringify({ token, shortcutId: item.id }),
          abortSignal: controller.signal,
        });
      } catch (directErr) {
        /* Direct path failed — retry once over XHR (real
           Content-Length, no chunked streaming), then through
           the server for small files. A server-side rejection
           (bad token, bad type, too large, access denied) is NOT
           retried: it would fail the same way on every path. */
        const directKind = stalled.current
          ? "stalled"
          : classifyUploadError(directErr);
        if (
          directKind === "content-type" ||
          directKind === "too-large" ||
          directKind === "token" ||
          directKind === "token-expired" ||
          directKind === "forbidden" ||
          directKind === "not-found"
        ) {
          throw directErr;
        }
        triedFallback.current = true;
        setMediaProgress(0);
        setMediaWaiting(false);
        sent.current = false;
        lastProgressAt.current = Date.now();
        const freshController = new AbortController();
        const freshTimeout = window.setTimeout(
          () => freshController.abort(),
          timeoutMs,
        );
        try {
          stage = "تجهيز الرفع";
          const freshToken = await mintClientToken(token, pathname, item.id);
          stage = "الرفع البديل";
          blob = await uploadViaXhr(
            pathname,
            upFile,
            freshToken,
            onRead,
            timeoutMs,
            freshController.signal,
          );
        } catch (xhrErr) {
          if (upFile.size > 4 * 1024 * 1024) {
            throw xhrErr;
          }
          stage = "الرفع من السيرفر";
          blob = await uploadViaServer(token, item.id, pathname, upFile);
        } finally {
          window.clearTimeout(freshTimeout);
        }
      }
      stage = "حفظ الوسائط";
      const saved = await api.attachMedia({
        token,
        shortcutId: item.id,
        kind: "image",
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        contentType: upFile.type,
        byteSize: upFile.size,
        width,
        height,
      });
      setMediaList((prev) => [...prev, saved.media]);
      queryClient.invalidateQueries({ queryKey: ["shortcuts", token] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "الرفع متمّش — حاول تاني";
      if (msg.includes("التخزين مش متظبط")) setMediaStorageDown(true);
      /* Error wording, in priority order: a stalled watchdog;
         the server's own Arabic message, verbatim (503, validation,
         attach errors — now carrying (HTTP <status>) + code, so the
         classifier names the cause); a SPECIFIC classified cause
         (forbidden, too-large, token…) — never the generic line
         when a cause is known; otherwise the mapped English
         SDK/transport error. Every branch carries the stage — one
         failure, one diagnosis. Never a generic spinner, never a
         silent failure. */
      const classified = classifyUploadError(e);
      let base: string;
      if (stalled.current) {
        base = uploadErrorMessage("stalled");
      } else if (/[\u0600-\u06FF]/.test(msg)) {
        base = msg;
      } else if (
        classified === "content-type" ||
        classified === "too-large" ||
        classified === "token" ||
        classified === "token-expired" ||
        classified === "forbidden" ||
        classified === "not-found" ||
        classified === "service"
      ) {
        base = uploadErrorMessage(classified);
      } else {
        base = uploadErrorMessage(classified);
      }
      setMediaError(withStage(base));
    } finally {
      window.clearTimeout(timeoutId);
      window.clearInterval(watchdogId);
      setMediaUploading(false);
      setMediaProgress(0);
      setMediaWaiting(false);
    }
  };

  /* Removal deletes only THAT image's Blob (when no other reply
     still references it) — hence the per-image confirm step. The
     other images on this reply are untouched. */
  const removeMediaFile = async (mediaId: number) => {
    if (!item) return;
    setRemovingIds((prev) => new Set(prev).add(mediaId));
    try {
      await api.removeMedia({ token, shortcutId: item.id, mediaId });
      setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
      setConfirmRemoveId(null);
      queryClient.invalidateQueries({ queryKey: ["shortcuts", token] });
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "المسح متمّش — حاول تاني");
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {/* A new reply starts blank — title, trigger, body. No
              invented drafts. */}
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
              {/* The trigger sits directly under the title — the
                  reply's name, then its shortcut, then its text. */}
              <div className="block">
                {labelWithIcon(I.shortcut, "الاختصار داخل الموقع (اختياري)")}
                <input
                  aria-label="الاختصار داخل الموقع"
                  dir="auto"
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="اكتب أي نص…"
                  className={`${field} text-start`}
                />
                <span className="mt-1 block text-xs text-[var(--dim)]">
                  النص اللي بتكتبه في بحث الموقع أو في «شريط الاختصارات» عشان تلاقي الرد ده على طول — أي نص ينفع: عربي أو إنجليزي أو رموز، المهم ما يتكررش مع اختصار تاني عندك. بيتحفظ زي ما كتبته بالظبط.
                </span>
                {triggerError(trigger, takenTriggers) && (
                  <span role="alert" className="mt-1 block text-xs font-semibold text-[var(--danger)]">
                    {triggerError(trigger, takenTriggers)}
                  </span>
                )}
                {/* Prefix collision: a non-blocking warning, not an
                    error — the typed text shares a prefix with an
                    existing trigger, so it may confuse typing. */}
                {!triggerError(trigger, takenTriggers) &&
                  triggerCollisionHint(trigger, takenTriggers) && (
                    <span className="mt-1 block text-xs font-semibold leading-relaxed text-[var(--warning)]">
                      {triggerCollisionHint(trigger, takenTriggers)}
                    </span>
                  )}
                {triggerSuggestions.length > 0 && (
                  <span className="mt-2 block">
                    <span className="mb-1 block text-[11.5px] font-bold text-[var(--faint)]">
                      اقتراحات جاهزة — دوس على أي واحدة:
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {triggerSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setTrigger(sug)}
                          className="lux-btn rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-bold text-[var(--accent-strong)] hover:border-[var(--accent)]"
                        >
                          <span dir="auto">{sug}</span>
                        </button>
                      ))}
                    </span>
                  </span>
                )}
              </div>
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

          {/* الوسائط: صورة مرفقة بالرد — بتتنسخ مع النص في نسخة
              واحدة. الإرفاق والمسح mutations مستقلة — مش جزء من
              حفظ الرد ولا المسودة ولا الحفظ التلقائي. */}
          <div className="mt-6">
            {sectionHead(I.image, "الوسائط")}
            <div className="mt-3 flex flex-col gap-3">
              {!item ? (
                <p className="text-[13px] leading-relaxed text-[var(--dim)]">
                  احفظ الرد الأول، وبعدين تقدر تضيف صورة من هنا — الوسائط بتتربط بالرد بعد ما يتحفظ.
                </p>
              ) : mediaStorageDown ? (
                <p role="alert" className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-3 text-[13px] font-bold leading-relaxed text-[var(--dim)]">
                  التخزين مش متظبط على السيرفر — الصور مش متاحة دلوقتي
                </p>
              ) : (
                <>
                  {mediaList.length > 0 && (
                    <>
                      <ReplyMediaBlock media={mediaList} title={title || item.title} />
                      {/* Thumbnails with per-image remove: each image
                          is its own tile — removing one deletes only
                          that file (when nothing else references it);
                          the counter on each tile is its position. */}
                      <div className="flex flex-wrap gap-2">
                        {mediaList.map((m, i) => {
                          const removing = removingIds.has(m.id);
                          const confirming = confirmRemoveId === m.id;
                          return (
                            <div
                              key={m.id}
                              className="relative overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)] shadow-[var(--shadow-1)]"
                            >
                              <img
                                src={m.blobUrl}
                                alt={`صورة ${i + 1} من ${mediaList.length}`}
                                className="h-16 w-16 object-cover"
                              />
                              <span className="absolute bottom-1 start-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {i + 1}/{mediaList.length}
                              </span>
                              <button
                                type="button"
                                disabled={mediaUploading || removing}
                                aria-label={confirming ? `تأكيد مسح صورة ${i + 1}` : `مسح صورة ${i + 1}`}
                                data-tip={confirming ? "دوس تاني لتأكيد مسح الصورة دي بس" : "مسح الصورة دي بس — باقي الصور مش هتتلمس"}
                                onClick={() => {
                                  if (confirming) void removeMediaFile(m.id);
                                  else {
                                    setConfirmRemoveId(m.id);
                                    window.setTimeout(
                                      () => setConfirmRemoveId((cur) => (cur === m.id ? null : cur)),
                                      3000,
                                    );
                                  }
                                }}
                                className={`absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow disabled:opacity-60 ${confirming ? "bg-[var(--danger)]" : "bg-black/55 hover:bg-[var(--danger)]"}`}
                              >
                                {removing ? (
                                  <span className="spinner" aria-hidden="true" />
                                ) : (
                                  <Icon d={I.x} size={13} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={mediaUploading || mediaList.length >= MAX_IMAGES_PER_REPLY}
                      onClick={() => imageInputRef.current?.click()}
                      className={`lux-btn flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-60 ${mediaList.length === 0 ? "bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:text-[var(--text)]"}`}
                    >
                      <Icon d={I.image} size={15} />
                      {mediaList.length === 0 ? "أضف صورة" : "أضف صورة تانية"}
                    </button>
                    <span className="text-[12px] font-bold text-[var(--faint)]">
                      {mediaList.length} من {MAX_IMAGES_PER_REPLY} صور
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--dim)]">
                    لحد 3 صور في الرد الواحد — JPG أو PNG أو WebP لحد 8 ميجا للصورة (بتتصغّر لـ 1600px قبل الرفع). الـ GIF مش مدعوم دلوقتي. الصور بتتنسخ مع النص في نسخة واحدة.
                  </p>
                </>
              )}
              {mediaUploading && (
                <div className="flex items-center gap-2" aria-live="polite">
                  <span className="spinner shrink-0" aria-hidden="true" />
                  <span className="text-[13px] font-bold text-[var(--dim)]">
                    {mediaWaiting ? "اترفع، مستني رد التخزين…" : `بيرفع… ${mediaProgress}%`}
                  </span>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)] transition-[width]"
                      style={{ width: `${mediaWaiting ? 100 : mediaProgress}%` }}
                    />
                  </span>
                </div>
              )}
              {mediaError && (
                <p role="alert" className="text-xs font-bold leading-relaxed text-[var(--danger)]">
                  {mediaError}
                </p>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="اختيار صورة"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadMediaFile(f);
                }}
              />
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

          {/* «ملاحظة: اختصار خارجي» — a reminder-only note, one
              muted line at the bottom. The field and its data are
              untouched (preserved in backup/export/import); only
              its placement changed. */}
          <label className="mt-6 flex items-center gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--dim)]">
            <span className="shrink-0 font-bold">ملاحظة: اختصار خارجي</span>
            <input
              {...FIELDS.createShortcut.extShortcut}
              aria-label="ملاحظة: اختصار خارجي"
              dir="ltr"
              value={extShortcut}
              onChange={(e) => setExtShortcut(e.target.value)}
              placeholder=";salam"
              className="min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-transparent px-2 py-1.5 font-mono text-xs text-[var(--dim)] outline-none focus:border-[var(--accent)]"
            />
          </label>

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
