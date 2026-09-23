import type { RuleGroupType, RuleType } from "react-querybuilder";
import type { FieldInfo } from "./cubeTypes";

export const FILTER_WRAPPER_KEY = "filter";

type Granularity = string;

export function isRuleGroupType(value: unknown): value is RuleGroupType {
  return !!value && typeof value === "object" && "combinator" in value && "rules" in value;
}

function isFilterRule(r: RuleType | RuleGroupType): r is RuleType {
  return "field" in r;
}

/**
 * Recursively splits a filter tree by field kind: rules on measure fields
 * become the `having` clause, everything else stays in `where`. Nested
 * groups keep their combinator/shape; groups left with no rules are dropped.
 */
export function partitionFilterQuery(
  query: RuleGroupType,
  fields: FieldInfo[],
): { where: RuleGroupType | null; having: RuleGroupType | null } {
  const isMeasure = (fieldName: string) =>
    fields.find((f) => f.name === fieldName)?.kind?.toLowerCase() === "measure";

  function split(group: RuleGroupType): { where: RuleGroupType | null; having: RuleGroupType | null } {
    const whereRules: (RuleType | RuleGroupType)[] = [];
    const havingRules: (RuleType | RuleGroupType)[] = [];

    for (const rule of group.rules) {
      if (isFilterRule(rule)) {
        (isMeasure(rule.field) ? havingRules : whereRules).push(rule);
      } else {
        const nested = split(rule);
        if (nested.where) whereRules.push(nested.where);
        if (nested.having) havingRules.push(nested.having);
      }
    }

    return {
      where: whereRules.length ? { ...group, rules: whereRules } : null,
      having: havingRules.length ? { ...group, rules: havingRules } : null,
    };
  }

  return split(query);
}

/**
 * Recombines previously-split where/having trees into one editable tree.
 * ponytail: flattens to a single top-level group rather than reconstructing exact
 * nested combinators — round-trips fine since partitionFilterQuery re-derives on save.
 */
export function mergeFilterQuery(where: RuleGroupType | null, having: RuleGroupType | null): RuleGroupType {
  return {
    combinator: where?.combinator ?? having?.combinator ?? "and",
    rules: [...(where?.rules ?? []), ...(having?.rules ?? [])],
  };
}

/** Persist filters as wrapped RuleGroupType JSON: `{ filter: RuleGroupType }`. */
export function wrapFilters(filter: RuleGroupType): Record<string, RuleGroupType> | undefined {
  if (!filter.rules?.length) return undefined;
  return { [FILTER_WRAPPER_KEY]: filter };
}

/** Unwrap filters saved as `{ filter: RuleGroupType }` or raw RuleGroupType. */
export function unwrapFilters(stored: unknown): RuleGroupType | null {
  if (!stored) return null;
  if (isRuleGroupType(stored)) return stored;
  if (typeof stored === "object" && stored !== null && FILTER_WRAPPER_KEY in stored) {
    const inner = (stored as Record<string, unknown>)[FILTER_WRAPPER_KEY];
    if (isRuleGroupType(inner)) return inner;
  }
  return null;
}

/** Serialize group-by fields; granularity stored as `field_name.gran`. */
export function buildGroupByFields(
  fields: FieldInfo[],
  granularityFor: (field: FieldInfo) => Granularity | undefined,
): string[] {
  return fields.map((field) => {
    const gran = granularityFor(field);
    return gran ? `${field.name}.${gran}` : field.name;
  });
}

export function buildOrderByFields(
  sortMap: Array<{ field: FieldInfo; dir: "asc" | "desc" }>,
): Record<string, string> | undefined {
  if (!sortMap.length) return undefined;
  return Object.fromEntries(sortMap.map((item) => [item.field.name, item.dir]));
}
