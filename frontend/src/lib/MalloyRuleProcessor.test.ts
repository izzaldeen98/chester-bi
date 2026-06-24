import { RuleGroupType } from 'react-querybuilder';
import { MalloyASTQueryBuilder } from './MalloyASTQueryBuilder';

// Type definitions to match your class signature
interface FieldInfo {
  name: string;
  kind: string;
  type?: {
    kind: string;
    subtype?: string;
  };
}

type SortDir = 'asc' | 'desc';

// Mock schema matching your production format payload
const activeSchemaMock: any = {
  name: 'release_tracking',
  schema: {
    fields: [
      { kind: "dimension", name: "dbid", type: { kind: "number_type", subtype: "bigint" } },
      { kind: "dimension", name: "start_time", type: { kind: "timestamp_type" } },
      { kind: "dimension", name: "ff_loaded_rows", type: { kind: "number_type", subtype: "bigint" } },
      { kind: "measure", name: "total_records", type: { kind: "number_type", subtype: "integer" } },
      { kind: "measure", name: "total_loaded_rows", type: { kind: "number_type", subtype: "bigint" } }
    ]
  }
};

describe('MalloyASTQueryBuilder Complete End-to-End Query Tests', () => {
  let builder: MalloyASTQueryBuilder;

  beforeEach(() => {
    // Clear and instantiate a fresh builder before every test run
    builder = new MalloyASTQueryBuilder(activeSchemaMock);
    
    // Explicitly reset any dynamic arrays on the builder if your setup reuses instances
    (builder as any).groupByFields = [];
    (builder as any).aggFields = [];
    (builder as any).sortMap = [];
    (builder as any).limit = 0;
    (builder as any).filters = null;
  });

  test('should accurately construct a full multi-line Malloy block with grouping, sorting, limits, and mixed filters', () => {
    // 1. Add Group By fields (one raw, one with time granularity mutation)
    builder.addGroupBy('dbid');
    builder.addGroupBy('start_time', 'year');

    // 2. Add Aggregate fields
    const aggField1: FieldInfo = { name: 'total_records', kind: 'measure' };
    const aggField2: FieldInfo = { name: 'total_loaded_rows', kind: 'measure' };
    builder.addAgg(aggField1);
    builder.addAgg(aggField2);

    // 3. Add Ordering metrics
    builder.addSort({ name: 'start_time.year', kind: 'dimension' }, 'desc');

    // 4. Set Execution boundaries
    builder.setLimit(500);

    // 5. Build complex, deeply nested filters tree state block
    const filterQuery: RuleGroupType = {
      combinator: 'and',
      rules: [
        { field: 'ff_loaded_rows', operator: 'greater than', value: '25000' },
        {
          combinator: 'or',
          rules: [
            { field: 'start_time', operator: 'after', value: 'relative|days|7' },
            { field: 'dbid', operator: 'is null', value: '' }
          ]
        }
      ]
    };
    builder.addFilter(filterQuery);

    // 6. Execute string serialization
    const finalMalloyQueryString = builder.buildQuery();

    console.log('=== END-TO-END SERIALIZED MALLOY STATEMENT ===');
    console.log(finalMalloyQueryString);

    // 7. Verify the precise structural format requirements demanded by Malloy compiler
    expect(finalMalloyQueryString).toContain('run: release_tracking -> {');
    
    // Groupings check (ensuring commas are dropped and indentation works)
    expect(finalMalloyQueryString).toContain('  group_by:\n    dbid\n    start_time.year');
    
    // Aggregations check
    expect(finalMalloyQueryString).toContain('  aggregate:\n    total_records\n    total_loaded_rows');
    
    // Sorting directions check
    expect(finalMalloyQueryString).toContain('  order_by:\n    start_time.year desc');
    
    // Limits check
    expect(finalMalloyQueryString).toContain('  limit: 500');
    
    // Complete relational tree string condition check
    expect(finalMalloyQueryString).toContain(
      '  where: ff_loaded_rows > 25000 and (start_time = after 7 days ago or dbid = null)'
    );
  });

  test('should degrade gracefully into an empty block syntax shell when no parameters are assigned', () => {
    const finalEmptyQueryString = builder.buildQuery();

    console.log('=== EMPTY SYSTEM STATE STATEMENT ===');
    console.log(finalEmptyQueryString);

    // Checks that structural defaults are kept perfectly clean
    expect(finalEmptyQueryString).toBe('run: release_tracking -> {\n}');
  });
});
