import type { ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

interface CButtonProps {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  className?: string;
}

/* Primary is near-black (inverted in dark), not the brand colour — the
   accent stays reserved for state and focus so it keeps its meaning. */
const styles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "var(--solid)", color: "var(--solid-ink)", border: "1px solid var(--solid)" },
  outline: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-strong)" },
  ghost:   { background: "transparent", color: "var(--text-2)", border: "1px solid transparent" },
  danger:  { background: "var(--surface)", color: "var(--danger)", border: "1px solid var(--border-strong)" },
};

const hover: Record<ButtonVariant, string> = {
  primary: "hover:bg-[var(--solid-hover)]",
  outline: "hover:bg-[var(--surface-2)]",
  ghost:   "hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  danger:  "hover:bg-[var(--danger-soft)] hover:border-[var(--danger)]",
};

export default function CButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  type = "button",
  fullWidth = false,
  className = "",
}: CButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[13px]
        font-medium transition-all duration-150 active:scale-[0.98]
        disabled:pointer-events-none disabled:opacity-45
        ${hover[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      style={{ ...styles[variant], borderRadius: "var(--r-sm)", boxShadow: variant === "primary" ? "var(--shadow-1)" : undefined }}
    >
      {children}
    </button>
  );
}
