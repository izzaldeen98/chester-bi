import { useEffect, useMemo, useState } from "react";
import { FaFilter } from "react-icons/fa";
import { BsArrowsCollapse, BsArrowsExpand } from "react-icons/bs";
import {
    QueryBuilder,
    ValueEditor,
    type Field,
    type RuleGroupType,
    type ValueEditorProps,
} from "react-querybuilder"; import { FieldInfo } from "@malloydata/malloy-interfaces";
import "react-querybuilder/dist/query-builder.css";
import "../styles/query-builder.css";

export const EMPTY_FILTER_QUERY: RuleGroupType = { combinator: "and", rules: [] };

function isDateTime(field: FieldInfo) {
    const dt = field.kind.toLowerCase() === "dimension" && "type" in field && field.type.kind.toLowerCase() === "timestamp_type";
    return dt;
}

function isBoolean(field: FieldInfo) {
    return field.kind.toLowerCase() === "dimension" && "type" in field && field.type.kind.toLowerCase() === "boolean_type";
}

function countFilterRules(group: RuleGroupType): number {
    return group.rules.reduce<number>((count, rule) => {
        if ("rules" in rule) return count + countFilterRules(rule);
        return count + 1;
    }, 0);
}

const defaultOperators = [
    { name: "is null", label: "Is Null", value: "is null" },
    { name: "is not null", label: "Is Not Null", value: "is not null" },
    { name: "equals", label: "Equals", value: "equals" },
    { name: "not equals", label: "Not Equals", value: "not equals" },
]

const timestampOperators = [
    { name: "after", label: "After", value: "after" },
    { name: "before", label: "Before", value: "before" },
    { name: "between", label: "Between", value: "between" },
    { name: "not between", label: "Not Between", value: "not between" },
    { name: "This", label: "This", value: "this" },
    { name: "next", label: "Next", value: "next" },
    { name: "last", label: "Last", value: "last" },
    ...defaultOperators,
]

const booleanOperators = [
    { name: "true", label: "True", value: "true" },
    { name: "false", label: "False", value: "false" },
    { name: "is null", label: "Is Null", value: "is null" },
    { name: "is not null", label: "Is Not Null", value: "is not null" },
]

const stringOperators = [
    { name: "contains", label: "Contains", value: "contains" },
    { name: "not contains", label: "Not Contains", value: "not contains" },
    { name: "starts with", label: "Starts With", value: "starts with" },
    { name: "not starts with", label: "Not Starts With", value: "not starts with" },
    { name: "ends with", label: "Ends With", value: "ends with" },
    { name: "not ends with", label: "Not Ends With", value: "not ends with" },
    { name: "is empty", label: "Is Empty", value: "is empty" },
    { name: "is not empty", label: "Is Not Empty", value: "is not empty" },
    ...defaultOperators,
]

const numberOperators = [
    { name: "greater than", label: "Greater Than", value: "greater than" },
    { name: "less than", label: "Less Than", value: "less than" },
    { name: "greater than or equal to", label: "Greater Than or Equal To", value: "greater than or equal to" },
    { name: "less than or equal to", label: "Less Than or Equal To", value: "less than or equal to" },
    { name: "between", label: "Between", value: "between" },
    { name: "not between", label: "Not Between", value: "not between" },
    ...defaultOperators,
]

function queryBuilderDataType(field: FieldInfo): string {
    const isMeasure = field.kind.toLowerCase() === "measure";
    const isDimension = field.kind.toLowerCase() === "dimension";
    const isDT = isDateTime(field);
    if (isMeasure) return "number";
    if (isDimension && isDT) return "datetime-local";
    if (isDimension && 'type' in field && field.type.kind.toLowerCase() === "boolean_type") return "boolean";
    if (isDimension && 'type' in field && field.type.kind.toLowerCase() === "string_type") return "string";
    if (isDimension && 'type' in field && field.type.kind.toLowerCase() === "number_type") return "number";
    if (isDimension) return "text";

    return "text";
}

function queryBuilderValueEditorType(field: FieldInfo): string {
    const isMeasure = field.kind.toLowerCase() === "measure";
    const isDimension = field.kind.toLowerCase() === "dimension";
    const isDT = isDateTime(field);
    const isBool = isBoolean(field);
    if (isMeasure) return "text";
    if (isDimension && isDT) return "text";
    if (isDimension && isBool) return "switch";
    return "text";
}

interface CQueryBuilderProps {
    fields?: FieldInfo[];
    query: RuleGroupType;
    onQueryChange: (query: RuleGroupType) => void;
}

