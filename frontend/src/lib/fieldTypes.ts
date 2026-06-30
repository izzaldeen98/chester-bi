import type { FieldInfo, SourceInfo } from "@malloydata/malloy-interfaces";

export function getFieldTypeKind(field: FieldInfo): string | null {
  if (field.kind?.toLowerCase() !== "dimension") return null;
  if (!("type" in field) || !field.type) return null;
  return field.type.kind?.toLowerCase() ?? null;
}

export function isDateTimeTypeKind(kind: string | null | undefined): boolean {
  return kind === "date_type" || kind === "timestamp_type";
}

export function findSourceField(source: SourceInfo, fieldName: string): FieldInfo | undefined {
  const fields = source.schema?.fields ?? [];
  const exact = fields.find((field) => field.name === fieldName);
  if (exact) return exact;

  const baseName = fieldName.includes(".") ? fieldName.split(".")[0] : fieldName;
  return fields.find((field) => field.name === baseName);
}

export function resolveXAxisFieldType(
  fieldName: string | undefined,
  source: SourceInfo | null | undefined,
): string | null {
  if (!fieldName || !source) return null;
  const field = findSourceField(source, fieldName);
  return field ? getFieldTypeKind(field) : null;
}
