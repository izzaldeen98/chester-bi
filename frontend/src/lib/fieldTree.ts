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

/**
 * Expands `kind: "join"` fields into their nested schema's fields, qualifying
 * names with the join path (e.g. "delivery_events.Avg. Detention Minutes") —
 * this is Malloy's actual mechanism for combining data from multiple sources
 * (unlike composite sources, which never merge rows). Non-join fields pass through.
 */
export function flattenFields(fields: FieldInfo[], prefix = ""): FieldInfo[] {
  return fields.flatMap((f): FieldInfo[] => {
    if (f.kind.toLowerCase() === "join" && "schema" in f) {
      return flattenFields(f.schema.fields, `${prefix}${f.name}.`);
    }
    return [{ ...f, name: `${prefix}${f.name}` } as FieldInfo];
  });
}
