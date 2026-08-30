import { RuleGroupType, RuleType } from 'react-querybuilder';
import { FieldInfo, SourceInfo, CubeQuery, CubeFilterExpr } from './cubeTypes';

type SortDir = "asc" | "desc";
interface SortItem {
  field: FieldInfo;
  dir: SortDir;
}

function isRule(filter: any): filter is RuleType {
  return filter && typeof filter === 'object' && 'field' in filter && 'operator' in filter;
}

/**
 * Builds a Cube `/cubejs-api/v1/load` query object — replaces
 * MalloyASTQueryBuilder's Malloy query-text generation. Every field is
 * qualified with the active source's cube name ("Cube.field"), matching how
 * Cube addresses members. The same public method surface as the old builder
 * is kept so call sites barely changed; buildQuery() now returns an object
 * instead of a string.
 */
export class CubeQueryBuilder {
  private activeSchema: SourceInfo;
  // Each entry carries its own source name, so a query can pull group-by
  // fields and measures from multiple joined cubes at once, not just the
  // one this builder was constructed with (used as the default/fallback
  // source, and for filter field lookups).
  private groupByFields: { name: string; granularity?: string; sourceName: string }[] = [];
  private aggFields: { field: FieldInfo; sourceName: string }[] = [];
  private limit: number = 1000;
  private sortMap: (SortItem & { sourceName: string })[] = [];
  private filters: RuleGroupType | null = null;
  private havings: RuleGroupType | null = null;
  // Every source a filter rule might reference — the constructor's schema
  // plus any extra sources pinned alongside it, keyed by cube name.
  private sourcesByName: Map<string, SourceInfo>;

  constructor(activeSchema: SourceInfo, extraSources: SourceInfo[] = []) {
    this.activeSchema = activeSchema;
    this.sourcesByName = new Map([activeSchema, ...extraSources].map((s) => [s.name, s]));
  }

  private qualify(fieldName: string, sourceName?: string): string {
    return `${sourceName ?? this.activeSchema.name}.${fieldName}`;
  }

  public addHaving(having: RuleGroupType) {
    this.havings = having;
  }

  public addGroupBy(fieldName: string, granularity?: string, sourceName?: string) {
    this.groupByFields.push({ name: fieldName, granularity, sourceName: sourceName ?? this.activeSchema.name });
  }

  public addAgg(field: FieldInfo, sourceName?: string) {
    this.aggFields.push({ field, sourceName: sourceName ?? this.activeSchema.name });
  }

  /**
   * Cube's query API has no equivalent to Malloy's `calculate:` (arbitrary
   * partitioned window-function columns) — there's no generic way to ask
   * for an ad-hoc lag/lead/moving-average over a query's result set via
   * /load. Calculated columns are dropped rather than faked; this is a real
   * feature gap from the Malloy version, not an oversight.
   */
  public addCalculate(_name: string, _expression: string, _partitionBy: string[], _orderBy: { field: string; dir: SortDir }[]) {
    console.warn("Calculated (window function) columns have no Cube equivalent and are not included in the query.");
  }

  public setLimit(limit: number) {
    this.limit = limit;
  }

  public addSort(field: FieldInfo, dir: SortDir, sourceName?: string) {
    this.sortMap.push({ field, dir, sourceName: sourceName ?? this.activeSchema.name });
  }

  public addFilter(filters: RuleGroupType) {
    this.filters = filters;
  }

  public buildQuery(): CubeQuery {
    const query: CubeQuery = {};

    const dimensions: string[] = [];
    const timeDimensions: { dimension: string; granularity: string }[] = [];
    for (const entry of this.groupByFields) {
      if (entry.granularity) {
        timeDimensions.push({ dimension: this.qualify(entry.name, entry.sourceName), granularity: entry.granularity });
      } else {
        dimensions.push(this.qualify(entry.name, entry.sourceName));
      }
    }
    if (dimensions.length) query.dimensions = dimensions;
    if (timeDimensions.length) query.timeDimensions = timeDimensions;

    if (this.aggFields.length) {
      query.measures = this.aggFields.map(({ field, sourceName }) => this.qualify(field.name, sourceName));
    }

    if (this.limit > 0) query.limit = this.limit;

    if (this.sortMap.length) {
      const activeGroupKeys = this.groupByFields.map((f) => `${f.sourceName}::${f.name}`);
      const order: Record<string, "asc" | "desc"> = {};
      for (const sortItem of this.sortMap) {
        if (!activeGroupKeys.includes(`${sortItem.sourceName}::${sortItem.field.name}`)) continue; // same "only sort selected fields" guard as before
        order[this.qualify(sortItem.field.name, sortItem.sourceName)] = sortItem.dir;
      }
      if (Object.keys(order).length) query.order = order;
    }

    // Cube resolves whether a filter applies pre- or post-aggregation from
    // whether the member is a dimension or measure — no separate where/having
    // split is needed the way Malloy required, so both feed the same array.
    const filterExprs: CubeFilterExpr[] = [];
    if (this.filters) {
      const expr = this.processRuleGroup(this.filters);
      if (expr) filterExprs.push(expr);
    }
    if (this.havings) {
      const expr = this.processRuleGroup(this.havings);
      if (expr) filterExprs.push(expr);
    }
    if (filterExprs.length) query.filters = filterExprs;

    return query;
  }

