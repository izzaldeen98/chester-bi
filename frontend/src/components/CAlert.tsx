type AlertVariant = "error" | "success" | "warning" | "info";

interface CAlertProps {
  variant?: AlertVariant;
  message: string;
  className?: string;
}

const spec: Record<AlertVariant, { fg: string; bg: string }> = {
  error:   { fg: "var(--danger)", bg: "var(--danger-soft)" },
  success: { fg: "var(--ok)",     bg: "var(--ok-soft)" },
  warning: { fg: "var(--warn)",   bg: "var(--warn-soft)" },
  info:    { fg: "var(--text-2)", bg: "var(--surface-2)" },
};

export default function CAlert({ variant = "info", message, className = "" }: CAlertProps) {
  const { fg, bg } = spec[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`settle flex items-start gap-2.5 px-3 py-2.5 text-[13px] leading-relaxed ${className}`}
      style={{ background: bg, borderRadius: "var(--r)", color: "var(--text)" }}
    >
      <span aria-hidden className="mt-[7px] block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: fg }} />
      <p className="min-w-0">{message}</p>
    </div>
  );
}
