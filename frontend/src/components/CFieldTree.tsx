import { useMemo, useState } from "react";
import { FaChevronDown, FaChevronRight, FaHashtag, FaCalendarAlt, FaSortAmountDown, FaSearch, FaTrash, FaPencilAlt } from "react-icons/fa";
import { IoText } from "react-icons/io5";
import { IoIosSwitch } from "react-icons/io";
import { TbRulerMeasure2, TbMathFunction } from "react-icons/tb";
import { FieldInfo } from "../lib/cubeTypes";
import { TIME_GRANULARITIES, type Granularity, type SortItem, isDateTime } from "../lib/fieldTree";

interface FieldGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  fields: FieldInfo[];
}

function FieldIcon({ field }: { field: FieldInfo }) {
  if (field.kind.toLowerCase() === "calculate")
    return <TbMathFunction size={13} style={{ color: "#0891b2", flexShrink: 0 }} />;
  if (field.kind.toLowerCase() === "measure")
    return <TbRulerMeasure2 size={13} style={{ color: "#7c3aed", flexShrink: 0 }} />;
  if (field.kind.toLowerCase() === "dimension" && "type" in field && field.type.kind.toLowerCase() === "boolean_type")
    return <IoIosSwitch size={13} style={{ color: "var(--text)", flexShrink: 0 }} />;
  if (field.kind.toLowerCase() === "dimension" && "type" in field && field.type.kind.toLowerCase() === "number_type")
    return <FaHashtag size={13} style={{ color: "var(--text)", flexShrink: 0 }} />;
  if (isDateTime(field))
    return <FaCalendarAlt size={12} style={{ color: "var(--text)", flexShrink: 0 }} />;
  return <IoText size={13} style={{ color: "var(--text)", flexShrink: 0 }} />;
}

interface CFieldTreeProps {
  fields: FieldInfo[];
  groupByFields: FieldInfo[];
  aggFields: FieldInfo[];
  granularityMap: Record<string, Granularity>;
  sortMap: SortItem[];
  /** Only set for composite sources — maps a field name to the member
   * source(s) that actually define it, e.g. {"Dock Doors": ["facilities"]}. */
  fieldOrigins?: Record<string, string[]> | null;
  onToggleField: (field: FieldInfo) => void;
  onSetGranularity: (e: React.MouseEvent, fieldName: string, gran: Granularity) => void;
  onCycleSort: (e: React.MouseEvent<HTMLDivElement>, field: FieldInfo) => void;
  onRemoveCalculated?: (fieldName: string) => void;
  onEditCalculated?: (fieldName: string) => void;
}

