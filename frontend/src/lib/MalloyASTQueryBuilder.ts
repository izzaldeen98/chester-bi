import { RuleGroupType, RuleType } from 'react-querybuilder';
import { FieldInfo, SourceInfo } from '@malloydata/malloy-interfaces';

type SortDir = "asc" | "desc";
interface SortItem {
  field: FieldInfo;
  dir: SortDir;
}

function isRule(filter: any): filter is RuleType {
  return filter && typeof filter === 'object' && 'field' in filter && 'operator' in filter;
}

export class MalloyASTQueryBuilder {
  private activeSchema: SourceInfo;
  private groupByFields: string[] = [];
  private aggFields: FieldInfo[] = [];
  private limit: number = 1000;
  private sortMap: SortItem[] = [];
  private filters: RuleGroupType | null = null;

  constructor(activeSchema: SourceInfo) {
    this.activeSchema = activeSchema;
    console.log("ACTIVE SCHEMA:", this.activeSchema);
  }

  public addGroupBy(fieldName: string, granularity?: string) {
    this.groupByFields.push(granularity ? `${fieldName}.${granularity}` : fieldName);
  }

  public addAgg(field: FieldInfo) {
    this.aggFields.push(field);
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
      this.aggFields.forEach((f: FieldInfo) => lines.push(`    ${f.name}`));
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

    lines.push('}');
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
    if (filedDataType === "timestamp_type") {
      if (["before", "after"].includes(filter.operator)) {
        const [addingType, unit, amount] = String(filter.value).split("|") || ['relative', 'days', '1'];
        const operatorSymbol = filter.operator === 'before' ? '-' : '+';
        
        if (addingType === "relative") {
          if (filter.operator === "before") {
            return `${filter.field} < now ${operatorSymbol} ${amount} ${unit}`;
          }
          if (filter.operator === "after") {
            return `${filter.field} > now ${operatorSymbol} ${amount} ${unit}`;
          }
        }
        if (addingType === "absolute") {
          const [, dateValue] = String(filter.value).split("|") || ['absolute', ''];
          if (filter.operator === "before") {
            return `${filter.field} < @${this.formatDate(dateValue)}`;
          }
          if (filter.operator === "after") {
            return `${filter.field} > @${this.formatDate(dateValue)}`;
          }
        }
      }
      if (["between", "not between"].includes(filter.operator)) {
        const [startValue, endValue] = String(filter.value).split(",") || ['', ''];
        if (startValue && endValue) {
          const rangeSyntax = `@${this.formatDate(startValue)} to @${this.formatDate(endValue)}`;
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
        if (filter.operator === "next") {
          return `${filter.field} = now to now + ${amount} ${unit}`;
        }
        if (filter.operator === "last") {
          return `${filter.field} = now - ${amount} ${unit} to now`;
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
      if (filter.operator === "less than") return `${filter.field} < ${filter.value}`;
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
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "timestamp_type")
      return "timestamp_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "boolean_type")
      return "boolean_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "number_type")
      return "number_type";
    if (field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "string_type")
      return "string_type";
    return "text";
  }

  private formatDate(val: string): string {
    const date = new Date(val);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}
