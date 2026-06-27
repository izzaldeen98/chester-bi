import { useState, type MouseEvent, type ReactNode } from "react";
import { IoBarChartSharp } from "react-icons/io5";
import { MdDragIndicator, MdClose, MdEdit } from "react-icons/md";
import WidgetEditDialog, { type WidgetChartConfig, type WidgetSaveResult } from "../WidgetEditDialog";

interface CWidgetProps {
  id: string;
  title?: string;
  query?: string;
  config?: WidgetChartConfig;
  chart?: ReactNode;
  onConfigChange?: (result: WidgetSaveResult) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onDrag?: (event: MouseEvent<HTMLDivElement>) => void;
}

export default function CWidget({
  id,
  title,
  query,
  config,
  chart,
  onConfigChange,
  onDelete,
  onEdit,
}: CWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);

  function openEdit(e?: MouseEvent) {
    e?.stopPropagation();
    setEditOpen(true);
    onEdit?.();
  }

  return (
    <>
      <div className="flex flex-col h-full p-1 border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between flex-row mb-2">
          <div className="widget-drag-handle flex cursor-grab items-center gap-2 active:cursor-grabbing">
            <MdDragIndicator size={16} className="text-gray-400 flex-shrink-0" />
            {title && (
              <span className="truncate text-xs font-medium text-gray-700">{title}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openEdit}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 hover:bg-gray-100 rounded transition"
              title="Edit"
            >
              <MdEdit size={16} className="text-gray-500 flex-shrink-0" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 hover:bg-gray-100 rounded transition"
              title="Delete"
            >
              <MdClose size={16} className="text-gray-500 flex-shrink-0" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-200 min-h-0">
          {chart ?? (
            <div className="flex items-center justify-center gap-2 flex-col">
              <span className="text-gray-400 text-sm">
                {query ? query : "No chart data provided"}
              </span>
              <button
                type="button"
                onClick={openEdit}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 hover:bg-gray-100 rounded transition cursor-pointer text-gray-500 flex-shrink-0"
                title="Edit"
              >
                <IoBarChartSharp size={24} style={{ color: "var(--text)", flexShrink: 0 }} />
              </button>
            </div>
          )}
        </div>
      </div>

      <WidgetEditDialog
        isOpen={editOpen}
        widgetTitle={title ?? `Widget ${id}`}
        initialConfig={config}
        onClose={() => setEditOpen(false)}
        onSave={(result) => {
          if (result) onConfigChange?.(result);
        }}
      />
    </>
  );
}