  private processRuleGroup(group: RuleGroupType): CubeFilterExpr | null {
    if (!group.rules || group.rules.length === 0) return null;

    const expressions: CubeFilterExpr[] = [];
    for (const filter of group.rules) {
      if (isRule(filter)) {
        const expr = this.compileRule(filter);
        if (expr) expressions.push(expr);
      } else {
        const nested = this.processRuleGroup(filter);
        if (nested) expressions.push(nested);
      }
    }
    if (expressions.length === 0) return null;
    if (expressions.length === 1) return expressions[0];

    return group.combinator.toLowerCase() === "or" ? { or: expressions } : { and: expressions };
  }

  /** A filter's `field` is either a bare name (assumed to live on the
   * constructor's schema — the single-source case FilterEditDialog still
   * uses) or a `sourceName::fieldName` key (the multi-source case, once a
   * field from a pinned source is merged into the filter's field list). */
  private resolveFilterField(fieldKey: string): { fieldName: string; field: FieldInfo | undefined; sourceName: string } {
    const sep = fieldKey.indexOf("::");
    if (sep === -1) {
      return { fieldName: fieldKey, sourceName: this.activeSchema.name, field: this.activeSchema.schema?.fields?.find((f) => f.name === fieldKey) };
    }
    const sourceName = fieldKey.slice(0, sep);
    const fieldName = fieldKey.slice(sep + 2);
    const source = this.sourcesByName.get(sourceName) ?? this.activeSchema;
    return { fieldName, sourceName: source.name, field: source.schema?.fields?.find((f) => f.name === fieldName) };
  }

  private compileRule(filter: RuleType): CubeFilterExpr | null {
    const { fieldName, field: targetField, sourceName } = this.resolveFilterField(filter.field);
    const dataType = this.getFieldDataType(targetField);
    const member = this.qualify(fieldName, sourceName);

    if (filter.operator === "is null") return { member, operator: "notSet" };
    if (filter.operator === "is not null") return { member, operator: "set" };

    if (dataType === "timestamp_type" || dataType === "date_type") {
      if (["before", "after"].includes(filter.operator)) {
        const [addingType, unit, amount] = String(filter.value).split("|");
        const now = new Date();
        const date = addingType === "absolute"
          ? new Date(unit ?? "")
          : new Date(now.getTime() + (filter.operator === "before" ? -1 : 1) * unitMs(unit, Number(amount) || 1));
        if (isNaN(date.getTime())) return null;
        return { member, operator: filter.operator === "before" ? "beforeDate" : "afterDate", values: [this.formatDate(date, dataType)] };
      }
      if (["between", "not between"].includes(filter.operator)) {
        const [startValue, endValue] = String(filter.value).split(",");
        if (!startValue || !endValue) return null;
        const range = [this.formatDate(new Date(startValue), dataType), this.formatDate(new Date(endValue), dataType)];
        return { member, operator: filter.operator === "between" ? "inDateRange" : "notInDateRange", values: range };
      }
      if (["next", "last"].includes(filter.operator)) {
        const [amount, unit] = String(filter.value).split(":");
        const now = new Date();
        const ms = unitMs(unit, Number(amount) || 1);
        const other = new Date(now.getTime() + (filter.operator === "next" ? ms : -ms));
        const [a, b] = filter.operator === "next" ? [now, other] : [other, now];
        return { member, operator: "inDateRange", values: [this.formatDate(a, dataType), this.formatDate(b, dataType)] };
      }
      if (filter.operator === "equals") return { member, operator: "equals", values: [String(filter.value)] };
      if (filter.operator === "not equals") return { member, operator: "notEquals", values: [String(filter.value)] };
      return null;
    }

    if (dataType === "number_type") {
      const numOps: Record<string, string> = {
        "greater than": "gt", "greater than or equal to": "gte",
        "less than": "lt", "less than or equal to": "lte",
        "equals": "equals", "not equals": "notEquals",
      };
      if (numOps[filter.operator]) return { member, operator: numOps[filter.operator], values: [String(filter.value)] };
      if (["between", "not between"].includes(filter.operator)) {
        const [a, b] = String(filter.value).split(",");
        if (!a || !b) return null;
        return filter.operator === "between"
          ? { and: [{ member, operator: "gte", values: [a] }, { member, operator: "lte", values: [b] }] }
          : { or: [{ member, operator: "lt", values: [a] }, { member, operator: "gt", values: [b] }] };
      }
      return null;
    }

    if (dataType === "boolean_type") {
      if (["true", "false"].includes(filter.operator)) {
        return { member, operator: "equals", values: [filter.operator] };
      }
      return null;
    }

    if (dataType === "string_type") {
      const strOps: Record<string, string> = {
        "contains": "contains", "not contains": "notContains",
        "starts with": "startsWith", "not starts with": "notStartsWith",
        "ends with": "endsWith", "not ends with": "notEndsWith",
        "equals": "equals", "not equals": "notEquals",
      };
      if (strOps[filter.operator]) return { member, operator: strOps[filter.operator], values: [String(filter.value)] };
      if (filter.operator === "is empty") return { member, operator: "equals", values: [""] };
      if (filter.operator === "is not empty") return { member, operator: "notEquals", values: [""] };
    }

    return null;
  }

  private getFieldDataType(field: FieldInfo | undefined): string {
    if (!field) return "text";
    if (field.kind === "measure") return "number_type";
    return field.type?.kind ?? "text";
  }

  private formatDate(date: Date, dataType: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (dataType === "date_type") return `${year}-${month}-${day}`;
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}

function unitMs(unit: string, n: number): number {
  const table: Record<string, number> = {
    seconds: 1_000, minutes: 60_000, hours: 3_600_000,
    days: 86_400_000, weeks: 7 * 86_400_000,
    months: 30 * 86_400_000, years: 365 * 86_400_000,
  };
  return (table[unit] ?? 86_400_000) * n;
}
