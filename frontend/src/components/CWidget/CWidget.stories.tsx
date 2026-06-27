import type { Meta, StoryObj } from "@storybook/react"; // Import from core @storybook/react
import CWidget from "./CWidget";
import React from "react";

const meta: Meta<typeof CWidget> = {
  title: "Components/CWidget",
  component: CWidget,
  tags: ["autodocs"],
  argTypes: {
    id: { control: "text" },
    query: { control: "text" },
    data: { control: "object" },
    onDelete: { action: "deleted" },
    onQueryChange: { action: "queryChanged" },
  },
};

export default meta;
type Story = StoryObj<typeof CWidget>;

// Create a Default story variant with initial mock values
export const Default: Story = {
  args: {
    id: "widget-01",
    query: "Monthly revenue",
    data: { revenue: 45000 },
  },
};
