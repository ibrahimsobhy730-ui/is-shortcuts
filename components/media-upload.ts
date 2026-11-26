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
   here, never a silent spinner.
   IMAGES ONLY (قرار المالك 2026-11-26): video upload was
   cancelled entirely — every function here takes images only.
   DIAGNOSABILITY (2026-11-26, live run 23:19–23:28 EET): the
   server fallback used to throw the route's bare message with no
   status, so the classifier saw no cause and the UI showed a bare
   «الرفع متمّش» at stage «الرفع من السيرفر». uploadViaServer now
   always appends (HTTP <status>) + the Blob error code, so the
   cause surfaces. The token mint retries once with the session
   token freshly re-read from storage when the first mint fails
   with «انتهت الجلسة» while the UI session is alive. */


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
  /* The XHR / server fallbacks report the raw HTTP status (and the
     Blob API's error code when the body carried one) — map the
     status the same way the SDK's getBlobError maps its codes, so
     a 403 from any path reads as «forbidden» instead of the
     generic «unknown» (the 2026-11-26 cloud run showed exactly
     that: every path failed, the UI said only «الرفع متمّش»).
     This check MUST sit above the network check: «load failed»
     is a substring of «upload failed», so a bare status string
     would otherwise read as a network failure. */
  const http = /Blob upload failed \((\d{3})/.exec(msg) ??
    /server upload failed \(HTTP (\d{3})\)/.exec(msg) ??
    /\(HTTP (\d{3})\)/.exec(msg);
  if (http) {
    const status = Number(http[1]);
    if (status === 401) return "token";
    if (status === 403) return "forbidden";
    if (status === 404) return "not-found";
    if (status === 429) return "service";
    if (status >= 500) return "service";
  }
  if (
    /failed to fetch|network request failed|networkerror|load failed|fetch failed|network error|terminated/i.test(
      msg,
    )
  )
    return "network";
  return "unknown";
}

export function uploadErrorMessage(kind: UploadFailureKind): string {
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
      return "الصورة لازم تكون JPG أو PNG أو WebP — الـ GIF مش مدعوم دلوقتي";
    case "too-large":
      return "الصورة أكبر من 8 ميجا — جرّب صورة أصغر";
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
/* The session token as the browser stores it right now
   (localStorage when "remember me", sessionStorage otherwise) —
   fresher than any token a modal captured as a prop when it
   opened. Used for the one mint retry below. */
export function readStoredSessionToken(): string {
  try {
    if (typeof window === "undefined") return "";
    return (
      window.localStorage.getItem("is-session-token") ??
      window.sessionStorage.getItem("is-session-token") ??
      ""
    );
  } catch {
    return "";
  }
}

export async function mintClientToken(
  token: string,
  pathname: string,
  shortcutId: number,
): Promise<string> {
  const attempt = async (tok: string): Promise<string> => {
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname,
          clientPayload: JSON.stringify({ token: tok, shortcutId }),
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
          : `مش قادر يجهّز الرفع (HTTP ${res.status}) — حاول تاني`;
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
  };
  try {
    return await attempt(token);
  } catch (e) {
    /* Session-ended at mint while the UI session is alive (live
       run 2026-11-26 23:19–23:28 EET, try 3): the token the modal
       captured as a prop can be stale — the stored token may have
       been refreshed since. Retry ONCE with the token freshly
       re-read from storage; if that fails the same way, the
       session really is gone and the original message stands. */
    const msg = e instanceof Error ? e.message : "";
    if (!/انتهت الجلسة/.test(msg)) throw e;
    const fresh = readStoredSessionToken();
    if (!fresh || fresh === token) throw e;
    return await attempt(fresh);
  }
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
   for an ~83 KB PNG and at 0% for a small image. This counter
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
      /* Surface the API's error code AND the HTTP status, not just
         the message: the code is what distinguishes «the store
         refuses public blobs» (forbidden) from a transport
         failure, and classifyUploadError maps both. */
      const code =
        errRec !== null && typeof errRec.code === "string" ? errRec.code : "";
      const detail = [msg, code ? `code: ${code}` : "", `HTTP ${xhr.status}`]
        .filter(Boolean)
        .join(" — ");
      reject(new Error(detail || `Blob upload failed (${xhr.status})`));
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
   route, which put()s them with the resolved Blob token
   (lib/blob-token.ts: PUBLIC_BLOB_READ_WRITE_TOKEN first). Serverless
   bodies cap at ~4.5 MB, so this is images/small files only.
   DIAGNOSABILITY: the thrown error always carries the HTTP status
   (and the Blob error code when the route reported one), so
   classifyUploadError can name the cause instead of returning
   «unknown» for a bare server message. */
export async function uploadViaServer(
  token: string,
  shortcutId: number,
  pathname: string,
  file: File,
): Promise<{ url: string; pathname: string }> {
  const form = new FormData();
  form.set("token", token);
  form.set("shortcutId", String(shortcutId));
  form.set("pathname", pathname);
  form.set("file", file);
  const res = await fetch("/api/media/upload-direct", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const rec =
      body !== null && typeof body === "object"
        ? (body as Record<string, unknown>)
        : null;
    const msg =
      rec !== null && typeof rec.error === "string"
        ? rec.error
        : `الرفع من السيرفر فشل — حاول تاني`;
    const code =
      rec !== null && typeof rec.code === "string" && rec.code
        ? ` — code: ${rec.code}`
        : "";
    const status = `(HTTP ${res.status})`;
    throw new Error(
      msg.includes("(HTTP") ? `${msg}${code}` : `${msg}${code} ${status}`,
    );
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
    throw new Error("رد السيرفر مش مفهوم — حاول تاني");
  return { url, pathname: pn };
}
