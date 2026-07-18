import { RuleGroupType, RuleType } from 'react-querybuilder';
import { FieldInfo, SourceInfo } from '@malloydata/malloy-interfaces';

type SortDir = "asc" | "desc";
interface SortItem {
  field: FieldInfo;
  dir: SortDir;
}

interface CalculateItem {
  name: string;
  expression: string;
  partitionBy: string[];
  orderBy: { field: string; dir: SortDir }[];
}

interface query {
  groupBy: string[];
  aggregate: string[];
  orderBy: string[];
  limit: number;
  filters: RuleGroupType;
  havings: RuleGroupType;
}

function isRule(filter: any): filter is RuleType {
  return filter && typeof filter === 'object' && 'field' in filter && 'operator' in filter;
}

export class MalloyASTQueryBuilder {
  private activeSchema: SourceInfo;
  private groupByFields: string[] = [];
  private aggFields: FieldInfo[] = [];
  private calculateFields: CalculateItem[] = [];
  private limit: number = 1000;
  private sortMap: SortItem[] = [];
  private filters: RuleGroupType | null = null;
  private havings: RuleGroupType | null = null;
  constructor(activeSchema: SourceInfo) {
    this.activeSchema = activeSchema;
  }

  // public buildFromResponse(response: query) {
  //   this.groupByFields = response.groupBy
  //   for (const field of response.aggregate) {
  //     for (const f of this.activeSchema.schema.fields) {
  //       if (f.name === field) {
  //         this.aggFields.push(f);
  //       }
  //     }
  //   }
  //   this.limit = response.limit;
  //   this.filters = response.filters["filters"];
  // }

  public buildFromResponse(response: query) {
    this.groupByFields = [...(response.groupBy ?? [])];

    const allFields = this.activeSchema?.schema?.fields ?? [];

    this.aggFields = (response.aggregate ?? []).reduce<FieldInfo[]>((acc, name) => {
      const found = allFields.find((f: FieldInfo) => f.name === name);
      if (found) acc.push(found);
      return acc;
    }, []);

    this.sortMap = (response.orderBy ?? []).reduce<SortItem[]>((acc, entry) => {
      const parts = String(entry).trim().split(/\s+/);
      const fieldName = parts.slice(0, parts.length > 1 && ["asc", "desc"].includes(parts[parts.length - 1].toLowerCase()) ? -1 : undefined).join(" ");
      const rawDir = parts[parts.length - 1]?.toLowerCase();
      const dir: SortDir = rawDir === "desc" ? "desc" : "asc";
      const found = allFields.find((f: FieldInfo) => f.name === fieldName);
      if (found) acc.push({ field: found, dir });
      return acc;
    }, []);

    this.limit = response.limit ?? this.limit;
    this.filters = response.filters ?? null;
    this.havings = response.havings ?? null;
  }

  public addHaving(having: RuleGroupType) {
    this.havings = having;
  }

  public addGroupBy(fieldName: string, granularity?: string) {
    this.groupByFields.push(granularity ? `${fieldName}.${granularity}` : fieldName);
  }

  public addAgg(field: FieldInfo) {
    this.aggFields.push(field);
  }

  public addCalculate(name: string, expression: string, partitionBy: string[], orderBy: { field: string; dir: SortDir }[]) {
    this.calculateFields.push({ name: name.trim(), expression: expression.trim(), partitionBy, orderBy });
  }

  public setLimit(limit: number) {
    this.limit = limit;
  }

  public addSort(field: FieldInfo, dir: SortDir) {
    this.sortMap.push({ field, dir });
  }

  public addFilter(filters: RuleGroupType) {
    this.filters = filters;
  }

