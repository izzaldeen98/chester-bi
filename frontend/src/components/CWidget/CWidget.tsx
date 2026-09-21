import { useState, type MouseEvent, type ReactNode } from "react";
import { IoBarChartSharp } from "react-icons/io5";
import { MdDragIndicator, MdClose, MdEdit, MdAutoAwesome } from "react-icons/md";
import WidgetEditDialog, { type WidgetChartConfig, type WidgetSaveResult } from "../WidgetEditDialog";

export type { WidgetChartConfig };

interface CWidgetProps {
  id: string;
  title?: string;
  query?: string;
  config?: WidgetChartConfig;
  chart?: ReactNode;
  readOnly?: boolean;
  onConfigChange?: (result: WidgetSaveResult) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  /** Opens the per-component AI chat. Button is hidden when not provided. */
  onPrompt?: () => void;
  onDrag?: (event: MouseEvent<HTMLDivElement>) => void;
}

export default function CWidget({
  id,
  title,
  query,
  config,
  chart,
  readOnly = false,
  onConfigChange,
  onDelete,
  onEdit,
  onPrompt,
}: CWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);

  function openEdit(e?: MouseEvent) {
    if (readOnly) return;
    e?.stopPropagation();
    setEditOpen(true);
    onEdit?.();
  }

  return (
    <div className="pointer-events-none flex h-full w-full min-h-0 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm">
      {!readOnly && (
        <div className="widget-drag-handle pointer-events-auto relative z-10 flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-gray-100 bg-white px-1 py-1 active:cursor-grabbing">
          <div className="flex min-w-0 items-center gap-2">
            <MdDragIndicator size={16} className="shrink-0 text-gray-400" />
            {title && (
              <span className="truncate text-xs font-medium text-gray-700">{title}</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onPrompt && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrompt();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 rounded transition hover:bg-gray-100"
                title="Prompt this component"
              >
                <MdAutoAwesome size={16} className="text-gray-500" />
              </button>
            )}
            <button
              type="button"
              onClick={openEdit}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded transition hover:bg-gray-100"
              title="Edit"
            >
              <MdEdit size={16} className="text-gray-500" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded transition hover:bg-gray-100"
              title="Delete"
            >
              <MdClose size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      <div className="widget-chart-area pointer-events-none relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-lg bg-gray-50">
        {chart ? (
          <div className="flex min-h-0 flex-1 flex-col">{chart}</div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {!readOnly && (
              <>
                <span className="text-sm text-gray-400">
                  {query ? query : "No chart data provided"}
                </span>
                <button
                  type="button"
                  onClick={openEdit}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="pointer-events-auto cursor-pointer rounded p-1 text-gray-500 transition hover:bg-gray-100"
                  title="Edit"
                >
                  <IoBarChartSharp size={24} />
                </button>
              </>
            )}
            {readOnly && <span className="text-sm text-gray-400">No data</span>}
          </div>
        )}
      </div>

      {!readOnly && editOpen && (
        <WidgetEditDialog
          key={`${id}-${config?.datasetId ?? "new"}-${config?.chartType ?? "none"}`}
          isOpen
          widgetTitle={title ?? `Widget ${id}`}
          initialConfig={config}
          onClose={() => setEditOpen(false)}
          onSave={(result) => {
            if (result) {
              onConfigChange?.(result);
              setEditOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
