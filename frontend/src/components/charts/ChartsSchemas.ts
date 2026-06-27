
export const CardSchema= {
    chartType: "card",
    fields: [
        {
            name: "title",
            inputType : "text",
            label : "Title",
            placeholder : "Enter title",
            required : false,
        }
        ,
        {
            name : "titleFontSize",
            inputType : "number",
            label : "Title Font Size",
            placeholder : "Enter title font size",
            required : false,
        },
        {
            name : "titleFontColor",
            inputType : "color",
            label : "Title Font Color",
            placeholder : "Enter title font color",
            required : false,
        },
        {
            name : "value",
            inputType : "select",
            label : "Value",
            placeholder : "Enter value",
            required : true,
        },
        {
            name : "valueFontSize",
            inputType : "number",
            label : "Value Font Size",
            placeholder : "Enter value font size",
            required : false,
        },
        {
            name : "valueFontColor",
            inputType : "color",
            label : "Value Font Color",
            placeholder : "Enter value font color",
            required : false,
        },
        {
            name : "valueFormat",
            inputType : "select",
            label : "Value Format",
            placeholder : "Select value format",
            required : false,
        },
        {
            name : "hasTarget",
            inputType : "switch",
            label : "Has Target",
            placeholder : "Has target",
            required : false,
            defaultValue : "false",
        },
        {
            name : "target",
            inputType : "text",
            label : "Target",
            placeholder : "Enter target",
            required : false,
            showWhen : "hasTarget",
        },
        {
            name : "targetFormat",
            inputType : "select",
            label : "Target Format",
            placeholder : "Select target format",
            required : false,
            showWhen : "hasTarget",
        },
        {
            name : "targetBarColor",
            inputType : "color",
            label : "Target Bar Color",
            placeholder : "Enter target bar color",
            required : false,
            showWhen : "hasTarget",
        },
    ]
}

export const LineChartSchema= {
    chartType: "line",
    fields: [
        {
            name: "title",
            inputType : "text",
            label : "Title",
            placeholder : "Enter title",
            required : false,
        },
        {
            name: "titleFontSize",
            inputType : "number",
            label : "Title Font Size",
            placeholder : "Enter title font size",
            required : false,
        },
        {
            name: "titleFontColor",
            inputType : "color",
            label : "Title Font Color",
            placeholder : "Enter title font color",
            required : false,
        }
        ,
        {
            name : "lineType",
            inputType : "select",
            label : "Line Type",
            placeholder : "Select line type",
            required : false,
            options : [
                { value: "smooth", label: "Smooth" },
                { value: "straight", label: "Straight" },
                

            ],
        },
        {
            name: "xAxis",
            inputType : "select",
            label : "X Axis",
            placeholder : "Enter x axis",
            required : true,
        },
        {
            name:"xAxisColor",
            inputType : "color",
            label : "X Axis Color",
            placeholder : "Enter x axis color",
            required : false,
        },
        
        {
            name: "yAxis",
            inputType : "multi-select",
            label : "Y Axis",
            placeholder : "Enter y axis",
            required : true,
        },
        {
            name: "yAxisColor",
            inputType : "multi-color",
            label : "Y Axis Color",
            placeholder : "Enter y axis color",
            required : false,
        },
        {
            name : "legend",
            inputType : "multi-text",
            label : "Legend",
            placeholder : "Enter legend",
            required : false,
        },

    ]
}

export const BarChartSchema = {
    chartType: "bar",
    fields: [
        {
            name: "title",
            inputType: "text",
            label: "Title",
            placeholder: "Enter title",
            required: false,
        },
        {
            name: "titleFontSize",
            inputType: "number",
            label: "Title Font Size",
            placeholder: "Enter title font size",
            required: false,
        },
        {
            name: "titleFontColor",
            inputType: "color",
            label: "Title Font Color",
            placeholder: "Enter title font color",
            required: false,
        },
        {
            name: "barOrientation",
            inputType: "select",
            label: "Orientation",
            placeholder: "Select orientation",
            required: false,
            defaultValue: "vertical",
            options: [
                { value: "vertical", label: "Vertical" },
                { value: "horizontal", label: "Horizontal" },
            ],
        },
        {
            name: "stacked",
            inputType: "switch",
            label: "Stacked",
            placeholder: "Stack series",
            required: false,
            defaultValue: "false",
        },
        {
            name: "xAxis",
            inputType: "select",
            label: "X Axis",
            placeholder: "Enter x axis",
            required: true,
        },
        {
            name: "xAxisColor",
            inputType: "color",
            label: "X Axis Color",
            placeholder: "Enter x axis color",
            required: false,
        },
        {
            name: "yAxis",
            inputType: "multi-select",
            label: "Y Axis",
            placeholder: "Enter y axis",
            required: true,
        },
        {
            name: "yAxisColor",
            inputType: "multi-color",
            label: "Y Axis Color",
            placeholder: "Enter y axis color",
            required: false,
        },
        {
            name: "legend",
            inputType: "multi-text",
            label: "Legend",
            placeholder: "Enter legend",
            required: false,
        },
    ],
};