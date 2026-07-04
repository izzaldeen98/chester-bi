import type { FilterRule } from "../components/FilterEditDialog";

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
 * Convert a FilterRule + a resolved field name into a Malloy `where:` expression.
 * Returns null if the rule is incomplete or the operator needs no clause.
 */
export function buildMalloyFilterClause(rule: FilterRule, fieldName: string): string | null {
  const { operator, value, kind } = rule;
  const isDate = kind === "datetime" || kind === "date";
  const dk = kind as "datetime" | "date";

  if (operator === "is null")      return `${fieldName} = null`;
  if (operator === "is not null")  return `${fieldName} != null`;
  if (operator === "is empty")     return `${fieldName} = ''`;
  if (operator === "is not empty") return `${fieldName} != ''`;

  if (!value) return null;

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
      const ds = fmt(date, dk);
      return operator === "after" ? `${fieldName} > @${ds}` : `${fieldName} < @${ds}`;
    }

    if (["last", "next"].includes(operator)) {
      const [amtStr = "1", unit = "days"] = value.split(":");
      const ms = unitMs(unit, +amtStr || 1);
      const now = new Date();
      const other = new Date(operator === "last" ? now.getTime() - ms : now.getTime() + ms);
      const [a, b] = operator === "last" ? [other, now] : [now, other];
      return `${fieldName} >= @${fmt(a, dk)} and ${fieldName} <= @${fmt(b, dk)}`;
    }

    if (["between", "not between"].includes(operator)) {
      const [a, b] = value.split(",");
      const da = new Date(a), db = new Date(b);
      if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
      const clause = `${fieldName} >= @${fmt(da, dk)} and ${fieldName} <= @${fmt(db, dk)}`;
      return operator === "not between" ? `not (${clause})` : clause;
    }

    if (operator === "equals")     return `${fieldName} = @${value}`;
    if (operator === "not equals") return `${fieldName} != @${value}`;
  }

  // ── Number ───────────────────────────────────────────────────────────────
  if (kind === "number") {
    const n = parseFloat(value);
    if (isNaN(n)) return null;
    const m: Record<string, string> = {
      "equals":                   `${fieldName} = ${n}`,
      "not equals":               `${fieldName} != ${n}`,
      "greater than":             `${fieldName} > ${n}`,
      "less than":                `${fieldName} < ${n}`,
      "greater than or equal to": `${fieldName} >= ${n}`,
      "less than or equal to":    `${fieldName} <= ${n}`,
    };
    if (m[operator]) return m[operator];
    if (["between", "not between"].includes(operator)) {
      const [a, b] = value.split(",").map(parseFloat);
      if (isNaN(a) || isNaN(b)) return null;
      const clause = `${fieldName} >= ${a} and ${fieldName} <= ${b}`;
      return operator === "not between" ? `not (${clause})` : clause;
    }
  }

  // ── Text ─────────────────────────────────────────────────────────────────
  if (kind === "text") {
    const esc = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const m: Record<string, string> = {
      "equals":          `${fieldName} = '${esc}'`,
      "not equals":      `${fieldName} != '${esc}'`,
      "contains":        `${fieldName} ~ r'${esc}'`,
      "not contains":    `not ${fieldName} ~ r'${esc}'`,
      "starts with":     `${fieldName} ~ r'^${esc}'`,
      "not starts with": `not ${fieldName} ~ r'^${esc}'`,
      "ends with":       `${fieldName} ~ r'${esc}$'`,
      "not ends with":   `not ${fieldName} ~ r'${esc}$'`,
    };
    return m[operator] ?? null;
  }

  return null;
}

/**
 * Append WHERE clauses to an existing Malloy `run:` query block.
 * Multiple `where:` lines are ANDed by Malloy implicitly.
 */
export function injectFiltersIntoQuery(malloyQuery: string, clauses: string[]): string {
  if (!clauses.length) return malloyQuery;
  const lines = clauses.map((c) => `  where: ${c}`).join("\n");
  const lastBrace = malloyQuery.lastIndexOf("}");
  if (lastBrace === -1) return malloyQuery;
  return malloyQuery.slice(0, lastBrace) + lines + "\n" + malloyQuery.slice(lastBrace);
}
