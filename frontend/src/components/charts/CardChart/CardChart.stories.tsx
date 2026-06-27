import { Meta, StoryObj } from "@storybook/react";
import CardChart from "./CardChart";
import React from "react";

const meta: Meta<typeof CardChart> = {
  title: "Components/CardChart",
  component: CardChart,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "object" },
    value: { control: "object" },
  },
  // FIX: Provide explicit box dimensions so the internal ResizeObserver can initialize
  decorators: [
    (Story) => (
      <div className="w-[320px] h-[200px] p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CardChart>;

export const Default: Story = {
  args: {
    title: { value: "Total Sales", valueFontSize: 24, valueFontColor: "#111827" },
    value: { label: "Sales", value: 45000, valueFontSize: 24, valueFontColor: "#111827" },
  },
};

// Add an alternative size option variant to verify your scaleFont logic works
export const SmallWidget: Story = {
  args: {
    ...Default.args,
    title: { value: "Total Sales", valueFontSize: 16, valueFontColor: "#6b7280" },
    value: { label: "Sales", value: 45000, valueFontSize: 16, valueFontColor: "#6b7280" },
  },
  decorators: [
    (Story) => (
      <div className="bg-white">
        <Story />
      </div>
    ),
  ],
};
