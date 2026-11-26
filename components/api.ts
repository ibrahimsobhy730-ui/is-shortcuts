"use client";

/* Typed RPC client — the local equivalent of the SDK's
   `createActionClient`. Same call shape the app already uses
   (`api.me({ token })`, …): a Proxy that POSTs `{ action, args }` to
   `/api/actions` and returns the typed response.
   - Success: the route answers `{ data, invalidated, invalidatedKeys? }`;
     when `invalidatedKeys` is present only those query-key prefixes
     are refetched; a bare `invalidated: true` with no keys still
     refetches every query (auth/account/import actions) — exactly
     what the SDK's bridge did.
   - Failure: the route answers non-OK with `{ error }` (a string, or
     `invalid args: <zod issues JSON>` for 422s); that becomes a
     SpaceActionError carrying the HTTP status, so the query client's
     retry policy treats it like before. */

import type { Actions } from "../lib/actions";
import { queryClient, SpaceActionError } from "./query-client";

type ActionClient = {
  [K in keyof typeof Actions]: (
    args: import("zod").input<(typeof Actions)[K]["request"]>,
  ) => Promise<import("zod").output<(typeof Actions)[K]["response"]>>;
};

export type ApiResponse<C, A extends keyof C> = C[A] extends (
  args: infer _T,
) => Promise<infer R>
  ? R
  : never;

export type ApiRequest<C, A extends keyof C> = C[A] extends (
  args: infer T,
) => unknown
  ? T
  : never;

const ENDPOINT = "/api/actions";

function parseRetryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (raw === null) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1_000;
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

/** Turns a request-schema rejection into one readable line per field. */
function requestSchemaIssues(body: unknown): Array<{ path: string[]; message: string }> {
  if (body === null || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  let raw: unknown = record.issues;
  const error = record.error;
  if (
    raw === undefined &&
    typeof error === "string" &&
    error.startsWith("invalid args: ")
  ) {
    try {
      raw = JSON.parse(error.slice("invalid args: ".length));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((issue): issue is Record<string, unknown> => issue !== null && typeof issue === "object")
    .map((issue) => {
      const path = Array.isArray(issue.path) ? issue.path.map(String) : [];
      const message =
        typeof issue.message === "string" && issue.message.trim().length > 0
          ? issue.message.trim()
          : "This value is invalid.";
      return { path, message };
    });
}

async function callAction(name: string, args: unknown): Promise<unknown> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: name, args: args ?? {} }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const issues = requestSchemaIssues(body);
    const errorText =
      body !== null &&
      typeof body === "object" &&
      typeof (body as Record<string, unknown>).error === "string"
        ? ((body as Record<string, unknown>).error as string)
        : undefined;
    const message =
      issues.length > 0
        ? [...new Set(issues.map((i) => i.message))].join("\n")
        : (errorText ?? `action ${name} failed (${res.status})`);
    throw new SpaceActionError(
      message,
      res.status,
      parseRetryAfterMs(res),
      false,
      undefined,
      issues,
      `action ${name} failed: ${message}`,
    );
  }
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    (body as Record<string, unknown>).error
  ) {
    throw new Error(
      `action ${name} error: ${String((body as Record<string, unknown>).error)}`,
    );
  }
  const data = (body as { data?: unknown } | null)?.data;
  /* خفيف (2026-11-26): the server says WHICH queries changed.
     Keyed invalidation refetches only those prefixes (e.g. a copy
     records no invalidation at all — the client patches the cache
     instead); a bare `invalidated: true` with no keys still means
     the old blanket refetch, for auth/account/import actions. */
  const invalidatedKeys = (body as { invalidatedKeys?: unknown } | null)
    ?.invalidatedKeys;
  if (
    Array.isArray(invalidatedKeys) &&
    invalidatedKeys.every((k) => typeof k === "string")
  ) {
    for (const k of invalidatedKeys as string[]) {
      void queryClient.invalidateQueries({ queryKey: [k] });
    }
  } else if ((body as { invalidated?: unknown } | null)?.invalidated === true) {
    void queryClient.invalidateQueries();
  }
  return data;
}

export const api = new Proxy(
  {},
  {
    get(_target, name) {
      if (typeof name !== "string") return undefined;
      if (name === "then" || name === "catch" || name === "finally") {
        return undefined;
      }
      return (args: unknown) => callAction(name, args);
    },
  },
) as unknown as ActionClient;