export default function CFieldTree({
  fields,
  groupByFields,
  aggFields,
  granularityMap,
  sortMap,
  fieldOrigins,
  onToggleField,
  onSetGranularity,
  onCycleSort,
  onRemoveCalculated,
  onEditCalculated,
}: CFieldTreeProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups: FieldGroup[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = (f: FieldInfo) => !term || f.name.toLowerCase().includes(term);

    return [
      {
        key: "dimension",
        label: "Dimensions",
        icon: <IoText size={12} style={{ color: "var(--text)" }} />,
        fields: fields.filter((f) => f.kind.toLowerCase() === "dimension" && matches(f)),
      },
      {
        key: "measure",
        label: "Measures",
        icon: <TbRulerMeasure2 size={12} style={{ color: "#7c3aed" }} />,
        fields: fields.filter((f) => f.kind.toLowerCase() === "measure" && matches(f)),
      },
      {
        key: "calculate",
        label: "Calculated",
        icon: <TbMathFunction size={12} style={{ color: "#0891b2" }} />,
        fields: fields.filter((f) => f.kind.toLowerCase() === "calculate" && matches(f)),
      },
    ];
  }, [fields, search]);

  const toggleGroup = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
          <FaSearch size={10} style={{ color: "var(--text)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            className="w-full bg-transparent text-xs outline-none"
            style={{ color: "var(--text-h)" }}
          />
        </div>
      </div>

      {groups.map((group) => {
        if (group.fields.length === 0 && !search) return null;
        const isCollapsed = !!collapsed[group.key];
        return (
          <div key={group.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
              style={{ color: "var(--text-h)" }}
            >
              {isCollapsed ? <FaChevronRight size={9} style={{ color: "var(--text)" }} /> : <FaChevronDown size={9} style={{ color: "var(--text)" }} />}
              {group.icon}
              <span className="text-[11px] font-semibold uppercase tracking-wide">{group.label}</span>
              <span className="ml-auto text-[10px]" style={{ color: "var(--text)" }}>{group.fields.length}</span>
            </button>

            {!isCollapsed && group.fields.length === 0 && (
              <p className="px-9 pb-1.5 text-[11px]" style={{ color: "var(--text)" }}>No matching fields</p>
            )}

            {!isCollapsed && group.fields.map((field) => {
              const isMeasureLike = field.kind.toLowerCase() !== "dimension";
              const isCalculated = field.kind.toLowerCase() === "calculate";
              const inGroupBy = groupByFields.some((f) => f.name === field.name);
              const inAgg = aggFields.some((f) => f.name === field.name);
              const isSelected = inGroupBy || inAgg;
              const sortDir = sortMap.find((s) => s.field.name === field.name)?.dir ?? "";
              const gran = granularityMap[field.name];
              const isDatetime = isDateTime(field);

              return (
                <div key={field.name} className="flex flex-col">
                  <div
                    className="flex w-full items-center gap-1.5 py-1 pl-6 pr-2 cursor-pointer transition-colors"
                    onClick={() => onToggleField(field)}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--border)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = ""; }}
                    style={isSelected ? { background: isMeasureLike ? "#ede9fe" : "var(--accent-muted)" } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleField(field)}
                      className="cursor-pointer"
                      style={{ accentColor: isMeasureLike ? "#7c3aed" : "var(--accent)" }}
                    />
                    <FieldIcon field={field} />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span
                        className="truncate text-xs"
                        style={{ color: isSelected ? (isMeasureLike ? "#7c3aed" : "var(--accent)") : "var(--text-h)" }}
                      >
                        {field.name}
                      </span>

                      {fieldOrigins && fieldOrigins[field.name] && (
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                          title={`Defined in: ${fieldOrigins[field.name].join(", ")}`}
                          style={{ background: "var(--border)", color: "var(--text)" }}
                        >
                          {fieldOrigins[field.name].join("/")}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div
                        className="flex flex-row items-center gap-1 pl-2 cursor-pointer"
                        onClick={(e) => onCycleSort(e, field)}
                      >
                        <FaSortAmountDown
                          size={10}
                          style={{ transform: sortDir === "asc" ? "scaleY(-1)" : undefined, color: sortDir ? "var(--accent)" : "var(--text)" }}
                        />
                        {sortDir && (
                          <span className="text-[9px] font-bold" style={{ color: "var(--accent)" }}>
                            {sortDir.toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}

                    {isCalculated && onEditCalculated && (
                      <button
                        type="button"
                        title="Edit calculated column"
                        onClick={(e) => { e.stopPropagation(); onEditCalculated(field.name); }}
                        className="cursor-pointer pl-2"
                      >
                        <FaPencilAlt size={10} style={{ color: "var(--text)" }} />
                      </button>
                    )}

                    {isCalculated && onRemoveCalculated && (
                      <button
                        type="button"
                        title="Remove calculated column"
                        onClick={(e) => { e.stopPropagation(); onRemoveCalculated(field.name); }}
                        className="cursor-pointer pl-2"
                      >
                        <FaTrash size={10} style={{ color: "var(--text)" }} />
                      </button>
                    )}
                  </div>

                  {isSelected && isDatetime && !isMeasureLike && (
                    <div className="flex flex-wrap gap-1 pb-1.5 pl-10 pr-2" onClick={(e) => e.stopPropagation()}>
                      {TIME_GRANULARITIES.map((g) => (
                        <span
                          key={g}
                          className="px-1.5 py-0.5 text-[9px] font-semibold transition-colors cursor-pointer rounded"
                          onClick={(e) => onSetGranularity(e, field.name, g)}
                          style={gran === g
                            ? { background: "var(--accent)", color: "var(--accent-fg)" }
                            : { background: "var(--border)", color: "var(--text)" }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
