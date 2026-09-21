import { useEffect, type ReactNode } from "react";
import { MdClose } from "react-icons/md";
import CButton from "./CButton";
import CSpinner from "./CSpinner";

interface CDialogProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  children?: ReactNode;
}

/* A dialog is a service panel swung open in front of the board: steel
   head, square, with the hall darkened behind it. */
export default function CDialog({
  isOpen,
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel = "Save",
  saving = false,
  saveDisabled = false,
  children,
}: CDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(23,22,20,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="settle flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <header
          className="flex shrink-0 items-start gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--r-sm)] p-1 transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            style={{ color: "var(--text-3)" }}
          >
            <MdClose size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {onSave && (
          <footer
            className="flex shrink-0 items-center justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
          >
            <CButton variant="ghost" onClick={onClose}>
              Cancel
            </CButton>
            <CButton variant="primary" onClick={onSave} disabled={saveDisabled || saving}>
              {saving ? <CSpinner size={13} /> : null} {saveLabel}
            </CButton>
          </footer>
        )}
      </div>
    </div>
  );
}
