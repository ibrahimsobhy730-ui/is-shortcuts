/* Port of the @hatch/space-sdk `describeRequest` build-time macro
   (dist/client/field-props.js): form-input attributes read from the same
   Zod request schema the server enforces, so the page and the server
   can't disagree about a field's limits. Here it runs in the
   `gen:fields` script (Bun) and writes components/fields.generated.ts —
   a static file the client imports — instead of running as a Bun macro
   at bundle time. Logic is verbatim from the SDK; only the module
   shape changed. */

type ZodNode = {
  _zod?: {
    def: { type: string; innerType?: ZodNode; shape?: Record<string, ZodNode>; element?: ZodNode };
    bag?: Record<string, unknown>;
  };
};

const WRAPPERS = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "readonly",
  "catch",
]);
const INTEGER_FORMATS = new Set(["safeint", "int32", "uint32", "int64", "uint64"]);

/** The fields of a request schema, or `{}` when the request is not an object. */
export function describeRequest(schema: unknown): Record<string, unknown> {
  const node = schema as ZodNode | null | undefined;
  if (node?._zod?.def.type !== "object") {
    return {};
  }
  return describe(node, "", new Set());
}

// `active` holds the object schemas on the current path, so a self-referencing
// schema (a category with child categories) stops at its first repeat.
// A field inside an optional section (`.optional()`, `.nullable()`, `.default()`) or a list
// item is never `required`: the server accepts the section left empty, and the box that adds a
// list item is empty again once the item is added.
function describe(
  start: ZodNode,
  name: string,
  active: Set<ZodNode>,
  parentOptional = false,
): Record<string, unknown> {
  let node = start;
  let optional = parentOptional;
  while (
    node._zod !== undefined &&
    WRAPPERS.has(node._zod.def.type) &&
    node._zod.def.innerType !== undefined
  ) {
    if (node._zod.def.type !== "readonly" && node._zod.def.type !== "catch") {
      optional = true;
    }
    node = node._zod.def.innerType as ZodNode;
  }
  const def = node._zod?.def;
  if (!def) return { name };
  if (def.type === "object" && def.shape !== undefined) {
    if (active.has(node)) return {};
    active.add(node);
    const fields: Record<string, unknown> = {};
    for (const [field, child] of Object.entries(def.shape)) {
      fields[field] = describe(child, field, active, optional);
    }
    active.delete(node);
    return fields;
  }
  if (def.type === "array" && def.element !== undefined) {
    return describe(def.element, name, active, true);
  }
  return scalar(node, name, optional);
}

function scalar(
  node: ZodNode,
  name: string,
  optional: boolean,
): Record<string, unknown> {
  const props: Record<string, unknown> = { name };
  const bag = node._zod?.bag ?? {};
  if (node._zod?.def.type === "string") {
    const minimum = bag.minimum as number | undefined;
    const maximum = bag.maximum as number | undefined;
    const format = bag.format as string | undefined;
    if (minimum !== undefined && minimum > 0) {
      props.minLength = minimum;
      if (!optional) props.required = true;
    }
    if (maximum !== undefined) props.maxLength = maximum;
    if (format === "email" || format === "url") {
      props.type = format;
      if (!optional) props.required = true;
    }
    return props;
  }
  if (node._zod?.def.type === "number") {
    // An exclusive bound on an integer becomes the next allowed whole number;
    // on a decimal it stays the bound itself (HTML has no exclusive bound), and
    // the server still rejects the bound with a readable error.
    const format = bag.format as string | undefined;
    const integer = format !== undefined && INTEGER_FORMATS.has(format);
    const step = integer ? 1 : 0;
    props.type = "number";
    props.step = integer ? 1 : "any";
    if (!optional) props.required = true;
    const min = tightest(
      Math.max,
      bag.minimum as number | undefined,
      bag.exclusiveMinimum as number | undefined,
      step,
    );
    const max = tightest(
      Math.min,
      bag.maximum as number | undefined,
      bag.exclusiveMaximum as number | undefined,
      -step,
    );
    if (min !== undefined) props.min = min;
    if (max !== undefined) props.max = max;
  }
  return props;
}

// `.int()` adds the safe-integer range as its own bound; it is not a limit a
// person could reach by typing, so it never becomes an attribute.
function tightest(
  pick: (a: number, b: number) => number,
  inclusive: number | undefined,
  exclusive: number | undefined,
  integerStep: number,
): number | undefined {
  const bounds = [
    inclusive,
    exclusive === undefined ? undefined : exclusive + integerStep,
  ].filter(
    (bound): bound is number =>
      bound !== undefined &&
      Number.isFinite(bound) &&
      Math.abs(bound) < Number.MAX_SAFE_INTEGER,
  );
  return bounds.length === 0 ? undefined : bounds.reduce(pick);
}
