type Operator = ">" | "<" | "==" | "!=" | ">=" | "<=" | "~" | "?";

interface Filter {
  field: string;
  operator: Operator;
  value: string;
}

export class MalloyQueryGenerator {
  private groupBy: string[] = [];
  private orderBy: string[] = [];
  private aggregates: string[] = [];
  private limit: number | null = null;
  private source: string = "";
  private filters: Filter[] = [];

  constructor(
    source: string = "",
    groupBy: string[] = [],
    aggregates: string[] = [],
    orderBy: string[] = [],
    limit: number = 1000,
  ) {
    this.source = source;
    this.groupBy = groupBy;
    this.aggregates = aggregates;
    this.orderBy = orderBy;
    this.limit = limit;
  }

  public setSource(source: string): this {
    this.source = source;
    return this;
  }

  public addFilter(field: string, operator: Operator, value: string): this {
    this.filters.push({ field, operator, value });
    return this;
  }

  public addGroupBy(field: string): this {
    this.groupBy.push(`\`${field}\``);
    return this;
  }

  public addAggregate(metric: string): this {
    this.aggregates.push(`\`${metric}\``);
    return this;
  }

  public addOrderBy(field: string): this {
    this.orderBy.push(`\`${field}\``);
    return this;
  }

  public setLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  private buildFilters(): string {
    if (this.filters.length === 0) return "";
    const filterString = this.filters
      .map((f) => `\`${f.field}\` ${f.operator} ${f.value}`)
      .join(" and ");
    return `where: ${filterString}`;
  }

  public buildQuery(): string {
    if (!this.source) {
      throw new Error("Source must be defined to build a Malloy query.");
    }
    const clauses: string[] = [];
    if (this.filters.length > 0) clauses.push(this.buildFilters());
    const wrap = (f: string) => `\`${f}\``;
    if (this.groupBy.length > 0) clauses.push(`group_by: ${this.groupBy.map(wrap).join(", ")}`);
    if (this.aggregates.length > 0) clauses.push(`aggregate: ${this.aggregates.map(wrap).join(", ")}`);
    if (this.orderBy.length > 0) clauses.push(`order_by: ${this.orderBy.map(wrap).join(", ")}`);
    if (this.limit !== null) clauses.push(`limit: ${this.limit}`);
    const body = clauses.join("\n  ");
    return `run: ${this.source} -> {\n  ${body}\n}`;
  }
}
