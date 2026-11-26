/* Helpers for the reply-media upload path. The pure parts (token
   parsing, error mapping) are unit-testable in Node (see
   scripts/verify-media.mjs); the browser steps (fetch, upload(),
   XMLHttpRequest, ReadableStream counting) live here too and are
   called by uploadMediaFile in components/modals/EditorModal.tsx.

   Why this file exists (2026-11-26): the client upload() does a
   single PUT to https://vercel.com/api/blob with chunked streaming
   (duplex: half, 64 KiB chunks, no Content-Length) — in one browser
   that PUT stalled silently at 79% (the first 64 KiB chunk of an
   ~83 KB PNG) with no error at all, and nothing in the old code
   could time it out or abort it. The upload path now has: a
   preflight reachability check, an AbortController timeout, a
   stall watchdog, an XHR fallback (real Content-Length, real
   upload progress) and a server-proxied fallback for small
   images — and every failure maps to a distinct Arabic message
   here, never a silent spinner. */


export const BLOB_API_URL = "https://vercel.com/api/blob";
export const BLOB_API_VERSION = "13";

/** Store id inside a client token: vercel_blob_client_<storeId>_<...> */
export function parseStoreIdFromClientToken(clientToken: string): string | null {
  const parts = clientToken.split("_");
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/** The direct-PUT URL for the XHR fallback — the same endpoint +
    query the SDK's put() uses. */
export function blobPutUrl(pathname: string): string {
  return `${BLOB_API_URL}/?${new URLSearchParams({ pathname }).toString()}`;
}

export type UploadFailureKind =
  | "aborted" // timeout / watchdog / user abort
  | "stalled" // watchdog: no progress while bytes remain unread
  | "unreachable" // preflight: the Blob endpoint never answered
  | "network" // fetch/XHR transport error
  | "token" // client-token mint/retrieval failed
  | "token-expired" // the minted token expired mid-upload
  | "content-type" // the file type is not allowed for this token
  | "too-large" // the file exceeds the token's size cap
  | "forbidden" // store/access mismatch or access denied
  | "not-found" // the store does not exist
  | "service" // Blob service unavailable / rate limited
  | "unknown";

export function classifyUploadError(e: unknown): UploadFailureKind {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const name = e instanceof Error ? e.name : "";
  if (name === "AbortError" || /abort/i.test(msg)) return "aborted";
  if (/client token has expired|token expired/i.test(msg)) return "token-expired";
  if (/content type .* not allowed|contentType.*not allowed/i.test(msg))
    return "content-type";
  if (/file (is )?too large|file length cannot be greater/i.test(msg))
    return "too-large";
  if (/failed to (retrieve|fetch).*client token/i.test(msg)) return "token";
  if (/store (does not exist|not found)|store_not_found/i.test(msg))
    return "not-found";
  if (/access denied|forbidden|not_allowed|not allowed/i.test(msg))
    return "forbidden";
  if (
    /service.*not available|service_unavailable|too many requests|rate_limited/i.test(
      msg,
    )
  )
    return "service";
  if (
    /failed to fetch|network request failed|networkerror|load failed|fetch failed|network error|terminated/i.test(
      msg,
    )
  )
    return "network";
  return "unknown";
}

export function uploadErrorMessage(
  kind: UploadFailureKind,
  isVideo: boolean,
): string {
  switch (kind) {
    case "stalled":
      return "الرفع واقف — مفيش تقدّم، اتأكد من النت وحاول تاني";
    case "aborted":
      return "الرفع وقف — مفيش رد من التخزين، اتأكد من النت وحاول تاني";
    case "unreachable":
      return "التخزين مش واصل من المتصفح ده — اتأكد من النت أو جرّب متصفح تاني";
    case "network":
      return "النت قطع أثناء الرفع — اتأكد من الاتصال وحاول تاني";
    case "token":
      return "مش قادر يجهّز الرفع — حاول تاني";
    case "token-expired":
      return "انتهت صلاحية الرفع — حاول تاني";
    case "content-type":
      return isVideo
        ? "الفيديو لازم يكون MP4 أو WebM — الـ MOV مش مدعوم دلوقتي"
        : "الصورة لازم تكون JPG أو PNG أو WebP — الـ GIF مش مدعوم دلوقتي";
    case "too-large":
      return isVideo
        ? "الفيديو أكبر من 50 ميجا — جرّب فيديو أصغر"
        : "الصورة أكبر من 8 ميجا — جرّب صورة أصغر";
    case "forbidden":
      return "التخزين رفض الرفع — اتأكد إن مخزن الوسائط مظبوط وحاول تاني";
    case "not-found":
      return "مخزن الوسائط مش موجود — اتأكد إن المخزن متوصّل وحاول تاني";
    case "service":
      return "خدمة التخزين مش متاحة دلوقتي — حاول تاني بعد شوية";
    case "unknown":
      return "الرفع متمّش — حاول تاني";
  }
}

/* Probes the media-upload token route and surfaces its exact
   error string. The @vercel/blob client swallows the route's
   error body behind a generic "Failed to retrieve the client
   token", so without this probe the editor could never show the
   server's real message — including the 503 «التخزين مش
   متظبط…» when no Blob store is connected yet. The probe mints
   a token that is never used (tokens live 30s and cost no Blob
   operation); the real upload() mints its own right after.
   Timeout (2026-11-26): the probe used to hang forever on a
   stalled transport — it now aborts after 15s. Returns the
   minted client token (the XHR fallback mints its own fresh one,
   so this return is for callers that need proof the mint works). */
export async function mintClientToken(
  token: string,
  pathname: string,
  shortcutId: number,
  kind: "image" | "video",
): Promise<string> {
  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname,
        clientPayload: JSON.stringify({ token, shortcutId, kind }),
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const msg =
      body !== null &&
      typeof body === "object" &&
      typeof (body as Record<string, unknown>).error === "string"
        ? ((body as Record<string, unknown>).error as string)
        : "الرفع متمّش — حاول تاني";
    throw new Error(msg);
  }
  const body: unknown = await res.json().catch(() => null);
  const clientToken =
    body !== null &&
    typeof body === "object" &&
    typeof (body as Record<string, unknown>).clientToken === "string"
      ? ((body as Record<string, unknown>).clientToken as string)
      : "";
  if (!clientToken) throw new Error("مش قادر يجهّز الرفع — حاول تاني");
  return clientToken;
}

