/* Test-only check of the pure share/import helpers in
   components/share-shortcuts.ts (no DOM, no browser): the export
   shape, and the import classification — free triggers import,
   taken triggers are conflicts (never overwriting), a trigger
   whose reply I already have links to my reply, invalid entries
   are dropped, an empty file yields no plan.
   Usage: node scripts/verify-share-import.mjs */

import {
  buildShareExport,
  classifyImportEntries,
} from "../components/share-shortcuts.ts";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const MINE = [
  { id: 1, trigger: "12", title: "ابتدائي أقل من رابع", body: "غير متاح" },
  { id: 2, trigger: "عربي", title: "أسعار ابتدائي وإعدادي — عربي", body: "الأسعار…" },
  { id: 3, trigger: null, title: "تيست", body: "نص تجريبي" },
];

try {
  // ---- export: only triggers, with title + body + category.
  const exp = buildShareExport(MINE.map((m) => ({ ...m, category: "قواعد" })));
  check("export app + version", exp.app === "is-shortcuts" && exp.version === 1);
  check(
    "export carries only triggered replies",
    exp.triggers.length === 2 &&
      exp.triggers.every((t) => t.trigger && t.title && t.body && t.category),
    `${exp.triggers.length} triggers`,
  );
  check("export keeps the trigger as typed", exp.triggers[0].trigger === "12");

  // ---- import: a fresh trigger for a new reply -> create.
  let plan = classifyImportEntries(
    [{ trigger: "سلام", title: "رد السلام", body: "وعليكم السلام", category: "ترحيب" }],
    MINE,
  );
  check(
    "import fresh trigger -> create",
    plan?.length === 1 && plan[0].status === "create" && plan[0].entry.trigger === "سلام",
    JSON.stringify(plan),
  );

  // ---- import: my trigger (exact + case-insensitive) -> conflict.
  plan = classifyImportEntries(
    [
      { trigger: "12", title: "أي رد", body: "أي نص" },
      { trigger: "عربي", title: "رد تاني", body: "نص تاني" },
    ],
    MINE,
  );
  check(
    "import taken triggers -> conflict, never overwrite",
    plan?.length === 2 && plan.every((p) => p.status === "conflict"),
    JSON.stringify(plan),
  );

  // ---- import: same reply I already have -> link to my reply.
  plan = classifyImportEntries(
    [{ trigger: "تجربة", title: "تيست", body: "نص تجريبي" }],
    MINE,
  );
  check(
    "import known reply -> link to my reply id",
    plan?.length === 1 && plan[0].status === "link" && plan[0].existingId === 3,
    JSON.stringify(plan),
  );

  // ---- import: duplicate trigger inside the file -> 2nd is conflict.
  plan = classifyImportEntries(
    [
      { trigger: "جديد", title: "أ", body: "ب" },
      { trigger: "جديد", title: "ج", body: "د" },
    ],
    MINE,
  );
  check(
    "import duplicate inside the file -> 2nd conflicts",
    plan?.length === 2 && plan[0].status === "create" && plan[1].status === "conflict",
    JSON.stringify(plan),
  );

  // ---- import: invalid entries dropped; empty file -> null.
  plan = classifyImportEntries(
    [
      { trigger: "", title: "بلا اختصار", body: "نص" },
      { title: "بلا اختصار", body: "نص" },
      { trigger: "سليم", title: "رد سليم", body: "نص سليم" },
    ],
    MINE,
  );
  check(
    "import drops invalid entries, keeps the valid one",
    plan?.length === 1 && plan[0].entry.trigger === "سليم",
    JSON.stringify(plan),
  );
  check(
    "import empty list -> null",
    classifyImportEntries([], MINE) === null,
  );
  check(
    "import garbage -> null",
    classifyImportEntries({ nope: true }, MINE) === null,
  );
  check(
    "import accepts the { triggers: [...] } wrapper",
    classifyImportEntries(
      { app: "is-shortcuts", version: 1, triggers: [{ trigger: "x", title: "t", body: "b" }] },
      MINE,
    )?.[0]?.status === "create",
  );
  check(
    "import missing category defaults to مستوردة",
    classifyImportEntries([{ trigger: "y", title: "t", body: "b" }], MINE)?.[0]
      ?.entry.category === "مستوردة",
  );
} catch (e) {
  console.log(`ERROR: ${e.stack ?? e.message}`);
  fail++;
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
