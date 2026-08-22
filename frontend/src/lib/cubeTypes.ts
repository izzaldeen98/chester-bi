/**
 * Local replacement for @malloydata/malloy-interfaces' FieldInfo/SourceInfo.
 * The backend (see backend/utils/cube.py's normalize_meta) flattens Cube's
 * raw GET /meta response into this exact shape, so the query-builder UI code
 * built against Malloy's SourceInfo/FieldInfo needed no logic changes here —
 * only the import source changed.
 */
export interface FieldType {
  kind: string; // "string_type" | "number_type" | "boolean_type" | "timestamp_type" | "text"
}

export interface FieldInfo {
  name: string;
  kind: "dimension" | "measure" | "calculate";
  type: FieldType;
}

export interface SourceInfo {
  name: string;
  schema: {
    fields: FieldInfo[];
  };
}

// ── Cube query JSON (POST /cubejs-api/v1/load body.query) ──────────────────

export interface CubeFilter {
  member: string;
  operator: string;
  values?: string[];
}

export interface CubeLogicalAnd {
  and: CubeFilterExpr[];
}

export interface CubeLogicalOr {
  or: CubeFilterExpr[];
}

export type CubeFilterExpr = CubeFilter | CubeLogicalAnd | CubeLogicalOr;

export interface CubeTimeDimension {
  dimension: string;
  granularity?: string;
  dateRange?: [string, string];
}

export interface CubeQuery {
  measures?: string[];
  dimensions?: string[];
  timeDimensions?: CubeTimeDimension[];
  filters?: CubeFilterExpr[];
  order?: Record<string, "asc" | "desc">;
  limit?: number;
  offset?: number;
}
