import type { FilterRule } from "../components/FilterEditDialog";
import type { CubeFilterExpr, CubeQuery } from "./cubeTypes";

// ── Date helpers ──────────────────────────────────────────────────────────

function fmt(date: Date, kind: "datetime" | "date"): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const [y, mo, d] = [date.getFullYear(), p(date.getMonth() + 1), p(date.getDate())];
  if (kind === "date") return `${y}-${mo}-${d}`;
  return `${y}-${mo}-${d} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function unitMs(unit: string, n: number): number {
  const table: Record<string, number> = {
    seconds: 1_000, minutes: 60_000, hours: 3_600_000,
    days: 86_400_000, weeks: 7 * 86_400_000,
    months: 30 * 86_400_000, years: 365 * 86_400_000,
  };
  return (table[unit] ?? 86_400_000) * n;
}

// ── Clause builder ────────────────────────────────────────────────────────

/**
 * Convert a FilterRule + a resolved (source-qualified) field name into a
 * Cube filter expression. Returns null if the rule is incomplete or the
 * operator needs no clause.
 */
export function buildCubeFilterExpr(rule: FilterRule, fieldName: string): CubeFilterExpr | null {
  const { operator, value, kind, uiType } = rule;
  const isDate = kind === "datetime" || kind === "date";
  const dk = kind as "datetime" | "date";
  const member = fieldName;

  if (operator === "is null")      return { member, operator: "notSet" };
  if (operator === "is not null")  return { member, operator: "set" };
  if (operator === "is empty")     return { member, operator: "equals", values: [""] };
  if (operator === "is not empty") return { member, operator: "notEquals", values: [""] };

  if (!value) return null;

  // Multi-select always means "any of these values" — Cube's `equals` with
  // multiple values is an IN clause, regardless of which operator happens
  // to be set (the picker itself never exposes one).
  if (uiType === "multiselect") {
    const raw = value.split(",").map((v) => v.trim()).filter(Boolean);
    if (!raw.length) return null;
    return { member, operator: "equals", values: raw };
  }

  // A slicer always means "between these two values" — same reasoning as multiselect above.
  if (uiType === "slicer") {
    const [a, b] = value.split(",");
    if (!a || !b) return null;
    if (kind === "number") {
      if (isNaN(parseFloat(a)) || isNaN(parseFloat(b))) return null;
      return { and: [{ member, operator: "gte", values: [a] }, { member, operator: "lte", values: [b] }] };
    }
    if (isDate) {
      const da = new Date(a), db = new Date(b);
      if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
      return { member, operator: "inDateRange", values: [fmt(da, dk), fmt(db, dk)] };
    }
    return null;
  }

  // ── Date / DateTime ─────────────────────────────────────────────────────
  if (isDate) {
    if (["after", "before"].includes(operator)) {
      let date: Date;
      if (value.startsWith("absolute|")) {
        date = new Date(value.slice(9));
      } else if (value.startsWith("relative|")) {
        const [, unit = "days", amtStr = "1"] = value.split("|");
        date = new Date(Date.now() - unitMs(unit, +amtStr || 1));
      } else {
        date = new Date(value);
      }
      if (isNaN(date.getTime())) return null;
      return { member, operator: operator === "after" ? "afterDate" : "beforeDate", values: [fmt(date, dk)] };
    }

    if (["last", "next"].includes(operator)) {
      const [amtStr = "1", unit = "days"] = value.split(":");
      const ms = unitMs(unit, +amtStr || 1);
      const now = new Date();
      const other = new Date(operator === "last" ? now.getTime() - ms : now.getTime() + ms);
      const [a, b] = operator === "last" ? [other, now] : [now, other];
      return { member, operator: "inDateRange", values: [fmt(a, dk), fmt(b, dk)] };
    }

    if (["between", "not between"].includes(operator)) {
      const [a, b] = value.split(",");
      const da = new Date(a), db = new Date(b);
      if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
      return { member, operator: operator === "not between" ? "notInDateRange" : "inDateRange", values: [fmt(da, dk), fmt(db, dk)] };
    }

    if (operator === "equals")     return { member, operator: "equals", values: [value] };
    if (operator === "not equals") return { member, operator: "notEquals", values: [value] };
    return null;
  }

  // ── Number ───────────────────────────────────────────────────────────────
  if (kind === "number") {
    const n = parseFloat(value);
    const opMap: Record<string, string> = {
      "equals": "equals", "not equals": "notEquals",
      "greater than": "gt", "greater than or equal to": "gte",
      "less than": "lt", "less than or equal to": "lte",
    };
    if (opMap[operator]) {
      if (isNaN(n)) return null;
      return { member, operator: opMap[operator], values: [value] };
    }
    if (["between", "not between"].includes(operator)) {
      const [a, b] = value.split(",");
      if (isNaN(parseFloat(a)) || isNaN(parseFloat(b))) return null;
      return operator === "between"
        ? { and: [{ member, operator: "gte", values: [a] }, { member, operator: "lte", values: [b] }] }
        : { or: [{ member, operator: "lt", values: [a] }, { member, operator: "gt", values: [b] }] };
    }
    if (operator === "is any of") {
      const nums = value.split(",").map((v) => v.trim()).filter((v) => !isNaN(parseFloat(v)));
      if (!nums.length) return null;
      return { member, operator: "equals", values: nums };
    }
    return null;
  }

  // ── Text ─────────────────────────────────────────────────────────────────
  if (kind === "text") {
    const opMap: Record<string, string> = {
      "equals": "equals", "not equals": "notEquals",
      "contains": "contains", "not contains": "notContains",
      "starts with": "startsWith", "not starts with": "notStartsWith",
      "ends with": "endsWith", "not ends with": "notEndsWith",
    };
    if (opMap[operator]) return { member, operator: opMap[operator], values: [value] };
    if (operator === "is any of") {
      const vals = value.split(",").map((v) => v.trim()).filter(Boolean);
      if (!vals.length) return null;
      return { member, operator: "equals", values: vals };
    }
  }

  return null;
}

/** Merges extra filter expressions into a Cube query object's `filters` array. */
export function injectFiltersIntoQuery(query: CubeQuery, filters: CubeFilterExpr[]): CubeQuery {
  if (!filters.length) return query;
  return { ...query, filters: [...(query.filters ?? []), ...filters] };
}
