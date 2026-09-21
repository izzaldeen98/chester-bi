import { useEffect } from "react";
import CButton from "./CButton";
import CSpinner from "./CSpinner";

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

const accent: Record<ConfirmVariant, string> = {
  danger: "var(--danger)",
  warning: "var(--warn)",
  info: "var(--text-3)",
};

export default function CConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: CConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  const color = accent[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(23,22,20,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="settle w-full max-w-md overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <div className="flex items-center gap-2.5 px-5 pb-1 pt-5">
          <span aria-hidden className="block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
            {title}
          </h2>
        </div>
        <p className="px-5 pb-5 pt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {message}
        </p>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <CButton variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </CButton>
          <CButton variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
            {loading ? <CSpinner size={13} /> : null} {confirmLabel}
          </CButton>
        </div>
      </div>
    </div>
  );
}
