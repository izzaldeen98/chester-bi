import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MdClose } from "react-icons/md";
import CButton from "./CButton";

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, saving]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-[9999] flex h-screen w-screen flex-col"
      style={{ background: "var(--bg)" }}
    >
      <header
        className="flex shrink-0 items-center gap-4 border-b px-5 py-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
      >
        <div className="min-w-0 flex-1">
          <h2
            id="dialog-title"
            className="truncate text-base font-bold"
            style={{ color: "var(--text-h)" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text)" }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CButton variant="ghost" onClick={onClose} disabled={saving} className="!px-3 !py-1.5 !text-xs">
            Cancel
          </CButton>
          {onSave && (
            <CButton
              variant="primary"
              onClick={onSave}
              loading={saving}
              disabled={saveDisabled}
              className="!px-3 !py-1.5 !text-xs"
            >
              {saveLabel}
            </CButton>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--border)] disabled:opacity-50"
            style={{ color: "var(--text)" }}
          >
            <MdClose size={18} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}
