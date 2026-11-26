/* Pure share/import logic for shortcuts — no DOM, no React, so
   the classification is unit-testable in Node (see
   scripts/verify-share-import.mjs). The browser steps (file
   reading, download, the actual create/assign mutations) live in
   components/App.tsx (ShareShortcutsRow) and call these helpers.

   The rules (2026-11-26, owner requirement):
   - export: my triggers as { trigger, title, body, category }.
   - import: only FREE triggers are imported. A trigger I already
     have (case-insensitive) is a CONFLICT — shown and skipped,
     never overwriting my existing trigger. A trigger whose reply
     I already have (same title + body) is LINKED to my reply;
     otherwise the reply is CREATED with its trigger. Invalid
     entries (missing trigger/title/body) are dropped silently. */

export type ImportEntry = {
  trigger: string;
  title: string;
  body: string;
  category: string;
};

export type ImportPlan = {
  entry: ImportEntry;
  status: "create" | "link" | "conflict";
  existingId?: number;
};

/** The export file shape (versioned so a future format stays readable). */
export type ShareExport = {
  app: "is-shortcuts";
  version: 1;
  exportedAt: string;
  triggers: ImportEntry[];
};

export function buildShareExport(
  shortcuts: Array<{
    trigger?: string | null;
    title: string;
    body: string;
    category: string;
  }>,
): ShareExport {
  return {
    app: "is-shortcuts",
    version: 1,
    exportedAt: new Date().toISOString(),
    triggers: shortcuts
      .filter((s) => s.trigger)
      .map((s) => ({
        trigger: s.trigger as string,
        title: s.title,
        body: s.body,
        category: s.category,
      })),
  };
}

/* Same key as importKeyOf in components/App.tsx (title + body,
   trimmed + lowercased) — kept in sync by hand; the two must
   agree or import-linking misses existing replies. */
function replyKey(title: string, body: string): string {
  return title.trim().toLowerCase() + "\n" + body.trim();
}

function normTrigger(t: string): string {
  return t.trim().toLowerCase();
}

/** Classify a parsed export file against my library.
    Returns null when the file holds no importable entry at all
    (not an array, or every entry invalid) — the caller shows an
    error instead of an empty plan. */
export function classifyImportEntries(
  rawList: unknown,
  myShortcuts: Array<{
    id: number;
    trigger?: string | null;
    title: string;
    body: string;
  }>,
): ImportPlan[] | null {
  const list: unknown = Array.isArray(rawList)
    ? rawList
    : (rawList as { triggers?: unknown } | null)?.triggers;
  if (!Array.isArray(list)) return null;
  const taken = new Set(
    myShortcuts
      .filter((s) => s.trigger)
      .map((s) => normTrigger(s.trigger as string)),
  );
  const byKey = new Map(
    myShortcuts.map((s) => [replyKey(s.title, s.body), s]),
  );
  const seen = new Set<string>();
  const plans: ImportPlan[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const trigger =
      typeof rec.trigger === "string" ? rec.trigger.trim() : "";
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    const body = typeof rec.body === "string" ? rec.body : "";
    const category =
      typeof rec.category === "string" && rec.category.trim()
        ? rec.category.trim().slice(0, 60)
        : "مستوردة";
    if (!trigger || !title || !body) continue;
    const key = normTrigger(trigger);
    if (taken.has(key) || seen.has(key)) {
      plans.push({
        entry: { trigger, title, body, category },
        status: "conflict",
      });
      continue;
    }
    seen.add(key);
    const existing = byKey.get(replyKey(title, body));
    plans.push(
      existing
        ? {
            entry: { trigger, title, body, category },
            status: "link",
            existingId: existing.id,
          }
        : {
            entry: { trigger, title, body, category },
            status: "create",
          },
    );
  }
  return plans.length === 0 ? null : plans;
}
