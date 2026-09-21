import { useEffect } from "react";
import { MdClose } from "react-icons/md";

interface CInfoSideBarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Set false while a form has in-progress/unsaved input (e.g. a file picker
   * flow) — a stray click on the backdrop (including "ghost clicks" some
   * browsers deliver right after a native dialog like a file picker or
   * alert() closes) would otherwise silently discard it. Defaults to true. */
  closeOnBackdropClick?: boolean;
}

export default function CInfoSideBar({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  closeOnBackdropClick = true,
}: CInfoSideBarProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeOnBackdropClick ? onClose : undefined}
        className="fixed inset-0 z-30 transition-opacity duration-200"
        style={{
          background: "rgba(23,22,20,0.35)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-[400px] max-w-full flex-col transition-transform duration-200"
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-3)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold" style={{ color: "var(--text)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 truncate text-[13px]" style={{ color: "var(--text-3)" }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--r-sm)] p-1 transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-3)" }}
          >
            <MdClose size={17} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="px-5 py-3.5"
            style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
