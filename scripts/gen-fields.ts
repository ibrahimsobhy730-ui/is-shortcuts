/* Generates components/fields.generated.ts — the static FIELDS map the
   client spreads onto its form inputs. Replaces the @hatch/space-sdk
   `actionFields` Bun macro: same schemas, same attributes, computed
   once here instead of at bundle time.
   Run: bun run gen:fields   (re-run after any request-schema change) */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Actions } from "../lib/actions.ts";
import { describeRequest } from "../lib/fields.ts";

const fields: Record<string, unknown> = {};
for (const [action, definition] of Object.entries(Actions)) {
  fields[action] = describeRequest(
    (definition as { request: unknown }).request,
  );
}

const out = `/* GENERATED — do not edit by hand. Run \`bun run gen:fields\` to
   regenerate from lib/actions.ts (the request schemas are the source
   of truth, so the page and the server can never disagree about a
   field's limits). */

export const FIELDS = ${JSON.stringify(fields, null, 2)} as const;
`;

writeFileSync(join(import.meta.dirname, "..", "components", "fields.generated.ts"), out);
console.log(
  `wrote components/fields.generated.ts (${Object.keys(fields).length} actions)`,
);
