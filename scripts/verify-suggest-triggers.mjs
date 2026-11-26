// Extract suggestTriggers + deps verbatim from components/App.tsx and test them.
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

const src = readFileSync(new URL("../components/App.tsx", import.meta.url), "utf8");
const grab = (re, name) => {
  const m = src.match(re);
  if (!m) throw new Error("not found: " + name);
  return m[0];
};
const code = [
  grab(/function normalizeSearchText[\s\S]*?\n\}/, "normalizeSearchText"),
  grab(/const TRIGGER_STOPWORDS[\s\S]*?\n\]\);/, "TRIGGER_STOPWORDS"),
  grab(/function suggestTriggers\([\s\S]*?\n\}/, "suggestTriggers"),
].join("\n\n");
const js = transpileModule(code, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.CommonJS } }).outputText;
const fn = new Function(`${js}\nreturn suggestTriggers;`)();

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};
// The reported case: reply «تيست», typing «تر» — old code returned [].
const test = { title: "تيست", body: "تيست", trigger: null };
check("1. «تر» in «تيست» editor falls back, never empty", (() => {
  const r = fn(test, [], "تر");
  return r.length > 0 && r.includes("تيست");
})(), JSON.stringify(fn(test, [], "تر")));
check("2. empty field still shows easiest first", (() => {
  const r = fn(test, [], "");
  return r.length > 0 && r[0] === "تيست";
})(), JSON.stringify(fn(test, [], "")));
// Arabic-aware narrowing still works when it matches.
const wel = { title: "ترحيب", body: "وعليكم السلام ورحمة الله وبركاته", trigger: null };
check("3. «تر» narrows to «ترحيب» when it matches", (() => {
  const r = fn(wel, [], "تر");
  return r.includes("ترحيب");
})(), JSON.stringify(fn(wel, [], "تر")));
// «ال»-insensitive prefix still works.
check("4. «التر» still matches «ترحيب»", fn(wel, [], "التر").includes("ترحيب"), JSON.stringify(fn(wel, [], "التر")));
// Only-free: taken suggestions excluded, fallback respects it too.
check("5. taken candidate excluded (incl. fallback)", (() => {
  const r = fn(test, ["تيست"], "تر");
  return !r.includes("تيست");
})(), JSON.stringify(fn(test, ["تيست"], "تر")));
// Own trigger excluded.
const own = { title: "تيست", body: "تيست", trigger: "تيست" };
check("6. own trigger excluded", !fn(own, [], "").includes("تيست"), JSON.stringify(fn(own, [], "")));
// Max 3, easiest first, never auto-assigned (pure function, no mutation of item).
const rich = { title: "أسعار الاشتراك السنوي", body: "الخطة كلاس متاحة لكل السنوات الدراسية", trigger: null };
check("7. max 3 suggestions", fn(rich, [], "").length <= 3, JSON.stringify(fn(rich, [], "")));
check("8. typed text itself never suggested", (() => {
  const r = fn(rich, [], "أسعار");
  return !r.includes("أسعار");
})(), JSON.stringify(fn(rich, [], "أسعار")));
// Fallback keeps easiest-first order (title first word first).
check("9. fallback order is easiest-first", (() => {
  const r = fn(rich, [], "zzz");
  return r.length > 0 && r[0] === "أسعار";
})(), JSON.stringify(fn(rich, [], "zzz")));
// No candidates at all (all stopwords) -> still empty, honestly (nothing to suggest).
const stop = { title: "في من", body: "على عن", trigger: null };
check("10. all-stopword reply honestly returns []", fn(stop, [], "تر").length === 0, JSON.stringify(fn(stop, [], "تر")));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