  /**
   * Generates a syntactically accurate, fully serialized Malloy multi-line query block.
   */
  public buildQuery(): string {
    const lines: string[] = [];
    
    // 1. Root Source Definition Initialization
    lines.push(`run: ${this.activeSchema?.name ?? 'source_info'} -> {`);

    // 2. Map Dimensions (Replaces commas with clean newlines and indentation layouts)
    if (this.groupByFields && this.groupByFields.length > 0) {
      lines.push('  group_by:');
      this.groupByFields.forEach((name) => lines.push(`    ${name}`));
    }

    // 3. Map Measures Aggregations 
    if (this.aggFields && this.aggFields.length > 0) {
      lines.push('  aggregate:');
      this.aggFields.forEach((f: FieldInfo) => lines.push(`   \`${f.name}\``));
    }

    // 3b. Map Calculated (window function) Columns
    if (this.calculateFields && this.calculateFields.length > 0) {
      this.calculateFields.forEach((c) => {
        lines.push(`  calculate: ${c.name} is ${c.expression} {`);
        if (c.partitionBy.length) lines.push(`    partition_by: ${c.partitionBy.join(", ")}`);
        if (c.orderBy.length) lines.push(`    order_by: ${c.orderBy.map((o) => `${o.field} ${o.dir}`).join(", ")}`);
        lines.push('  }');
      });
    }

    // 4. Map Sorting Ordering Layout
    if (this.sortMap && this.sortMap.length > 0) {
      lines.push('  order_by:');
      this.sortMap.forEach((sortItem: { field: FieldInfo; dir: SortDir }) => {
        lines.push(`    ${sortItem.field.name} ${sortItem.dir}`);
      });
    }

    // 5. Apply Execution Limit Boundaries
    if (this.limit && this.limit > 0) {
      lines.push(`  limit: ${this.limit}`);
    }

    // 6. Generate and Apply Tree-Aware String Filter Block
    if (this.filters) {
      const filterExpression = this.handleFilter();
      if (filterExpression) {
        lines.push(`  where: ${filterExpression}`);
      }
    }

    if (this.havings) {
      const havingExpression = this.handleHaving();
      if (havingExpression) {
        lines.push(`  having: ${havingExpression}`);
      }
    }

    lines.push('}');
    console.log("MALLOY QUERY:", lines.join('\n'));
    return lines.join('\n');
  }

private handleFilter(): string {
    if (!this.filters) return '';

    // 1. Generate a single, comprehensive tree-aware filter string expression
    const fullMalloyFilterExpression = this.processRuleGroup(this.filters);

    console.log("FULL MALLOY FILTER EXPRESSION:", fullMalloyFilterExpression);
    
    // 2. Return the string expression directly
    return fullMalloyFilterExpression;
  }

  private handleHaving(): string {
    if (!this.havings) return '';
    return this.processRuleGroup(this.havings);
  }

  /**
   * Recursively processes groups, mapping child rules and joining them with explicit combinators
   */
  private processRuleGroup(group: RuleGroupType): string {
    if (!group.rules || group.rules.length === 0) return '';

    const expressions: string[] = [];

    for (const filter of group.rules) {
      if (isRule(filter)) {
        const singleExpression = this.compileSingleRuleString(filter);
        if (singleExpression) expressions.push(singleExpression);
      } else {
        // Recurse down into sub-group branch nodes
        const nestedExpression = this.processRuleGroup(filter);
        if (nestedExpression) {
          // Wrap nested levels in explicit parentheses to protect precedence rules
          expressions.push(`(${nestedExpression})`);
        }
      }
    }

    if (expressions.length === 0) return '';

    // Join elements using the group's active combinator ('and' / 'or')
    const combinatorKeyword = ` ${group.combinator.toLowerCase()} `;
    return expressions.join(combinatorKeyword);
  }

