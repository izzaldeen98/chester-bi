function isPlainRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractArrayRows(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (isPlainRow(value[0])) return value as Record<string, unknown>[];
    return [];
  }

  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;

  // Cube's /cubejs-api/v1/load response shape: {"data": [{"Cube.field": value, ...}]}.
  for (const key of ["data", "result", "rows", "results"]) {
    const nested = record[key];
    if (Array.isArray(nested) && (nested.length === 0 || isPlainRow(nested[0]))) {
      return nested as Record<string, unknown>[];
    }
    if (nested && typeof nested === "object") {
      const parsed = normalizeQueryRows(nested);
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
}

export function normalizeQueryRows(result: unknown): Record<string, unknown>[] {
  return extractArrayRows(result);
}

function stripFieldName(name: string): string {
  return name.replace(/`/g, "").trim();
}

function buildFieldCandidates(fieldName: string): string[] {
  const stripped = stripFieldName(fieldName);
  const candidates = [fieldName, stripped];

  if (stripped.includes(".")) {
    candidates.push(stripped.split(".")[0]);
  }

  return [...new Set(candidates.filter(Boolean))];
}

function findRowKey(row: Record<string, unknown>, candidate: string): string | undefined {
  if (candidate in row) return candidate;

  const normalized = stripFieldName(candidate).toLowerCase();
  return Object.keys(row).find((key) => stripFieldName(key).toLowerCase() === normalized);
}

export function getRowFieldValue(row: Record<string, unknown>, fieldName: string): unknown {
  if (!fieldName) return undefined;

  for (const candidate of buildFieldCandidates(fieldName)) {
    const key = findRowKey(row, candidate);
    if (key !== undefined) return row[key];
  }

  return undefined;
}

export function resolveResultFieldName(fieldName: string, rowKeys: string[]): string {
  for (const candidate of buildFieldCandidates(fieldName)) {
    const key = rowKeys.find((rowKey) => stripFieldName(rowKey).toLowerCase() === stripFieldName(candidate).toLowerCase());
    if (key) return key;
  }
  return fieldName;
}
