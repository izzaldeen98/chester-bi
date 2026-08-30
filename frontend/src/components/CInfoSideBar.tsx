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
          background: "rgba(0,0,0,0.25)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-[380px] max-w-full flex-col transition-transform duration-200"
        style={{
          background: "var(--bg-subtle)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--text-h)" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-sm" style={{ color: "var(--text)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--border)]"
            style={{ color: "var(--text)" }}
          >
            <MdClose size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
