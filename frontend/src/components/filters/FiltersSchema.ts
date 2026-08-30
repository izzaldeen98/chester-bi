// Per-kind operator schemas — mirrors components/charts/ChartsSchemas.ts:
// pure field/option data, kept separate from the dialog's UI/rendering code.

export const DateTimeFilterSchema = {
    kind: "datetime",
    operators: [
        { value: "after",       label: "After" },
        { value: "before",      label: "Before" },
        { value: "between",     label: "Between" },
        { value: "not between", label: "Not Between" },
        { value: "next",        label: "Next" },
        { value: "last",        label: "Last" },
        { value: "equals",      label: "Equals" },
        { value: "not equals",  label: "Not Equals" },
        { value: "is null",     label: "Is Null" },
        { value: "is not null", label: "Is Not Null" },
    ],
};

export const DateFilterSchema = {
    kind: "date",
    operators: DateTimeFilterSchema.operators,
};

export const NumberFilterSchema = {
    kind: "number",
    operators: [
        { value: "equals",                   label: "Equals" },
        { value: "not equals",               label: "Not Equals" },
        { value: "greater than",             label: "Greater Than" },
        { value: "greater than or equal to", label: "≥ Greater or Equal" },
        { value: "less than",                label: "Less Than" },
        { value: "less than or equal to",    label: "≤ Less or Equal" },
        { value: "between",                  label: "Between" },
        { value: "not between",              label: "Not Between" },
        { value: "is any of",                label: "Is Any Of" },
        { value: "is null",                  label: "Is Null" },
        { value: "is not null",              label: "Is Not Null" },
    ],
};

export const TextFilterSchema = {
    kind: "text",
    operators: [
        { value: "equals",          label: "Equals" },
        { value: "not equals",      label: "Not Equals" },
        { value: "contains",        label: "Contains" },
        { value: "not contains",    label: "Not Contains" },
        { value: "starts with",     label: "Starts With" },
        { value: "not starts with", label: "Not Starts With" },
        { value: "ends with",       label: "Ends With" },
        { value: "not ends with",   label: "Not Ends With" },
        { value: "is any of",       label: "Is Any Of" },
        { value: "is empty",        label: "Is Empty" },
        { value: "is not empty",    label: "Is Not Empty" },
        { value: "is null",         label: "Is Null" },
        { value: "is not null",     label: "Is Not Null" },
    ],
};