function handleGetOperators(_fieldName: string, { fieldData }: { fieldData: Field }) {
    if (!fieldData) return defaultOperators;

    if (fieldData.inputType === "datetime-local") return timestampOperators;
    if (fieldData.inputType === "boolean") return booleanOperators;
    if (fieldData.inputType === "string") return stringOperators;
    if (fieldData.inputType === "number") return numberOperators;
    return defaultOperators;
}

function FilterValueEditor(props: ValueEditorProps) {
    if (["is null", "is not null"].includes(props.operator)) {
        return null;
    }
    if (
        props.fieldData.inputType === "datetime-local" &&
        ["after", "before"].includes(props.operator)
    ) {
        const parseDateValue = (value?: string) => {
            if (!value) {
                return {
                    dateType: "relative",
                    unit: "days",
                    amount: "1",
                    absoluteValue: "",
                };
            }

            // New format: relative|days|1 OR absolute|2026-06-22 14:30:00
            if (value.includes("|")) {
                const [type = "relative", second = "days", third = "1"] =
                    value.split("|");

                return {
                    dateType: type,
                    unit: type === "relative" ? second : "days",
                    amount: type === "relative" ? third : "1",
                    absoluteValue: type === "absolute" ? second : "",
                };
            }

            // Backward compatibility for old relative format: relative:days:1
            const [type = "relative", second = "days", third = "1"] = value.split(":");

            return {
                dateType: type,
                unit: second,
                amount: third,
                absoluteValue: "",
            };
        };



        const { dateType, unit, amount, absoluteValue } = parseDateValue(
            String(props.value ?? "")
        );

        const updateRelativeValue = (
            nextType: string,
            nextUnit: string,
            nextAmount: string
        ) => {
            props.handleOnChange(`${nextType}|${nextUnit}|${nextAmount}`);
        };

        const updateAbsoluteValue = (nextValue: string) => {
            props.handleOnChange(`absolute|${nextValue}`);
        };

        const handleTypeChange = (nextType: string) => {
            if (nextType === "relative") {
                props.handleOnChange(`relative|${unit || "days"}|${amount || "1"}`);
                return;
            }

            props.handleOnChange(`absolute|${absoluteValue || ""}`);
        };

        return (
            <div className="flex flex-row gap-1">
                <select
                    className="w-full p-1"
                    value={dateType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                >
                    <option value="relative">Relative</option>
                    <option value="absolute">Absolute</option>
                </select>

                {dateType.toLowerCase() === "relative" && (
                    <div className="flex gap-1 flex-row items-center">
                        <input
                            type="number"
                            value={amount}
                            min="1"
                            onChange={(e) =>
                                updateRelativeValue(dateType, unit, e.target.value)
                            }
                            style={{ minWidth: 60 }}
                        />

                        <select
                            value={unit}
                            onChange={(e) =>
                                updateRelativeValue(dateType, e.target.value, amount)
                            }
                        >
                            <option value="days">Days</option>
                            <option value="weeks">Weeks</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                            <option value="hours">Hours</option>
                            <option value="minutes">Minutes</option>
                            <option value="seconds">Seconds</option>
                        </select>
                    </div>
                )}

                {dateType.toLowerCase() === "absolute" && (
                    <input 
                        type="datetime-local"
                        value={absoluteValue}
                        onChange={(e) => updateAbsoluteValue(e.target.value)}
                    />
                )}
            </div>
        );
    } if (props.fieldData.inputType === "datetime-local" && ["next", "last"].includes(props.operator)) {
        const [amount = "1", unit = "days"] = props.value ? props.value.split(":") : ["1", "days"];
        const updateQueryValue = (nextAmount: string, nextUnit: string) => {
            props.handleOnChange(`${nextAmount}:${nextUnit}` as string);
        };
        return (
            <div className="flex flex-row gap-1">
                <input type="number" value={amount} onChange={(e) => updateQueryValue(e.target.value, unit)} />
                <select className="w-full p-2" value={unit} onChange={(e) => updateQueryValue(amount, e.target.value)}>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                </select>
            </div>
        );
    }
    if (props.fieldData.inputType === "datetime-local" && ["between", "not between"].includes(props.operator)) {
        const [startValue = "", endValue = ""] = props.value ? props.value.split(",") : ["", ""];
        const updateQueryValue = (nextStartValue: string, nextEndValue: string) => {
            props.handleOnChange(`${nextStartValue},${nextEndValue}`);
        };
        return (
            <div className="flex flex-row w-full gap-1">
                <input type="datetime-local" value={startValue} onChange={(e) => updateQueryValue(e.target.value, endValue)} />
                <span className="text-xs font-medium p-1 text-center" style={{ color: "var(--text)" }}>to</span>
                <input type="datetime-local" value={endValue} onChange={(e) => updateQueryValue(startValue, e.target.value)} />
            </div>
        );
    }

    if (
        props.fieldData.inputType === "datetime-local" &&
        props.operator === "this"
      ) {
        const selectedUnit = String(props.value || "day");
      
        return (
          <div className="flex flex-row w-full gap-1 items-center">
            <span
              className="text-xs font-medium p-1 text-center"
              style={{ color: "var(--text)" }}
            >
              This
            </span>
      
            <select
              className="w-full p-2"
              value={selectedUnit}
              onChange={(e) => props.handleOnChange(e.target.value)}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>
        );
      }    if (props.fieldData.inputType === "boolean" && ["true", "false"].includes(props.operator)) {
        return null;
    }
    if (props.fieldData.inputType === "number" && ["between", "not between"].includes(props.operator)) {
        const [startValue = "", endValue = ""] = props.value ? props.value.split(",") : ["", ""];
        const updateQueryValue = (nextStartValue: string, nextEndValue: string) => {
            props.handleOnChange(`${nextStartValue},${nextEndValue}`);
        };
        return (
            <div className="flex flex-row gap-1">
                <input type="number" value={startValue} onChange={(e) => updateQueryValue(e.target.value, endValue)} />
                <span className="text-xs font-medium p-1 text-center" style={{ color: "var(--text)" }}>to</span>
                <input type="number" value={endValue} onChange={(e) => updateQueryValue(startValue, e.target.value)} />
            </div>
        );
    }

    if (props.fieldData.inputType === "string" && ["contains", "not contains", "starts with", "ends with", "equals", "not equals"].includes(props.operator)) {
        return (
            <div className="flex flex-row gap-1">
                <input type="text" value={props.value} onChange={(e) => props.handleOnChange(e.target.value)} />
            </div>
        );
    }

    return <ValueEditor {...props} />;
}

const QB_CONTROL_ELEMENTS = {
    valueEditor: FilterValueEditor,
};

const QB_CONTROL_CLASSNAMES = {
    queryBuilder: "qb-modern-compact queryBuilder-branches queryBuilder-responsive",
};

const QB_TRANSLATIONS = {
    addRule: { label: "+ Rule", title: "Add filter rule" },
    addGroup: { label: "+ Group", title: "Add filter group" },
    removeRule: { label: "×", title: "Remove rule" },
    removeGroup: { label: "×", title: "Remove group" },
};

export default function CQueryBuilder({ fields, query, onQueryChange }: CQueryBuilderProps) {
    const [collapseFilters, setCollapseFilters] = useState(true);

    const filterRuleCount = useMemo(() => countFilterRules(query), [query]);

    const filterFields = useMemo(() => fields?.map((field: FieldInfo) => ({
        name: field.name,
        label: field.name,
        inputType: queryBuilderDataType(field),
        valueEditorType: queryBuilderValueEditorType(field),
    })) ?? [],
        [fields],
    );

    function cycleCollapseFilters() {
        setCollapseFilters((prev) => !prev);
    }

    useEffect(() => {
    }, [query]);

    return (
        <div className="query-builder-section shrink-0">
            <div className="query-builder-section-header">
                <span className="flex items-center gap-1">
                    {collapseFilters ? <BsArrowsExpand size={14} className="cursor-pointer var(--text)" onClick={cycleCollapseFilters} /> : <BsArrowsCollapse size={14} className="cursor-pointer var(--accent)" onClick={cycleCollapseFilters} />}
                </span>
                <FaFilter size={11} style={{ color: "var(--accent)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-h)" }}>Filters</span>
                {filterRuleCount > 0 ? (
                    <button
                        type="button"
                        onClick={() => onQueryChange(EMPTY_FILTER_QUERY)}
                        className="ml-auto text-[10px] font-medium transition-colors hover:opacity-80"
                        style={{ color: "var(--text)" }}
                    >
                        Clear all
                    </button>
                ) : (
                    <span className="qb-header-hint">
                        Add rules below to filter your query results
                    </span>
                )}
            </div>

            <div
                className={`query-builder-panel${filterRuleCount === 0 ? " query-builder-panel--empty" : ""}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                hidden={collapseFilters}
            >
                <QueryBuilder
                    fields={filterFields}
                    getOperators={handleGetOperators}
                    query={query}
                    onQueryChange={onQueryChange}
                    showCombinatorsBetweenRules
                    controlClassnames={QB_CONTROL_CLASSNAMES}
                    translations={QB_TRANSLATIONS}
                    controlElements={QB_CONTROL_ELEMENTS}
                />            </div>
        </div>
    );
}
