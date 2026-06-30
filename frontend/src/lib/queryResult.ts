function unwrapMalloyCell(cell: unknown): unknown {
  if (cell == null || typeof cell !== "object") return cell;
  const c = cell as Record<string, unknown>;
  const kind = c.kind;

  if (kind === "string_cell") return c.string_value;
  if (kind === "number_cell") return c.number_value;
  if (kind === "boolean_cell") return c.boolean_value;
  if (kind === "timestamp_cell") return c.timestamp_value ?? c.string_value;
  if (kind === "date_cell") return c.date_value ?? c.string_value;
  if (kind === "null_cell") return null;
  if (kind === "record_cell" && Array.isArray(c.record_value)) {
    return c.record_value.map(unwrapMalloyCell);
  }
  if (kind === "array_cell" && Array.isArray(c.array_value)) {
    return c.array_value.map(unwrapMalloyCell);
  }

  return cell;
}

function isPlainRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && !("kind" in value));
}

function parseMalloyCompact(payload: Record<string, unknown>): Record<string, unknown>[] {
  const fields =
    (payload.schema as { fields?: { name: string }[] } | undefined)?.fields?.map((field) => field.name) ?? [];
  const data = payload.data as Record<string, unknown> | undefined;

  if (!data || data.kind !== "array_cell" || !Array.isArray(data.array_value)) {
    return [];
  }

  return data.array_value.map((record) => {
    const values = unwrapMalloyCell(record);
    if (!Array.isArray(values)) return {};
    const row: Record<string, unknown> = {};
    fields.forEach((name, index) => {
      row[name] = values[index];
    });
    return row;
  });
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

  if (record.schema && record.data) {
    return parseMalloyCompact(record);
  }

  for (const key of ["result", "data", "rows", "results"]) {
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
