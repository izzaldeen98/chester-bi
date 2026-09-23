import { FieldInfo } from "./cubeTypes";

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
    (field.type.kind.toLowerCase() === "timestamp_type" || field.type.kind.toLowerCase() === "date_type")
  );
}
