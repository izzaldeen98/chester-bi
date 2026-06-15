import { useEffect } from "react";
import { MdClose } from "react-icons/md";
import CButton from "./CButton";

type ConfirmVariant = "danger" | "warning" | "info";

interface CConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantIcon: Record<ConfirmVariant, { bg: string; color: string; symbol: string }> = {
  danger:  { bg: "bg-red-100 dark:bg-red-900/40",    color: "text-red-600 dark:text-red-400",    symbol: "!" },
  warning: { bg: "bg-yellow-100 dark:bg-yellow-900/40", color: "text-yellow-700 dark:text-yellow-300", symbol: "!" },
  info:    { bg: "bg-blue-100 dark:bg-blue-900/40",   color: "text-blue-600 dark:text-blue-400",  symbol: "?" },
};

export default function CConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  variant      = "danger",
  loading      = false,
  onConfirm,
  onCancel,
}: CConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const vi = variantIcon[variant];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.4)" }}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Close × */}
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1 transition-colors hover:bg-[var(--border)]"
          style={{ color: "var(--text)" }}
        >
          <MdClose size={18} />
        </button>

        {/* Icon */}
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${vi.bg} ${vi.color}`}>
          {vi.symbol}
        </div>

        {/* Text */}
        <h2
          id="confirm-title"
          className="mb-1 text-base font-bold"
          style={{ color: "var(--text-h)" }}
        >
          {title}
        </h2>
        <p
          id="confirm-desc"
          className="mb-6 text-sm"
          style={{ color: "var(--text)" }}
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <CButton
            variant="danger"
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </CButton>
          <CButton
            variant="outline"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </CButton>
        </div>
      </div>
    </>
  );
}
