import { FieldInfo } from "@malloydata/malloy-interfaces";

export const TIME_GRANULARITIES = ["year", "quarter", "month", "week", "day", "hour", "minute", "second"] as const;
export type Granularity = typeof TIME_GRANULARITIES[number];
export type SortDir = "asc" | "desc";

export interface SortItem {
  field: FieldInfo;
  dir: SortDir;
}

export function isDateTime(field: FieldInfo): boolean {
  return (
    field.kind.toLowerCase() === "dimension" &&
    "type" in field &&
    (field.type.kind.toLowerCase() === "timestamp_type" || field.type.kind.toLowerCase() === "date_type")
  );
}
