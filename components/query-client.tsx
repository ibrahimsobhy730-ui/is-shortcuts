"use client";

/* Shared TanStack Query client — the local equivalent of the SDK's
   `spaceQueryClient`, with the same conservative defaults:
   - queries retry only explicit retryable action errors (bounded
     exponential backoff with full jitter), stale after 30s, no
     refetch on window focus;
   - a mutation with no onError/onSettled of its own shows its
     failure as a short notice at the bottom of the page, so a save
     with no handler is never silent. */

import { MutationCache, QueryClient } from "@tanstack/react-query";

/** Error thrown by an `api.*` call when /api/actions answers non-OK.
    Same shape as the SDK's SpaceActionError so the retry policy and
    any message reading behave identically. */
export class SpaceActionError extends Error {
  status: number;
  retryAfterMs?: number;
  retrySafe: boolean;
  code?: string;
  issues: Array<{ path: string[]; message: string }>;
  detail: string;

  constructor(
    message: string,
    status: number,
    retryAfterMs?: number,
    retrySafe = false,
    code?: string,
    issues: Array<{ path: string[]; message: string }> = [],
    detail = message,
  ) {
    super(message);
    this.name = "SpaceActionError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.retrySafe = retrySafe;
    this.code = code;
    this.issues = issues;
    this.detail = detail;
  }
}

// A failed connection or gateway response cannot prove that the
// handler did not commit a write.
export const PERMANENT_ACTION_STATUSES = new Set([
  400, 401, 403, 404, 409, 413, 415, 422,
]);

/** Retries after the first failure for a retryable action error. */
export const MAX_ACTION_RETRIES = 3;
const RETRY_BASE_MS = 1_000;
const RETRY_CAP_MS = 30_000;

/** Default retry predicate. Retry only explicit pre-invocation failures,
    with bounded backoff. */
export function shouldRetryAction(
  failureCount: number,
  error: unknown,
): boolean {
  if (
    error instanceof SpaceActionError &&
    PERMANENT_ACTION_STATUSES.has(error.status)
  ) {
    return false;
  }
  return (
    error instanceof SpaceActionError &&
    error.retrySafe &&
    failureCount < MAX_ACTION_RETRIES
  );
}

/** Retry delay: exponential backoff with full jitter, honoring the
    server's `Retry-After` (carried on the error) as a floor. */
export function actionRetryDelay(
  failureCount: number,
  error: unknown,
): number {
  const ceiling = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** failureCount);
  const floor =
    error instanceof SpaceActionError && error.retryAfterMs != null
      ? Math.min(RETRY_CAP_MS, Math.max(0, error.retryAfterMs))
      : 0;
  return floor + Math.random() * ceiling;
}

const NOTICE_ID = "is-action-failure-notice";
const VISIBLE_MS = 6_000;

function showFailureNotice(error: unknown): void {
  if (typeof document === "undefined" || document.body === null) return;
  const message =
    error instanceof SpaceActionError && error.message.length > 0
      ? error.message
      : "حصلت مشكلة — حاول تاني";
  let notice = document.getElementById(NOTICE_ID);
  if (notice === null) {
    notice = document.createElement("div");
    notice.id = NOTICE_ID;
    notice.setAttribute("role", "alert");
    Object.assign(notice.style, {
      position: "fixed",
      left: "16px",
      right: "16px",
      bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      width: "fit-content",
      maxWidth: "480px",
      marginInline: "auto",
      pointerEvents: "none",
      padding: "12px 16px",
      borderRadius: "12px",
      background: "var(--text, #1c1c1e)",
      color: "var(--bg, #ffffff)",
      font: "500 15px/1.4 system-ui, -apple-system, sans-serif",
      whiteSpace: "pre-line",
      boxShadow: "0 6px 24px rgba(0, 0, 0, 0.2)",
      zIndex: "2147483647",
    });
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  window.setTimeout(() => {
    document.getElementById(NOTICE_ID)?.remove();
  }, VISIBLE_MS);
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (
        mutation.options.onError === undefined &&
        mutation.options.onSettled === undefined
      ) {
        showFailureNotice(error);
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: shouldRetryAction,
      retryDelay: actionRetryDelay,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