  /**
   * Your exact business criteria mapping expressions encapsulated into standalone string returns
   */
  private compileSingleRuleString(filter: RuleType): string {
    console.log("FILTER:", filter);
    const targetField = this.activeSchema?.schema?.fields?.find((f: any) => f.name === filter.field);
    console.log("TARGET FIELD:", targetField);
    const filedDataType = this.getFieldDataType(targetField ?? {} as FieldInfo);

    // 1. Generic Null Check
    if (["is null", "is not null"].includes(filter.operator)) {
      if (filter.operator === "is null") return `${filter.field} = null`;
      if (filter.operator === "is not null") return `${filter.field} != null`;
      return '';
    }

    // 2. Timestamp Handling Logic
    if (filedDataType === "timestamp_type" || filedDataType === "date_type") {
      if (["before", "after"].includes(filter.operator)) {
        const [addingType, unit, amount] = String(filter.value).split("|") || ['relative', 'days', '1'];
        const operatorSymbol = filter.operator === 'before' ? '-' : '+';
        const nowOrToday = filedDataType === "date_type" ? "now::date" : "now";
        
        if (addingType === "relative") {
          if (filter.operator === "before") {
            return `${filter.field} < ${nowOrToday} ${operatorSymbol} ${amount} ${unit}`;
          }
          if (filter.operator === "after") {
            return `${filter.field} > ${nowOrToday} ${operatorSymbol} ${amount} ${unit}`;
          }
        }
        if (addingType === "absolute") {
          const [, dateValue] = String(filter.value).split("|") || ['absolute', ''];
          if (filter.operator === "before") {
            return `${filter.field} < @${this.formatDate(dateValue , filedDataType)}`;
          }
          if (filter.operator === "after") {
            return `${filter.field} > @${this.formatDate(dateValue , filedDataType)}`;
          }
        }
      }
      if (["between", "not between"].includes(filter.operator)) {
        const [startValue, endValue] = String(filter.value).split(",") || ['', ''];
        if (startValue && endValue) {
          const rangeSyntax = `@${this.formatDate(startValue , filedDataType)} to @${this.formatDate(endValue , filedDataType)}`;
          if (filter.operator === "between") {
            return `${filter.field} ? ${rangeSyntax}`;
          }
          if (filter.operator === "not between") {
            return `not (${filter.field} ? ${rangeSyntax})`;
          }
        }
      }
      if (["next", "last"].includes(filter.operator)) {
        const [amount, unit] = String(filter.value).split(":") || ['1', 'days'];
        const nowOrToday = filedDataType === "date_type" ? "now::date" : "now";
        if (filter.operator === "next") {
          return `${filter.field} = ${nowOrToday} to ${nowOrToday} + ${amount} ${unit}`;
        }
        if (filter.operator === "last") {
          return `${filter.field} = ${nowOrToday} - ${amount} ${unit} to ${nowOrToday}`;
        }
      }
      if (["equals", "not equals"].includes(filter.operator)) {
        if (filter.operator === "equals") return `${filter.field} = @${this.formatDate(filter.value)}`;
        if (filter.operator === "not equals") return `not (${filter.field} = @${this.formatDate(filter.value)})`;
      }
      return '';
    }

    // 3. Number Handling Logic
    if (filedDataType === "number_type") {
      if (filter.operator === "greater than") return `${filter.field} > ${filter.value}`;
      if (filter.operator === "greater than or equal to") return `${filter.field} >= ${filter.value}`;
      if (filter.operator === "less than") return `${filter.field}   < ${filter.value}`;
      if (filter.operator === "less than or equal to") return `${filter.field} <= ${filter.value}`;
      if (filter.operator === "between" || filter.operator === "not between") {
        const [startValue, endValue] = String(filter.value).split(",") || ['', ''];
        if (startValue && endValue) {
          const syntax = `[${startValue} to ${endValue}]`;
          return filter.operator === "between" ? `${filter.field} = ${syntax}` : `not (${filter.field} = ${syntax})`;
        }
      }
      if (filter.operator === "equals") return `${filter.field} = ${filter.value}`;
      if (filter.operator === "not equals") return `${filter.field} != ${filter.value}`;
      return '';
    }

    // 4. Boolean Handling Logic
    if (filedDataType === "boolean_type") {
      if (filter.operator === "true" || filter.operator === "false") {
        return `${filter.field} = ${filter.operator}`;
      }
      return '';
    }

    // 5. String Handling Logic
    if (filedDataType === "string_type") {
      const escape = (v: any) => `${String(v).replace(/'/g, "\\'")}`;
      if (filter.operator === "contains") return `${filter.field} ~ '%${escape(filter.value)}%'`;
      if (filter.operator === "not contains") return `not (${filter.field} ~ '%${escape(filter.value)}%')`;
      if (filter.operator === "starts with") return `${filter.field} ~ '${escape(filter.value)}%'`;
      if (filter.operator === "not starts with") return `not (${filter.field} ~ '${escape(filter.value)}%')`;
      if (filter.operator === "ends with") return `${filter.field} ~ '%${escape(filter.value)}'`;
      if (filter.operator === "not ends with") return `not (${filter.field} ~ '%${escape(filter.value)}')`;
      if (filter.operator === "equals") return `${filter.field} = '${escape(filter.value)}'`;
      if (filter.operator === "not equals") return `${filter.field} != '${escape(filter.value)}'`;
      if (filter.operator === "is empty") return `${filter.field} = ''`;
      if (filter.operator === "is not empty") return `${filter.field} != ''`;
    }

    return '';
  }

  private getFieldDataType(field: FieldInfo): string {
    if (field.kind.toLowerCase() === "measure")
      return "number_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "timestamp_type")
      return "timestamp_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "boolean_type")
      return "boolean_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "number_type")
      return "number_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "string_type")
      return "string_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "date_type")
      return "date_type";
    return "text";
  }

  private formatDate(val: string, filedDataType?: string): string {
    const date = new Date(val);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");

    if (filedDataType === "date_type") {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}