/* Preflight (2026-11-26): before starting a doomed upload, ask
   the Blob endpoint itself whether it answers from THIS browser.
   Any response — even the fast 403 an unauthenticated GET gets —
   means "reachable"; a timeout means the endpoint is unreachable
   from this browser/network, so say so at once instead of parking
   the progress bar at 79% or 0% for half a minute. */
export async function checkBlobReachable(): Promise<boolean> {
  try {
    await fetch(BLOB_API_URL, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

/* Wraps a File in a counting stream for the direct upload: the
   SDK's onUploadProgress suppresses the 100% callback until the
   response arrives, and a sub-64 KiB file sits at 0% (its only
   chunk completes at 100% — suppressed), so the bar froze at 79%
   for an ~83 KB PNG and at 0% for a small video. This counter
   reports every byte read from the file, so the UI knows exactly
   when all bytes are handed to the transport ("sent, waiting for
   the server") instead of a frozen percentage. */
export function countedStream(
  file: File,
  onRead: (loaded: number, total: number) => void,
): ReadableStream<Uint8Array> {
  const total = file.size;
  let loaded = 0;
  const reader = file.stream().getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      loaded += value.byteLength;
      onRead(loaded, total);
      controller.enqueue(value);
    },
    cancel() {
      void reader.cancel();
    },
  });
}

/* Fallback 1 (2026-11-26): the same Blob PUT, but over a plain
   XMLHttpRequest instead of the SDK's chunked fetch stream. XHR
   sends a real Content-Length and reports real upload progress,
   so a proxy that mishandles `duplex: half` streaming cannot
   stall it the same way. Same endpoint, same Bearer client token
   (freshly minted — tokens live 30s), same headers the SDK sends.
   Returns the Blob result the attach step needs (url + pathname). */
export async function uploadViaXhr(
  pathname: string,
  file: File,
  clientToken: string,
  onProgress: (loaded: number, total: number) => void,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<{ url: string; pathname: string }> {
  const storeId = parseStoreIdFromClientToken(clientToken);
  if (!storeId) throw new Error("مش قادر يجهّز الرفع — حاول تاني");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", blobPutUrl(pathname), true);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("authorization", `Bearer ${clientToken}`);
    xhr.setRequestHeader("x-vercel-blob-store-id", storeId);
    xhr.setRequestHeader("x-api-version", BLOB_API_VERSION);
    xhr.setRequestHeader("x-vercel-blob-access", "public");
    xhr.setRequestHeader("x-content-type", file.type);
    xhr.setRequestHeader("x-add-random-suffix", "0");
    xhr.setRequestHeader(
      "x-api-blob-request-id",
      `${storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    );
    xhr.setRequestHeader("x-api-blob-request-attempt", "0");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        /* not JSON — handled below as a failure */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data !== null && typeof data === "object") {
        const url = (data as Record<string, unknown>).url;
        const pn = (data as Record<string, unknown>).pathname;
        if (typeof url === "string" && typeof pn === "string") {
          resolve({ url, pathname: pn });
          return;
        }
      }
      const errObj =
        data !== null && typeof data === "object"
          ? (data as Record<string, unknown>).error
          : null;
      const errRec =
        errObj !== null && typeof errObj === "object"
          ? (errObj as Record<string, unknown>)
          : null;
      const msg =
        errRec !== null && typeof errRec.message === "string"
          ? errRec.message
          : typeof errObj === "string"
            ? errObj
            : "";
      reject(new Error(msg || `Blob upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.ontimeout = () =>
      reject(new DOMException("The request timed out.", "TimeoutError"));
    xhr.onabort = () =>
      reject(new DOMException("The user aborted a request.", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/* Fallback 2 (2026-11-26): the bytes go through our own server
   route, which put()s them with BLOB_READ_WRITE_TOKEN. Serverless
   bodies cap at ~4.5 MB, so this is images/small files only —
   videos failing both direct paths get an honest message instead. */
export async function uploadViaServer(
  token: string,
  shortcutId: number,
  kind: "image" | "video",
  pathname: string,
  file: File,
): Promise<{ url: string; pathname: string }> {
  const form = new FormData();
  form.set("token", token);
  form.set("shortcutId", String(shortcutId));
  form.set("kind", kind);
  form.set("pathname", pathname);
  form.set("file", file);
  const res = await fetch("/api/media/upload-direct", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      body !== null &&
      typeof body === "object" &&
      typeof (body as Record<string, unknown>).error === "string"
        ? ((body as Record<string, unknown>).error as string)
        : "الرفع متمّش — حاول تاني";
    throw new Error(msg);
  }
  const url =
    body !== null && typeof body === "object"
      ? (body as Record<string, unknown>).url
      : undefined;
  const pn =
    body !== null && typeof body === "object"
      ? (body as Record<string, unknown>).pathname
      : undefined;
  if (typeof url !== "string" || typeof pn !== "string")
    throw new Error("الرفع متمّش — حاول تاني");
  return { url, pathname: pn };
}
